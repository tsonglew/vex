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
                            hasCollections = ( collections as any[] ).length > 0;
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
                const loadStateResponse = await this.client.getLoadState( { collection_name: collection } );
                console.log( `Load state for collection "${collection}":`, loadStateResponse );

                // Check if the collection is loaded based on the response state
                if ( loadStateResponse && loadStateResponse.state ) {
                    const state = loadStateResponse.state.toLowerCase();
                    if ( state === 'loadstateloaded' || state === 'loaded' ) {
                        console.log( `Collection "${collection}" is already loaded` );
                        return true;
                    } else if ( state === 'loadstateloading' || state === 'loading' ) {
                        console.log( `Collection "${collection}" is currently loading...` );
                        // Wait a bit and check again, or proceed as it will likely complete
                        return true;
                    } else if ( state === 'loadstatenotload' || state === 'not_load' || state === 'notloaded' ) {
                        console.log( `Collection "${collection}" is not loaded, will attempt to load it` );
                        // Continue to loading logic below
                    }
                }
            } catch ( loadStateError ) {
                // getLoadState might not be available in all Milvus versions or might fail
                console.log( 'getLoadState not available or failed, trying alternative approach:', loadStateError );
            }

            // Try to check collection existence first
            try {
                await this.client.describeCollection( { collection_name: collection } );
                console.log( `Collection "${collection}" exists` );
            } catch ( describeError ) {
                const describeErrorMsg = describeError instanceof Error ? describeError.message : String( describeError );
                if ( describeErrorMsg.toLowerCase().includes( 'not found' ) ||
                    describeErrorMsg.toLowerCase().includes( 'does not exist' ) ||
                    describeErrorMsg.toLowerCase().includes( 'not exist' ) ) {
                    throw new Error( `Collection "${collection}" does not exist` );
                }
                throw describeError;
            }

            // Collection exists but might not be loaded - try to load it directly
            // Skip query test as it may fail with "collection not loaded"

            // Collection exists but might not be loaded - try to load it
            try {
                console.log( `Loading collection "${collection}"...` );
                await this.client.loadCollection( { collection_name: collection } );
                console.log( `Collection "${collection}" loaded successfully` );
                return true;
            } catch ( loadError ) {
                const loadErrorMessage = loadError instanceof Error ? loadError.message : String( loadError );

                // Check if collection is already loaded
                if ( loadErrorMessage.toLowerCase().includes( 'already loaded' ) ||
                    loadErrorMessage.toLowerCase().includes( 'already exists' ) ) {
                    console.log( `Collection "${collection}" is already loaded` );
                    return true;
                }

                console.error( `Failed to load collection "${collection}":`, loadErrorMessage );

                // Prompt user after load failure
                const reloadChoice = await vscode.window.showInformationMessage(
                    `Failed to load collection "${collection}": ${loadErrorMessage}. Try again?`,
                    'Retry',
                    'Cancel'
                );

                if ( reloadChoice === 'Retry' ) {
                    // Add small delay and retry
                    await new Promise( resolve => setTimeout( resolve, 1000 ) );
                    await this.client.loadCollection( { collection_name: collection } );
                    console.log( `Collection "${collection}" loaded successfully on retry` );
                    return true;
                } else {
                    throw new Error( `Failed to load collection "${collection}": ${loadErrorMessage}` );
                }
            }

        } catch ( error ) {
            const errorMessage = error instanceof Error ? error.message : String( error );

            // Check for specific error patterns
            if ( errorMessage.toLowerCase().includes( 'not found' ) ||
                errorMessage.toLowerCase().includes( 'does not exist' ) ||
                errorMessage.toLowerCase().includes( 'not exist' ) ) {
                throw new Error( `Collection "${collection}" does not exist` );
            }

            // Re-throw the error if it's already our custom error
            if ( errorMessage.includes( 'Operation cancelled' ) || errorMessage.includes( 'Failed to load collection' ) ) {
                throw error;
            }

            // For other errors, provide more context
            console.error( 'Unexpected error in ensureCollectionLoaded:', error );
            throw new Error( `Failed to check collection loading status for "${collection}": ${errorMessage}` );
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

    async listVectors( collection: string, offset: number = 0, limit: number = 100 ): Promise<{ vectors: Array<{ id: string; vector: number[]; metadata: any }>; total: number; offset: number; limit: number }> {
        if ( !this.client ) {
            throw new Error( 'Milvus client not connected' );
        }

        const args = { collection, offset, limit };
        console.log( 'Listing vectors with args:', args );

        try {
            // Ensure collection is loaded before proceeding
            await this.ensureCollectionLoaded( collection );

            // Get total count first
            let total = 0;
            try {
                // Try to get collection statistics first (more efficient)
                try {
                    const statsResponse = await this.client.getCollectionStatistics( { collection_name: collection } );
                    if ( statsResponse && statsResponse.stats ) {
                        // Look for row count in stats
                        const rowCountStat = statsResponse.stats.find( ( stat: any ) => stat.key === 'row_count' );
                        if ( rowCountStat ) {
                            total = parseInt( String( rowCountStat.value ) ) || 0;
                        }
                    }
                } catch ( statsError ) {
                    console.warn( 'Collection statistics not available, trying count query:', statsError );
                }

                // If we couldn't get stats, try count query without pagination parameters
                if ( total === 0 ) {
                    try {
                        const countResponse = await this.client.query( {
                            collection_name: collection,
                            filter: '',
                            output_fields: ['count(*)']
                            // No limit parameter to avoid pagination error
                        } );
                        // Try to extract count from response
                        if ( countResponse.data && countResponse.data.length > 0 ) {
                            total = countResponse.data[0]['count(*)'] || 0;
                        }
                    } catch ( countQueryError ) {
                        console.warn( 'Count query failed, trying alternative approach:', countQueryError );

                        // Final fallback: estimate by querying with max limit
                        try {
                            const allResponse = await this.client.query( {
                                collection_name: collection,
                                output_fields: ['id'],
                                limit: 16384 // Milvus max limit
                            } );
                            total = ( allResponse.data || [] ).length;
                        } catch ( fallbackError ) {
                            console.warn( 'All count methods failed, will estimate from results:', fallbackError );
                        }
                    }
                }
            } catch ( countError ) {
                console.warn( 'Failed to get exact count, will estimate from query results:', countError );
                // We'll set total based on the actual query results
            }

            // For Milvus, we need to query the collection to get vectors
            try {
                const response = await this.client.query( {
                    collection_name: collection,
                    limit: limit,
                    offset: offset,
                    output_fields: ['*']
                } );

                const vectors = response.data || [];

                // If we couldn't get total earlier, estimate it
                if ( total === 0 && vectors.length > 0 ) {
                    if ( vectors.length < limit ) {
                        // We got fewer results than requested, so total is offset + actual results
                        total = offset + vectors.length;
                    } else {
                        // We got full page, so there might be more. Try to get a better estimate
                        total = Math.max( offset + vectors.length, offset + limit + 1 );
                    }
                }

                // Normalize vector format to match interface
                const normalizedVectors = vectors.map( ( vector: any ) => ( {
                    id: vector.id || vector._id || 'unknown',
                    vector: vector.vector || [],
                    metadata: { ...vector }
                } ) );

                console.log( `Successfully listed ${normalizedVectors.length} vectors (offset: ${offset}, limit: ${limit}, total: ${total})` );

                return {
                    vectors: normalizedVectors,
                    total: total,
                    offset: offset,
                    limit: limit
                };
            } catch ( queryError ) {
                const queryErrorMsg = queryError instanceof Error ? queryError.message : String( queryError );
                console.log( 'Query failed, trying alternative approach:', queryErrorMsg );

                // Fallback: try to get collection info and return empty result with structure
                try {
                    const collectionInfo = await this.client.describeCollection( { collection_name: collection } );
                    console.log( 'Collection info retrieved:', collectionInfo.schema?.fields?.length || 0, 'fields' );

                    return {
                        vectors: [],
                        total: 0,
                        offset: offset,
                        limit: limit
                    };
                } catch ( describeError ) {
                    console.error( 'Failed to describe collection:', describeError );
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

    // Collection management methods
    async getCollectionInfo( collection: string ): Promise<any> {
        if ( !this.client ) {
            throw new Error( 'Milvus client not connected' );
        }

        try {
            const description = await this.client.describeCollection( { collection_name: collection } );
            const loadState = await this.client.getLoadState( { collection_name: collection } );

            return {
                name: collection,
                description: description.schema?.description || '',
                fields: description.schema?.fields || [],
                consistencyLevel: description.consistency_level || 'Session',
                loadState: loadState.state || 'Unknown',
                createdTime: description.created_utc_timestamp || null,
                autoId: description.schema?.fields?.some( ( field: any ) => field.auto_id ) || false
            };
        } catch ( error ) {
            console.error( 'Error getting collection info:', error );
            throw new Error( `Failed to get collection info: ${error}` );
        }
    }

    async getCollectionStatistics( collection: string ): Promise<any> {
        if ( !this.client ) {
            throw new Error( 'Milvus client not connected' );
        }

        try {
            const stats = await this.client.getCollectionStatistics( { collection_name: collection } );
            console.log( 'Raw collection statistics:', JSON.stringify( stats, null, 2 ) );
            
            const parsedStats: any = {};

            if ( stats.stats ) {
                stats.stats.forEach( ( stat: any ) => {
                    parsedStats[stat.key] = stat.value;
                } );
            }
            
            console.log( 'Parsed statistics keys:', Object.keys( parsedStats ) );
            console.log( 'Parsed statistics values:', parsedStats );

            // Try different possible key names for better compatibility
            const rowCount = parseInt( 
                parsedStats.row_count || 
                parsedStats['row_count'] || 
                parsedStats.num_entities || 
                parsedStats['num_entities'] || 
                '0' 
            );

            // For segments, try various possible key names
            const indexedSegments = parseInt( 
                parsedStats.indexed_segments || 
                parsedStats['indexed_segments'] ||
                parsedStats.indexed_segment_count ||
                parsedStats['indexed_segment_count'] ||
                '0' 
            );

            const totalSegments = parseInt( 
                parsedStats.total_segments || 
                parsedStats['total_segments'] ||
                parsedStats.total_segment_count ||
                parsedStats['total_segment_count'] ||
                parsedStats.segment_count ||
                parsedStats['segment_count'] ||
                '0' 
            );

            // For memory and disk, try various formats
            const memorySize = 
                parsedStats.memory_size || 
                parsedStats['memory_size'] ||
                parsedStats.memory_usage ||
                parsedStats['memory_usage'] ||
                '0';

            const diskSize = 
                parsedStats.disk_size || 
                parsedStats['disk_size'] ||
                parsedStats.disk_usage ||
                parsedStats['disk_usage'] ||
                '0';

            return {
                rowCount,
                indexedSegments,
                totalSegments,
                memorySize,
                diskSize
            };
        } catch ( error ) {
            console.error( 'Error getting collection statistics:', error );
            throw new Error( `Failed to get collection statistics: ${error}` );
        }
    }

    async getIndexes( collection: string ): Promise<any[]> {
        if ( !this.client ) {
            throw new Error( 'Milvus client not connected' );
        }

        try {
            const indexes = await this.client.describeIndex( { collection_name: collection } );
            return Array.isArray( indexes ) ? indexes : [indexes];
        } catch ( error ) {
            console.error( 'Error getting indexes:', error );
            return [];
        }
    }

    async getPartitions( collection: string ): Promise<any[]> {
        if ( !this.client ) {
            throw new Error( 'Milvus client not connected' );
        }

        try {
            const partitions = await this.client.showPartitions( { collection_name: collection } );
            return partitions.partition_names?.map( ( name: string, index: number ) => ( {
                name: name,
                id: partitions.partitionIDs?.[index] || index,
                createdTime: partitions.created_utc_timestamps?.[index] || null
            } ) ) || [];
        } catch ( error ) {
            console.error( 'Error getting partitions:', error );
            return [];
        }
    }

    async createIndex( collection: string, fieldName: string, indexType: string, params: any ): Promise<void> {
        if ( !this.client ) {
            throw new Error( 'Milvus client not connected' );
        }

        try {
            await this.client.createIndex( {
                collection_name: collection,
                field_name: fieldName,
                index_type: indexType as any,
                params: params || {}
            } );
            console.log( `Index created on field "${fieldName}" with type "${indexType}"` );
        } catch ( error ) {
            console.error( 'Error creating index:', error );
            throw new Error( `Failed to create index: ${error}` );
        }
    }

    async dropIndex( collection: string, indexName: string ): Promise<void> {
        if ( !this.client ) {
            throw new Error( 'Milvus client not connected' );
        }

        try {
            await this.client.dropIndex( {
                collection_name: collection,
                index_name: indexName
            } );
            console.log( `Index "${indexName}" dropped successfully` );
        } catch ( error ) {
            console.error( 'Error dropping index:', error );
            throw new Error( `Failed to drop index: ${error}` );
        }
    }

    async createPartition( collection: string, partitionName: string ): Promise<void> {
        if ( !this.client ) {
            throw new Error( 'Milvus client not connected' );
        }

        try {
            await this.client.createPartition( {
                collection_name: collection,
                partition_name: partitionName
            } );
            console.log( `Partition "${partitionName}" created successfully` );
        } catch ( error ) {
            console.error( 'Error creating partition:', error );
            throw new Error( `Failed to create partition: ${error}` );
        }
    }

    async dropPartition( collection: string, partitionName: string ): Promise<void> {
        if ( !this.client ) {
            throw new Error( 'Milvus client not connected' );
        }

        try {
            await this.client.dropPartition( {
                collection_name: collection,
                partition_name: partitionName
            } );
            console.log( `Partition "${partitionName}" dropped successfully` );
        } catch ( error ) {
            console.error( 'Error dropping partition:', error );
            throw new Error( `Failed to drop partition: ${error}` );
        }
    }

    async loadPartition( collection: string, partitionName: string ): Promise<void> {
        if ( !this.client ) {
            throw new Error( 'Milvus client not connected' );
        }

        try {
            await this.client.loadPartitions( {
                collection_name: collection,
                partition_names: [partitionName]
            } );
            console.log( `Partition "${partitionName}" loaded successfully` );
        } catch ( error ) {
            console.error( 'Error loading partition:', error );
            throw new Error( `Failed to load partition: ${error}` );
        }
    }

    async releasePartition( collection: string, partitionName: string ): Promise<void> {
        if ( !this.client ) {
            throw new Error( 'Milvus client not connected' );
        }

        try {
            await this.client.releasePartitions( {
                collection_name: collection,
                partition_names: [partitionName]
            } );
            console.log( `Partition "${partitionName}" released successfully` );
        } catch ( error ) {
            console.error( 'Error releasing partition:', error );
            throw new Error( `Failed to release partition: ${error}` );
        }
    }
}
