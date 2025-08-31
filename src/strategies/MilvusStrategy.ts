import { MilvusClient, DataType, MetricType, IndexType, ListDatabasesResponse, ShowCollectionsResponse, CollectionData } from '@zilliz/milvus2-sdk-node';
import { VectorDBStrategy } from './VectorDBStrategy';
import * as vscode from 'vscode';

// Define interfaces for different response formats we might encounter
interface DatabaseInfo {
    name: string;
    id?: string;
}

interface GenericResponse {
    data?: unknown[];
    names?: string[];
    databases?: unknown[];
}

export class MilvusStrategy implements VectorDBStrategy {
    readonly type = 'milvus';
    private client: MilvusClient | undefined;

    async connect( host: string, port: string, username?: string, password?: string ): Promise<void> {
        try {
            // Handle Docker networking issue: use 127.0.0.1 instead of localhost
            const resolvedHost = host === 'localhost' ? '127.0.0.1' : host;
            const address = `${resolvedHost}:${port}`;
            console.log( `Attempting to connect to Milvus at ${address}` );

            // Enhanced client configuration with better compatibility
            const clientConfig: {
                address: string;
                timeout: number;
                channelOptions: Record<string, number | boolean>;
                username?: string;
                password?: string;
            } = {
                address,
                timeout: 10000, // Reduced timeout
                channelOptions: {
                    'grpc.keepalive_time_ms': 30000,
                    'grpc.keepalive_timeout_ms': 10000,
                    'grpc.keepalive_permit_without_calls': true,
                    'grpc.http2.max_pings_without_data': 0,
                    'grpc.http2.min_time_between_pings_ms': 10000,
                    'grpc.http2.min_ping_interval_without_data_ms': 300000
                }
            };

            if ( username && password ) {
                clientConfig.username = username;
                clientConfig.password = password;
            }

            this.client = new MilvusClient( clientConfig );

            // Test the connection with a simple health check
            console.log( 'Testing connection with checkHealth...' );
            try {
                const healthResponse = await this.client.checkHealth();
                console.log( 'Health check response:', healthResponse );
            } catch ( healthError ) {
                console.log( 'Health check failed, trying listCollections...' );
                // Fallback to listCollections if checkHealth is not available
                const collections = await this.client.listCollections();
                console.log( `Connected to Milvus. Found ${collections.data?.length || 0} collections.` );
            }

            console.log( `Successfully connected to Milvus at ${address}` );
        } catch ( error ) {
            // Clean up the client if connection fails
            this.client = undefined;
            console.error( 'Milvus connection failed:', error );

            // Provide specific guidance based on error type
            if ( error instanceof Error ) {
                if ( error.message.includes( 'UNAVAILABLE' ) || error.message.includes( 'Connection dropped' ) ) {
                    throw new Error( `Failed to connect to milvus database: ${error.message}

This error typically occurs when:
1. Milvus server is not running or not ready
2. Network connectivity issues 
3. Firewall blocking the connection
4. Wrong host/port configuration

Please ensure:
- Milvus is running: docker ps | grep milvus
- Port ${port} is accessible
- Using correct host: ${host}

For Docker setups, try starting Milvus with:
cd docker && docker-compose up -d` );
                } else if ( error.message.includes( 'timeout' ) ) {
                    throw new Error( `Connection to Milvus timed out. The server might be overloaded or network is slow.` );
                } else if ( error.message.includes( 'permission' ) || error.message.includes( 'authentication' ) ) {
                    throw new Error( `Authentication failed for Milvus. Check username/password or server configuration.` );
                }
            }

            throw new Error( `Failed to connect to milvus database: ${error instanceof Error ? error.message : String( error )}` );
        }
    }

    async disconnect(): Promise<void> {
        // Milvus doesn't have explicit disconnect method, just clear the reference
        this.client = undefined;
    }

