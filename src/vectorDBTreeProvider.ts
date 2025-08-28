import * as vscode from 'vscode';
import { VectorDBManager } from './vectorDBManager';

export class VectorDBTreeProvider implements vscode.TreeDataProvider<TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | null | void> = new vscode.EventEmitter<TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private connections: DatabaseConnection[] = [];

    constructor( private manager: VectorDBManager ) {
        // Listen for connection changes from the manager
        this.setupManagerListeners();

        // Add sample connections for demonstration
        this.initializeSampleConnections();
    }

    private setupManagerListeners(): void {
        // This will be implemented to listen to connection status changes
        // from the VectorDBManager
    }

    private initializeSampleConnections(): void {
        // Add sample connections for demonstration purposes
        const sampleConnections: DatabaseConnection[] = [
            {
                id: 'milvus-local',
                name: 'Local Milvus',
                type: 'milvus',
                host: 'localhost',
                port: '19530',
                isConnected: true,
                lastConnected: new Date()
            },
            {
                id: 'chroma-dev',
                name: 'Development ChromaDB',
                type: 'chroma',
                host: 'localhost',
                port: '8000',
                isConnected: false
            },
            {
                id: 'milvus-prod',
                name: 'Production Milvus',
                type: 'milvus',
                host: 'prod-milvus.company.com',
                port: '19530',
                username: 'admin',
                isConnected: false
            }
        ];

        this.connections = sampleConnections;
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

            // Get collections from the manager
            const collections = await this.getCollectionsFromManager( dbItem.connection );

            if ( collections.length === 0 ) {
                return [new PlaceholderItem( 'No collections', 'Create a collection to get started' )];
            }

            return collections.map( collection => new CollectionItem( collection, dbItem.connection ) );
        } catch ( error ) {
            console.error( 'Error getting collections:', error );
            return [new PlaceholderItem( 'Error loading collections', error?.toString() || 'Unknown error' )];
        }
    }

    private async getCollectionsFromManager( connection: DatabaseConnection ): Promise<any[]> {
        try {
            // TODO: Integrate with the VectorDBManager to get actual collections
            // For now, return mock data for demonstration
            if ( connection.type === 'milvus' ) {
                return [
                    { name: 'documents', dimension: 768, vectorCount: 1250 },
                    { name: 'images', dimension: 512, vectorCount: 890 },
                    { name: 'products', dimension: 1024, vectorCount: 2100 }
                ];
            } else if ( connection.type === 'chroma' ) {
                return [
                    { name: 'embeddings', dimension: 384, vectorCount: 750 },
                    { name: 'semantic_search', dimension: 768, vectorCount: 1500 }
                ];
            }
            return [];
        } catch ( error ) {
            console.error( 'Error getting collections from manager:', error );
            return [];
        }
    }

    // Public methods for external management
    addConnection( connection: DatabaseConnection ): void {
        this.connections.push( connection );
        this.refresh();
    }

    updateConnection( id: string, updates: Partial<DatabaseConnection> ): void {
        const index = this.connections.findIndex( conn => conn.id === id );
        if ( index !== -1 ) {
            this.connections[index] = { ...this.connections[index], ...updates };
            this.refresh();
        }
    }

    removeConnection( id: string ): void {
        this.connections = this.connections.filter( conn => conn.id !== id );
        this.refresh();
    }

    setConnections( connections: DatabaseConnection[] ): void {
        this.connections = connections;
        this.refresh();
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
