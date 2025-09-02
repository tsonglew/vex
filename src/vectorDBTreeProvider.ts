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

    // Force refresh databases for a specific server connection
    refreshServerDatabases( connectionId: string ): void {
        // This will trigger a refresh of the specific server's databases
        this._onDidChangeTreeData.fire();
    }

    getTreeItem( element: TreeItem ): vscode.TreeItem {
        return element;
    }

    getChildren( element?: TreeItem ): Thenable<TreeItem[]> {
        if ( !element ) {
            // Root level - show server connections
            return Promise.resolve( this.getServerConnections() );
        }

        if ( element instanceof ServerConnectionItem ) {
            // Show databases for this server
            return this.getDatabasesForServer( element );
        }

        if ( element instanceof DatabaseItem ) {
            // Show collections for this database
            return this.getCollectionsForDatabase( element );
        }

        if ( element instanceof CollectionItem ) {
            // Collections are now leaf nodes - no longer show individual vectors
            return Promise.resolve( [] );
        }

        // VectorItem class removed - no longer showing individual vectors

        return Promise.resolve( [] );
    }

    private getServerConnections(): TreeItem[] {
        if ( this.connections.length === 0 ) {
            return [new PlaceholderItem( 'No server connections', 'Click "+" to add a connection' )];
        }

        return this.connections.map( conn => new ServerConnectionItem( conn ) );
    }

    private async getDatabasesForServer( serverItem: ServerConnectionItem ): Promise<TreeItem[]> {
        try {
            if ( !serverItem.connection.isConnected ) {
                return [new PlaceholderItem( 'Not connected', 'Connect to view databases' )];
            }

            console.log( `Fetching databases from server: ${serverItem.connection.name} (${serverItem.connection.host}:${serverItem.connection.port})` );

            // Get databases directly from the server using listDatabases API
            const databases = await this.connectionManager.listDatabases( serverItem.connection.id );

            console.log( `Retrieved ${databases.length} databases from server` );

            if ( databases.length === 0 ) {
                return [new PlaceholderItem( 'No databases', 'Create a database to get started' )];
            }

            return databases.map( database => new DatabaseItem( database, serverItem.connection ) );
        } catch ( error ) {
            console.error( 'Error getting databases from server:', error );
            return [new PlaceholderItem( 'Error loading databases', error?.toString() || 'Unknown error' )];
        }
    }

    private async getCollectionsForDatabase( dbItem: DatabaseItem ): Promise<TreeItem[]> {
        try {
            if ( !dbItem.connection.isConnected ) {
                return [new PlaceholderItem( 'Not connected', 'Connect to view collections' )];
            }

            // Switch to the selected database
            await this.connectionManager.useDatabase( dbItem.connection.id, dbItem.database.name );

            // Get collections for this database
            const collections = await this.connectionManager.listCollections( dbItem.connection.id );

            if ( collections.length === 0 ) {
                return [new PlaceholderItem( 'No collections', 'Create a collection to get started' )];
            }

            // Enhance collections with vector counts
            const enhancedCollections = await Promise.all(
                collections.map( async ( collection ) => {
                    try {
                        // Get vector count for this collection (just get count, no actual vectors)
                        const vectorsResult = await this.connectionManager.listVectors( dbItem.connection.id, collection.name, 0, 1 );
                        return {
                            ...collection,
                            vectorCount: vectorsResult.total
                        };
                    } catch ( error ) {
                        console.warn( `Failed to get vector count for collection ${collection.name}:`, error );
                        return {
                            ...collection,
                            vectorCount: 0
                        };
                    }
                } )
            );

            return enhancedCollections.map( collection => new CollectionItem( collection, dbItem.connection, dbItem.database ) );
        } catch ( error ) {
            console.error( 'Error getting collections:', error );
            return [new PlaceholderItem( 'Error loading collections', error?.toString() || 'Unknown error' )];
        }
    }

    // Method removed - collections are now leaf nodes that show vector count in their description

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

// Server connection item (Milvus server)
export class ServerConnectionItem extends TreeItem {
    constructor( public readonly connection: DatabaseConnection ) {
        super( connection.name, vscode.TreeItemCollapsibleState.Collapsed );

        this.tooltip = this.getTooltip();
        this.description = this.getDescription();
        this.iconPath = this.getIcon();
        this.contextValue = this.getContextValue();
    }