    // Database operations
    async listDatabases(): Promise<DatabaseInfo[]> {
        if ( !this.client ) {
            throw new Error( 'Milvus client not connected' );
        }

        console.log( 'Listing databases using Milvus API...' );

        try {
            // Call the actual Milvus listDatabases API
            const response = await this.client.listDatabases();
            console.log( 'Milvus listDatabases response:', response );

            // Handle different response formats from different Milvus versions
            let databases: DatabaseInfo[] = [];

            // Standard ListDatabasesResponse format
            databases = response.db_names.map( ( name: string ) => ( {
                name: name,
                id: name
            } ) );

            // If no databases found, check if we're in a single-database setup
            if ( databases.length === 0 ) {
                console.log( 'No databases found, checking if single-database setup...' );
                try {
                    // Try to list collections to see if we're in a default database
                    const collections = await this.client.listCollections();

                    // Check if we have collections in any format
                    let hasCollections = false;
                    if ( collections && typeof collections === 'object' ) {
                        if ( 'data' in collections ) {
                            const showResponse = collections as ShowCollectionsResponse;
                            hasCollections = Array.isArray( showResponse.data ) && showResponse.data.length > 0;
                        } else if ( Array.isArray( collections ) ) {
                            hasCollections = collections.length > 0;
                        }
                    }

                    if ( hasCollections ) {
                        console.log( 'Found collections, assuming default database' );
                        databases = [{ name: 'default', id: 'default' }];
                    }
                } catch ( collectionError ) {
                    console.log( 'Could not list collections, assuming default database' );
                    databases = [{ name: 'default', id: 'default' }];
                }
            }

            console.log( `Successfully listed ${databases.length} databases from Milvus API` );
            return databases;
        } catch ( error ) {
            console.error( 'Error calling Milvus listDatabases API:', error );

            // Provide specific error information
            if ( error instanceof Error ) {
                if ( error.message.includes( 'method not found' ) || error.message.includes( 'not implemented' ) ) {
                    console.log( 'listDatabases method not supported in this Milvus version, using default database' );
                    return [{ name: 'default', id: 'default' }];
                } else if ( error.message.includes( 'permission' ) || error.message.includes( 'access' ) ) {
                    throw new Error( `Permission denied: Cannot list databases. Check your credentials and permissions.` );
                } else if ( error.message.includes( 'timeout' ) ) {
                    throw new Error( `Timeout while listing databases. The server might be overloaded.` );
                }
            }

            // For other errors, try to provide helpful information
            throw new Error( `Failed to list databases from Milvus API: ${error instanceof Error ? error.message : String( error )}` );
        }
    }

    async createDatabase( name: string ): Promise<void> {
        if ( !this.client ) {
            throw new Error( 'Milvus client not connected' );
        }

        const args = { name };
        console.log( 'Creating database using Milvus API with args:', args );

        try {
            // Call the actual Milvus createDatabase API
            await this.client.createDatabase( { db_name: name } );
            console.log( 'Database created successfully via Milvus API' );
        } catch ( error ) {
            console.error( 'Error calling Milvus createDatabase API:', error );

            // Provide specific error information
            if ( error instanceof Error ) {
                if ( error.message.includes( 'already exists' ) || error.message.includes( 'duplicate' ) ) {
                    throw new Error( `Database "${name}" already exists.` );
                } else if ( error.message.includes( 'permission' ) || error.message.includes( 'access' ) ) {
                    throw new Error( `Permission denied: Cannot create database. Check your credentials and permissions.` );
                } else if ( error.message.includes( 'invalid' ) || error.message.includes( 'name' ) ) {
                    throw new Error( `Invalid database name "${name}". Database names must be valid identifiers.` );
                }
            }

            throw new Error( `Failed to create database via Milvus API with args ${JSON.stringify( args )}: ${error instanceof Error ? error.message : String( error )}` );
        }
    }

    async deleteDatabase( name: string ): Promise<void> {
        if ( !this.client ) {
            throw new Error( 'Milvus client not connected' );
        }

        const args = { name };
        console.log( 'Deleting database using Milvus API with args:', args );

        try {
            // Call the actual Milvus dropDatabase API
            await this.client.dropDatabase( { db_name: name } );
            console.log( 'Database deleted successfully via Milvus API' );
        } catch ( error ) {
            console.error( 'Error calling Milvus dropDatabase API:', error );

            // Provide specific error information
            if ( error instanceof Error ) {
                if ( error.message.includes( 'not found' ) || error.message.includes( 'does not exist' ) ) {
                    throw new Error( `Database "${name}" does not exist.` );
                } else if ( error.message.includes( 'permission' ) || error.message.includes( 'access' ) ) {
                    throw new Error( `Permission denied: Cannot delete database. Check your credentials and permissions.` );
                } else if ( error.message.includes( 'in use' ) || error.message.includes( 'busy' ) ) {
                    throw new Error( `Database "${name}" is currently in use and cannot be deleted.` );
                }
            }

            throw new Error( `Failed to delete database via Milvus API with args ${JSON.stringify( args )}: ${error instanceof Error ? error.message : String( error )}` );
        }
    }

