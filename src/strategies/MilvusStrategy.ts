import { MilvusClient, DataType, MetricType, IndexType, ShowCollectionsResponse } from '@zilliz/milvus2-sdk-node';
import { VectorDBStrategy } from './VectorDBStrategy';
import * as vscode from 'vscode';

// Custom error class for collection not loaded scenarios
export class CollectionNotLoadedError extends Error {
    public readonly collectionName: string;
    
    constructor(collectionName: string, message?: string) {
        super(message || `Collection "${collectionName}" is not loaded`);
        this.name = 'CollectionNotLoadedError';
        this.collectionName = collectionName;
    }
}

// Define interfaces for different response formats we might encounter
interface DatabaseInfo {
    name: string;
    id?: string;
}

// Collection configuration interfaces
export interface CollectionConfig {
    name: string;
    description: string;
    consistencyLevel: 'Strong' | 'Session' | 'Bounded' | 'Eventually';
    enableDynamicField: boolean;
    fields: FieldDefinition[];
    vectorField: VectorFieldConfig;
    indexConfig: IndexConfig;
}

export interface FieldDefinition {
    name: string;
    dataType: string;
    isPrimaryKey: boolean;
    autoId: boolean;
    nullable: boolean;
    defaultValue?: string;
    maxLength?: number;
    description?: string;
}

export interface VectorFieldConfig {
    name: string;
    dimension: number;
    description?: string;
}

export interface IndexConfig {
    indexType: 'FLAT' | 'IVF_FLAT' | 'IVF_SQ8' | 'IVF_PQ' | 'HNSW' | 'SCANN';
    metricType: 'L2' | 'IP' | 'COSINE' | 'HAMMING' | 'JACCARD';
    params: Record<string, any>;
}


export class MilvusStrategy implements VectorDBStrategy {
    readonly type = 'milvus';
    private client: MilvusClient | undefined;

    /**
     * Map Milvus data type enum to readable string
     */
    private mapDataTypeToString( dataType: number ): string {
        const dataTypeMap: { [key: number]: string } = {
            1: 'Bool',
            2: 'Int8', 
            3: 'Int16',
            4: 'Int32',
            5: 'Int64',
            10: 'Float',
            11: 'Double',
            20: 'String',
            21: 'VarChar',
            100: 'BinaryVector',
            101: 'FloatVector'
        };
        return dataTypeMap[dataType] || `Unknown(${dataType})`;
    }

    /**
     * Handle collection not loaded error by prompting user and optionally loading
     */
    private async handleCollectionNotLoaded( collection: string ): Promise<boolean> {
        const loadChoice = await vscode.window.showInformationMessage(
            `Collection "${collection}" is not loaded. Do you want to load it to proceed?`,
            'Load Collection',
            'Cancel'
        );

        if ( loadChoice === 'Load Collection' ) {
            try {
                console.log( `Loading collection "${collection}"...` );
                const loadResponse = await this.client!.loadCollection( { collection_name: collection } );
                this.checkResponseStatus( loadResponse, 'loadCollection' );
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
                
                // Ask user if they want to retry
                const retryChoice = await vscode.window.showErrorMessage(
                    `Failed to load collection "${collection}": ${loadErrorMessage}. Try again?`,
                    'Retry',
                    'Cancel'
                );

                if ( retryChoice === 'Retry' ) {
                    await new Promise( resolve => setTimeout( resolve, 1000 ) );
                    await this.client!.loadCollection( { collection_name: collection } );
                    console.log( `Collection "${collection}" loaded successfully on retry` );
                    return true;
                } else {
                    throw new Error( `Failed to load collection "${collection}": ${loadErrorMessage}` );
                }
            }
        }
        
        return false; // User declined to load
    }
    private checkResponseStatus( response: any, operation: string = 'operation' ): void {
        const code = response?.status?.code ?? 0;
        const error_code = response?.error_code ?? 'Success';
        const reason = response?.status?.reason ?? '';
        if ( code !== 0 && error_code.toLowerCase() !== 'success') {
            throw new Error( `Milvus ${operation} failed (error code: ${code}): ${reason}` );
        }
    }

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

            // Check response status first
            this.checkResponseStatus( response, 'listDatabases' );

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
            const response = await this.client.createDatabase( { db_name: name } );

            // Check response status
            this.checkResponseStatus( response, 'createDatabase' );

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
            const response = await this.client.dropDatabase( { db_name: name } );

            // Check response status
            this.checkResponseStatus( response, 'dropDatabase' );

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
            const response = await this.client.useDatabase( { db_name: name } );

            // Check response status
            this.checkResponseStatus( response, 'useDatabase' );

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

            // Check response status
            this.checkResponseStatus( response, 'listCollections' );

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

