import * as vscode from 'vscode';
import { ConnectionManager } from './connectionManager.js';

export class DataViewerPanel {
    private static currentPanels = new Map<string, DataViewerPanel>();
    private _panel: vscode.WebviewPanel | undefined;
    private _context: vscode.ExtensionContext;
    private _connectionManager: ConnectionManager;
    private _data: any;
    private _title: string;
    private _viewType: 'vectors' | 'search_results' | 'collections';

    constructor(
        context: vscode.ExtensionContext,
        connectionManager: ConnectionManager,
        title: string,
        viewType: 'vectors' | 'search_results' | 'collections',
        data: any
    ) {
        this._context = context;
        this._connectionManager = connectionManager;
        this._title = title;
        this._viewType = viewType;
        this._data = data;
    }

    public static show(
        context: vscode.ExtensionContext,
        connectionManager: ConnectionManager,
        title: string,
        viewType: 'vectors' | 'search_results' | 'collections',
        data: any
    ): DataViewerPanel {
        const panelKey = `${viewType}_${title}`;

        // Check if we already have a panel for this data
        const existingPanel = DataViewerPanel.currentPanels.get( panelKey );
        if ( existingPanel ) {
            existingPanel._panel?.reveal();
            existingPanel.updateData( data );
            return existingPanel;
        }

        // Create new panel
        const panel = new DataViewerPanel( context, connectionManager, title, viewType, data );
        panel.createPanel();
        DataViewerPanel.currentPanels.set( panelKey, panel );
        return panel;
    }

    private createPanel(): void {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        this._panel = vscode.window.createWebviewPanel(
            'vexDataViewer',
            this._title,
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [this._context.extensionUri]
            }
        );

        this._panel.webview.html = this.getWebviewContent();

        this._panel.onDidDispose( () => {
            const panelKey = `${this._viewType}_${this._title}`;
            DataViewerPanel.currentPanels.delete( panelKey );
            this._panel = undefined;
        } );

