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
            const strategy = StrategyFactory.createStrategy( connection.type );

            await strategy.connect(
                connection.host,
                connection.port,
                connection.username,
                connection.password
            );

            this.activeConnections.set( connection.id, strategy );
        } catch ( error ) {
            throw new Error( `Failed to connect to ${connection.type} database: ${error}` );
        }
    }

    async disconnectFromDatabase( connectionId: string ): Promise<void> {
        const strategy = this.activeConnections.get( connectionId );
        if ( strategy ) {
            await strategy.disconnect();
            this.activeConnections.delete( connectionId );
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

        return await strategy.listCollections();
    }

    async createCollection( connectionId: string, name: string, dimension: number, metric: string ): Promise<void> {
        const strategy = this.activeConnections.get( connectionId );
        if ( !strategy ) {
            throw new Error( 'Database not connected' );
        }

        await strategy.createCollection( name, dimension, metric );
    }

    async deleteCollection( connectionId: string, name: string ): Promise<void> {
        const strategy = this.activeConnections.get( connectionId );
        if ( !strategy ) {
            throw new Error( 'Database not connected' );
        }

        await strategy.deleteCollection( name );
    }

    async listVectors( connectionId: string, collection: string ): Promise<any[]> {
        const strategy = this.activeConnections.get( connectionId );
        if ( !strategy ) {
            throw new Error( 'Database not connected' );
        }

        return await strategy.listVectors( collection );
    }

    async insertVectors( connectionId: string, collection: string, vectors: number[][], ids?: string[], metadata?: any[] ): Promise<number> {
        const strategy = this.activeConnections.get( connectionId );
        if ( !strategy ) {
            throw new Error( 'Database not connected' );
        }

        return await strategy.insertVectors( collection, vectors, ids, metadata );
    }

    async searchVectors( connectionId: string, collection: string, vector: number[], topK: number ): Promise<any[]> {
        const strategy = this.activeConnections.get( connectionId );
        if ( !strategy ) {
            throw new Error( 'Database not connected' );
        }

        return await strategy.searchVectors( collection, vector, topK );
    }

    async deleteVectors( connectionId: string, collection: string, ids: string[] ): Promise<number> {
        const strategy = this.activeConnections.get( connectionId );
        if ( !strategy ) {
            throw new Error( 'Database not connected' );
        }

        return await strategy.deleteVectors( collection, ids );
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