    private getTooltip(): string {
        const { host, port, type, isConnected } = this.connection;
        const status = isConnected ? '🟢 Connected' : '🔴 Disconnected';
        const actions = isConnected ?
            'Right-click to: Disconnect, Edit, Delete Server, Create Database' :
            'Right-click to: Connect, Edit, Delete Server';

        return `${type.toUpperCase()} Server\nHost: ${host}:${port}\nStatus: ${status}\n\n${actions}`;
    }

    private getDescription(): string {
        const { host, port, isConnected } = this.connection;
        const status = isConnected ? '🟢 Connected' : '🔴 Disconnected';
        return `${host}:${port} ${status}`;
    }

    private getIcon(): vscode.ThemeIcon {
        const { type, isConnected } = this.connection;

        if ( !isConnected ) {
            return new vscode.ThemeIcon( 'plug', new vscode.ThemeColor( 'errorForeground' ) );
        }

        // Connected state with different colors for different types
        switch ( type ) {
            case 'milvus':
                return new vscode.ThemeIcon( 'server', new vscode.ThemeColor( 'charts.blue' ) );
            case 'chroma':
                return new vscode.ThemeIcon( 'server', new vscode.ThemeColor( 'charts.purple' ) );
            case 'pinecone':
                return new vscode.ThemeIcon( 'server', new vscode.ThemeColor( 'charts.green' ) );
            case 'weaviate':
                return new vscode.ThemeIcon( 'server', new vscode.ThemeColor( 'charts.orange' ) );
            case 'qdrant':
                return new vscode.ThemeIcon( 'server', new vscode.ThemeColor( 'charts.red' ) );
            case 'faiss':
                return new vscode.ThemeIcon( 'server', new vscode.ThemeColor( 'charts.yellow' ) );
            case 'elasticsearch':
                return new vscode.ThemeIcon( 'server', new vscode.ThemeColor( 'charts.blue' ) );
            case 'vespa':
                return new vscode.ThemeIcon( 'server', new vscode.ThemeColor( 'charts.purple' ) );
            case 'redis':
                return new vscode.ThemeIcon( 'server', new vscode.ThemeColor( 'charts.red' ) );
            case 'pgvector':
                return new vscode.ThemeIcon( 'server', new vscode.ThemeColor( 'charts.blue' ) );
            default:
                return new vscode.ThemeIcon( 'server', new vscode.ThemeColor( 'charts.foreground' ) );
        }
    }

    private getContextValue(): string {
        // Return different context values based on connection status
        // This allows different context menu items to be shown
        return this.connection.isConnected ? 'serverConnectionConnected' : 'serverConnectionDisconnected';
    }
}

// Database item (within a server)
export class DatabaseItem extends TreeItem {
    constructor(
        public readonly database: any,
        public readonly connection: DatabaseConnection
    ) {
        super( database.name, vscode.TreeItemCollapsibleState.Collapsed );

        this.tooltip = this.getTooltip();
        this.description = this.getDescription();
        this.iconPath = new vscode.ThemeIcon( 'database', new vscode.ThemeColor( 'charts.blue' ) );
        this.contextValue = 'database';
    }

    private getTooltip(): string {
        const { name, id } = this.database;
        return `Database: ${name}\nID: ${id || 'N/A'}`;
    }

    private getDescription(): string {
        return this.database.id || '';
    }
}

// Collection item (within a database)
export class CollectionItem extends TreeItem {
    constructor(
        public readonly collection: any,
        public readonly connection: DatabaseConnection,
        public readonly database: any
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

        return `Collection: ${name}\nDatabase: ${this.database.name}\nDimension: ${dimension}\nVectors: ${vectorCount}`;
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

// VectorItem class removed - collections now show vector count instead of individual vectors

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
    type: 'milvus' | 'chroma' | 'pinecone' | 'weaviate' | 'qdrant' | 'faiss' | 'elasticsearch' | 'vespa' | 'redis' | 'pgvector';
    host: string;
    port: string;
    username?: string;
    password?: string;
    isConnected: boolean;
    lastConnected?: Date;
}
