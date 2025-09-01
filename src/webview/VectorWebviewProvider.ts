import * as vscode from 'vscode';
import { ConnectionManager } from '../connectionManager.js';

export class VectorWebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'vex.vectorsView';
    private _view?: vscode.WebviewView;
    private _connectionManager: ConnectionManager;
    private _currentCollection?: {
        name: string;
        connectionId: string;
        databaseName: string;
    };

    constructor(
        private readonly _extensionUri: vscode.Uri,
        connectionManager: ConnectionManager
    ) {
        this._connectionManager = connectionManager;
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview( webviewView.webview );

        webviewView.webview.onDidReceiveMessage( async ( data ) => {
            switch ( data.command || data.type ) {
                case 'ready':
                    // Webview is ready
                    break;
                case 'refresh':
                    this.loadCollectionData();
                    break;
                case 'createIndex':
                    this.createIndex( data.fieldName, data.indexType, data.params );
                    break;
                case 'dropIndex':
                    this.dropIndex( data.indexName );
                    break;
                case 'createPartition':
                    this.createPartition( data.partitionName );
                    break;
                case 'dropPartition':
                    this.dropPartition( data.partitionName );
                    break;
                case 'loadPartition':
                    this.loadPartition( data.partitionName );
                    break;
                case 'releasePartition':
                    this.releasePartition( data.partitionName );
                    break;
            }
        } );
    }

    public setCollection( collectionName: string, connectionId: string, databaseName: string ) {
        this._currentCollection = { name: collectionName, connectionId, databaseName };
        this.loadCollectionData();
    }

    public clearCollection() {
        this._currentCollection = undefined;
        if ( this._view ) {
            this._view.webview.postMessage( {
                command: 'clearCollection'
            } );
        }
    }

    private async loadCollectionData() {
        if ( !this._view || !this._currentCollection ) {
            return;
        }

        try {
            // Get collection details from MilvusStrategy
            const strategy = ( this._connectionManager as any ).activeConnections.get( this._currentCollection.connectionId );
            if ( !strategy || strategy.type !== 'milvus' ) {
                throw new Error( 'Collection management is only available for Milvus databases' );
            }

            const collectionInfo = await strategy.getCollectionInfo( this._currentCollection.name );
            const collectionStats = await strategy.getCollectionStatistics( this._currentCollection.name );
            const indexes = await strategy.getIndexes( this._currentCollection.name );
            const partitions = await strategy.getPartitions( this._currentCollection.name );

            this._view.webview.postMessage( {
                command: 'updateCollectionData',
                data: {
                    collectionInfo,
                    collectionStats,
                    indexes,
                    partitions
                }
            } );

        } catch ( error ) {
            this._view.webview.postMessage( {
                command: 'showError',
                message: `Failed to load collection data: ${error}`
            } );
        }
    }

    private async createIndex( fieldName: string, indexType: string, params: any ) {
        if ( !this._currentCollection ) return;

        try {
            const strategy = ( this._connectionManager as any ).activeConnections.get( this._currentCollection.connectionId );
            await strategy.createIndex( this._currentCollection.name, fieldName, indexType, params );
            vscode.window.showInformationMessage( `Index created successfully on field "${fieldName}"` );
            this.loadCollectionData();
        } catch ( error ) {
            vscode.window.showErrorMessage( `Failed to create index: ${error}` );
        }
    }

    private async dropIndex( indexName: string ) {
        if ( !this._currentCollection ) return;

        try {
            const strategy = ( this._connectionManager as any ).activeConnections.get( this._currentCollection.connectionId );
            await strategy.dropIndex( this._currentCollection.name, indexName );
            vscode.window.showInformationMessage( `Index "${indexName}" dropped successfully` );
            this.loadCollectionData();
        } catch ( error ) {
            vscode.window.showErrorMessage( `Failed to drop index: ${error}` );
        }
    }

    private async createPartition( partitionName: string ) {
        if ( !this._currentCollection ) return;

        try {
            const strategy = ( this._connectionManager as any ).activeConnections.get( this._currentCollection.connectionId );
            await strategy.createPartition( this._currentCollection.name, partitionName );
            vscode.window.showInformationMessage( `Partition "${partitionName}" created successfully` );
            this.loadCollectionData();
        } catch ( error ) {
            vscode.window.showErrorMessage( `Failed to create partition: ${error}` );
        }
    }

    private async dropPartition( partitionName: string ) {
        if ( !this._currentCollection ) return;

        try {
            const strategy = ( this._connectionManager as any ).activeConnections.get( this._currentCollection.connectionId );
            await strategy.dropPartition( this._currentCollection.name, partitionName );
            vscode.window.showInformationMessage( `Partition "${partitionName}" dropped successfully` );
            this.loadCollectionData();
        } catch ( error ) {
            vscode.window.showErrorMessage( `Failed to drop partition: ${error}` );
        }
    }

    private async loadPartition( partitionName: string ) {
        if ( !this._currentCollection ) return;

        try {
            const strategy = ( this._connectionManager as any ).activeConnections.get( this._currentCollection.connectionId );
            await strategy.loadPartition( this._currentCollection.name, partitionName );
            vscode.window.showInformationMessage( `Partition "${partitionName}" loaded successfully` );
            this.loadCollectionData();
        } catch ( error ) {
            vscode.window.showErrorMessage( `Failed to load partition: ${error}` );
        }
    }

    private async releasePartition( partitionName: string ) {
        if ( !this._currentCollection ) return;

        try {
            const strategy = ( this._connectionManager as any ).activeConnections.get( this._currentCollection.connectionId );
            await strategy.releasePartition( this._currentCollection.name, partitionName );
            vscode.window.showInformationMessage( `Partition "${partitionName}" released successfully` );
            this.loadCollectionData();
        } catch ( error ) {
            vscode.window.showErrorMessage( `Failed to release partition: ${error}` );
        }
    }

    private _getHtmlForWebview( webview: vscode.Webview ) {
        const scriptUri = webview.asWebviewUri( vscode.Uri.joinPath( this._extensionUri, 'media', 'collection-management.js' ) );
        const styleResetUri = webview.asWebviewUri( vscode.Uri.joinPath( this._extensionUri, 'media', 'reset.css' ) );
        const styleVSCodeUri = webview.asWebviewUri( vscode.Uri.joinPath( this._extensionUri, 'media', 'vscode.css' ) );

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${styleResetUri}" rel="stylesheet">
                <link href="${styleVSCodeUri}" rel="stylesheet">
                <title>Collection Management</title>
                <style>
                    body {
                        padding: 10px;
                        font-family: var(--vscode-font-family);
                        font-size: var(--vscode-font-size);
                        color: var(--vscode-foreground);
                    }
                    
                    .section {
                        margin-bottom: 20px;
                        border: 1px solid var(--vscode-widget-border);
                        border-radius: 4px;
                        padding: 15px;
                    }
                    
                    .section-header {
                        font-weight: bold;
                        font-size: 1.1em;
                        margin-bottom: 10px;
                        color: var(--vscode-textLink-foreground);
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }
                    
                    .stats-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                        gap: 10px;
                    }
                    
                    .stat-item {
                        background: var(--vscode-editor-background);
                        padding: 8px 12px;
                        border-radius: 3px;
                        border: 1px solid var(--vscode-input-border);
                    }
                    
                    .stat-label {
                        font-size: 0.85em;
                        color: var(--vscode-descriptionForeground);
                        margin-bottom: 2px;
                    }
                    
                    .stat-value {
                        font-weight: bold;
                        font-size: 1.1em;
                    }
                    
                    .fields-table, .indexes-table, .partitions-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 10px;
                    }
                    
                    .fields-table th, .fields-table td,
                    .indexes-table th, .indexes-table td,
                    .partitions-table th, .partitions-table td {
                        border: 1px solid var(--vscode-widget-border);
                        padding: 8px;
                        text-align: left;
                    }
                    
                    .fields-table th, .indexes-table th, .partitions-table th {
                        background: var(--vscode-editor-background);
                        font-weight: bold;
                    }
                    
                    .action-buttons {
                        margin-top: 10px;
                        display: flex;
                        gap: 8px;
                        flex-wrap: wrap;
                    }
                    
                    .btn {
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        padding: 6px 12px;
                        border-radius: 3px;
                        cursor: pointer;
                        font-size: 0.9em;
                    }
                    
                    .btn:hover {
                        background: var(--vscode-button-hoverBackground);
                    }
                    
                    .btn-secondary {
                        background: var(--vscode-button-secondaryBackground);
                        color: var(--vscode-button-secondaryForeground);
                    }
                    
                    .btn-secondary:hover {
                        background: var(--vscode-button-secondaryHoverBackground);
                    }
                    
                    .btn-danger {
                        background: var(--vscode-testing-iconFailed);
                        color: white;
                    }
                    
                    .input-row {
                        display: flex;
                        gap: 8px;
                        align-items: center;
                        margin-top: 8px;
                    }
                    
                    .input-row input, .input-row select {
                        background: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        border: 1px solid var(--vscode-input-border);
                        padding: 4px 8px;
                        border-radius: 3px;
                    }
                    
                    .loading {
                        text-align: center;
                        padding: 40px;
                        color: var(--vscode-descriptionForeground);
                    }
                    
                    .error {
                        background: var(--vscode-inputValidation-errorBackground);
                        border: 1px solid var(--vscode-inputValidation-errorBorder);
                        color: var(--vscode-errorForeground);
                        padding: 10px;
                        border-radius: 3px;
                        margin: 10px 0;
                    }
                    
                    .empty-state {
                        text-align: center;
                        padding: 40px;
                        color: var(--vscode-descriptionForeground);
                    }
                    
                    .empty-state h3 {
                        margin-bottom: 8px;
                        color: var(--vscode-foreground);
                    }
                    
                    .icon {
                        width: 16px;
                        height: 16px;
                        display: inline-block;
                    }
                    
                    .collapsible {
                        cursor: pointer;
                        user-select: none;
                    }
                    
                    .collapsible::before {
                        content: '▼';
                        margin-right: 5px;
                        transition: transform 0.2s;
                    }
                    
                    .collapsible.collapsed::before {
                        transform: rotate(-90deg);
                    }
                    
                    .collapsible-content {
                        margin-top: 10px;
                    }
                    
                    .collapsible.collapsed + .collapsible-content {
                        display: none;
                    }
                </style>
            </head>
            <body>
                <div id="content">
                    <div class="empty-state">
                        <h3>Collection Management</h3>
                        <p>Double-click a collection in the tree view to manage it</p>
                        <p>Available for Milvus databases only</p>
                    </div>
                </div>
                <script src="${scriptUri}"></script>
            </body>
            </html>`;
    }
}