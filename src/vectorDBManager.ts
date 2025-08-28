import * as vscode from 'vscode';
import { VectorDBStrategy } from './strategies/VectorDBStrategy';
import { StrategyFactory } from './strategies/StrategyFactory';

export class VectorDBManager {
    private _panel: vscode.WebviewPanel | undefined;
    private _context: vscode.ExtensionContext;
    private _strategy: VectorDBStrategy | undefined;
    private _currentConnection: { type: string; host: string; port: string } | undefined;

    constructor( context: vscode.ExtensionContext ) {
        this._context = context;
    }

    public showPanel() {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if ( this._panel ) {
            this._panel.reveal( column );
        } else {
            this._panel = vscode.window.createWebviewPanel(
                'vectorDBManager',
                'VectorDB Manager',
                column || vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                    localResourceRoots: [this._context.extensionUri]
                }
            );

            this._panel.webview.html = this.getWebviewContent();
            this._panel.onDidDispose( () => {
                this._panel = undefined;
            } );

            this._panel.webview.onDidReceiveMessage(
                async ( message: any ) => {
                    switch ( message.command ) {
                        case 'connect':
                            await this.handleConnect( message );
                            break;
                        case 'listCollections':
                            await this.handleListCollections( message );
                            break;
                        case 'createCollection':
                            console.log( 'Backend: Received createCollection message:', message );
                            await this.handleCreateCollection( message );
                            break;
                        case 'deleteCollection':
                            await this.handleDeleteCollection( message );
                            break;
                        case 'insertVectors':
                            await this.handleInsertVectors( message );
                            break;
                        case 'searchVectors':
                            await this.handleSearchVectors( message );
                            break;
                        case 'listVectors':
                            await this.handleListVectors( message );
                            break;
                        case 'deleteVectors':
                            await this.handleDeleteVectors( message );
                            break;
                    }
                },
                undefined,
                this._context.subscriptions
            );
        }
    }

    private showLoading( operation: string, message: string = '' ) {
        this._panel?.webview.postMessage( {
            command: 'loading',
            operation: operation,
            loading: true,
            message: message
        } );
    }

    private hideLoading( operation: string ) {
        this._panel?.webview.postMessage( {
            command: 'loading',
            operation: operation,
            loading: false
        } );
    }

    private async handleConnect( message: any ) {
        this.showLoading( 'connect', 'Connecting to database...' );
        try {
            const { type, host, port, username, password } = message;

            // Clean up any existing connections
            await this.disconnectCurrent();

            // Create strategy for the requested database type
            this._strategy = StrategyFactory.createStrategy( type );

            // Connect using the strategy
            await this._strategy.connect( host, port, username, password );

            this._currentConnection = { type, host, port };

            const connectionTime = Date.now() - Date.now();
            this._panel?.webview.postMessage( {
                command: 'connectionStatus',
                status: 'connected',
                type: type,
                details: {
                    host,
                    port,
                    timestamp: new Date().toISOString(),
                    message: 'Successfully connected to ' + type + ' database',
                    server: host + ':' + port,
                    authenticated: !!( username && password )
                }
            } );
        } catch ( error ) {
            this._panel?.webview.postMessage( {
                command: 'connectionStatus',
                status: 'error',
                details: {
                    error: error instanceof Error ? error.message : String( error ),
                    timestamp: new Date().toISOString(),
                    operation: 'Database Connection'
                }
            } );
        } finally {
            this.hideLoading( 'connect' );
        }
    }

    private async disconnectCurrent() {
        if ( this._strategy ) {
            await this._strategy.disconnect();
            this._strategy = undefined;
        }
        this._currentConnection = undefined;
    }

    private async handleListCollections( message: any ) {
        this.showLoading( 'listCollections', 'Loading collections...' );
        try {
            if ( !this._strategy ) {
                throw new Error( 'No active database connection' );
            }

            const collections = await this._strategy.listCollections();

            this._panel?.webview.postMessage( {
                command: 'collectionsList',
                collections,
                details: {
                    count: collections.length,
                    timestamp: new Date().toISOString(),
                    message: 'Successfully retrieved ' + collections.length + ' collections',
                    operation: 'List Collections'
                }
            } );
        } catch ( error ) {
            const errorMessage = error instanceof Error ? error.message : String( error );
            this._panel?.webview.postMessage( {
                command: 'error',
                error: errorMessage,
                details: {
                    message: errorMessage,
                    operation: 'List Collections',
                    timestamp: new Date().toISOString(),
                    type: 'error'
                }
            } );
        } finally {
            this.hideLoading( 'listCollections' );
        }
    }

    private async handleCreateCollection( message: any ) {
        console.log( 'Backend: handleCreateCollection called with:', message );
        const { name, dimension, metric } = message;
        this.showLoading( 'createCollection', `Creating collection '${name}'...` );
        try {
            if ( !this._strategy ) {
                throw new Error( 'No active database connection' );
            }

            await this._strategy.createCollection( name, dimension, metric );

            this._panel?.webview.postMessage( {
                command: 'collectionCreated',
                name,
                details: {
                    name,
                    dimension,
                    metric,
                    timestamp: new Date().toISOString(),
                    message: 'Collection \'' + name + '\' created successfully',
                    operation: 'Create Collection',
                    config: {
                        'Dimension': dimension,
                        'Similarity Metric': metric === 'cosine' ? 'Cosine Similarity' :
                            metric === 'euclidean' ? 'Euclidean Distance' :
                                metric === 'dot' ? 'Dot Product' : metric
                    }
                }
            } );
        } catch ( error ) {
            const errorMessage = error instanceof Error ? error.message : String( error );
            this._panel?.webview.postMessage( {
                command: 'error',
                error: errorMessage,
                details: {
                    message: errorMessage,
                    operation: 'Create Collection',
                    timestamp: new Date().toISOString(),
                    type: 'error',
                    config: { name, dimension, metric }
                }
            } );
        } finally {
            this.hideLoading( 'createCollection' );
        }
    }

    private async handleDeleteCollection( message: any ) {
        const { name } = message;
        this.showLoading( 'deleteCollection', `Deleting collection '${name}'...` );
        try {
            if ( !this._strategy ) {
                throw new Error( 'No active database connection' );
            }

            await this._strategy.deleteCollection( name );

            this._panel?.webview.postMessage( {
                command: 'collectionDeleted',
                name,
                details: {
                    name,
                    timestamp: new Date().toISOString(),
                    message: 'Collection \'' + name + '\' deleted successfully',
                    operation: 'Delete Collection'
                }
            } );
        } catch ( error ) {
            const errorMessage = error instanceof Error ? error.message : String( error );
            this._panel?.webview.postMessage( {
                command: 'error',
                error: errorMessage,
                details: {
                    message: errorMessage,
                    operation: 'Delete Collection',
                    timestamp: new Date().toISOString(),
                    type: 'error',
                    config: { name }
                }
            } );
        } finally {
            this.hideLoading( 'deleteCollection' );
        }
    }

    private async handleInsertVectors( message: any ) {
        const { collection, vectors, ids, metadata } = message;
        this.showLoading( 'insertVectors', `Inserting ${vectors.length} vectors into '${collection}'...` );
        const startTime = Date.now();
        try {
            if ( !this._strategy ) {
                throw new Error( 'No active database connection' );
            }

            const insertedCount = await this._strategy.insertVectors( collection, vectors, ids, metadata );
            const endTime = Date.now();
            const duration = endTime - startTime;

            // Calculate additional statistics
            const avgDimension = vectors.length > 0 ? vectors.reduce( ( sum: number, v: number[] ) => sum + v.length, 0 ) / vectors.length : 0;
            const minDimension = vectors.length > 0 ? Math.min( ...vectors.map( ( v: number[] ) => v.length ) ) : 0;
            const maxDimension = vectors.length > 0 ? Math.max( ...vectors.map( ( v: number[] ) => v.length ) ) : 0;
            const successRate = vectors.length > 0 ? ( insertedCount / vectors.length * 100 ).toFixed( 1 ) : '0';

            this._panel?.webview.postMessage( {
                command: 'vectorsInserted',
                count: insertedCount,
                details: {
                    collection,
                    insertedCount,
                    timestamp: new Date().toISOString(),
                    message: `Successfully inserted ${insertedCount} vectors into collection '${collection}'`,
                    operation: 'Insert Vectors',
                    stats: {
                        'Vectors Requested': vectors.length,
                        'Vectors Inserted': insertedCount,
                        'Success Rate': successRate + '%',
                        'Average Dimension': Math.round( avgDimension ),
                        'Min Dimension': minDimension,
                        'Max Dimension': maxDimension,
                        'With Custom IDs': ids ? ids.length : 0,
                        'With Metadata': metadata ? metadata.length : 0,
                        'Processing Time': duration + 'ms',
                        'Insertion Rate': vectors.length > 0 ? Math.round( vectors.length / ( duration / 1000 ) ) + ' vectors/sec' : '0 vectors/sec'
                    },
                    config: {
                        collection: collection,
                        vectorCount: vectors.length,
                        hasCustomIds: !!ids,
                        hasMetadata: !!metadata,
                        strategy: this._strategy.type
                    }
                }
            } );
        } catch ( error ) {
            const errorMessage = error instanceof Error ? error.message : String( error );
            this._panel?.webview.postMessage( {
                command: 'error',
                error: errorMessage,
                details: {
                    message: errorMessage,
                    operation: 'Insert Vectors',
                    timestamp: new Date().toISOString(),
                    type: 'error',
                    config: { collection, vectorCount: vectors.length }
                }
            } );
        } finally {
            this.hideLoading( 'insertVectors' );
        }
    }

    private async handleSearchVectors( message: any ) {
        const { collection, vector, topK } = message;
        this.showLoading( 'searchVectors', `Searching for top ${topK} similar vectors...` );
        try {
            if ( !this._strategy ) {
                throw new Error( 'No active database connection' );
            }

            const results = await this._strategy.searchVectors( collection, vector, topK );

            const distances = results.map( r => r.distance ).filter( d => d !== null );
            const avgDistance = distances.length > 0 ? distances.reduce( ( a, b ) => a + b, 0 ) / distances.length : 0;
            const minDistance = distances.length !== 0 ? Math.min( ...distances ) : 0;
            const maxDistance = distances.length !== 0 ? Math.max( ...distances ) : 0;

            this._panel?.webview.postMessage( {
                command: 'searchResults',
                results,
                details: {
                    collection,
                    queryVector: vector,
                    topK,
                    resultCount: results.length,
                    timestamp: new Date().toISOString(),
                    message: 'Found ' + results.length + ' similar vectors in collection \'' + collection + '\'',
                    operation: 'Vector Similarity Search',
                    stats: {
                        'Query Dimension': vector.length,
                        'Requested Count': topK,
                        'Returned Results': results.length,
                        'Average Distance': avgDistance.toFixed( 4 ),
                        'Minimum Distance': minDistance.toFixed( 4 ),
                        'Maximum Distance': maxDistance.toFixed( 4 )
                    }
                }
            } );
        } catch ( error ) {
            const errorMessage = error instanceof Error ? error.message : String( error );
            this._panel?.webview.postMessage( {
                command: 'error',
                error: errorMessage,
                details: {
                    message: errorMessage,
                    operation: 'Search Vectors',
                    timestamp: new Date().toISOString(),
                    type: 'error',
                    config: { collection, vectorDimension: vector.length, topK }
                }
            } );
        } finally {
            this.hideLoading( 'searchVectors' );
        }
    }

    private async handleListVectors( message: any ) {
        const { collection } = message;
        this.showLoading( 'listVectors', `Loading vectors from '${collection}'...` );
        try {
            if ( !this._strategy ) {
                throw new Error( 'No active database connection' );
            }

            const vectors = await this._strategy.listVectors( collection );

            const dimensions = vectors.map( v => v.vector?.length ).filter( d => d !== null );
            const avgDimension = dimensions.length > 0 ? dimensions.reduce( ( a, b ) => a + b, 0 ) / dimensions.length : 0;
            const hasMetadata = vectors.some( v => v.metadata && Object.keys( v.metadata ).length > 0 );

            this._panel?.webview.postMessage( {
                command: 'vectorsList',
                vectors,
                details: {
                    collection,
                    vectorCount: vectors.length,
                    timestamp: new Date().toISOString(),
                    message: 'Successfully loaded ' + vectors.length + ' vectors from collection \'' + collection + '\'',
                    operation: 'List Vectors',
                    stats: {
                        'Total Vectors': vectors.length,
                        'Average Dimension': avgDimension > 0 ? avgDimension.toFixed( 0 ) : 'Unknown',
                        'Has Metadata': hasMetadata ? 'Yes' : 'No',
                        'Display Limit': vectors.length >= 100 ? 'Showing first 100' : 'Showing all'
                    }
                }
            } );
        } catch ( error ) {
            const errorMessage = error instanceof Error ? error.message : String( error );
            this._panel?.webview.postMessage( {
                command: 'error',
                error: errorMessage,
                details: {
                    message: errorMessage,
                    operation: 'List Vectors',
                    timestamp: new Date().toISOString(),
                    type: 'error',
                    config: { collection }
                }
            } );
        } finally {
            this.hideLoading( 'listVectors' );
        }
    }

    private async handleDeleteVectors( message: any ) {
        const { collection, ids } = message;
        this.showLoading( 'deleteVectors', `Deleting ${ids.length} vectors from '${collection}'...` );
        try {
            if ( !this._strategy ) {
                throw new Error( 'No active database connection' );
            }

            const deletedCount = await this._strategy.deleteVectors( collection, ids );

            this._panel?.webview.postMessage( {
                command: 'vectorsDeleted',
                count: deletedCount,
                details: {
                    collection,
                    requestedCount: ids.length,
                    deletedCount,
                    timestamp: new Date().toISOString(),
                    message: 'Successfully deleted ' + deletedCount + ' vectors from collection \'' + collection + '\'',
                    operation: 'Delete Vectors',
                    stats: {
                        'Requested Delete': ids.length,
                        'Actually Deleted': deletedCount,
                        'Delete Success Rate': ( ( deletedCount / ids.length ) * 100 ).toFixed( 1 ) + '%',
                        'Deleted IDs': ids.slice( 0, 5 ).join( ', ' ) + ( ids.length > 5 ? '...' : '' )
                    }
                }
            } );
        } catch ( error ) {
            const errorMessage = error instanceof Error ? error.message : String( error );
            this._panel?.webview.postMessage( {
                command: 'error',
                error: errorMessage,
                details: {
                    message: errorMessage,
                    operation: 'Delete Vectors',
                    timestamp: new Date().toISOString(),
                    type: 'error',
                    config: { collection, vectorIds: ids }
                }
            } );
        } finally {
            this.hideLoading( 'deleteVectors' );
        }
    }

    private getWebviewContent() {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vector Database Manager</title>
    <style>
        :root {
            /* VS Code Theme Integration */
            --primary-color: var(--vscode-button-background, #0078d4);
            --primary-hover: var(--vscode-button-hoverBackground, #106ebe);
            --secondary-color: var(--vscode-button-secondaryBackground, #5f6368);
            --secondary-hover: var(--vscode-button-secondaryHoverBackground, #6c757d);
            --success-color: var(--vscode-testing-iconPassed, #16825d);
            --warning-color: var(--vscode-list-warningForeground, #bf8803);
            --error-color: var(--vscode-list-errorForeground, #f14c4c);
            --info-color: var(--vscode-notificationsInfoIcon-foreground, #0078d4);
            
            /* Background and Borders */
            --panel-bg: var(--vscode-panel-background, #181818);
            --input-bg: var(--vscode-input-background, #3c3c3c);
            --border-color: var(--vscode-panel-border, #454545);
            --hover-bg: var(--vscode-list-hoverBackground, #2a2d2e);
            --active-bg: var(--vscode-list-activeSelectionBackground, #04395e);
            
            /* Text Colors */
            --text-primary: var(--vscode-foreground, #cccccc);
            --text-secondary: var(--vscode-descriptionForeground, #9d9d9d);
            --text-disabled: var(--vscode-disabledForeground, #656565);
            
            /* Module Background Colors - Using softer colors, theme adaptive */
            --module-bg-connection: var(--vscode-editorGroupHeader-tabsBackground, rgba(0, 120, 212, 0.1));
            --module-bg-collections: var(--vscode-tab-inactiveBackground, rgba(156, 39, 176, 0.1));  
            --module-bg-vectors: var(--vscode-merge-incomingHeaderBackground, rgba(22, 130, 93, 0.1));
            --module-bg-search: var(--vscode-peekViewEditor-background, rgba(255, 152, 0, 0.1));
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: var(--vscode-font-family, 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif);
            font-size: var(--vscode-font-size, 13px);
            background: var(--vscode-editor-background);
            color: var(--text-primary);
            line-height: 1.6;
            margin: 0;
            padding: 0;
        }

        .app-container {
            display: grid;
            grid-template-columns: 300px 1fr;
            grid-template-rows: 60px 1fr;
            height: 100vh;
            gap: 0;
        }

        /* Top Header Bar */
        .app-header {
            grid-column: 1 / -1;
            background: var(--vscode-titleBar-activeBackground);
            color: var(--vscode-titleBar-activeForeground);
            display: flex;
            align-items: center;
            padding: 0 24px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .app-title {
            font-size: 16px;
            font-weight: 500;
        }

        /* Left Navigation Bar */
        .sidebar {
            background: var(--vscode-sideBar-background);
            border-right: 1px solid var(--vscode-panel-border);
            display: flex;
            flex-direction: column;
        }

        /* Connection Module */
        .connection-module {
            background: var(--module-bg-connection);
            padding: 16px;
            border-bottom: 1px solid var(--border-color);
            backdrop-filter: blur(10px);
        }

        .module-header {
            font-size: 14px;
            font-weight: 600;
            color: var(--text-primary);
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .module-icon {
            width: 16px;
            height: 16px;
            background: currentColor;
            mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z'/%3E%3C/svg%3E") no-repeat center;
        }

        .form-row {
            display: flex;
            gap: 8px;
            margin-bottom: 8px;
        }

        .form-group {
            flex: 1;
            margin-bottom: 12px;
        }

        .form-label {
            display: block;
            font-size: 12px;
            font-weight: 500;
            color: var(--text-secondary);
            margin-bottom: 4px;
        }

        .form-input, .form-select {
            width: 100%;
            height: 28px;
            padding: 4px 8px;
            border: 1px solid var(--vscode-input-border);
            background: var(--input-bg);
            color: var(--vscode-input-foreground);
            font-size: 12px;
            font-family: inherit;
            transition: all 0.2s ease;
            border-radius: 2px;
        }

        .form-input:focus, .form-select:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
            box-shadow: 0 0 0 1px var(--vscode-focusBorder);
        }

        .form-input:hover:not(:focus), .form-select:hover:not(:focus) {
            background: var(--vscode-input-background);
        }

        .btn {
            height: 28px;
            padding: 0 12px;
            border: 1px solid var(--vscode-button-border, transparent);
            background: var(--primary-color);
            color: var(--vscode-button-foreground, white);
            font-size: 12px;
            font-weight: 500;
            font-family: inherit;
            cursor: pointer;
            transition: all 0.2s ease;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            border-radius: 2px;
            user-select: none;
        }

        .btn:hover:not(:disabled) {
            background: var(--primary-hover);
            border-color: var(--vscode-button-hoverBackground, transparent);
        }

        .btn:focus {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: 2px;
        }

        .btn:active:not(:disabled) {
            transform: translateY(1px);
        }

        .btn:disabled {
            background: var(--vscode-button-background);
            color: var(--text-disabled);
            cursor: not-allowed;
            opacity: 0.5;
            transform: none;
        }

        .btn-success { 
            background: var(--success-color); 
            color: var(--vscode-button-foreground, white);
        }
        .btn-success:hover:not(:disabled) { 
            background: color-mix(in srgb, var(--success-color) 85%, black);
        }

        .btn-warning { 
            background: var(--warning-color); 
            color: var(--vscode-button-foreground, white);
        }
        .btn-warning:hover:not(:disabled) { 
            background: color-mix(in srgb, var(--warning-color) 85%, black);
        }

        .btn-error { 
            background: var(--error-color); 
            color: var(--vscode-button-foreground, white);
        }
        .btn-error:hover:not(:disabled) { 
            background: color-mix(in srgb, var(--error-color) 85%, black);
        }

        .btn-secondary { 
            background: var(--secondary-color); 
            color: var(--vscode-button-secondaryForeground, var(--text-primary));
        }
        .btn-secondary:hover:not(:disabled) { 
            background: var(--secondary-hover);
        }

        /* Navigation Menu */
        .nav-menu {
            flex: 1;
            padding: 8px 0;
        }

        .nav-item {
            display: flex;
            align-items: center;
            height: 36px;
            padding: 0 16px;
            cursor: pointer;
            color: var(--vscode-sideBar-foreground);
            font-size: 13px;
            transition: all 0.2s ease;
            gap: 8px;
            border-left: 3px solid transparent;
            user-select: none;
        }

        .nav-item:hover:not(.active) {
            background: var(--hover-bg);
            border-left-color: var(--vscode-focusBorder);
        }

        .nav-item.active {
            background: var(--active-bg);
            color: var(--vscode-list-activeSelectionForeground);
            border-left-color: var(--primary-color);
            font-weight: 500;
        }

        .nav-item:focus {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: -1px;
        }

        /* Status Bar */
        .status-bar {
            padding: 8px 16px;
            border-top: 1px solid var(--vscode-panel-border);
            font-size: 12px;
        }

        .status-item {
            padding: 4px 0;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .status-success { 
            color: var(--success-color);
            font-weight: 500;
        }
        .status-error { 
            color: var(--error-color);
            font-weight: 500;
        }
        .status-loading { 
            color: var(--info-color);
            font-weight: 500;
        }

        /* Main Content Area */
        .main-content {
            background: var(--vscode-editor-background);
            overflow: auto;
        }

        .content-module {
            padding: 24px;
            min-height: 100%;
        }

        .content-module.hidden {
            display: none;
        }

        .module-title {
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 20px;
            color: var(--text-primary);
        }

        /* Toolbar */
        .toolbar {
            display: flex;
            gap: 8px;
            margin-bottom: 20px;
            flex-wrap: wrap;
        }

        /* Data List */
        .data-grid {
            background: var(--panel-bg);
            border: 1px solid var(--border-color);
            border-radius: 4px;
            overflow: hidden;
        }

        .grid-header {
            background: var(--vscode-editorGroupHeader-tabsBackground);
            padding: 8px 12px;
            border-bottom: 1px solid var(--border-color);
            font-size: 12px;
            font-weight: 600;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .grid-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px;
            border-bottom: 1px solid var(--border-color);
            transition: all 0.2s ease;
            cursor: pointer;
        }

        .grid-item:last-child {
            border-bottom: none;
        }

        .grid-item:hover {
            background: var(--hover-bg);
            transform: translateX(2px);
        }

        .item-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 2px;
        }

        .item-title {
            font-weight: 500;
            font-size: 13px;
        }

        .item-meta {
            font-size: 11px;
            color: var(--text-secondary);
        }

        .item-actions {
            display: flex;
            gap: 4px;
        }

        /* Modal Forms */
        .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: var(--vscode-editor-background);
            background: color-mix(in srgb, var(--vscode-editor-background) 80%, transparent);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            animation: modalFadeIn 0.2s ease;
        }

        @keyframes modalFadeIn {
            from {
                opacity: 0;
                backdrop-filter: blur(0px);
            }
            to {
                opacity: 1;
                backdrop-filter: blur(4px);
            }
        }

        .modal {
            background: var(--panel-bg);
            border: 1px solid var(--border-color);
            border-radius: 6px;
            width: 480px;
            max-width: 90vw;
            max-height: 80vh;
            overflow: auto;
            box-shadow: 0 8px 32px color-mix(in srgb, var(--vscode-editor-background) 50%, transparent);
            animation: modalSlideIn 0.2s ease;
        }

        @keyframes modalSlideIn {
            from {
                opacity: 0;
                transform: translateY(-20px) scale(0.95);
            }
            to {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }

        .modal-header {
            padding: 16px 20px;
            border-bottom: 1px solid var(--border-color);
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: var(--vscode-editorGroupHeader-tabsBackground);
        }

        .modal-title {
            font-size: 16px;
            font-weight: 600;
            color: var(--text-primary);
        }

        .modal-body {
            padding: 20px;
        }

        .modal-footer {
            padding: 16px 20px;
            border-top: 1px solid var(--border-color);
            display: flex;
            gap: 8px;
            justify-content: flex-end;
            background: var(--vscode-editorGroupHeader-tabsBackground);
        }

        /* Loading States */
        .loading-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(255, 255, 255, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            gap: 8px;
        }

        .spinner {
            width: 20px;
            height: 20px;
            border: 2px solid color-mix(in srgb, var(--primary-color) 20%, transparent);
            border-top: 2px solid var(--primary-color);
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .loading-text {
            font-size: 12px;
            color: var(--text-secondary);
        }

        /* Code Display */
        .code-block {
            background: var(--vscode-textCodeBlock-background);
            padding: 12px;
            font-family: var(--vscode-editor-font-family, 'Cascadia Code', 'Fira Code', Consolas, monospace);
            font-size: var(--vscode-editor-font-size, 11px);
            color: var(--vscode-editor-foreground);
            white-space: pre-wrap;
            overflow-x: auto;
            border-left: 3px solid var(--primary-color);
            border-radius: 0 4px 4px 0;
            line-height: 1.4;
        }

        /* Responsive Design */
        @media (max-width: 768px) {
            .app-container {
                grid-template-columns: 1fr;
                grid-template-rows: 60px auto 1fr;
            }
            
            .sidebar {
                height: auto;
                border-right: none;
                border-bottom: 1px solid var(--vscode-panel-border);
            }
            
            .nav-menu {
                display: flex;
                overflow-x: auto;
                padding: 0;
            }
            
            .nav-item {
                white-space: nowrap;
                border-right: 1px solid var(--vscode-panel-border);
            }
        }

        /* Hidden Elements */
        .hidden { display: none !important; }
        
        /* Textarea Styles */
        textarea.form-input {
            height: auto;
            resize: vertical;
            font-family: var(--vscode-editor-font-family, 'Cascadia Code', monospace);
            font-size: var(--vscode-editor-font-size, 11px);
            line-height: 1.4;
            min-height: 60px;
        }

        /* Operation Result Panel Styles */
        .operation-result-panel {
            position: fixed;
            top: 20px;
            right: 20px;
            width: 400px;
            max-width: calc(100vw - 40px);
            background: var(--panel-bg);
            border: 2px solid var(--primary-color);
            border-radius: 8px;
            box-shadow: 0 8px 32px color-mix(in srgb, var(--primary-color) 20%, transparent);
            z-index: 2000;
            animation: slideInRight 0.3s ease-out;
        }

        .result-header {
            padding: 12px 16px;
            background: var(--primary-color);
            color: white;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-radius: 6px 6px 0 0;
        }

        .result-title {
            font-weight: 600;
            font-size: 14px;
        }

        .close-btn {
            background: none;
            border: none;
            color: white;
            font-size: 20px;
            cursor: pointer;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            transition: background 0.2s;
        }

        .close-btn:hover {
            background: color-mix(in srgb, white 20%, transparent);
        }

        .result-content {
            padding: 16px;
            max-height: 300px;
            overflow-y: auto;
        }

        .result-item {
            margin-bottom: 12px;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 13px;
            line-height: 1.4;
        }

        .result-item.success {
            background: color-mix(in srgb, var(--success-color) 15%, var(--panel-bg));
            border-left: 3px solid var(--success-color);
        }

        .result-item.info {
            background: color-mix(in srgb, var(--info-color) 15%, var(--panel-bg));
            border-left: 3px solid var(--info-color);
        }

        .result-item.error {
            background: color-mix(in srgb, var(--error-color) 15%, var(--panel-bg));
            border-left: 3px solid var(--error-color);
        }

        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }

        /* Theme Adaptive Enhancement */
        @media (prefers-color-scheme: light) {
            :root {
                --module-bg-connection: color-mix(in srgb, var(--vscode-button-background) 15%, var(--vscode-editor-background));
                --module-bg-collections: color-mix(in srgb, #9c27b0 15%, var(--vscode-editor-background)); 
                --module-bg-vectors: color-mix(in srgb, var(--success-color) 15%, var(--vscode-editor-background));
                --module-bg-search: color-mix(in srgb, var(--warning-color) 15%, var(--vscode-editor-background));
            }
        }

        @media (prefers-color-scheme: dark) {
            :root {
                --module-bg-connection: color-mix(in srgb, var(--vscode-button-background) 12%, var(--vscode-editor-background));
                --module-bg-collections: color-mix(in srgb, #9c27b0 12%, var(--vscode-editor-background)); 
                --module-bg-vectors: color-mix(in srgb, var(--success-color) 12%, var(--vscode-editor-background));
                --module-bg-search: color-mix(in srgb, var(--warning-color) 12%, var(--vscode-editor-background));
            }
        }

        /* High Contrast Theme Support */
        @media (prefers-contrast: high) {
            .btn {
                border-width: 2px;
            }
            
            .form-input:focus, .form-select:focus {
                box-shadow: 0 0 0 2px var(--vscode-focusBorder);
            }
            
            .grid-item {
                border-width: 2px;
            }
        }

        /* Reduced Animation */
        @media (prefers-reduced-motion: reduce) {
            *, *::before, *::after {
                animation-duration: 0.01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.01ms !important;
            }
            
            .modal-overlay, .modal {
                animation: none;
            }
        }
    </style>
</head>
<body>
    <div class="app-container">
        <!-- Top Header Bar -->
        <div class="app-header">
            <div class="app-title">Vector Database Manager</div>
        </div>

        <!-- Left Sidebar -->
        <div class="sidebar">
            <!-- Connection Module -->
            <div class="connection-module">
                <div class="module-header">
                    <span class="module-icon"></span>
                    Database Connection
                </div>
                
            <div class="form-group">
                    <label class="form-label">Database Type</label>
                    <select id="db-type" class="form-select">
                    <option value="milvus">Milvus</option>
                    <option value="chroma">ChromaDB</option>
                </select>
            </div>
                
                <div class="form-row">
            <div class="form-group">
                        <label class="form-label">Host Address</label>
                        <input type="text" id="host" class="form-input" value="localhost" />
            </div>
            <div class="form-group">
                        <label class="form-label">Port</label>
                        <input type="text" id="port" class="form-input" value="19530" />
            </div>
                </div>
                
                <div class="form-row">
            <div class="form-group">
                        <label class="form-label">Username</label>
                        <input type="text" id="username" class="form-input" />
            </div>
            <div class="form-group">
                        <label class="form-label">Password</label>
                        <input type="password" id="password" class="form-input" />
            </div>
        </div>

                <button class="btn" onclick="connect()" id="connect-btn">
                    Connect Database
                </button>
            </div>

            <!-- Navigation Menu -->
            <div class="nav-menu">
                <div class="nav-item active" onclick="switchModule('collections')">
                    📚 Collection Management
                </div>
                <div class="nav-item" onclick="switchModule('vectors')">
                    🔢 Vector Data
                </div>
                <div class="nav-item" onclick="switchModule('search')">
                    🔍 Similarity Search
                </div>
                <div class="nav-item" onclick="switchModule('logs')">
                    📋 Operation Logs
                </div>
        </div>

            <!-- Status Bar -->
            <div class="status-bar">
                <div id="connection-status" class="status-item">
                    <span>⚪</span> Not Connected
                </div>
                <div id="global-loading"></div>
            </div>
        </div>

        <!-- Main Content Area -->
        <div class="main-content">
            <!-- Collection Management Module -->
            <div id="collections-module" class="content-module">
                <div class="module-title">Collection Management</div>
                
                <div class="toolbar">
                    <button class="btn btn-success" onclick="listCollections()">Refresh List</button>
                    <button class="btn" onclick="showCreateCollection()">Create Collection</button>
                </div>

                <div class="data-grid">
                    <div class="grid-header">Collection List</div>
                    <div id="collections-list">
                        <!-- Collection list will be displayed here -->
                </div>
                </div>
            </div>

            <!-- Vector Data Module -->
            <div id="vectors-module" class="content-module hidden">
                <div class="module-title">Vector Data</div>
                
                <div class="toolbar">
                    <select id="vectors-collection" class="form-select" style="width: 200px;">
                        <option value="">Select Collection...</option>
                    </select>
                    <button class="btn btn-success" onclick="listVectors()">View Data</button>
                    <button class="btn" onclick="showInsertVectors()">Insert Vectors</button>
                </div>

                <div class="data-grid">
                    <div class="grid-header">Vector Data List</div>
                    <div id="vectors-list">
                        <!-- Vector list will be displayed here -->
                    </div>
            </div>
        </div>

            <!-- Similarity Search Module -->
            <div id="search-module" class="content-module hidden">
                <div class="module-title">Similarity Search</div>
                
                <div class="form-row" style="margin-bottom: 20px;">
                <div class="form-group">
                        <label class="form-label">Target Collection</label>
                        <select id="search-collection" class="form-select">
                            <option value="">Select Collection...</option>
                        </select>
                </div>
                <div class="form-group">
                        <label class="form-label">Return Count</label>
                        <input type="number" id="top-k" class="form-input" value="5" min="1" max="100" />
                </div>
                </div>
                
                <div class="form-group" style="margin-bottom: 20px;">
                    <label class="form-label">Query Vector (JSON Array Format)</label>
                    <textarea id="query-vector" class="form-input" rows="4" placeholder='[0.1, 0.2, 0.3, 0.4, 0.5]'></textarea>
                </div>
                
                <button class="btn btn-success" onclick="searchVectors()">Start Search</button>

                <div class="data-grid" style="margin-top: 20px;">
                    <div class="grid-header">Search Results</div>
                    <div id="search-results">
                        <!-- Search results will be displayed here -->
                    </div>
            </div>
        </div>

            <!-- Operation Logs Module -->
            <div id="logs-module" class="content-module hidden">
                <div class="module-title">Operation Logs</div>
                
                <div class="toolbar">
                    <button class="btn btn-secondary" onclick="clearLogs()">Clear Logs</button>
            </div>

                <div class="data-grid">
                    <div class="grid-header">Operation Records</div>
                    <div id="logs-list">
                        <!-- Log list will be displayed here -->
            </div>
            </div>
            </div>
        </div>
    </div>

    <!-- Modal Container -->
    <div id="modal-container"></div>

    <!-- Operation Result Display Panel -->
    <div class="operation-result-panel" id="operation-result-panel" style="display: none;">
        <div class="result-header">
            <span class="result-title">Operation Result Details</span>
            <button class="close-btn" onclick="hideOperationResult()">×</button>
        </div>
        <div class="result-content" id="result-content">
            <!-- Dynamic Content -->
        </div>
    </div>

    <script>
        let currentType = 'milvus';
        let currentConnection = null;
        let loadingStates = {};
        let operationLogs = [];

        // Module switching functionality
        function switchModule(moduleName) {
            // Hide all modules
            document.querySelectorAll('.content-module').forEach(module => {
                module.classList.add('hidden');
            });
            
            // Show target module
            document.getElementById(moduleName + '-module').classList.remove('hidden');
            
            // Update navigation state
            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.remove('active');
            });
            event.target.classList.add('active');
            
            // Log operation
            addLog('info', 'Switched to ' + getModuleName(moduleName) + ' module');
        }

        function getModuleName(moduleKey) {
            const names = {
                'collections': 'Collection Management',
                'vectors': 'Vector Data', 
                'search': 'Similarity Search',
                'logs': 'Operation Logs'
            };
            return names[moduleKey] || moduleKey;
        }

        // Log management functionality
        function addLog(type, message) {
            const timestamp = new Date().toLocaleString('en-US');
            operationLogs.unshift({
                timestamp,
                type,
                message
            });
            
            // Keep only the latest 100 logs
            if (operationLogs.length > 100) {
                operationLogs = operationLogs.slice(0, 100);
            }
            
            updateLogsDisplay();
        }

        function showOperationResult(details, type = 'info') {
            // Display main message
            if (details.message) {
                addLog(type === 'error' ? 'error' : 'success', details.message);
            }

            // Display detailed statistics
            if (details.stats) {
                const statsText = Object.entries(details.stats)
                    .map(([key, value]) => key + ': ' + value)
                    .join(' | ');
                addLog('info', '📊 Statistics: ' + statsText);
            }

            // Display configuration info  
            if (details.config) {
                const configText = Object.entries(details.config)
                    .map(([key, value]) => key + ': ' + value)
                    .join(' | ');
                addLog('info', '⚙️ Configuration: ' + configText);
            }

            // Display server information
            if (details.server && details.authenticated !== undefined) {
                const authText = details.authenticated ? 'Authenticated' : 'Anonymous';
                addLog('info', '🔗 Server: ' + details.server + ' (' + authText + ')');
            }

            // Display error details
            if (details.error && type === 'error') {
                addLog('error', '❌ Error Details: ' + details.error);
                if (details.operation) {
                    addLog('error', '🔧 Failed Operation: ' + details.operation);
                }
                if (details.attemptedConfig) {
                    const configText = JSON.stringify(details.attemptedConfig, null, 2);
                    addLog('error', '📝 Attempted Configuration: ' + configText);
                }
            }

            // Display performance info
            if (details.connectionTime || details.queryTime || details.creationTime || 
                details.deletionTime || details.insertionTime || details.searchTime) {
                const timeField = details.connectionTime || details.queryTime || 
                               details.creationTime || details.deletionTime || 
                               details.insertionTime || details.searchTime;
                addLog('info', '⚡ Execution Time: ' + timeField);
            }

            // Display detailed result panel
            showDetailedResult(details, type);
        }

        function showDetailedResult(details, type = 'info') {
            const panel = document.getElementById('operation-result-panel');
            const content = document.getElementById('result-content');
            
            if (!panel || !content) return;

            // Clear previous content
            content.innerHTML = '';

            // Main message
            if (details.message) {
                const messageItem = document.createElement('div');
                messageItem.className = 'result-item ' + (type === 'error' ? 'error' : 'success');
                messageItem.innerHTML = '<strong>' + details.message + '</strong>';
                content.appendChild(messageItem);
            }

            // Statistics information
            if (details.stats) {
                const statsItem = document.createElement('div');
                statsItem.className = 'result-item info';
                statsItem.innerHTML = '<strong>📊 Statistics:</strong><br>' + 
                    Object.entries(details.stats)
                        .map(([key, value]) => '• ' + key + ': ' + value)
                        .join('<br>');
                content.appendChild(statsItem);
            }

            // Configuration information
            if (details.config) {
                const configItem = document.createElement('div');
                configItem.className = 'result-item info';
                configItem.innerHTML = '<strong>⚙️ Configuration:</strong><br>' +
                    Object.entries(details.config)
                        .map(([key, value]) => '• ' + key + ': ' + value)
                        .join('<br>');
                content.appendChild(configItem);
            }

            // Server information
            if (details.server) {
                const serverItem = document.createElement('div');
                serverItem.className = 'result-item info';
                const authText = details.authenticated ? 'Authenticated' : 'Anonymous';
                serverItem.innerHTML = '<strong>🔗 Connection Info:</strong><br>• Server: ' + details.server + '<br>• Authentication Status: ' + authText;
                content.appendChild(serverItem);
            }

            // Performance information
            const timeField = details.connectionTime || details.queryTime || 
                             details.creationTime || details.deletionTime || 
                             details.insertionTime || details.searchTime;
            if (timeField || details.timestamp) {
                const perfItem = document.createElement('div');
                perfItem.className = 'result-item info';
                let perfHtml = '<strong>⚡ Performance Info:</strong><br>';
                if (timeField) perfHtml += '• Execution Time: ' + timeField + '<br>';
                if (details.timestamp) {
                    const time = new Date(details.timestamp).toLocaleString('en-US');
                    perfHtml += '• Operation Time: ' + time;
                }
                perfItem.innerHTML = perfHtml;
                content.appendChild(perfItem);
            }

            // Error information
            if (details.error && type === 'error') {
                const errorItem = document.createElement('div');
                errorItem.className = 'result-item error';
                errorItem.innerHTML = '<strong>❌ Error Details:</strong><br>' + details.error;
                content.appendChild(errorItem);
            }

            // Show panel
            panel.style.display = 'block';
            
            // Auto-hide after 5 seconds (unless it's an error)
            if (type !== 'error') {
                setTimeout(() => {
                    hideOperationResult();
                }, 5000);
            }
        }

        function hideOperationResult() {
            const panel = document.getElementById('operation-result-panel');
            if (panel) {
                panel.style.display = 'none';
            }
        }

        function updateLogsDisplay() {
            const logsList = document.getElementById('logs-list');
            if (!logsList) return;
            
            if (operationLogs.length === 0) {
                logsList.innerHTML = '<div class="grid-item">No operation records</div>';
                return;
            }
            
            logsList.innerHTML = operationLogs.map(log => \`
                <div class="grid-item">
                    <div class="item-content">
                        <div class="item-title">\${log.message}</div>
                        <div class="item-meta">\${log.timestamp} • \${getLogTypeText(log.type)}</div>
                    </div>
                </div>
            \`).join('');
        }

        function getLogTypeText(type) {
            const types = {
                'info': 'Info',
                'success': 'Success', 
                'error': 'Error',
                'warning': 'Warning'
            };
            return types[type] || type;
        }

        function clearLogs() {
            operationLogs = [];
            updateLogsDisplay();
            addLog('info', 'Operation logs cleared');
        }

        // Loading state management
        function showLoading(operation, message = 'Loading...') {
            loadingStates[operation] = true;
            updateLoadingDisplay(operation, message);
            updateButtonStates();
        }

        function hideLoading(operation) {
            delete loadingStates[operation];
            clearLoadingDisplay(operation);
            updateButtonStates();
        }

        function updateLoadingDisplay(operation, message) {
            const loadingDiv = document.getElementById('global-loading');
            if (!loadingDiv.querySelector(\`[data-operation="\${operation}"]\`)) {
                const loadingItem = document.createElement('div');
                loadingItem.className = 'status-item status-loading';
                loadingItem.setAttribute('data-operation', operation);
                loadingItem.innerHTML = \`<div class="spinner"></div><span>\${message}</span>\`;
                loadingDiv.appendChild(loadingItem);
            }
        }

        function clearLoadingDisplay(operation) {
            const loadingDiv = document.getElementById('global-loading');
            const loadingItem = loadingDiv.querySelector(\`[data-operation="\${operation}"]\`);
            if (loadingItem) {
                loadingItem.remove();
            }
        }

        function updateButtonStates() {
            const hasAnyLoading = Object.keys(loadingStates).length > 0;
            
            // Connect button is disabled during any operation
            const connectButton = document.getElementById('connect-btn');
            if (connectButton) {
                connectButton.disabled = hasAnyLoading;
            }
            
            // Operation-related buttons
            const operationButtons = {
                'connect': ['#connect-btn'],
                'listCollections': ['button[onclick="listCollections()"]'],
                'createCollection': ['button[onclick="showCreateCollection()"]'],
                'insertVectors': ['button[onclick="showInsertVectors()"]', 'button[onclick="listVectors()"]'],
                'searchVectors': ['button[onclick="searchVectors()"]']
            };
            
            // Reset all button states
            Object.values(operationButtons).flat().forEach(selector => {
                document.querySelectorAll(selector).forEach(button => {
                    button.disabled = false;
                });
            });
            
            // Disable buttons related to the operation being executed
            Object.keys(loadingStates).forEach(operation => {
                if (operationButtons[operation]) {
                    operationButtons[operation].forEach(selector => {
                        document.querySelectorAll(selector).forEach(button => {
                            button.disabled = true;
                        });
                    });
                }
            });
        }

        // Modal management
        function showModal(title, content) {
            const modalContainer = document.getElementById('modal-container');
            modalContainer.innerHTML = \`
                <div class="modal-overlay" onclick="hideModal()">
                    <div class="modal" onclick="event.stopPropagation()">
                        <div class="modal-header">
                            <div class="modal-title">\${title}</div>
                            <button class="btn btn-secondary" onclick="hideModal()">×</button>
                        </div>
                        <div class="modal-body">
                            \${content}
                        </div>
                    </div>
                </div>
            \`;
        }

        function hideModal() {
            document.getElementById('modal-container').innerHTML = '';
        }

        // Database connection
        function connect() {
            const type = document.getElementById('db-type').value;
            const host = document.getElementById('host').value;
            const port = document.getElementById('port').value;
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            
            if (!host || !port) {
                addLog('error', 'Please fill in complete connection information');
                return;
            }
            
            currentType = type;
            addLog('info', \`Attempting to connect to \${type} (\${host}:\${port})\`);
            
            vscode.postMessage({
                command: 'connect',
                type,
                host,
                port,
                username,
                password
            });
        }

        // Collection management
        function listCollections() {
            if (!currentConnection) {
                addLog('warning', 'Please connect to database first');
                return;
            }
            
            addLog('info', 'Fetching collection list');
            vscode.postMessage({
                command: 'listCollections',
                type: currentType
            });
        }

        function showCreateCollection() {
            console.log('showCreateCollection called');
            if (!currentConnection) {
                addLog('warning', 'Please connect to database first');
                return;
            }
            
            showModal('Create Collection', \`
                <div class="form-group">
                    <label class="form-label">Collection Name</label>
                    <input type="text" id="modal-collection-name" class="form-input" placeholder="Enter collection name" />
                </div>
                <div class="form-group">
                    <label class="form-label">Vector Dimension</label>
                    <input type="number" id="modal-collection-dimension" class="form-input" value="128" min="1" />
                </div>
                <div class="form-group">
                    <label class="form-label">Similarity Metric</label>
                    <select id="modal-collection-metric" class="form-select">
                        <option value="cosine">Cosine Similarity</option>
                        <option value="euclidean">Euclidean Distance</option>
                        <option value="dot">Dot Product</option>
                    </select>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="hideModal()">Cancel</button>
                    <button class="btn btn-success" onclick="createCollection()">Create</button>
                </div>
            \`);
        }

        function createCollection() {
            console.log('createCollection called');
            const nameEl = document.getElementById('modal-collection-name');
            const dimensionEl = document.getElementById('modal-collection-dimension');
            const metricEl = document.getElementById('modal-collection-metric');
            
            console.log('Form elements:', { nameEl, dimensionEl, metricEl });
            
            const name = nameEl ? nameEl.value : '';
            const dimension = dimensionEl ? parseInt(dimensionEl.value) : 0;
            const metric = metricEl ? metricEl.value : '';
            
            console.log('Form values:', { name, dimension, metric });
            
            if (!name || !dimension) {
                addLog('error', 'Please fill in complete collection information');
                return;
            }
            
            addLog('info', \`Creating collection: \${name} (dimension: \${dimension})\`);
            hideModal();
            
            const message = {
                command: 'createCollection',
                type: currentType,
                name,
                dimension,
                metric
            };
            
            console.log('Sending message to backend:', message);
            vscode.postMessage(message);
        }

        function deleteCollection(name) {
            if (confirm(\`Are you sure you want to delete collection "\${name}"? This operation cannot be undone!\`)) {
                addLog('warning', \`Deleting collection: \${name}\`);
                vscode.postMessage({
                    command: 'deleteCollection',
                    type: currentType,
                    name
                });
            }
        }

        // Vector data management
        function listVectors() {
            const collection = document.getElementById('vectors-collection').value;
            if (!collection) {
                addLog('warning', 'Please select a collection');
                return;
            }
            
            addLog('info', \`Viewing vector data in collection \${collection}\`);
            vscode.postMessage({
                command: 'listVectors',
                type: currentType,
                collection
            });
        }

        function showInsertVectors() {
            if (!currentConnection) {
                addLog('warning', 'Please connect to database first');
                return;
            }
            
            const collections = Array.from(document.getElementById('vectors-collection').options)
                .map(opt => opt.value)
                .filter(val => val)
                .map(val => \`<option value="\${val}">\${val}</option>\`)
                .join('');
            
            if (!collections) {
                addLog('warning', 'No collections available, please create a collection first');
                return;
            }
            
            showModal('Insert Vector Data', \`
                <div class="form-group">
                    <label class="form-label">Target Collection</label>
                    <select id="modal-vectors-collection" class="form-select">
                        <option value="">Select Collection...</option>
                        \${collections}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Vector Data (JSON Array)</label>
                    <textarea id="modal-vectors-data" class="form-input" rows="4" 
                        placeholder='[[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]'></textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">Vector IDs (Optional)</label>
                    <textarea id="modal-vectors-ids" class="form-input" rows="2" 
                        placeholder='["vector_1", "vector_2"]'></textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">Metadata (Optional)</label>
                    <textarea id="modal-vectors-metadata" class="form-input" rows="2"
                        placeholder='[{"type": "image"}, {"type": "text"}]'></textarea>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="hideModal()">Cancel</button>
                    <button class="btn btn-success" onclick="insertVectors()">Insert</button>
                </div>
            \`);
        }

        function insertVectors() {
            const collection = document.getElementById('modal-vectors-collection').value;
            const vectorsText = document.getElementById('modal-vectors-data').value;
            const idsText = document.getElementById('modal-vectors-ids').value;
            const metadataText = document.getElementById('modal-vectors-metadata').value;
            
            if (!collection || !vectorsText) {
                addLog('error', 'Please select collection and enter vector data');
                return;
            }
            
            try {
                const vectors = JSON.parse(vectorsText);
                const ids = idsText ? JSON.parse(idsText) : null;
                const metadata = metadataText ? JSON.parse(metadataText) : null;
                
                addLog('info', \`Inserting \${vectors.length} vectors into collection \${collection}\`);
                hideModal();
            
            vscode.postMessage({
                command: 'insertVectors',
                type: currentType,
                collection,
                vectors,
                ids,
                metadata
            });
            } catch (error) {
                addLog('error', \`JSON format error: \${error.message}\`);
            }
        }

        // 相似搜索
        function searchVectors() {
            const collection = document.getElementById('search-collection').value;
            const vectorText = document.getElementById('query-vector').value;
            const topK = parseInt(document.getElementById('top-k').value);
            
            if (!collection || !vectorText) {
                addLog('warning', 'Please select collection and enter query vector');
                return;
            }
            
            try {
                const vector = JSON.parse(vectorText);
                addLog('info', \`Searching for similar vectors in collection \${collection} (Top \${topK})\`);
            
            vscode.postMessage({
                command: 'searchVectors',
                type: currentType,
                collection,
                vector,
                topK
            });
            } catch (error) {
                addLog('error', \`Query vector format error: \${error.message}\`);
            }
        }

        // 消息处理
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.command) {
                case 'loading':
                    if (message.loading) {
                        showLoading(message.operation, message.message || 'Loading...');
                    } else {
                        hideLoading(message.operation);
                    }
                    break;
                    
                case 'connectionStatus':
                    handleConnectionStatus(message);
                    if (message.details) {
                        // Show popup for both success and error connections
                        const resultType = message.status === 'error' ? 'error' : 'success';
                        showOperationResult(message.details, resultType);
                    }
                    break;
                    
                case 'collectionsList':
                    handleCollectionsList(message);
                    if (message.details) {
                        showOperationResult(message.details);
                    }
                    break;
                    
                case 'vectorsList':
                    handleVectorsList(message);
                    if (message.details) {
                        showOperationResult(message.details);
                    }
                    break;
                    
                case 'searchResults':
                    handleSearchResults(message);
                    if (message.details) {
                        showOperationResult(message.details);
                    }
                    break;
                    
                case 'collectionCreated':
                    console.log('Received collectionCreated message:', message);
                    addLog('success', \`Collection created successfully: \${message.name}\`);
                    if (message.details) {
                        showOperationResult(message.details);
                    }
                    listCollections();
                    break;
                    
                case 'collectionDeleted':
                    addLog('success', \`Collection deleted successfully: \${message.name}\`);
                    if (message.details) {
                        showOperationResult(message.details);
                    }
                    listCollections();
                    break;
                    
                case 'vectorsInserted':
                    addLog('success', \`Successfully inserted \${message.count} vectors\`);
                    if (message.details) {
                        showOperationResult(message.details, 'success');
                    }
                    break;
                    
                case 'vectorsDeleted':
                    addLog('success', \`Successfully deleted \${message.count} vectors\`);
                    if (message.details) {
                        showOperationResult(message.details);
                    }
                    break;
                    
                case 'error':
                    console.log('Received error message:', message);
                    const errorText = message.error || message.details?.error || 'Unknown error';
                    addLog('error', errorText);
                    
                    // Always show popup for errors, create details if not provided
                    const errorDetails = message.details || {
                        message: errorText,
                        operation: 'Operation',
                        timestamp: new Date().toISOString(),
                        type: 'error'
                    };
                    showOperationResult(errorDetails, 'error');
                    break;
            }
        });

        // 连接状态处理
        function handleConnectionStatus(message) {
            const statusDiv = document.getElementById('connection-status');
            if (message.status === 'connected') {
                statusDiv.innerHTML = \`<span>🟢</span> Connected to \${message.type}\`;
                statusDiv.className = 'status-item status-success';
                currentConnection = message.type;
                addLog('success', \`Successfully connected to \${message.type}\`);
                
                // 自动刷新集合列表
                setTimeout(() => listCollections(), 500);
            } else {
                statusDiv.innerHTML = \`<span>🔴</span> Connection failed\`;
                statusDiv.className = 'status-item status-error';
                currentConnection = null;
                addLog('error', \`Connection failed: \${message.error}\`);
            }
        }

        // 集合列表处理
        function handleCollectionsList(message) {
            const collectionsList = document.getElementById('collections-list');
            
            if (!message.collections || message.collections.length === 0) {
                collectionsList.innerHTML = '<div class="grid-item">No collections available</div>';
                updateCollectionSelects([]);
                return;
            }
            
            collectionsList.innerHTML = message.collections.map(collection => {
                const name = collection.name || collection;
                return \`
                    <div class="grid-item">
                        <div class="item-content">
                            <div class="item-title">\${name}</div>
                            <div class="item-meta">Collection • \${currentType}</div>
                        </div>
                        <div class="item-actions">
                            <button class="btn btn-error" onclick="deleteCollection('\${name}')">Delete</button>
                        </div>
                    </div>
                \`;
            }).join('');
            
            updateCollectionSelects(message.collections.map(c => c.name || c));
        }

        // 向量列表处理
        function handleVectorsList(message) {
            const vectorsList = document.getElementById('vectors-list');
            
            if (!message.vectors || message.vectors.length === 0) {
                vectorsList.innerHTML = '<div class="grid-item">No vector data in this collection</div>';
                return;
            }
            
            vectorsList.innerHTML = message.vectors.slice(0, 20).map((vector, index) => {
                return \`
                    <div class="grid-item">
                        <div class="item-content">
                            <div class="item-title">Vector #\${vector.id || index + 1}</div>
                            <div class="item-meta">Dimension: \${Array.isArray(vector.vector) ? vector.vector.length : 'N/A'}</div>
                        </div>
                        <button class="btn btn-secondary" onclick="showVectorDetail(\${index})">Details</button>
                    </div>
                \`;
            }).join('');
            
            if (message.vectors.length > 20) {
                vectorsList.innerHTML += \`<div class="grid-item">Showing first 20 results, \${message.vectors.length} total records</div>\`;
            }
            
            // Store complete data for detail viewing
            window.currentVectors = message.vectors;
        }

        // 搜索结果处理
        function handleSearchResults(message) {
            const searchResults = document.getElementById('search-results');
            
            if (!message.results || message.results.length === 0) {
                searchResults.innerHTML = '<div class="grid-item">未找到相似向量</div>';
                return;
            }
            
            searchResults.innerHTML = message.results.map((result, index) => {
                return \`
                    <div class="grid-item">
                        <div class="item-content">
                            <div class="item-title">向量 #\${result.id}</div>
                            <div class="item-meta">相似度: \${(1 - result.distance).toFixed(4)} | 距离: \${result.distance.toFixed(4)}</div>
                        </div>
                        <button class="btn btn-secondary" onclick="showSearchDetail(\${index})">详情</button>
                    </div>
                \`;
            }).join('');
            
            // 存储完整数据供详情查看使用
            window.currentSearchResults = message.results;
        }

        // 显示向量详情
        function showVectorDetail(index) {
            const vector = window.currentVectors[index];
            const vectorStr = JSON.stringify(vector, null, 2);
            
            showModal(\`向量详情 - #\${vector.id || index + 1}\`, \`
                <div class="code-block">\${vectorStr}</div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="hideModal()">关闭</button>
                </div>
            \`);
        }

        // 显示搜索结果详情
        function showSearchDetail(index) {
            const result = window.currentSearchResults[index];
            const resultStr = JSON.stringify(result, null, 2);
            
            showModal(\`搜索结果详情 - #\${result.id}\`, \`
                <div class="code-block">\${resultStr}</div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="hideModal()">关闭</button>
                </div>
            \`);
        }

        // 更新集合选择器
        function updateCollectionSelects(collections) {
            const selects = [
                document.getElementById('vectors-collection'),
                document.getElementById('search-collection')
            ];
            
            selects.forEach(select => {
                const currentValue = select.value;
                select.innerHTML = '<option value="">选择集合...</option>';
                
                collections.forEach(name => {
                    select.innerHTML += \`<option value="\${name}">\${name}</option>\`;
                });
                
                // 恢复之前的选择
                if (collections.includes(currentValue)) {
                    select.value = currentValue;
                }
            });
        }

        // 初始化
        document.addEventListener('DOMContentLoaded', function() {
            addLog('info', '向量数据库管理工具已启动');
            updateLogsDisplay();
            
            // 设置端口变化监听
            document.getElementById('db-type').addEventListener('change', function() {
                const portInput = document.getElementById('port');
                if (this.value === 'milvus') {
                    portInput.value = '19530';
                } else if (this.value === 'chroma') {
                    portInput.value = '8000';
                }
            });
        });

        const vscode = acquireVsCodeApi();
    </script>
</body>
</html>`;
    }
}