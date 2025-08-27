import * as vscode from 'vscode';
import { VectorDBManager } from './vectorDBManager';

export class CollectionsProvider implements vscode.TreeDataProvider<CollectionItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<CollectionItem | undefined | null | void> = new vscode.EventEmitter<CollectionItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<CollectionItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor( private manager: VectorDBManager ) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem( element: CollectionItem ): vscode.TreeItem {
        return element;
    }

    getChildren( element?: CollectionItem ): Thenable<CollectionItem[]> {
        if ( element ) {
            return Promise.resolve( [] );
        } else {
            return this.getCollections();
        }
    }

    private async getCollections(): Promise<CollectionItem[]> {
        try {
            // This will be populated with real data from the manager
            // For now, return empty array - will be populated when connected
            return [];
        } catch ( error ) {
            console.error( 'Error getting collections:', error );
            return [];
        }
    }
}

export class CollectionItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly collection?: any
    ) {
        super( label, collapsibleState );
        
        this.tooltip = `${ this.label } collection`;
        this.description = collection?.dimension ? `${ collection.dimension }D` : '';
        this.iconPath = new vscode.ThemeIcon( 'database' );
        
        if ( collection ) {
            this.contextValue = 'collection';
        }
    }
}