    async createCollection( name: string, dimension: number, metric: string ): Promise<void>;
    async createCollection( config: CollectionConfig ): Promise<void>;
    async createCollection( nameOrConfig: string | CollectionConfig, dimension?: number, metric?: string ): Promise<void> {
        if ( !this.client ) {
            throw new Error( 'Milvus client not connected' );
        }

        // Handle both legacy and new API calls
        let config: CollectionConfig;
        if ( typeof nameOrConfig === 'string' ) {
            // Legacy API call - convert to new format
            config = {
                name: nameOrConfig,
                description: '',
                consistencyLevel: 'Session',
                enableDynamicField: false,
                fields: [{
                    name: 'id',
                    dataType: 'Int64',
                    isPrimaryKey: true,
                    autoId: true,
                    nullable: false,
                    description: 'Primary key field'
                }],
                vectorField: {
                    name: 'vector',
                    dimension: dimension!,
                    description: 'Vector embeddings field'
                },
                indexConfig: {
                    indexType: 'HNSW',
                    metricType: metric === 'cosine' ? 'COSINE' : metric === 'euclidean' ? 'L2' : 'IP',
                    params: { M: 8, efConstruction: 64 }
                }
            };
        } else {
            config = nameOrConfig;
        }

        console.log( 'Creating collection with config:', config );

        try {
            // Map data types from form to Milvus DataType enum
            const dataTypeMap: { [key: string]: DataType } = {
                'Bool': DataType.Bool,
                'Int8': DataType.Int8,
                'Int16': DataType.Int16,
                'Int32': DataType.Int32,
                'Int64': DataType.Int64,
                'Float': DataType.Float,
                'Double': DataType.Double,
                'VarChar': DataType.VarChar,
                'JSON': DataType.JSON
            };

            // Map metric types
            const metricMap: { [key: string]: MetricType } = {
                'L2': MetricType.L2,
                'IP': MetricType.IP,
                'COSINE': MetricType.COSINE,
                'HAMMING': MetricType.HAMMING,
                'JACCARD': MetricType.JACCARD
            };

            // Map index types
            const indexTypeMap: { [key: string]: IndexType } = {
                'FLAT': IndexType.FLAT,
                'IVF_FLAT': IndexType.IVF_FLAT,
                'IVF_SQ8': IndexType.IVF_SQ8,
                'IVF_PQ': IndexType.IVF_PQ,
                'HNSW': IndexType.HNSW,
                'SCANN': IndexType.ScaNN
            };

            // Build fields array
            const fields: any[] = [];

            // Add regular fields
            config.fields.forEach( field => {
                const fieldDef: any = {
                    name: field.name,
                    data_type: dataTypeMap[field.dataType] || DataType.VarChar,
                    is_primary_key: field.isPrimaryKey,
                    auto_id: field.autoId,
                    nullable: field.nullable
                };

                // Add max_length for VarChar fields
                if ( field.dataType === 'VarChar' && field.maxLength ) {
                    fieldDef.max_length = field.maxLength;
                }

                // Add description if provided
                if ( field.description ) {
                    fieldDef.description = field.description;
                }

                fields.push( fieldDef );
            } );

            // Add vector field
            fields.push( {
                name: config.vectorField.name,
                data_type: DataType.FloatVector,
                dim: config.vectorField.dimension,
                description: config.vectorField.description || 'Vector embeddings field'
            } );

            console.log( 'Creating collection with fields:', fields );

            // Map consistency level
            const consistencyLevelMap: { [key: string]: any } = {
                'Strong': 'Strong',
                'Session': 'Session', 
                'Bounded': 'Bounded',
                'Eventually': 'Eventually'
            };

            // Create collection with comprehensive schema
            const createCollectionParams: any = {
                collection_name: config.name,
                fields: fields,
                enable_dynamic_field: config.enableDynamicField
            };

            // Add description if provided
            if ( config.description ) {
                createCollectionParams.description = config.description;
            }

            // Add consistency level if supported
            if ( config.consistencyLevel && consistencyLevelMap[config.consistencyLevel] ) {
                createCollectionParams.consistency_level = consistencyLevelMap[config.consistencyLevel];
            }

            const createCollectionResponse = await this.client.createCollection( createCollectionParams );

            // Check response status
            this.checkResponseStatus( createCollectionResponse, 'createCollection' );

            console.log( 'Collection created, creating index...' );

            // Build index parameters based on index type
            let indexParams: any = {};
            
            switch ( config.indexConfig.indexType ) {
                case 'HNSW':
                    indexParams = {
                        M: config.indexConfig.params.M || 16,
                        efConstruction: config.indexConfig.params.efConstruction || 200
                    };
                    break;
                case 'IVF_FLAT':
                case 'IVF_SQ8':
                case 'IVF_PQ':
                    indexParams = {
                        nlist: config.indexConfig.params.nlist || 1024
                    };
                    break;
                case 'FLAT':
                default:
                    indexParams = {};
                    break;
            }

            // Create index for vector field
            const createIndexResponse = await this.client.createIndex( {
                collection_name: config.name,
                field_name: config.vectorField.name,
                index_type: indexTypeMap[config.indexConfig.indexType] || IndexType.HNSW,
                metric_type: metricMap[config.indexConfig.metricType] || MetricType.COSINE,
                params: indexParams
            } );

            // Check response status
            this.checkResponseStatus( createIndexResponse, 'createIndex' );

            console.log( 'Index created, loading collection...' );

            // Load the newly created collection to make it ready for operations
            const loadCollectionResponse = await this.client.loadCollection( { collection_name: config.name } );

            // Check response status
            this.checkResponseStatus( loadCollectionResponse, 'loadCollection' );

            console.log( 'Collection created and loaded successfully' );
        } catch ( error ) {
            console.error( 'Error creating collection:', error );
            throw new Error( `Failed to create collection "${config.name}": ${error instanceof Error ? error.message : String( error )}` );
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

                // Check response status
                this.checkResponseStatus( loadStateResponse, 'getLoadState' );

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
                        console.log( `Collection "${collection}" is not loaded, will prompt user to load it` );
                        // Continue to user confirmation logic below
                    }
                }
            } catch ( loadStateError ) {
                // getLoadState might not be available in all Milvus versions or might fail
                console.log( 'getLoadState not available or failed, trying alternative approach:', loadStateError );
            }

            // Try to check collection existence first
            try {
                const describeResponse = await this.client.describeCollection( { collection_name: collection } );

                // Check response status
                this.checkResponseStatus( describeResponse, 'describeCollection' );

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

            // Collection exists but is not loaded - prompt user for confirmation before throwing error
            const userWantsToLoad = await this.handleCollectionNotLoaded( collection );
            if ( userWantsToLoad ) {
                // Collection was successfully loaded, return true
                return true;
            } else {
                // User declined to load - throw custom error for graceful handling
                throw new CollectionNotLoadedError( collection );
            }

        } catch ( error ) {
            const errorMessage = error instanceof Error ? error.message : String( error );

            // Check for specific error patterns
            if ( errorMessage.toLowerCase().includes( 'not found' ) ||
                errorMessage.toLowerCase().includes( 'does not exist' ) ||
                errorMessage.toLowerCase().includes( 'not exist' ) ) {
                throw new Error( `Collection "${collection}" does not exist` );
            }

            // Re-throw the error if it's already our custom error or user cancelled
            if ( error instanceof CollectionNotLoadedError || 
                errorMessage.includes( 'Operation cancelled' ) || 
                errorMessage.includes( 'Failed to load collection' ) ) {
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
            // Ensure collection is loaded before proceeding (includes user confirmation)
            const isLoaded = await this.ensureCollectionLoaded( collection );
            if ( !isLoaded ) {
                // User declined to load, return 0 inserted count
                console.log( `Collection "${collection}" is not loaded, cannot insert vectors` );
                return 0;
            }

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

            // Check response status
            this.checkResponseStatus( response, 'insertVectors' );

            const insertedCount = Number( response.insert_cnt );
            console.log( `Successfully inserted ${insertedCount} vectors` );
            return insertedCount;
        } catch ( error ) {
            // Handle collection not loaded gracefully
            if ( error instanceof CollectionNotLoadedError ) {
                console.log( `Collection "${collection}" is not loaded, cannot insert vectors` );
                return 0;
            }
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
            // Ensure collection is loaded before proceeding (includes user confirmation)
            const isLoaded = await this.ensureCollectionLoaded( collection );
            if ( !isLoaded ) {
                // User declined to load, return empty results
                console.log( `Collection "${collection}" is not loaded, returning empty results` );
                return [];
            }

            const response = await this.client.search( {
                collection_name: collection,
                vectors: [vector],
                topk: topK,
                output_fields: ['*']
            } );

            // Check response status
            this.checkResponseStatus( response, 'searchVectors' );

            const results = response.results || [];
            console.log( `Search completed, found ${results.length} results` );
            return results;
        } catch ( error ) {
            // Handle collection not loaded gracefully
            if ( error instanceof CollectionNotLoadedError ) {
                console.log( `Collection "${collection}" is not loaded, returning empty results` );
                return [];
            }
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
            // Ensure collection is loaded before proceeding (includes user confirmation)
            const isLoaded = await this.ensureCollectionLoaded( collection );
            if ( !isLoaded ) {
                // User declined to load, return empty vector list
                console.log( `Collection "${collection}" is not loaded, returning empty vector list` );
                return {
                    vectors: [],
                    total: 0,
                    offset: offset,
                    limit: limit
                };
            }

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
            // Handle collection not loaded gracefully
            if ( error instanceof CollectionNotLoadedError ) {
                console.log( `Collection "${collection}" is not loaded, returning empty vector list` );
                return {
                    vectors: [],
                    total: 0,
                    offset: offset,
                    limit: limit
                };
            }
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
            // Ensure collection is loaded before proceeding (includes user confirmation)
            const isLoaded = await this.ensureCollectionLoaded( collection );
            if ( !isLoaded ) {
                // User declined to load, return 0 deleted count
                console.log( `Collection "${collection}" is not loaded, cannot delete vectors` );
                return 0;
            }

            const response = await this.client.delete( {
                collection_name: collection,
                filter: `id in [${ids.join( ',' )}]`
            } );

            // Check response status
            this.checkResponseStatus( response, 'deleteVectors' );

            const deletedCount = Number( response.delete_cnt ) || 0;
            console.log( `Successfully deleted ${deletedCount} vectors` );
            return deletedCount;
        } catch ( error ) {
            // Handle collection not loaded gracefully
            if ( error instanceof CollectionNotLoadedError ) {
                console.log( `Collection "${collection}" is not loaded, cannot delete vectors` );
                return 0;
            }
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
            // First try to ensure collection is loaded for accurate load state
            const isLoaded = await this.ensureCollectionLoaded( collection );
            if ( !isLoaded ) {
                // User declined to load, get basic info without load state
                const description = await this.client.describeCollection( { collection_name: collection } );
                
                // Map field data types to readable strings
                const mappedFields = description.schema?.fields?.map( ( field: any ) => ( {
                    ...field,
                    type: this.mapDataTypeToString( field.data_type ),
                    isPrimaryKey: field.is_primary_key || false,
                    autoId: field.auto_id || false
                } ) ) || [];
                
                return {
                    name: collection,
                    description: description.schema?.description || '',
                    fields: mappedFields,
                    consistencyLevel: description.consistency_level || 'Session',
                    loadState: 'Not Loaded',
                    createdTime: description.created_utc_timestamp || null,
                    autoId: description.schema?.fields?.some( ( field: any ) => field.auto_id ) || false
                };
            }

            const description = await this.client.describeCollection( { collection_name: collection } );
            const loadState = await this.client.getLoadState( { collection_name: collection } );

            // Map field data types to readable strings
            const mappedFields = description.schema?.fields?.map( ( field: any ) => ( {
                ...field,
                type: this.mapDataTypeToString( field.data_type ),
                isPrimaryKey: field.is_primary_key || false,
                autoId: field.auto_id || false
            } ) ) || [];

            return {
                name: collection,
                description: description.schema?.description || '',
                fields: mappedFields,
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
            // Step 1: Ensure collection is loaded (required for accurate statistics)
            const isLoaded = await this.ensureCollectionLoaded( collection );
            if ( !isLoaded ) {
                // User declined to load, return unknown statistics
                console.log( `Collection "${collection}" is not loaded, returning unknown statistics` );
                return {
                    rowCount: 'Unknown',
                    indexedSegments: 'Unknown',
                    totalSegments: 'Unknown',
                    memorySize: 'Unknown',
                    diskSize: 'Unknown'
                };
            }

            // Step 2: Flush data to disk to ensure all data is persisted
            try {
                console.log( `Flushing collection "${collection}" to ensure accurate statistics...` );
                await this.client.flush( { collection_names: [collection] } );
                console.log( `Collection "${collection}" flushed successfully` );
            } catch ( flushError ) {
                console.warn( 'Failed to flush collection, statistics might be incomplete:', flushError );
            }

            // Step 3: Get collection statistics
            const stats = await this.client.getCollectionStatistics( { collection_name: collection } );
            console.log( 'Raw collection statistics response:', JSON.stringify( stats, null, 2 ) );

            let parsedStats: any = {};

            // Handle different response formats
            if ( stats.stats && Array.isArray( stats.stats ) ) {
                stats.stats.forEach( ( stat: any ) => {
                    if ( stat.key && stat.value !== undefined ) {
                        parsedStats[stat.key] = stat.value;
                    }
                } );
            } else if ( stats.data ) {
                // Alternative response format
                parsedStats = stats.data;
            } else if ( typeof stats === 'object' && stats !== null ) {
                // Direct response format
                parsedStats = stats;
            }

            console.log( 'Parsed statistics object:', parsedStats );

            // Step 4: Get row count using alternative method if statistics are empty
            let rowCount = 0;
            const rowCountKeys = ['row_count', 'num_entities', 'entity_num'];
            for ( const key of rowCountKeys ) {
                if ( parsedStats[key] ) {
                    rowCount = parseInt( String( parsedStats[key] ) ) || 0;
                    break;
                }
            }

            // If still zero, try querying for count
            if ( rowCount === 0 ) {
                try {
                    console.log( 'Statistics show zero count, attempting direct count query...' );
                    const countResult = await this.client.query( {
                        collection_name: collection,
                        output_fields: ['count(*)']
                    } );
                    if ( countResult.data && countResult.data.length > 0 ) {
                        rowCount = parseInt( countResult.data[0]['count(*)'] ) || 0;
                        console.log( `Got row count from direct query: ${rowCount}` );
                    }
                } catch ( countError ) {
                    console.warn( 'Direct count query failed:', countError );
                }
            }

            // Parse other statistics with multiple key attempts
            const indexedSegments = parseInt( String(
                parsedStats.indexed_segments ||
                parsedStats.indexed_segment_count ||
                parsedStats['indexed segments'] ||
                '0'
            ) );

            const totalSegments = parseInt( String(
                parsedStats.total_segments ||
                parsedStats.total_segment_count ||
                parsedStats.segment_count ||
                parsedStats['total segments'] ||
                '0'
            ) );

            const memorySize = String(
                parsedStats.memory_size ||
                parsedStats.memory_usage ||
                parsedStats['memory size'] ||
                '0'
            );

            const diskSize = String(
                parsedStats.disk_size ||
                parsedStats.disk_usage ||
                parsedStats['disk size'] ||
                '0'
            );

            console.log( `Final parsed statistics: rowCount=${rowCount}, indexedSegments=${indexedSegments}, totalSegments=${totalSegments}, memorySize=${memorySize}, diskSize=${diskSize}` );

            return {
                rowCount,
                indexedSegments,
                totalSegments,
                memorySize,
                diskSize
            };
        } catch ( error ) {
            // Handle collection not loaded gracefully
            if ( error instanceof CollectionNotLoadedError ) {
                console.log( `Collection "${collection}" is not loaded, returning unknown statistics` );
                return {
                    rowCount: 'Unknown',
                    indexedSegments: 'Unknown',
                    totalSegments: 'Unknown',
                    memorySize: 'Unknown',
                    diskSize: 'Unknown'
                };
            }
            
            console.error( 'Error getting collection statistics:', error );

            // Return fallback statistics with at least the row count if possible
            try {
                console.log( 'Attempting fallback count query...' );
                const vectorsResult = await this.listVectors( collection, 0, 1 );
                return {
                    rowCount: vectorsResult.total || 0,
                    indexedSegments: 0,
                    totalSegments: 0,
                    memorySize: 'N/A',
                    diskSize: 'N/A'
                };
            } catch ( fallbackError ) {
                console.error( 'Fallback count also failed:', fallbackError );
                throw new Error( `Failed to get collection statistics: ${error}` );
            }
        }
    }

    async compactCollection( collection: string ): Promise<void> {
        if ( !this.client ) {
            throw new Error( 'Milvus client not connected' );
        }

        try {
            console.log( `Compacting collection "${collection}" to improve statistics accuracy...` );
            await this.client.compact( { collection_name: collection } );
            console.log( `Collection "${collection}" compacted successfully` );
        } catch ( error ) {
            console.error( 'Error compacting collection:', error );
            throw new Error( `Failed to compact collection: ${error}` );
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
            return partitions.partition_names?.map( ( name: string, index: number ) => {
                const rawTimestamp = partitions.created_utc_timestamps?.[index];
                let formattedTime = null;

                if ( rawTimestamp ) {
                    // Convert Unix timestamp (in milliseconds) to readable format
                    const timestamp = typeof rawTimestamp === 'string' ? parseInt( rawTimestamp ) : rawTimestamp;
                    formattedTime = new Date( timestamp ).toISOString();
                }

                return {
                    name: name,
                    id: partitions.partitionIDs?.[index] || index,
                    createdTime: formattedTime
                };
            } ) || [];
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

    // Collection-level load and release operations
    async loadCollection( collection: string ): Promise<void> {
        if ( !this.client ) {
            throw new Error( 'Milvus client not connected' );
        }

        try {
            console.log( `Loading collection "${collection}"...` );
            await this.client.loadCollection( { collection_name: collection } );
            console.log( `Collection "${collection}" loaded successfully` );
        } catch ( error ) {
            console.error( 'Error loading collection:', error );

            // Handle "already loaded" case as success
            const errorMessage = error instanceof Error ? error.message : String( error );
            if ( errorMessage.toLowerCase().includes( 'already loaded' ) ||
                errorMessage.toLowerCase().includes( 'already exists' ) ) {
                console.log( `Collection "${collection}" is already loaded` );
                return;
            }

            throw new Error( `Failed to load collection: ${error}` );
        }
    }

    async releaseCollection( collection: string ): Promise<void> {
        if ( !this.client ) {
            throw new Error( 'Milvus client not connected' );
        }

        try {
            console.log( `Releasing collection "${collection}"...` );
            await this.client.releaseCollection( { collection_name: collection } );
            console.log( `Collection "${collection}" released successfully` );
        } catch ( error ) {
            console.error( 'Error releasing collection:', error );
            throw new Error( `Failed to release collection: ${error}` );
        }
    }

    /**
     * Delete a collection with comprehensive error handling
     */
    async deleteCollection( collectionName: string ): Promise<void> {
        if ( !this.client ) {
            throw new Error( 'Milvus client not connected' );
        }

        const args = { collectionName };
        console.log( 'Deleting collection with args:', args );

        try {
            // First check if collection exists
            try {
                await this.client.describeCollection( { collection_name: collectionName } );
            } catch ( describeError ) {
                const describeErrorMsg = describeError instanceof Error ? describeError.message : String( describeError );
                if ( describeErrorMsg.toLowerCase().includes( 'not found' ) ||
                    describeErrorMsg.toLowerCase().includes( 'does not exist' ) ) {
                    throw new Error( `Collection "${collectionName}" does not exist.` );
                }
                throw describeError;
            }

            // Release collection if loaded before deletion
            try {
                await this.client.releaseCollection( { collection_name: collectionName } );
                console.log( `Collection "${collectionName}" released before deletion` );
            } catch ( releaseError ) {
                console.warn( `Could not release collection "${collectionName}" before deletion:`, releaseError );
            }

            // Drop the collection
            const dropResponse = await this.client.dropCollection( { collection_name: collectionName } );

            // Check response status
            this.checkResponseStatus( dropResponse, 'dropCollection' );

            console.log( `Collection "${collectionName}" deleted successfully` );
        } catch ( error ) {
            console.error( 'Error deleting collection:', error );
            throw new Error( `Failed to delete collection "${collectionName}": ${error instanceof Error ? error.message : String( error )}` );
        }
    }

    /**
     * Delete a field from an existing collection
     */
    async deleteField( collectionName: string, fieldName: string ): Promise<void> {
        if ( !this.client ) {
            throw new Error( 'Milvus client not connected' );
        }

        const args = { collectionName, fieldName };
        console.log( 'Deleting field with args:', args );

        try {
            // First, get the current collection schema
            const collectionInfo = await this.client.describeCollection( { collection_name: collectionName } );

            if ( !collectionInfo.schema ) {
                throw new Error( 'Could not retrieve collection schema' );
            }

            // Check if field exists
            const existingField = collectionInfo.schema.fields?.find( ( field: any ) => field.name === fieldName );
            if ( !existingField ) {
                throw new Error( `Field "${fieldName}" does not exist in collection "${collectionName}"` );
            }

            // Check if field is primary key
            if ( existingField.is_primary_key ) {
                throw new Error( `Cannot delete primary key field "${fieldName}"` );
            }

            // Create new collection with updated schema (without the field to delete)
            const newFields = collectionInfo.schema?.fields?.filter( ( field: any ) => field.name !== fieldName ) || [];
            const tempCollectionName = `${collectionName}_temp_${Date.now()}`;

            // Map consistency level string to proper type
            const consistencyLevelMap: { [key: string]: any } = {
                'Strong': 'Strong',
                'Session': 'Session',
                'Bounded': 'Bounded',
                'Eventually': 'Eventually',
                'Customized': 'Customized'
            };

            const consistencyLevel = collectionInfo.consistency_level ?
                consistencyLevelMap[collectionInfo.consistency_level as string] || 'Session' : 'Session';

            try {
                // Create new collection with updated schema
                await this.client.createCollection( {
                    collection_name: tempCollectionName,
                    fields: newFields as any,
                    consistency_level: consistencyLevel
                } );

                // Copy data from old collection to new collection (excluding the deleted field)
                try {
                    const response = await this.client.query( {
                        collection_name: collectionName,
                        output_fields: ['*'],
                        limit: 16384
                    } );

                    if ( response?.data && response.data.length > 0 ) {
                        // Remove the deleted field from each record
                        const filteredData = response.data.map( ( record: any ) => {
                            const { [fieldName]: deletedField, ...rest } = record;
                            return rest;
                        } );

                        await this.client.insert( {
                            collection_name: tempCollectionName,
                            data: filteredData
                        } );
                    }
                } catch ( copyError ) {
                    console.warn( 'Could not copy existing data:', copyError );
                }

                // Drop old collection
                await this.client.dropCollection( { collection_name: collectionName } );

                // Rename new collection to old name (create alias)
                await this.client.createAlias( {
                    collection_name: tempCollectionName,
                    alias: collectionName
                } );

                console.log( `Field "${fieldName}" deleted from collection "${collectionName}" successfully` );
            } catch ( fieldError ) {
                // Cleanup temp collection if something went wrong
                try {
                    await this.client.dropCollection( { collection_name: tempCollectionName } );
                } catch ( cleanupError ) {
                    console.warn( 'Failed to cleanup temporary collection:', cleanupError );
                }
                throw fieldError;
            }
        } catch ( error ) {
            console.error( 'Error deleting field:', error );
            throw new Error( `Failed to delete field "${fieldName}" from collection "${collectionName}": ${error instanceof Error ? error.message : String( error )}` );
        }
    }

    /**
     * Add a new field to an existing collection
     */
    async addField(
        collectionName: string,
        fieldName: string,
        fieldType: string,
        dimension?: number,
        nullable?: boolean,
        defaultValue?: string
    ): Promise<void> {
        if ( !this.client ) {
            throw new Error( 'Milvus client not connected' );
        }

        const args = { collectionName, fieldName, fieldType, dimension, nullable, defaultValue };
        console.log( 'Adding field with args:', args );

        try {
            // First, get the current collection schema to check if field already exists
            const collectionInfo = await this.client.describeCollection( { collection_name: collectionName } );

            if ( !collectionInfo.schema ) {
                throw new Error( 'Could not retrieve collection schema' );
            }

            // Check if field already exists
            const existingField = collectionInfo.schema.fields?.find( ( field: any ) => field.name === fieldName );
            if ( existingField ) {
                throw new Error( `Field "${fieldName}" already exists in collection "${collectionName}"` );
            }

            // Map string field type to DataType
            const fieldTypeMap: { [key: string]: any } = {
                'int64': DataType.Int64,
                'int32': DataType.Int32,
                'int16': DataType.Int16,
                'int8': DataType.Int8,
                'float': DataType.Float,
                'double': DataType.Double,
                'bool': DataType.Bool,
                'string': DataType.VarChar,
                'varchar': DataType.VarChar,
                'binary_vector': DataType.BinaryVector,
                'float_vector': DataType.FloatVector
            };

            const mappedType = fieldTypeMap[fieldType.toLowerCase()];
            if ( !mappedType ) {
                throw new Error( `Unsupported field type: ${fieldType}` );
            }

            // Prepare new field schema
            const newField: any = {
                name: fieldName,
                data_type: mappedType
            };

            if ( dimension && ( fieldType.toLowerCase().includes( 'vector' ) ) ) {
                newField.dim = dimension;
            }

            if ( nullable !== undefined ) {
                newField.nullable = nullable;
            }

            if ( defaultValue !== undefined ) {
                newField.default_value = defaultValue;
            }

            // Use the Milvus SDK's addCollectionField method
            const response = await this.client.addCollectionField( {
                collection_name: collectionName,
                field: newField
            } );

            // Check response status
            this.checkResponseStatus( response, 'addCollectionField' );

            console.log( `Field "${fieldName}" added to collection "${collectionName}" successfully` );
        } catch ( error ) {
            console.error( 'Error adding field:', error );
            throw new Error( `Failed to add field "${fieldName}" to collection "${collectionName}": ${error instanceof Error ? error.message : String( error )}` );
        }
    }

    /**
     * Update collection properties
     */
    async updateCollectionProperties( collectionName: string, properties: any ): Promise<void> {
        if ( !this.client ) {
            throw new Error( 'Milvus client not connected' );
        }

        const args = { collectionName, properties };
        console.log( 'Updating collection properties with args:', args );

        try {
            // Check if collection exists
            try {
                await this.client.describeCollection( { collection_name: collectionName } );
            } catch ( describeError ) {
                const describeErrorMsg = describeError instanceof Error ? describeError.message : String( describeError );
                if ( describeErrorMsg.toLowerCase().includes( 'not found' ) ||
                    describeErrorMsg.toLowerCase().includes( 'does not exist' ) ) {
                    throw new Error( `Collection "${collectionName}" does not exist.` );
                }
                throw describeError;
            }

            // Update collection properties
            // Note: alterCollection is deprecated, using the current method for compatibility
            // @ts-ignore - deprecation warning suppressed for compatibility
            await this.client.alterCollection( {
                collection_name: collectionName,
                properties: properties
            } );

            console.log( `Collection properties updated for "${collectionName}" successfully` );
        } catch ( error ) {
            console.error( 'Error updating collection properties:', error );
            throw new Error( `Failed to update collection properties for "${collectionName}": ${error instanceof Error ? error.message : String( error )}` );
        }
    }

    /**
     * Flush collection data to disk
     */
    async flushCollection( collectionName: string ): Promise<void> {
        if ( !this.client ) {
            throw new Error( 'Milvus client not connected' );
        }

        const args = { collectionName };
        console.log( 'Flushing collection with args:', args );

        try {
            // Check if collection exists
            try {
                await this.client.describeCollection( { collection_name: collectionName } );
            } catch ( describeError ) {
                const describeErrorMsg = describeError instanceof Error ? describeError.message : String( describeError );
                if ( describeErrorMsg.toLowerCase().includes( 'not found' ) ||
                    describeErrorMsg.toLowerCase().includes( 'does not exist' ) ) {
                    throw new Error( `Collection "${collectionName}" does not exist.` );
                }
                throw describeError;
            }

            await this.client.flush( { collection_names: [collectionName] } );
            console.log( `Collection "${collectionName}" flushed successfully` );
        } catch ( error ) {
            console.error( 'Error flushing collection:', error );
            throw new Error( `Failed to flush collection "${collectionName}": ${error instanceof Error ? error.message : String( error )}` );
        }
    }

    /**
     * Truncate collection data (remove all entities but keep schema)
     */
    async truncateCollection( collectionName: string ): Promise<void> {
        if ( !this.client ) {
            throw new Error( 'Milvus client not connected' );
        }

        const args = { collectionName };
        console.log( 'Truncating collection with args:', args );

        try {
            // Check if collection exists
            try {
                await this.client.describeCollection( { collection_name: collectionName } );
            } catch ( describeError ) {
                const describeErrorMsg = describeError instanceof Error ? describeError.message : String( describeError );
                if ( describeErrorMsg.toLowerCase().includes( 'not found' ) ||
                    describeErrorMsg.toLowerCase().includes( 'does not exist' ) ) {
                    throw new Error( `Collection "${collectionName}" does not exist.` );
                }
                throw describeError;
            }

            // Release collection if loaded
            try {
                await this.client.releaseCollection( { collection_name: collectionName } );
                console.log( `Collection "${collectionName}" released for truncation` );
            } catch ( releaseError ) {
                console.warn( `Could not release collection "${collectionName}" for truncation:`, releaseError );
            }

            // Delete all entities from the collection
            await this.client.delete( {
                collection_name: collectionName,
                filter: '' // Empty filter to delete all entities
            } );

            // Flush to ensure deletion is persisted
            await this.client.flush( { collection_names: [collectionName] } );

            console.log( `Collection "${collectionName}" truncated successfully` );
        } catch ( error ) {
            console.error( 'Error truncating collection:', error );
            throw new Error( `Failed to truncate collection "${collectionName}": ${error instanceof Error ? error.message : String( error )}` );
        }
    }

    /**
     * Delete all entities from a collection
     */
    async deleteAllEntities( collectionName: string ): Promise<number> {
        if ( !this.client ) {
            throw new Error( 'Milvus client not connected' );
        }

        const args = { collectionName };
        console.log( 'Deleting all entities with args:', args );

        try {
            // Check if collection exists
            try {
                await this.client.describeCollection( { collection_name: collectionName } );
            } catch ( describeError ) {
                const describeErrorMsg = describeError instanceof Error ? describeError.message : String( describeError );
                if ( describeErrorMsg.toLowerCase().includes( 'not found' ) ||
                    describeErrorMsg.toLowerCase().includes( 'does not exist' ) ) {
                    throw new Error( `Collection "${collectionName}" does not exist.` );
                }
                throw describeError;
            }

            // Ensure collection is loaded
            await this.ensureCollectionLoaded( collectionName );

            // Get total count before deletion
            let totalCount = 0;
            try {
                const countResponse = await this.client.query( {
                    collection_name: collectionName,
                    output_fields: ['count(*)']
                } );
                if ( countResponse.data && countResponse.data.length > 0 ) {
                    totalCount = parseInt( countResponse.data[0]['count(*)'] ) || 0;
                }
            } catch ( countError ) {
                console.warn( 'Could not get entity count before deletion:', countError );
            }

            if ( totalCount === 0 ) {
                console.log( `Collection "${collectionName}" is already empty` );
                return 0;
            }

            // Delete all entities
            const response = await this.client.delete( {
                collection_name: collectionName,
                filter: '' // Empty filter to delete all entities
            } );

            const deletedCount = Number( response.delete_cnt ) || totalCount;

            // Flush to ensure deletion is persisted
            await this.client.flush( { collection_names: [collectionName] } );

            console.log( `Deleted ${deletedCount} entities from collection "${collectionName}"` );
            return deletedCount;
        } catch ( error ) {
            // Handle collection not loaded by prompting user
            if ( error instanceof CollectionNotLoadedError ) {
                const loaded = await this.handleCollectionNotLoaded( collectionName );
                if ( loaded ) {
                    // Retry the operation after loading
                    return this.deleteAllEntities( collectionName );
                } else {
                    // User declined to load, return 0 deleted count
                    console.log( `Collection "${collectionName}" is not loaded, cannot delete entities` );
                    return 0;
                }
            }
            console.error( 'Error deleting all entities:', error );
            throw new Error( `Failed to delete all entities from collection "${collectionName}": ${error instanceof Error ? error.message : String( error )}` );
        }
    }

    async getDatabaseInfo(): Promise<any> {
        if ( !this.client ) {
            throw new Error( 'Milvus client not connected' );
        }

        try {
            // Get list of collections in the current database
            const collectionsResponse = await this.client.showCollections();
            const collectionNames = (collectionsResponse as any).collection_names || [];

            // Get detailed info for each collection
            const collections = await Promise.all(
                collectionNames.map(async (name: string) => {
                    try {
                        // Get basic collection info
                        const description = await this.client!.describeCollection({ collection_name: name });
                        
                        // Check load state
                        let loadState = 'Unknown';
                        try {
                            const loadStateResponse = await this.client!.getLoadState({ collection_name: name });
                            loadState = (loadStateResponse as any).state || 'Unknown';
                        } catch (error) {
                            // If we can't get load state, assume unloaded
                            loadState = 'NotLoad';
                        }

                        // Get row count (with fallback)
                        let rowCount = 0;
                        try {
                            if (loadState === 'LoadStateLoaded') {
                                const stats = await this.client!.getCollectionStatistics({ collection_name: name });
                                // Parse row count from stats array
                                const statsArray = (stats as any).stats || [];
                                const rowCountStat = statsArray.find((stat: any) => stat.key === 'row_count');
                                rowCount = parseInt(rowCountStat?.value || '0') || 0;
                            }
                        } catch (error) {
                            // If collection is not loaded or stats fail, row count remains 0
                            console.warn(`Could not get row count for collection "${name}":`, error);
                        }

                        return {
                            name,
                            loadState: loadState === 'LoadStateLoaded' ? 'Loaded' : 'Unloaded',
                            rowCount,
                            description: description.schema?.description || ''
                        };
                    } catch (error) {
                        console.warn(`Error getting info for collection "${name}":`, error);
                        return {
                            name,
                            loadState: 'Unknown',
                            rowCount: 0,
                            description: ''
                        };
                    }
                })
            );

            // Get current database name (default to 'default' if not available)
            let databaseName = 'default';
            try {
                if (this.client.listDatabases) {
                    const dbResponse = await this.client.listDatabases();
                    const dbNames = (dbResponse as any)?.db_names;
                    if (dbNames && dbNames.length > 0) {
                        databaseName = dbNames.find((name: string) => name === 'default') || dbNames[0];
                    }
                }
            } catch (error) {
                // If listDatabases is not supported or fails, use default
                console.warn('Could not get database list, using default:', error);
            }

            return {
                databaseInfo: {
                    name: databaseName,
                    description: `Milvus database containing ${collections.length} collections`,
                    collections
                }
            };
        } catch (error) {
            console.error('Error getting database info:', error);
            throw new Error(`Failed to get database info: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