    async useDatabase( name: string ): Promise<void> {
        if ( !this.client ) {
            throw new Error( 'Milvus client not connected' );
        }

        const args = { name };
        console.log( 'Switching to database using Milvus API with args:', args );

        try {
            // Call the actual Milvus useDatabase API to set database context
            await this.client.useDatabase( { db_name: name } );
            console.log( 'Database context switched successfully via Milvus API' );
        } catch ( error ) {
            console.error( 'Error calling Milvus useDatabase API:', error );

            // If useDatabase is not supported in this Milvus version, log it but don't fail
            if ( error instanceof Error ) {
                if ( error.message.includes( 'method not found' ) || error.message.includes( 'not implemented' ) ) {
                    console.log( 'useDatabase method not supported in this Milvus version, will use database name in collection operations' );
                    return; // Don't throw error, just continue
                } else if ( error.message.includes( 'not found' ) || error.message.includes( 'does not exist' ) ) {
                    throw new Error( `Database "${name}" does not exist.` );
                } else if ( error.message.includes( 'permission' ) || error.message.includes( 'access' ) ) {
                    throw new Error( `Permission denied: Cannot access database. Check your credentials and permissions.` );
                }
            }

            // For other errors, throw them
            throw new Error( `Failed to switch database via Milvus API with args ${JSON.stringify( args )}: ${error instanceof Error ? error.message : String( error )}` );
        }
    }

    async listCollections(): Promise<Array<{ name: string;[key: string]: any }>> {
        if ( !this.client ) {
            throw new Error( 'Milvus client not connected' );
        }

        console.log( 'Listing collections...' );

        try {
            const response = await this.client.listCollections();
            const collections = response.data?.map( ( col: any ) => ( {
                name: col.name || col,
                id: col.id || undefined
            } ) ) || [];
            console.log( `Successfully listed ${collections.length} collections` );
            return collections;
        } catch ( error ) {
            console.error( 'Error listing collections:', error );
            throw new Error( `Failed to list collections: ${error}` );
        }
    }

    async createCollection( name: string, dimension: number, metric: string ): Promise<void> {
        if ( !this.client ) {
            throw new Error( 'Milvus client not connected' );
        }

        const args = { name, dimension, metric };
        console.log( 'Creating collection with args:', args );

        try {
            const metricMap: { [key: string]: MetricType } = {
                'cosine': MetricType.COSINE,
                'euclidean': MetricType.L2,
                'dot': MetricType.IP
            };

            const fields = [
                {
                    name: 'id',
                    data_type: DataType.Int64,
                    is_primary_key: true,
                    auto_id: true
                },
                {
                    name: 'vector',
                    data_type: DataType.FloatVector,
                    dim: dimension
                }
            ];

            console.log( 'Creating collection with fields:', fields );

            // Create collection with explicit schema
            await this.client.createCollection( {
                collection_name: name,
                fields: fields,
                enable_dynamic_field: false
            } );

            console.log( 'Collection created, creating index...' );

            // Create index separately after collection creation
            await this.client.createIndex( {
                collection_name: name,
                field_name: 'vector',
                index_type: IndexType.HNSW,
                metric_type: metricMap[metric] || MetricType.COSINE,
                params: { M: 8, efConstruction: 64 }
            } );

            console.log( 'Index created, loading collection...' );

            // Load the newly created collection to make it ready for operations
            await this.client.loadCollection( { collection_name: name } );

            console.log( 'Collection loaded successfully' );
        } catch ( error ) {
            console.error( 'Error creating collection:', error );
            throw new Error( `Failed to create collection with args ${JSON.stringify( args )}: ${error}` );
        }
    }

    async deleteCollection( name: string ): Promise<void> {
        if ( !this.client ) {
            throw new Error( 'Milvus client not connected' );
        }

        const args = { name };
        console.log( 'Deleting collection with args:', args );

        try {
            await this.client.dropCollection( { collection_name: name } );
            console.log( 'Collection deleted successfully' );
        } catch ( error ) {
            console.error( 'Error deleting collection:', error );
            throw new Error( `Failed to delete collection with args ${JSON.stringify( args )}: ${error}` );
        }
    }

