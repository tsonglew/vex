export interface VectorDBStrategy {
    readonly type: string;

    // Connection management
    connect( host: string, port: string, username?: string, password?: string ): Promise<void>;
    disconnect(): Promise<void>;

    // Database operations
    listDatabases(): Promise<Array<{ name: string;[key: string]: any }>>;
    createDatabase( name: string ): Promise<void>;
    deleteDatabase( name: string ): Promise<void>;
    useDatabase( name: string ): Promise<void>;

    // Collection operations
    listCollections(): Promise<Array<{ name: string;[key: string]: any }>>;
    createCollection( name: string, dimension: number, metric: string ): Promise<void>;
    deleteCollection( name: string ): Promise<void>;

    // Vector operations  
    insertVectors( collection: string, vectors: number[][], ids?: string[], metadata?: any[] ): Promise<number>;
    searchVectors( collection: string, vector: number[], topK: number ): Promise<Array<{ id: string; distance: number; vector?: number[] }>>;
    listVectors( collection: string ): Promise<Array<{ id: string; vector: number[]; metadata: any }>>;
    deleteVectors( collection: string, ids: string[] ): Promise<number>;
}
