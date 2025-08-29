import * as vscode from 'vscode';
import { ConnectionManager } from './connectionManager';
import { ConnectionStorage } from './connectionStorage';

export class VectorDBTreeProvider implements vscode.TreeDataProvider<TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | null | void> = new vscode.EventEmitter<TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private connections: DatabaseConnection[] = [];
    private connectionStorage: ConnectionStorage;

    constructor( private connectionManager: ConnectionManager, context: vscode.ExtensionContext ) {
        this.connectionStorage = new ConnectionStorage( context );
        // Load persisted connections on initialization
        this.initializeConnections();
    }

    private async initializeConnections(): Promise<void> {
        try {
            this.connections = await this.connectionStorage.loadConnections();
            this.refresh();

            if ( this.connections.length > 0 ) {
                console.log( `Loaded ${this.connections.length} persisted database connections` );
                vscode.window.showInformationMessage(
                    `Restored ${this.connections.length} database connection${this.connections.length !== 1 ? 's' : ''}`
                );
            }
        } catch ( error ) {
            console.error( 'Failed to initialize connections:', error );
            this.connections = [];
        }
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem( element: TreeItem ): vscode.TreeItem {
        return element;
    }

    getChildren( element?: TreeItem ): Thenable<TreeItem[]> {
        if ( !element ) {
            // Root level - show database connections
            return Promise.resolve( this.getDatabaseConnections() );
        }

        if ( element instanceof DatabaseConnectionItem ) {
            // Show collections for this database
            return this.getCollectionsForDatabase( element );
        }

        if ( element instanceof CollectionItem ) {
            // Show collection details (vectors, indexes, etc.)
            return Promise.resolve( [] ); // Can be expanded later for collection details
        }

        return Promise.resolve( [] );
    }

    private getDatabaseConnections(): TreeItem[] {
        if ( this.connections.length === 0 ) {
            return [new PlaceholderItem( 'No database connections', 'Click "+" to add a connection' )];
        }

        return this.connections.map( conn => new DatabaseConnectionItem( conn ) );
    }

    private async getCollectionsForDatabase( dbItem: DatabaseConnectionItem ): Promise<TreeItem[]> {
        try {
            if ( !dbItem.connection.isConnected ) {
                return [new PlaceholderItem( 'Not connected', 'Connect to view collections' )];
            }

            // Get collections for this connection
            const collections = await this.getCollectionsForConnection( dbItem.connection );

            if ( collections.length === 0 ) {
                return [new PlaceholderItem( 'No collections', 'Create a collection to get started' )];
            }

            return collections.map( collection => new CollectionItem( collection, dbItem.connection ) );
        } catch ( error ) {
            console.error( 'Error getting collections:', error );
            return [new PlaceholderItem( 'Error loading collections', error?.toString() || 'Unknown error' )];
        }
    }

    private async getCollectionsForConnection( connection: DatabaseConnection ): Promise<any[]> {
        try {
            // Only return real collections if actually connected
            if ( !connection.isConnected || !this.connectionManager.isConnected( connection.id ) ) {
                return [];
            }

            // Get real collections from the database
            return await this.connectionManager.listCollections( connection.id );
        } catch ( error ) {
            console.error( 'Error getting collections for connection:', error );
            return [];
        }
    }

    // Public methods for external management
    async addConnection( connection: DatabaseConnection ): Promise<void> {
        try {
            this.connections = await this.connectionStorage.addConnection( connection, this.connections );
            this.refresh();
        } catch ( error ) {
            console.error( 'Failed to add connection:', error );
            vscode.window.showErrorMessage( 'Failed to save database connection' );
        }
    }

    async updateConnection( id: string, updates: Partial<DatabaseConnection> ): Promise<void> {
        try {
            this.connections = await this.connectionStorage.updateConnection( id, updates, this.connections );
            this.refresh();
        } catch ( error ) {
            console.error( 'Failed to update connection:', error );
            vscode.window.showErrorMessage( 'Failed to update database connection' );
        }
    }

    async removeConnection( id: string ): Promise<void> {
        try {
            this.connections = await this.connectionStorage.removeConnection( id, this.connections );
            this.refresh();
        } catch ( error ) {
            console.error( 'Failed to remove connection:', error );
            vscode.window.showErrorMessage( 'Failed to remove database connection' );
        }
    }

    setConnections( connections: DatabaseConnection[] ): void {
        this.connections = connections;
        this.refresh();
    }

    // Additional utility methods
    getConnections(): DatabaseConnection[] {
        return [...this.connections];
    }

    async clearAllConnections(): Promise<void> {
        try {
            await this.connectionStorage.clearAllConnections();
            this.connections = [];
            this.refresh();
            vscode.window.showInformationMessage( 'All database connections have been cleared' );
        } catch ( error ) {
            console.error( 'Failed to clear connections:', error );
            vscode.window.showErrorMessage( 'Failed to clear database connections' );
        }
    }
}

