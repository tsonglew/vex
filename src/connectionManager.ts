import * as vscode from 'vscode';
import { VectorDBStrategy } from './strategies/VectorDBStrategy';
import { StrategyFactory } from './strategies/StrategyFactory';
import { DatabaseConnection } from './vectorDBTreeProvider';

export class ConnectionManager {
    private activeConnections = new Map<string, VectorDBStrategy>();
    private context: vscode.ExtensionContext;

    constructor( context: vscode.ExtensionContext ) {
        this.context = context;
    }

    async connectToDatabase( connection: DatabaseConnection ): Promise<void> {
        try {
            console.log( `Attempting to connect to ${connection.type} database at ${connection.host}:${connection.port}` );

            const strategy = StrategyFactory.createStrategy( connection.type );

            // Add connection timeout and retry logic
            const maxRetries = 3;
            let lastError: Error | null = null;

            for ( let attempt = 1; attempt <= maxRetries; attempt++ ) {
                try {
                    console.log( `Connection attempt ${attempt}/${maxRetries}` );

                    await strategy.connect(
                        connection.host,
                        connection.port,
                        connection.username,
                        connection.password
                    );

                    this.activeConnections.set( connection.id, strategy );
                    console.log( `Successfully connected to ${connection.type} database` );
                    return;
                } catch ( error ) {
                    lastError = error as Error;
                    console.warn( `Connection attempt ${attempt} failed:`, error );

                    if ( attempt < maxRetries ) {
                        // Wait before retrying
                        await new Promise( resolve => setTimeout( resolve, 1000 * attempt ) );
                    }
                }
            }

            // All retries failed
            throw new Error( `Failed to connect after ${maxRetries} attempts. Last error: ${lastError?.message}` );
        } catch ( error ) {
            // Clean up any partial connection
            this.activeConnections.delete( connection.id );

            // Provide user-friendly error messages
            let errorMessage = 'Unknown connection error';

            if ( error instanceof Error ) {
                if ( error.message.includes( 'UNAVAILABLE' ) ) {
                    errorMessage = `Database server at ${connection.host}:${connection.port} is not available. Please check if the server is running and accessible.`;
                } else if ( error.message.includes( 'timeout' ) ) {
                    errorMessage = `Connection to ${connection.host}:${connection.port} timed out. Please check your network connection and server status.`;
                } else if ( error.message.includes( 'ECONNREFUSED' ) ) {
                    errorMessage = `Connection refused by ${connection.host}:${connection.port}. Please verify the host and port are correct and the server is running.`;
                } else if ( error.message.includes( 'authentication' ) || error.message.includes( 'username' ) || error.message.includes( 'password' ) ) {
                    errorMessage = `Authentication failed for ${connection.host}:${connection.port}. Please check your username and password.`;
                } else {
                    errorMessage = `Failed to connect to ${connection.type} database: ${error.message}`;
                }
            } else {
                errorMessage = `Failed to connect to ${connection.type} database: ${String( error )}`;
            }

            throw new Error( errorMessage );
        }
    }

    async disconnectFromDatabase( connectionId: string ): Promise<void> {
        const strategy = this.activeConnections.get( connectionId );
        if ( strategy ) {
            try {
                await strategy.disconnect();
                console.log( `Successfully disconnected from database ${connectionId}` );
            } catch ( error ) {
                console.error( `Error during disconnect:`, error );
                // Don't throw here, just log the error
            } finally {
                this.activeConnections.delete( connectionId );
            }
        }
    }

    getConnection( connectionId: string ): VectorDBStrategy | undefined {
        return this.activeConnections.get( connectionId );
    }

    isConnected( connectionId: string ): boolean {
        return this.activeConnections.has( connectionId );
    }

    async listCollections( connectionId: string ): Promise<any[]> {
        const strategy = this.activeConnections.get( connectionId );
        if ( !strategy ) {
            throw new Error( 'Database not connected' );
        }

        try {
            return await strategy.listCollections();
        } catch ( error ) {
            console.error( 'Error listing collections:', error );
            throw new Error( `Failed to list collections: ${error}` );
        }
    }

    async createCollection( connectionId: string, name: string, dimension: number, metric: string ): Promise<void> {
        const strategy = this.activeConnections.get( connectionId );
        if ( !strategy ) {
            throw new Error( 'Database not connected' );
        }

        try {
            await strategy.createCollection( name, dimension, metric );
        } catch ( error ) {
            console.error( 'Error creating collection:', error );
            throw new Error( `Failed to create collection: ${error}` );
        }
    }

    async deleteCollection( connectionId: string, name: string ): Promise<void> {
        const strategy = this.activeConnections.get( connectionId );
        if ( !strategy ) {
            throw new Error( 'Database not connected' );
        }

        try {
            await strategy.deleteCollection( name );
        } catch ( error ) {
            console.error( 'Error deleting collection:', error );
            throw new Error( `Failed to delete collection: ${error}` );
        }
    }

    async listVectors( connectionId: string, collection: string ): Promise<any[]> {
        const strategy = this.activeConnections.get( connectionId );
        if ( !strategy ) {
            throw new Error( 'Database not connected' );
        }

        try {
            return await strategy.listVectors( collection );
        } catch ( error ) {
            console.error( 'Error listing vectors:', error );
            throw new Error( `Failed to list vectors: ${error}` );
        }
    }

    async insertVectors( connectionId: string, collection: string, vectors: number[][], ids?: string[], metadata?: any[] ): Promise<number> {
        const strategy = this.activeConnections.get( connectionId );
        if ( !strategy ) {
            throw new Error( 'Database not connected' );
        }

        try {
            return await strategy.insertVectors( collection, vectors, ids, metadata );
        } catch ( error ) {
            console.error( 'Error inserting vectors:', error );
            throw new Error( `Failed to insert vectors: ${error}` );
        }
    }

    async searchVectors( connectionId: string, collection: string, vector: number[], topK: number ): Promise<any[]> {
        const strategy = this.activeConnections.get( connectionId );
        if ( !strategy ) {
            throw new Error( 'Database not connected' );
        }

        try {
            return await strategy.searchVectors( collection, vector, topK );
        } catch ( error ) {
            console.error( 'Error searching vectors:', error );
            throw new Error( `Failed to search vectors: ${error}` );
        }
    }

    async deleteVectors( connectionId: string, collection: string, ids: string[] ): Promise<number> {
        const strategy = this.activeConnections.get( connectionId );
        if ( !strategy ) {
            throw new Error( 'Database not connected' );
        }

        try {
            return await strategy.deleteVectors( collection, ids );
        } catch ( error ) {
            console.error( 'Error deleting vectors:', error );
            throw new Error( `Failed to delete vectors: ${error}` );
        }
    }

    // Cleanup all connections
    async cleanup(): Promise<void> {
        for ( const [connectionId, strategy] of this.activeConnections ) {
            try {
                await strategy.disconnect();
            } catch ( error ) {
                console.error( `Error disconnecting from ${connectionId}:`, error );
            }
        }
        this.activeConnections.clear();
    }
}