    /**
     * Check if a collection is loaded and prompt user to load it if needed
     */
    private async ensureCollectionLoaded( collection: string ): Promise<boolean> {
        if ( !this.client ) {
            throw new Error( 'Milvus client not connected' );
        }

        try {
            // First try to get the load state of the collection using getLoadState
            try {
                const loadStateResponse = await this.client.getLoadState({ collection_name: collection });
                console.log(`Load state for collection "${collection}":`, loadStateResponse);
                
                // Check if the collection is loaded based on the response state
                if (loadStateResponse && loadStateResponse.state) {
                    const state = loadStateResponse.state.toLowerCase();
                    if (state === 'loadstateloaded' || state === 'loaded') {
                        console.log(`Collection "${collection}" is already loaded`);
                        return true;
                    } else if (state === 'loadstateloading' || state === 'loading') {
                        console.log(`Collection "${collection}" is currently loading...`);
                        // Wait a bit and check again, or proceed as it will likely complete
                        return true;
                    } else if (state === 'loadstatenotload' || state === 'not_load' || state === 'notloaded') {
                        console.log(`Collection "${collection}" is not loaded, will attempt to load it`);
                        // Continue to loading logic below
                    }
                }
            } catch (loadStateError) {
                // getLoadState might not be available in all Milvus versions or might fail
                console.log('getLoadState not available or failed, trying alternative approach:', loadStateError);
            }

            // Try to check collection existence first
            try {
                await this.client.describeCollection({ collection_name: collection });
                console.log(`Collection "${collection}" exists`);
            } catch (describeError) {
                const describeErrorMsg = describeError instanceof Error ? describeError.message : String(describeError);
                if (describeErrorMsg.toLowerCase().includes('not found') ||
                    describeErrorMsg.toLowerCase().includes('does not exist') ||
                    describeErrorMsg.toLowerCase().includes('not exist')) {
                    throw new Error(`Collection "${collection}" does not exist`);
                }
                throw describeError;
            }

            // Collection exists but might not be loaded - try to load it directly
            // Skip query test as it may fail with "collection not loaded"

            // Collection exists but might not be loaded - try to load it
            try {
                console.log(`Loading collection "${collection}"...`);
                await this.client.loadCollection({ collection_name: collection });
                console.log(`Collection "${collection}" loaded successfully`);
                return true;
            } catch (loadError) {
                const loadErrorMessage = loadError instanceof Error ? loadError.message : String(loadError);
                
                // Check if collection is already loaded
                if (loadErrorMessage.toLowerCase().includes('already loaded') ||
                    loadErrorMessage.toLowerCase().includes('already exists')) {
                    console.log(`Collection "${collection}" is already loaded`);
                    return true;
                }
                
                console.error(`Failed to load collection "${collection}":`, loadErrorMessage);
                
                // Prompt user after load failure
                const reloadChoice = await vscode.window.showInformationMessage(
                    `Failed to load collection "${collection}": ${loadErrorMessage}. Try again?`,
                    'Retry',
                    'Cancel'
                );
                
                if (reloadChoice === 'Retry') {
                    // Add small delay and retry
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    await this.client.loadCollection({ collection_name: collection });
                    console.log(`Collection "${collection}" loaded successfully on retry`);
                    return true;
                } else {
                    throw new Error(`Failed to load collection "${collection}": ${loadErrorMessage}`);
                }
            }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            // Check for specific error patterns
            if (errorMessage.toLowerCase().includes('not found') ||
                errorMessage.toLowerCase().includes('does not exist') ||
                errorMessage.toLowerCase().includes('not exist')) {
                throw new Error(`Collection "${collection}" does not exist`);
            }
            
            // Re-throw the error if it's already our custom error
            if (errorMessage.includes('Operation cancelled') || errorMessage.includes('Failed to load collection')) {
                throw error;
            }

            // For other errors, provide more context
            console.error('Unexpected error in ensureCollectionLoaded:', error);
            throw new Error(`Failed to check collection loading status for "${collection}": ${errorMessage}`);
        }
    }