// Base class for all tree items
export abstract class TreeItem extends vscode.TreeItem { }

// Database connection item
export class DatabaseConnectionItem extends TreeItem {
    constructor( public readonly connection: DatabaseConnection ) {
        super( connection.name, vscode.TreeItemCollapsibleState.Collapsed );

        this.tooltip = this.getTooltip();
        this.description = this.getDescription();
        this.iconPath = this.getIcon();
        this.contextValue = 'databaseConnection';
    }

    private getTooltip(): string {
        const { host, port, type, isConnected } = this.connection;
        return `${type.toUpperCase()} Database\nHost: ${host}:${port}\nStatus: ${isConnected ? 'Connected' : 'Disconnected'}`;
    }

    private getDescription(): string {
        const { host, port, isConnected } = this.connection;
        return `${host}:${port} ${isConnected ? '🟢' : '🔴'}`;
    }

    private getIcon(): vscode.ThemeIcon {
        const { type, isConnected } = this.connection;

        if ( !isConnected ) {
            return new vscode.ThemeIcon( 'plug', new vscode.ThemeColor( 'errorForeground' ) );
        }

        switch ( type ) {
            case 'milvus':
                return new vscode.ThemeIcon( 'database', new vscode.ThemeColor( 'charts.blue' ) );
            case 'chroma':
                return new vscode.ThemeIcon( 'database', new vscode.ThemeColor( 'charts.purple' ) );
            default:
                return new vscode.ThemeIcon( 'database', new vscode.ThemeColor( 'charts.foreground' ) );
        }
    }
}

// Collection item
export class CollectionItem extends TreeItem {
    constructor(
        public readonly collection: any,
        public readonly connection: DatabaseConnection
    ) {
        super( collection.name, vscode.TreeItemCollapsibleState.None );

        this.tooltip = this.getTooltip();
        this.description = this.getDescription();
        this.iconPath = new vscode.ThemeIcon( 'symbol-array', new vscode.ThemeColor( 'charts.orange' ) );
        this.contextValue = 'collection';
    }

    private getTooltip(): string {
        const { name } = this.collection;
        const dimension = this.collection.dimension || 'Unknown';
        const vectorCount = this.collection.vectorCount || 0;

        return `Collection: ${name}\nDimension: ${dimension}\nVectors: ${vectorCount}`;
    }

    private getDescription(): string {
        const dimension = this.collection.dimension;
        const vectorCount = this.collection.vectorCount;

        if ( dimension && vectorCount !== undefined ) {
            return `${dimension}D (${vectorCount})`;
        } else if ( dimension ) {
            return `${dimension}D`;
        }

        return '';
    }
}

// Placeholder item for empty states
export class PlaceholderItem extends TreeItem {
    constructor( label: string, description?: string ) {
        super( label, vscode.TreeItemCollapsibleState.None );

        this.description = description;
        this.iconPath = new vscode.ThemeIcon( 'info', new vscode.ThemeColor( 'descriptionForeground' ) );
        this.contextValue = 'placeholder';
    }
}

// Database connection interface
export interface DatabaseConnection {
    id: string;
    name: string;
    type: 'milvus' | 'chroma';
    host: string;
    port: string;
    username?: string;
    password?: string;
    isConnected: boolean;
    lastConnected?: Date;
    collections?: any[];
}
