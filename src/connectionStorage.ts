import * as vscode from 'vscode';
import { DatabaseConnection } from './vectorDBTreeProvider';

export class ConnectionStorage {
    private static readonly CONNECTIONS_KEY = 'vex.databaseConnections';
    private static readonly PASSWORD_KEY_PREFIX = 'vex.password.';

    constructor( private context: vscode.ExtensionContext ) { }

    /**
     * Save all connections to persistent storage
     * Passwords are stored separately in secure storage
     */
    async saveConnections( connections: DatabaseConnection[] ): Promise<void> {
        try {
            // Prepare connections for storage (remove sensitive data)
            const connectionsToStore = connections.map( conn => ( {
                ...conn,
                password: undefined, // Don't store password in regular state
                isConnected: false // Don't persist connection status
            } ) );

            // Save connections to global state
            await this.context.globalState.update( ConnectionStorage.CONNECTIONS_KEY, connectionsToStore );

            // Save passwords to secure storage
            for ( const conn of connections ) {
                if ( conn.password ) {
                    const passwordKey = `${ConnectionStorage.PASSWORD_KEY_PREFIX}${conn.id}`;
                    await this.context.secrets.store( passwordKey, conn.password );
                }
            }

            console.log( `Saved ${connections.length} connections to persistent storage` );
        } catch ( error ) {
            console.error( 'Failed to save connections:', error );
            vscode.window.showErrorMessage( 'Failed to save database connections' );
        }
    }

    /**
     * Load all connections from persistent storage
     * Retrieves passwords from secure storage
     */
    async loadConnections(): Promise<DatabaseConnection[]> {
        try {
            // Load connections from global state
            const storedConnections = this.context.globalState.get<DatabaseConnection[]>( ConnectionStorage.CONNECTIONS_KEY, [] );

            // Restore passwords from secure storage
            const connectionsWithPasswords = await Promise.all(
                storedConnections.map( async ( conn ) => {
                    const passwordKey = `${ConnectionStorage.PASSWORD_KEY_PREFIX}${conn.id}`;
                    const password = await this.context.secrets.get( passwordKey );

                    return {
                        ...conn,
                        password: password || undefined,
                        isConnected: false, // Always start disconnected
                        lastConnected: conn.lastConnected ? new Date( conn.lastConnected ) : undefined
                    };
                } )
            );

            console.log( `Loaded ${connectionsWithPasswords.length} connections from persistent storage` );
            return connectionsWithPasswords;
        } catch ( error ) {
            console.error( 'Failed to load connections:', error );
            vscode.window.showWarningMessage( 'Failed to load saved database connections' );
            return [];
        }
    }

    /**
     * Add a new connection and persist it
     */
    async addConnection( connection: DatabaseConnection, existingConnections: DatabaseConnection[] ): Promise<DatabaseConnection[]> {
        const updatedConnections = [...existingConnections, connection];
        await this.saveConnections( updatedConnections );
        return updatedConnections;
    }

    /**
     * Update an existing connection and persist changes
     */
    async updateConnection(
        connectionId: string,
        updates: Partial<DatabaseConnection>,
        existingConnections: DatabaseConnection[]
    ): Promise<DatabaseConnection[]> {
        const updatedConnections = existingConnections.map( conn =>
            conn.id === connectionId ? { ...conn, ...updates } : conn
        );
        await this.saveConnections( updatedConnections );
        return updatedConnections;
    }

    /**
     * Remove a connection and clean up its stored password
     */
    async removeConnection( connectionId: string, existingConnections: DatabaseConnection[] ): Promise<DatabaseConnection[]> {
        // Remove password from secure storage
        const passwordKey = `${ConnectionStorage.PASSWORD_KEY_PREFIX}${connectionId}`;
        await this.context.secrets.delete( passwordKey );

        // Remove connection from list
        const updatedConnections = existingConnections.filter( conn => conn.id !== connectionId );
        await this.saveConnections( updatedConnections );
        return updatedConnections;
    }

    /**
     * Clear all stored connections and passwords (for debugging/cleanup)
     */
    async clearAllConnections(): Promise<void> {
        try {
            // Get current connections to clean up passwords
            const connections = await this.loadConnections();

            // Delete all stored passwords
            for ( const conn of connections ) {
                const passwordKey = `${ConnectionStorage.PASSWORD_KEY_PREFIX}${conn.id}`;
                await this.context.secrets.delete( passwordKey );
            }

            // Clear connections from global state
            await this.context.globalState.update( ConnectionStorage.CONNECTIONS_KEY, undefined );

            console.log( 'Cleared all stored connections' );
        } catch ( error ) {
            console.error( 'Failed to clear connections:', error );
        }
    }

    /**
     * Check if connections are stored
     */
    hasStoredConnections(): boolean {
        const stored = this.context.globalState.get<DatabaseConnection[]>( ConnectionStorage.CONNECTIONS_KEY );
        return Array.isArray( stored ) && stored.length > 0;
    }

    /**
     * Get connection statistics for debugging
     */
    async getConnectionStats(): Promise<{ totalConnections: number; connectionsWithPasswords: number }> {
        const connections = await this.loadConnections();
        const connectionsWithPasswords = connections.filter( conn => conn.password ).length;

        return {
            totalConnections: connections.length,
            connectionsWithPasswords
        };
    }
}
