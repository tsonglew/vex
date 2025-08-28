import { MilvusClient, DataType, MetricType, IndexType } from '@zilliz/milvus2-sdk-node';
import { VectorDBStrategy } from './VectorDBStrategy';

export class MilvusStrategy implements VectorDBStrategy {
    readonly type = 'milvus';
    private client: MilvusClient | undefined;

    async connect( host: string, port: string, username?: string, password?: string ): Promise<void> {
        const address = `${host}:${port}`;
        const clientConfig: any = { address };

        if ( username && password ) {
            clientConfig.username = username;
            clientConfig.password = password;
        }

        this.client = new MilvusClient( clientConfig );

        // Test the connection by checking if server is alive
        const response = await this.client.checkHealth();
        if ( !response.isHealthy ) {
            throw new Error( 'Milvus server is not healthy' );
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

        const response = await this.client.listCollections();
        return response.data?.map( ( col: any ) => ( { name: col.name || col } ) ) || [];
    }

    async createCollection( name: string, dimension: number, metric: string ): Promise<void> {
        if ( !this.client ) {
            throw new Error( 'Milvus client not connected' );
        }

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
    }

    async deleteCollection( name: string ): Promise<void> {
        if ( !this.client ) {
            throw new Error( 'Milvus client not connected' );
        }

        await this.client.dropCollection( { collection_name: name } );
    }

    async insertVectors( collection: string, vectors: number[][], ids?: string[], metadata?: any[] ): Promise<number> {
        if ( !this.client ) {
            throw new Error( 'Milvus client not connected' );
        }

        // For auto_id collections, we must NOT include the id field at all
        const data = vectors.map( ( vector ) => {
            return {
                vector: vector
            };
        } );

        const result = await this.client.insert( {
            collection_name: collection,
            data: data
        } );
        console.log( 'result', result );

        // Check if insert operation was successful
        if ( result.status && result.status.code !== 200 ) {
            const errorMessage = result.status.reason || 'Insert operation failed';
            throw new Error( `Milvus insert failed (Code: ${result.status.code}): ${errorMessage}` );
        }

        // Flush the collection to ensure data is persisted and available for querying
        await this.client.flushSync( { collection_names: [collection] } );

        // Load the collection into memory to make it queryable
        await this.client.loadCollection( { collection_name: collection } );

        return vectors.length;
    }

    async searchVectors( collection: string, vector: number[], topK: number ): Promise<Array<{ id: string; distance: number; vector?: number[] }>> {
        if ( !this.client ) {
            throw new Error( 'Milvus client not connected' );
        }

        // Ensure collection is loaded before searching
        await this.client.loadCollection( { collection_name: collection } );

        const response = await this.client.search( {
            collection_name: collection,
            vector: vector,
            limit: topK,
            output_fields: ['id']
        } );

        return response.results?.map( result => ( {
            id: result.id?.toString() || '',
            distance: result.score || 0,
            vector: undefined // Milvus doesn't return vectors in search by default
        } ) ) || [];
    }

    async listVectors( collection: string ): Promise<Array<{ id: string; vector: number[]; metadata: any }>> {
        if ( !this.client ) {
            throw new Error( 'Milvus client not connected' );
        }

        try {
            // Ensure collection is loaded before querying
            await this.client.loadCollection( { collection_name: collection } );

            // Query all vectors (limited to first 100 for performance)
            // Use proper integer comparison for auto-generated IDs
            const response = await this.client.query( {
                collection_name: collection,
                expr: 'id >= 0',
                output_fields: ['id', 'vector'],
                limit: 100
            } );

            return response.data?.map( item => ( {
                id: item.id?.toString() || '',
                vector: item.vector || [],
                metadata: {}
            } ) ) || [];
        } catch ( error ) {
            console.error( 'Error listing vectors:', error );
            // If query fails, return empty array
            return [];
        }
    }

    async deleteVectors( collection: string, ids: string[] ): Promise<number> {
        if ( !this.client ) {
            throw new Error( 'Milvus client not connected' );
        }

        const expr = `id in [${ids.join( ',' )}]`;
        await this.client.deleteEntities( {
            collection_name: collection,
            expr: expr
        } );

        return ids.length;
    }
}
