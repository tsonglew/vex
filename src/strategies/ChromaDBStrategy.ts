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

    // Database operations (ChromaDB doesn't have databases, so we'll use collections as databases)
    async listDatabases(): Promise<Array<{ name: string;[key: string]: any }>> {
        if ( !this.httpClient ) {
            throw new Error( 'ChromaDB client not connected' );
        }

        console.log( 'Listing databases (collections)...' );

        try {
            // In ChromaDB, we'll treat collections as databases
            const response = await this.httpClient.get( '/api/v1/collections' );
            const databases = response.data?.map( ( col: any ) => ( {
                name: col.name || col,
                id: col.id || col.name || col
            } ) ) || [];

            console.log( `Found ${databases.length} databases (collections)` );
            return databases;
        } catch ( error ) {
            console.error( 'Error listing databases:', error );
            return [];
        }
    }

    async createDatabase( name: string ): Promise<void> {
        if ( !this.httpClient ) {
            throw new Error( 'ChromaDB client not connected' );
        }

        const args = { name };
        console.log( 'Creating database (collection) with args:', args );

        try {
            // In ChromaDB, creating a database means creating a collection
            await this.httpClient.post( '/api/v1/collections', {
                name: name,
                metadata: {
                    'hnsw:space': 'cosine'
                }
            } );
            console.log( 'Database (collection) created successfully' );
        } catch ( error ) {
            console.error( 'Error creating database:', error );
            throw new Error( `Failed to create database with args ${JSON.stringify( args )}: ${error}` );
        }
    }

    async deleteDatabase( name: string ): Promise<void> {
        if ( !this.httpClient ) {
            throw new Error( 'ChromaDB client not connected' );
        }

        const args = { name };
        console.log( 'Deleting database (collection) with args:', args );

        try {
            // In ChromaDB, deleting a database means deleting a collection
            await this.httpClient.delete( `/api/v1/collections/${name}` );
            console.log( 'Database (collection) deleted successfully' );
        } catch ( error ) {
            console.error( 'Error deleting database:', error );
            throw new Error( `Failed to delete database with args ${JSON.stringify( args )}: ${error}` );
        }
    }

    async useDatabase( name: string ): Promise<void> {
        if ( !this.httpClient ) {
            throw new Error( 'ChromaDB client not connected' );
        }

        const args = { name };
        console.log( 'Switching to database (collection) with args:', args );

        try {
            // In ChromaDB, we'll store the current database context
            // This is a no-op for ChromaDB but maintains API compatibility
            console.log( 'Database context set (ChromaDB uses collections directly)' );
        } catch ( error ) {
            console.error( 'Error setting database context:', error );
            throw new Error( `Failed to set database context with args ${JSON.stringify( args )}: ${error}` );
        }
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

        const args = { name, dimension, metric };
        console.log( 'Creating ChromaDB collection with args:', args );

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
            console.log( 'ChromaDB collection created successfully' );
        } catch ( error ) {
            console.error( 'Error creating ChromaDB collection:', error );
            throw new Error( `Failed to create ChromaDB collection with args ${JSON.stringify( args )}: ${error}` );
        }
    }

    async deleteCollection( name: string ): Promise<void> {
        if ( !this.httpClient ) {
            throw new Error( 'ChromaDB client not connected' );
        }

        const args = { name };
        console.log( 'Deleting ChromaDB collection with args:', args );

        try {
            await this.httpClient.delete( `/api/v1/collections/${name}` );
            console.log( 'ChromaDB collection deleted successfully' );
        } catch ( error ) {
            console.error( 'Error deleting ChromaDB collection:', error );
            throw new Error( `Failed to delete ChromaDB collection with args ${JSON.stringify( args )}: ${error}` );
        }
    }

    async insertVectors( collection: string, vectors: number[][], ids?: string[], metadata?: any[] ): Promise<number> {
        if ( !this.httpClient ) {
            throw new Error( 'ChromaDB client not connected' );
        }

        const args = {
            collection,
            vectorCount: vectors.length,
            vectorDimension: vectors[0]?.length || 0,
            hasIds: !!ids?.length,
            hasMetadata: !!metadata?.length
        };
        console.log( 'Inserting ChromaDB vectors with args:', args );

        const vectorIds = ids || vectors.map( ( _, index ) => `${Date.now()}_${index}` );
        const documents = vectors.map( ( _, index ) => `document_${index}` );

        try {
            await this.httpClient.post( `/api/v1/collections/${collection}/add`, {
                ids: vectorIds,
                embeddings: vectors,
                documents: documents,
                metadatas: metadata || []
            } );

            console.log( `Successfully inserted ${vectors.length} vectors into ChromaDB` );
            return vectors.length;
        } catch ( error ) {
            console.error( 'Error inserting ChromaDB vectors:', error );
            throw new Error( `Failed to insert ChromaDB vectors with args ${JSON.stringify( args )}: ${error}` );
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
