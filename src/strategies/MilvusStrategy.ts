import { MilvusClient, DataType, MetricType, IndexType } from '@zilliz/milvus2-sdk-node';
import { VectorDBStrategy } from './VectorDBStrategy';

export class MilvusStrategy implements VectorDBStrategy {
    readonly type = 'milvus';
    private client: MilvusClient | undefined;

    async connect( host: string, port: string, username?: string, password?: string ): Promise<void> {
        try {
            // Handle Docker networking issue: use 127.0.0.1 instead of localhost
            const resolvedHost = host === 'localhost' ? '127.0.0.1' : host;
            const address = `${resolvedHost}:${port}`;
            console.log( `Attempting to connect to Milvus at ${address}` );

            // Simplified client configuration that works with Docker
            const clientConfig: any = {
                address,
                timeout: 30000 // 30 second timeout
            };

            if ( username && password ) {
                clientConfig.username = username;
                clientConfig.password = password;
            }

            this.client = new MilvusClient( clientConfig );

            // Test the connection with listCollections
            console.log( 'Testing connection with listCollections...' );
            const collections = await this.client.listCollections();
            console.log( `Successfully connected to Milvus. Found ${collections.data?.length || 0} collections.` );
        } catch ( error ) {
            // Clean up the client if connection fails
            this.client = undefined;
            console.error( 'Milvus connection failed:', error );

            // Provide specific guidance based on error type
            if ( error instanceof Error ) {
                if ( error.message.includes( 'UNAVAILABLE' ) ) {
                    throw new Error( `Milvus server at ${host}:${port} is unavailable. Please ensure:
1. Milvus server is running and healthy
2. Port ${port} is accessible
3. No firewall blocking the connection
4. Docker container (if used) is properly started

Try: docker ps | grep milvus` );
                } else if ( error.message.includes( 'timeout' ) ) {
                    throw new Error( `Connection to Milvus timed out. The server might be overloaded or network is slow.` );
                } else if ( error.message.includes( 'permission' ) || error.message.includes( 'authentication' ) ) {
                    throw new Error( `Authentication failed for Milvus. Check username/password or server configuration.` );
                }
            }

            throw new Error( `Failed to connect to Milvus at ${host}:${port}: ${error}` );
        }
    }

    async disconnect(): Promise<void> {
        // Milvus doesn't have explicit disconnect method, just clear the reference
        this.client = undefined;
    }

    async listCollections(): Promise<Array<{ name: string;[key: string]: any }>> {
        if ( !this.client ) {
            throw new Error( 'Milvus client not connected' );
        }

        try {
            const response = await this.client.listCollections();
            const collections = response.data?.map( ( col: any ) => ( {
                name: col.name || col,
                id: col.id || undefined
            } ) ) || [];
            console.log( `Listed ${collections.length} collections` );
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

            // Create collection with explicit schema
            await this.client.createCollection( {
                collection_name: name,
                fields: fields,
                enable_dynamic_field: false
            } );

            // Create index separately after collection creation
            await this.client.createIndex( {
                collection_name: name,
                field_name: 'vector',
                index_type: IndexType.HNSW,
                metric_type: metricMap[metric] || MetricType.COSINE,
                params: { M: 8, efConstruction: 64 }
            } );

            // Load the newly created collection to make it ready for operations
            await this.client.loadCollection( { collection_name: name } );
        } catch ( error ) {
            console.error( 'Error creating collection:', error );
            throw new Error( `Failed to create collection ${name}: ${error}` );
        }
    }

    async deleteCollection( name: string ): Promise<void> {
        if ( !this.client ) {
            throw new Error( 'Milvus client not connected' );
        }

        try {
            await this.client.dropCollection( { collection_name: name } );
        } catch ( error ) {
            console.error( 'Error deleting collection:', error );
            throw new Error( `Failed to delete collection ${name}: ${error}` );
        }
    }

    async insertVectors( collection: string, vectors: number[][], ids?: string[], metadata?: any[] ): Promise<number> {
        if ( !this.client ) {
            throw new Error( 'Milvus client not connected' );
        }

        try {
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

            const response = await this.client.insert( {
                collection_name: collection,
                data: insertData
            } );

            return Number( response.insert_cnt ) || insertData.length;
        } catch ( error ) {
            console.error( 'Error inserting vectors:', error );
            throw new Error( `Failed to insert vectors: ${error}` );
        }
    }

    async searchVectors( collection: string, vector: number[], topK: number ): Promise<any[]> {
        if ( !this.client ) {
            throw new Error( 'Milvus client not connected' );
        }

        try {
            const response = await this.client.search( {
                collection_name: collection,
                vectors: [vector],
                topk: topK,
                output_fields: ['*']
            } );

            return response.results || [];
        } catch ( error ) {
            console.error( 'Error searching vectors:', error );
            throw new Error( `Failed to search vectors: ${error}` );
        }
    }

    async listVectors( collection: string ): Promise<any[]> {
        if ( !this.client ) {
            throw new Error( 'Milvus client not connected' );
        }

        try {
            // For Milvus, we need to query the collection to get vectors
            // This is a simplified approach - in production you might want pagination
            const response = await this.client.query( {
                collection_name: collection,
                expr: 'id >= 0',
                limit: 100,
                output_fields: ['*']
            } );

            return response.data || [];
        } catch ( error ) {
            console.error( 'Error listing vectors:', error );
            throw new Error( `Failed to list vectors: ${error}` );
        }
    }

    async deleteVectors( collection: string, ids: string[] ): Promise<number> {
        if ( !this.client ) {
            throw new Error( 'Milvus client not connected' );
        }

        try {
            const response = await this.client.delete( {
                collection_name: collection,
                filter: `id in [${ids.join( ',' )}]`
            } );

            return Number( response.delete_cnt ) || 0;
        } catch ( error ) {
            console.error( 'Error deleting vectors:', error );
            throw new Error( `Failed to delete vectors: ${error}` );
        }
    }
}