    async insertVectors( collection: string, vectors: number[][], ids?: string[], metadata?: any[] ): Promise<number> {
        if ( !this.client ) {
            throw new Error( 'Milvus client not connected' );
        }

        const args = {
            collection,
            vectorCount: vectors.length,
            vectorDimension: vectors[0]?.length || 0,
            hasIds: !!ids?.length,
            hasMetadata: !!metadata?.length
        };
        console.log( 'Inserting vectors with args:', args );

        try {
            // Ensure collection is loaded before proceeding
            await this.ensureCollectionLoaded( collection );

            // Check collection schema to determine if it uses auto_id
            const collectionInfo = await this.client.describeCollection( { collection_name: collection } );
            const hasAutoId = collectionInfo.schema?.fields?.some( ( field: any ) => field.name === 'id' && field.auto_id );

            const insertData: any[] = [];
            vectors.forEach( ( vector, index ) => {
                const data: any = { vector };
                if ( !hasAutoId && ids && ids[index] ) {
                    data.id = parseInt( ids[index] );
                }
                if ( metadata && metadata[index] ) {
                    Object.assign( data, metadata[index] );
                }
                insertData.push( data );
            } );

            console.log( `Inserting ${insertData.length} data records` );

            const response = await this.client.insert( {
                collection_name: collection,
                data: insertData
            } );

            const insertedCount = Number( response.insert_cnt ) || insertData.length;
            console.log( `Successfully inserted ${insertedCount} vectors` );
            return insertedCount;
        } catch ( error ) {
            console.error( 'Error inserting vectors:', error );
            throw new Error( `Failed to insert vectors with args ${JSON.stringify( args )}: ${error}` );
        }
    }

    async searchVectors( collection: string, vector: number[], topK: number ): Promise<any[]> {
        if ( !this.client ) {
            throw new Error( 'Milvus client not connected' );
        }

        const args = {
            collection,
            vectorDimension: vector.length,
            topK
        };
        console.log( 'Searching vectors with args:', args );

        try {
            // Ensure collection is loaded before proceeding
            await this.ensureCollectionLoaded( collection );

            const response = await this.client.search( {
                collection_name: collection,
                vectors: [vector],
                topk: topK,
                output_fields: ['*']
            } );

            const results = response.results || [];
            console.log( `Search completed, found ${results.length} results` );
            return results;
        } catch ( error ) {
            console.error( 'Error searching vectors:', error );
            throw new Error( `Failed to search vectors with args ${JSON.stringify( args )}: ${error}` );
        }
    }

    async listVectors( collection: string ): Promise<any[]> {
        if ( !this.client ) {
            throw new Error( 'Milvus client not connected' );
        }

        const args = { collection, limit: 100 };
        console.log( 'Listing vectors with args:', args );

        try {
            // Ensure collection is loaded before proceeding
            await this.ensureCollectionLoaded( collection );

            // For Milvus, we need to query the collection to get vectors
            try {
                const response = await this.client.query( {
                    collection_name: collection,
                    limit: 100,
                    output_fields: ['*']
                } );

                const vectors = response.data || [];
                console.log( `Successfully listed ${vectors.length} vectors` );
                return vectors;
            } catch (queryError) {
                const queryErrorMsg = queryError instanceof Error ? queryError.message : String(queryError);
                console.log('Query failed, trying alternative approach:', queryErrorMsg);
                
                // Fallback: try to get collection info and return basic structure
                try {
                    const collectionInfo = await this.client.describeCollection({ collection_name: collection });
                    console.log('Collection info retrieved:', collectionInfo.schema?.fields?.length || 0, 'fields');
                    return [];
                } catch (describeError) {
                    console.error('Failed to describe collection:', describeError);
                    throw queryError; // Re-throw original query error
                }
            }
        } catch ( error ) {
            console.error( 'Error listing vectors:', error );
            throw new Error( `Failed to list vectors with args ${JSON.stringify( args )}: ${error}` );
        }
    }

    async deleteVectors( collection: string, ids: string[] ): Promise<number> {
        if ( !this.client ) {
            throw new Error( 'Milvus client not connected' );
        }

        const args = { collection, idCount: ids.length, ids: ids.slice( 0, 5 ) }; // Show first 5 IDs for logging
        console.log( 'Deleting vectors with args:', args );

        try {
            // Ensure collection is loaded before proceeding
            await this.ensureCollectionLoaded( collection );

            const response = await this.client.delete( {
                collection_name: collection,
                filter: `id in [${ids.join( ',' )}]`
            } );

            const deletedCount = Number( response.delete_cnt ) || 0;
            console.log( `Successfully deleted ${deletedCount} vectors` );
            return deletedCount;
        } catch ( error ) {
            console.error( 'Error deleting vectors:', error );
            throw new Error( `Failed to delete vectors with args ${JSON.stringify( args )}: ${error}` );
        }
    }
}