        // Handle messages from webview
        this._panel.webview.onDidReceiveMessage(
            ( message: any ) => {
                switch ( message.command ) {
                    case 'refresh':
                        this.refresh();
                        break;
                    case 'export':
                        this.exportData();
                        break;
                    case 'nextPage':
                        this.loadPage( message.page );
                        break;
                    case 'prevPage':
                        this.loadPage( message.page );
                        break;
                    case 'goToPage':
                        this.loadPage( message.page );
                        break;
                    case 'changePageSize':
                        this.changePageSize( message.page, message.limit );
                        break;
                }
            },
            undefined,
            this._context.subscriptions
        );
    }

    public updateData( data: any ): void {
        this._data = data;
        if ( this._panel ) {
            this._panel.webview.html = this.getWebviewContent();
        }
    }

    private refresh(): void {
        // TODO: Implement refresh logic - fetch fresh data from database
        vscode.window.showInformationMessage( 'Refreshing data...' );
    }

    private exportData(): void {
        // TODO: Implement export functionality
        const dataStr = JSON.stringify( this._data, null, 2 );
        vscode.env.clipboard.writeText( dataStr );
        vscode.window.showInformationMessage( 'Data copied to clipboard!' );
    }

    private async loadPage( page: number ): Promise<void> {
        if ( this._viewType !== 'vectors' || !this._data.connection ) {
            return;
        }

        const limit = this._data.limit || 100;
        const offset = page * limit;

        try {
            // Get new page of vectors using the existing connection manager
            const vectorsResult = await this._connectionManager.listVectors(
                this._data.connection.id,
                this._data.collection.name,
                offset,
                limit
            );

            // Update data with new page
            this._data = {
                ...this._data,
                vectors: vectorsResult.vectors,
                total: vectorsResult.total,
                offset: vectorsResult.offset,
                limit: vectorsResult.limit
            };

            // Update webview content
            if ( this._panel ) {
                this._panel.webview.html = this.getWebviewContent();
            }
        } catch ( error ) {
            vscode.window.showErrorMessage( `Failed to load page ${page + 1}: ${error}` );
        }
    }

    private async changePageSize( page: number, newLimit: number ): Promise<void> {
        if ( this._viewType !== 'vectors' || !this._data.connection ) {
            return;
        }

        const offset = page * newLimit;

        try {
            // Get vectors with new page size using the existing connection manager
            const vectorsResult = await this._connectionManager.listVectors(
                this._data.connection.id,
                this._data.collection.name,
                offset,
                newLimit
            );

            // Update data with new page size
            this._data = {
                ...this._data,
                vectors: vectorsResult.vectors,
                total: vectorsResult.total,
                offset: vectorsResult.offset,
                limit: vectorsResult.limit
            };

            // Update webview content
            if ( this._panel ) {
                this._panel.webview.html = this.getWebviewContent();
            }
        } catch ( error ) {
            vscode.window.showErrorMessage( `Failed to change page size: ${error}` );
        }
    }

    private getWebviewContent(): string {
        const data = this._data;
        let contentHtml = '';

        switch ( this._viewType ) {
            case 'vectors':
                contentHtml = this.getVectorListContent( data );
                break;
            case 'search_results':
                contentHtml = this.getSearchResultsContent( data );
                break;
            case 'collections':
                contentHtml = this.getCollectionListContent( data );
                break;
        }

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this._title}</title>
    <style>
        :root {
            /* VS Code Theme Integration */
            --primary-color: var(--vscode-button-background, #0078d4);
            --primary-hover: var(--vscode-button-hoverBackground, #106ebe);
            --secondary-color: var(--vscode-button-secondaryBackground, #5f6368);
            --success-color: var(--vscode-testing-iconPassed, #16825d);
            --warning-color: var(--vscode-list-warningForeground, #bf8803);
            --error-color: var(--vscode-list-errorForeground, #f14c4c);
            
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
            padding: 20px;
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid var(--border-color);
        }

        .title {
            font-size: 24px;
            font-weight: 600;
            color: var(--text-primary);
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .title-icon {
            font-size: 28px;
        }

        .toolbar {
            display: flex;
            gap: 10px;
        }

        .btn {
            height: 32px;
            padding: 0 16px;
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
            gap: 6px;
            border-radius: 3px;
            user-select: none;
        }

        .btn:hover:not(:disabled) {
            background: var(--primary-hover);
        }

        .btn:focus {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: 2px;
        }

        .btn-secondary {
            background: var(--secondary-color);
            color: var(--vscode-button-secondaryForeground, var(--text-primary));
        }

        .data-container {
            background: var(--panel-bg);
            border: 1px solid var(--border-color);
            border-radius: 6px;
            overflow: hidden;
        }

        .data-table {
            width: 100%;
            border-collapse: collapse;
            background: var(--vscode-editor-background);
        }

        .data-table th {
            background: var(--vscode-editorGroupHeader-tabsBackground);
            color: var(--text-primary);
            font-weight: 600;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            padding: 12px;
            text-align: left;
            border-bottom: 2px solid var(--border-color);
            position: sticky;
            top: 0;
            z-index: 1;
        }

        .data-table td {
            padding: 12px;
            border-bottom: 1px solid var(--border-color);
            vertical-align: top;
        }

        .data-table tr:hover {
            background: var(--hover-bg);
        }

        .data-table tr:nth-child(even) {
            background: color-mix(in srgb, var(--panel-bg) 50%, transparent);
        }

        .data-table tr:nth-child(even):hover {
            background: var(--hover-bg);
        }

        .vector-id {
            font-weight: 600;
            color: var(--primary-color);
            font-family: var(--vscode-editor-font-family, 'Cascadia Code', monospace);
        }

        .vector-data {
            font-family: var(--vscode-editor-font-family, 'Cascadia Code', monospace);
            font-size: 11px;
            background: var(--input-bg);
            padding: 4px 6px;
            border-radius: 3px;
            max-width: 300px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .vector-data:hover {
            max-width: none;
            white-space: normal;
            word-break: break-all;
            background: var(--hover-bg);
        }

        .metadata {
            font-family: var(--vscode-editor-font-family, 'Cascadia Code', monospace);
            font-size: 11px;
            color: var(--text-secondary);
            background: var(--input-bg);
            padding: 4px 6px;
            border-radius: 3px;
        }

        .score {
            font-weight: 600;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 11px;
            text-align: center;
            min-width: 60px;
        }

        .score.high {
            background: color-mix(in srgb, var(--success-color) 20%, var(--panel-bg));
            color: var(--success-color);
        }

        .score.medium {
            background: color-mix(in srgb, var(--warning-color) 20%, var(--panel-bg));
            color: var(--warning-color);
        }

        .score.low {
            background: color-mix(in srgb, var(--error-color) 20%, var(--panel-bg));
            color: var(--error-color);
        }

        .dimension-badge {
            background: var(--primary-color);
            color: var(--vscode-button-foreground, white);
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
        }

        .stats-container {
            display: flex;
            gap: 20px;
            margin-bottom: 20px;
            flex-wrap: wrap;
        }

        .stat-card {
            background: var(--panel-bg);
            border: 1px solid var(--border-color);
            border-radius: 6px;
            padding: 16px;
            min-width: 150px;
            flex: 1;
        }

        .stat-label {
            color: var(--text-secondary);
            font-size: 12px;
            margin-bottom: 4px;
        }

        .stat-value {
            font-size: 20px;
            font-weight: 600;
            color: var(--primary-color);
        }

        .empty-state {
            text-align: center;
            padding: 60px 20px;
            color: var(--text-secondary);
        }

        .empty-state-icon {
            font-size: 48px;
            margin-bottom: 16px;
            opacity: 0.5;
        }

        .empty-state-title {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 8px;
            color: var(--text-primary);
        }

        .empty-state-description {
            font-size: 14px;
            line-height: 1.5;
        }

        .loading {
            text-align: center;
            padding: 40px;
            color: var(--text-secondary);
        }

        .spinner {
            width: 32px;
            height: 32px;
            border: 3px solid color-mix(in srgb, var(--primary-color) 20%, transparent);
            border-top: 3px solid var(--primary-color);
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 16px;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .pagination {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 20px;
            padding: 16px;
            background: var(--panel-bg);
            border-top: 1px solid var(--border-color);
        }

        .pagination-info {
            color: var(--text-secondary);
            font-size: 12px;
        }

        .pagination-controls {
            display: flex;
            gap: 8px;
        }

        /* Responsive Design */
        @media (max-width: 768px) {
            body {
                padding: 10px;
            }
            
            .header {
                flex-direction: column;
                gap: 15px;
                align-items: stretch;
            }
            
            .toolbar {
                justify-content: center;
            }
            
            .stats-container {
                flex-direction: column;
            }
            
            .data-table {
                font-size: 11px;
            }
            
            .data-table th,
            .data-table td {
                padding: 8px;
            }
        }

        /* Dark theme enhancements */
        @media (prefers-color-scheme: dark) {
            .data-table tr:nth-child(even) {
                background: color-mix(in srgb, var(--panel-bg) 30%, transparent);
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">
            <span class="title-icon">${this.getTitleIcon()}</span>
            ${this._title}
        </div>
        <div class="toolbar">
            <button class="btn" onclick="refresh()">
                🔄 Refresh
            </button>
            <button class="btn btn-secondary" onclick="exportData()">
                📄 Export
            </button>
        </div>
    </div>

    ${contentHtml}

    <script>
        const vscode = acquireVsCodeApi();

        function refresh() {
            vscode.postMessage({ command: 'refresh' });
        }

        function exportData() {
            vscode.postMessage({ command: 'export' });
        }
    </script>
</body>
</html>`;
    }

    private getTitleIcon(): string {
        switch ( this._viewType ) {
            case 'vectors': return '🔢';
            case 'search_results': return '🔍';
            case 'collections': return '📚';
            default: return '📊';
        }
    }

    private getVectorListContent( data: any ): string {
        if ( !data || !data.vectors || data.vectors.length === 0 ) {
            return `
                <div class="empty-state">
                    <div class="empty-state-icon">📭</div>
                    <div class="empty-state-title">No Vectors Found</div>
                    <div class="empty-state-description">
                        This collection doesn't contain any vectors yet.<br>
                        Try inserting some vectors to see them here.
                    </div>
                </div>
            `;
        }

        const vectors = data.vectors;
        const collection = data.collection || {};
        const total = data.total || vectors.length;
        const offset = data.offset || 0;
        const limit = data.limit || 100;

        // Calculate stats
        const avgDimension = vectors.length > 0 ?
            vectors.reduce( ( sum: number, v: any ) => sum + ( v.vector?.length || 0 ), 0 ) / vectors.length : 0;
        const hasMetadata = vectors.some( ( v: any ) => v.metadata && Object.keys( v.metadata ).length > 0 );

        const statsHtml = `
            <div class="stats-container">
                <div class="stat-card">
                    <div class="stat-label">Total Vectors</div>
                    <div class="stat-value">${total.toLocaleString()}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Collection</div>
                    <div class="stat-value">${collection.name || 'Unknown'}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Avg Dimension</div>
                    <div class="stat-value">${Math.round( avgDimension )}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Has Metadata</div>
                    <div class="stat-value">${hasMetadata ? 'Yes' : 'No'}</div>
                </div>
            </div>
        `;

        const tableRows = vectors.map( ( vector: any, index: number ) => {
            const vectorData = vector.vector ? JSON.stringify( vector.vector ) : 'N/A';
            const metadata = vector.metadata ? JSON.stringify( vector.metadata ) : '';

            return `
                <tr>
                    <td><span class="vector-id">${vector.id || `vec_${index + 1}`}</span></td>
                    <td><span class="dimension-badge">${vector.vector?.length || 0}D</span></td>
                    <td><div class="vector-data" title="Click to expand">${vectorData}</div></td>
                    <td><div class="metadata">${metadata}</div></td>
                </tr>
            `;
        } ).join( '' );

        return `
            ${statsHtml}
            <div class="data-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Vector ID</th>
                            <th>Dimension</th>
                            <th>Vector Data</th>
                            <th>Metadata</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
                <div class="pagination">
                    <div class="pagination-info">
                        Showing ${offset + 1} - ${Math.min( offset + limit, total )} of ${total.toLocaleString()} vectors
                    </div>
                    <div class="pagination-controls">
                        <button id="first-page-btn" class="pagination-btn" ${offset === 0 ? 'disabled' : ''} onclick="goToFirstPage()">
                            ⏮ First
                        </button>
                        <button id="prev-page-btn" class="pagination-btn" ${offset === 0 ? 'disabled' : ''} onclick="goToPrevPage()">
                            ← Prev
                        </button>
                        <span class="page-info">
                            Page ${Math.floor( offset / limit ) + 1} of ${Math.ceil( total / limit )}
                        </span>
                        <button id="next-page-btn" class="pagination-btn" ${offset + limit >= total ? 'disabled' : ''} onclick="goToNextPage()">
                            Next →
                        </button>
                        <button id="last-page-btn" class="pagination-btn" ${offset + limit >= total ? 'disabled' : ''} onclick="goToLastPage()">
                            Last ⏭
                        </button>
                    </div>
                    <div class="pagination-size">
                        <label>Vectors per page:</label>
                        <select id="page-size-select" onchange="changePageSize(this.value)">
                            <option value="50" ${limit === 50 ? 'selected' : ''}>50</option>
                            <option value="100" ${limit === 100 ? 'selected' : ''}>100</option>
                            <option value="200" ${limit === 200 ? 'selected' : ''}>200</option>
                            <option value="500" ${limit === 500 ? 'selected' : ''}>500</option>
                        </select>
                    </div>
                </div>
                <script>
                    const vscode = acquireVsCodeApi();
                    
                    function goToFirstPage() {
                        vscode.postMessage({ command: 'goToPage', page: 0 });
                    }
                    
                    function goToPrevPage() {
                        const currentPage = Math.floor(${offset} / ${limit});
                        vscode.postMessage({ command: 'prevPage', page: currentPage - 1 });
                    }
                    
                    function goToNextPage() {
                        const currentPage = Math.floor(${offset} / ${limit});
                        vscode.postMessage({ command: 'nextPage', page: currentPage + 1 });
                    }
                    
                    function goToLastPage() {
                        const lastPage = Math.ceil(${total} / ${limit}) - 1;
                        vscode.postMessage({ command: 'goToPage', page: lastPage });
                    }
                    
                    function changePageSize(newLimit) {
                        // Recalculate current page with new limit
                        const currentItem = ${offset} + 1;
                        const newPage = Math.floor((currentItem - 1) / parseInt(newLimit));
                        vscode.postMessage({ command: 'changePageSize', page: newPage, limit: parseInt(newLimit) });
                    }
                </script>
            </div>
        `;
    }

    private getSearchResultsContent( data: any ): string {
        if ( !data || !data.results || data.results.length === 0 ) {
            return `
                <div class="empty-state">
                    <div class="empty-state-icon">🔍</div>
                    <div class="empty-state-title">No Search Results</div>
                    <div class="empty-state-description">
                        No similar vectors were found for your query.<br>
                        Try adjusting your search parameters or query vector.
                    </div>
                </div>
            `;
        }

        const results = data.results;
        const query = data.query || {};

        const statsHtml = `
            <div class="stats-container">
                <div class="stat-card">
                    <div class="stat-label">Results Found</div>
                    <div class="stat-value">${results.length}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Query Dimension</div>
                    <div class="stat-value">${query.vector?.length || 0}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Best Score</div>
                    <div class="stat-value">${results[0]?.score?.toFixed( 4 ) || '0.0000'}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Collection</div>
                    <div class="stat-value">${query.collection || 'Unknown'}</div>
                </div>
            </div>
        `;

        const tableRows = results.map( ( result: any, index: number ) => {
            const score = result.score || result.distance || 0;
            const scoreClass = score > 0.8 ? 'high' : score > 0.5 ? 'medium' : 'low';

            return `
                <tr>
                    <td>${index + 1}</td>
                    <td><span class="vector-id">${result.id || `result_${index + 1}`}</span></td>
                    <td><span class="score ${scoreClass}">${score.toFixed( 4 )}</span></td>
                    <td><div class="vector-data">${result.vector ? JSON.stringify( result.vector ) : 'N/A'}</div></td>
                    <td><div class="metadata">${result.metadata ? JSON.stringify( result.metadata ) : ''}</div></td>
                </tr>
            `;
        } ).join( '' );

        return `
            ${statsHtml}
            <div class="data-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Rank</th>
                            <th>Vector ID</th>
                            <th>Similarity Score</th>
                            <th>Vector Data</th>
                            <th>Metadata</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            </div>
        `;
    }

    private getCollectionListContent( data: any ): string {
        // TODO: Implement collection list view
        return '<div class="loading"><div class="spinner"></div>Collection list view coming soon...</div>';
    }
}
