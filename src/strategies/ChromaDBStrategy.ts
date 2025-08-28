import axios, { AxiosInstance } from 'axios';
import { VectorDBStrategy } from './VectorDBStrategy';

export class ChromaDBStrategy implements VectorDBStrategy {
    readonly type = 'chroma';
    private httpClient: AxiosInstance | undefined;
    private basePath: string = '';

    async connect( host: string, port: string, username?: string, password?: string ): Promise<void> {
        this.basePath = `http://${host}:${port}`;

        // Create HTTP client
        this.httpClient = axios.create( {
            baseURL: this.basePath,
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json'
            }
        } );

        // Test connection
        try {
            await this.httpClient.get( '/api/v1/heartbeat' );
        } catch ( error ) {
            throw new Error( `Cannot connect to ChromaDB at ${this.basePath}` );
        }
    }

    async disconnect(): Promise<void> {
        this.httpClient = undefined;
        this.basePath = '';
    }

    async listCollections(): Promise<Array<{ name: string;[key: string]: any }>> {
        if ( !this.httpClient ) {
            throw new Error( 'ChromaDB client not connected' );
        }

        try {
            const response = await this.httpClient.get( '/api/v1/collections' );
            return response.data.map( ( col: any ) => ( { name: col.name } ) ) || [];
        } catch ( error ) {
            throw new Error( `Failed to list collections: ${error}` );
        }
    }

    async createCollection( name: string, dimension: number, metric: string ): Promise<void> {
        if ( !this.httpClient ) {
            throw new Error( 'ChromaDB client not connected' );
        }

        const metricMap: { [key: string]: string } = {
            'cosine': 'cosine',
            'euclidean': 'l2',
            'dot': 'ip'
        };

        try {
            await this.httpClient.post( '/api/v1/collections', {
                name: name,
                metadata: {
                    'hnsw:space': metricMap[metric] || 'cosine'
                }
            } );
        } catch ( error ) {
            throw new Error( `Failed to create collection: ${error}` );
        }
    }

    async deleteCollection( name: string ): Promise<void> {
        if ( !this.httpClient ) {
            throw new Error( 'ChromaDB client not connected' );
        }

        try {
            await this.httpClient.delete( `/api/v1/collections/${name}` );
        } catch ( error ) {
            throw new Error( `Failed to delete collection: ${error}` );
        }
    }

    async insertVectors( collection: string, vectors: number[][], ids?: string[], metadata?: any[] ): Promise<number> {
        if ( !this.httpClient ) {
            throw new Error( 'ChromaDB client not connected' );
        }

        const vectorIds = ids || vectors.map( ( _, index ) => `${Date.now()}_${index}` );
        const documents = vectors.map( ( _, index ) => `document_${index}` );

        try {
            await this.httpClient.post( `/api/v1/collections/${collection}/add`, {
                ids: vectorIds,
                embeddings: vectors,
                documents: documents,
                metadatas: metadata || []
            } );

            return vectors.length;
        } catch ( error ) {
            throw new Error( `Failed to insert vectors: ${error}` );
        }
    }

    async searchVectors( collection: string, vector: number[], topK: number ): Promise<Array<{ id: string; distance: number; vector?: number[] }>> {
        if ( !this.httpClient ) {
            throw new Error( 'ChromaDB client not connected' );
        }

        try {
            const response = await this.httpClient.post( `/api/v1/collections/${collection}/query`, {
                query_embeddings: [vector],
                n_results: topK,
                include: ['embeddings', 'distances', 'metadatas']
            } );

            const ids = response.data?.ids?.[0] || [];
            const distances = response.data?.distances?.[0] || [];
            const embeddings = response.data?.embeddings?.[0] || [];

            return ids.map( ( id: string, index: number ) => ( {
                id: id,
                distance: distances[index],
                vector: embeddings[index]
            } ) );
        } catch ( error ) {
            throw new Error( `Failed to search vectors: ${error}` );
        }
    }

    async listVectors( collection: string ): Promise<Array<{ id: string; vector: number[]; metadata: any }>> {
        if ( !this.httpClient ) {
            throw new Error( 'ChromaDB client not connected' );
        }

        try {
            const response = await this.httpClient.post( `/api/v1/collections/${collection}/get`, {
                limit: 100,
                include: ['embeddings', 'metadatas']
            } );

            const ids = response.data?.ids || [];
            const embeddings = response.data?.embeddings || [];
            const metadatas = response.data?.metadatas || [];

            return ids.map( ( id: string, index: number ) => ( {
                id: id,
                vector: embeddings[index],
                metadata: metadatas[index] || {}
            } ) );
        } catch ( error ) {
            return [];
        }
    }

    async deleteVectors( collection: string, ids: string[] ): Promise<number> {
        if ( !this.httpClient ) {
            throw new Error( 'ChromaDB client not connected' );
        }

        try {
            await this.httpClient.post( `/api/v1/collections/${collection}/delete`, {
                ids: ids
            } );

            return ids.length;
        } catch ( error ) {
            throw new Error( `Failed to delete vectors: ${error}` );
        }
    }
}
