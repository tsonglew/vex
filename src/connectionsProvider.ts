import * as vscode from 'vscode';
import { VectorDBManager } from './vectorDBManager';

export class ConnectionsProvider implements vscode.TreeDataProvider<ConnectionItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ConnectionItem | undefined | null | void> = new vscode.EventEmitter<ConnectionItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ConnectionItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor( private manager: VectorDBManager ) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem( element: ConnectionItem ): vscode.TreeItem {
        return element;
    }

    getChildren( element?: ConnectionItem ): Thenable<ConnectionItem[]> {
        if ( element ) {
            return Promise.resolve( [] );
        } else {
            return this.getConnections();
        }
    }

    private async getConnections(): Promise<ConnectionItem[]> {
        try {
            // This will be populated with real connection data from the manager
            // For now, return empty array - will be populated when connected
            return [];
        } catch ( error ) {
            console.error( 'Error getting connections:', error );
            return [];
        }
    }
}

export class ConnectionItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly connection?: any
    ) {
        super( label, collapsibleState );
        
        this.tooltip = `${ this.label } connection`;
        this.description = connection?.status || 'Disconnected';
        this.iconPath = new vscode.ThemeIcon( connection?.status === 'connected' ? 'check' : 'plug' );
        
        if ( connection ) {
            this.contextValue = 'connection';
        }
    }
}
