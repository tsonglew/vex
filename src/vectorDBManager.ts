import * as vscode from 'vscode';

export class VectorDBManager {
    private _panel: vscode.WebviewPanel | undefined;
    private _context: vscode.ExtensionContext;

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
                async ( message ) => {
                    switch ( message.command ) {
                        case 'connect':
                            await this.handleConnect( message );
                            break;
                        case 'listCollections':
                            await this.handleListCollections( message );
                            break;
                        case 'createCollection':
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

    private async handleConnect( message: any ) {
        try {
            const { type, host, port, username, password } = message;

            // Simulate connection for now
            await new Promise( resolve => setTimeout( resolve, 1000 ) );

            this._panel?.webview.postMessage( {
                command: 'connectionStatus',
                status: 'connected',
                type: type,
                info: { message: 'Connection simulated successfully' }
            } );
        } catch ( error ) {
            this._panel?.webview.postMessage( {
                command: 'connectionStatus',
                status: 'error',
                error: error instanceof Error ? error.message : String( error )
            } );
        }
    }

    private async handleListCollections( message: any ) {
        try {
            const { type } = message;

            // Simulate collections list
            const collections = [
                { name: 'sample_collection_1', schema: {} },
                { name: 'sample_collection_2', schema: {} }
            ];

            this._panel?.webview.postMessage( {
                command: 'collectionsList',
                collections
            } );
        } catch ( error ) {
            this._panel?.webview.postMessage( {
                command: 'error',
                error: error instanceof Error ? error.message : String( error )
            } );
        }
    }

    private async handleCreateCollection( message: any ) {
        try {
            const { type, name, dimension, metric } = message;

            // Simulate collection creation
            await new Promise( resolve => setTimeout( resolve, 500 ) );

            this._panel?.webview.postMessage( {
                command: 'collectionCreated',
                name
            } );
        } catch ( error ) {
            this._panel?.webview.postMessage( {
                command: 'error',
                error: error instanceof Error ? error.message : String( error )
            } );
        }
    }

    private async handleDeleteCollection( message: any ) {
        try {
            const { type, name } = message;

            // Simulate collection deletion
            await new Promise( resolve => setTimeout( resolve, 500 ) );

            this._panel?.webview.postMessage( {
                command: 'collectionDeleted',
                name
            } );
        } catch ( error ) {
            this._panel?.webview.postMessage( {
                command: 'error',
                error: error instanceof Error ? error.message : String( error )
            } );
        }
    }

    private async handleInsertVectors( message: any ) {
        try {
            const { type, collection, vectors, ids, metadata } = message;

            // Simulate vector insertion
            await new Promise( resolve => setTimeout( resolve, 500 ) );

            this._panel?.webview.postMessage( {
                command: 'vectorsInserted',
                count: vectors.length
            } );
        } catch ( error ) {
            this._panel?.webview.postMessage( {
                command: 'error',
                error: error instanceof Error ? error.message : String( error )
            } );
        }
    }

    private async handleSearchVectors( message: any ) {
        try {
            const { type, collection, vector, topK } = message;

            // Simulate vector search
            await new Promise( resolve => setTimeout( resolve, 500 ) );

            const results = [
                { id: '1', distance: 0.1, vector: [0.1, 0.2, 0.3] },
                { id: '2', distance: 0.2, vector: [0.4, 0.5, 0.6] }
            ];

            this._panel?.webview.postMessage( {
                command: 'searchResults',
                results
            } );
        } catch ( error ) {
            this._panel?.webview.postMessage( {
                command: 'error',
                error: error instanceof Error ? error.message : String( error )
            } );
        }
    }

    private async handleListVectors( message: any ) {
        try {
            const { type, collection } = message;

            // Simulate vector listing
            await new Promise( resolve => setTimeout( resolve, 500 ) );

            const vectors = [
                { id: '1', vector: [0.1, 0.2, 0.3], metadata: {} },
                { id: '2', vector: [0.4, 0.5, 0.6], metadata: {} }
            ];

            this._panel?.webview.postMessage( {
                command: 'vectorsList',
                vectors
            } );
        } catch ( error ) {
            this._panel?.webview.postMessage( {
                command: 'error',
                error: error instanceof Error ? error.message : String( error )
            } );
        }
    }

    private async handleDeleteVectors( message: any ) {
        try {
            const { type, collection, ids } = message;

            // Simulate vector deletion
            await new Promise( resolve => setTimeout( resolve, 500 ) );

            this._panel?.webview.postMessage( {
                command: 'vectorsDeleted',
                count: ids.length
            } );
        } catch ( error ) {
            this._panel?.webview.postMessage( {
                command: 'error',
                error: error instanceof Error ? error.message : String( error )
            } );
        }
    }

    private getWebviewContent() {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VectorDB Manager</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .connection-form {
            background: var(--vscode-input-background);
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .form-group {
            margin-bottom: 15px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: 500;
        }
        input, select {
            width: 100%;
            padding: 8px;
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
        }
        button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            margin-right: 10px;
        }
        button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .status {
            padding: 10px;
            border-radius: 4px;
            margin: 10px 0;
        }
        .success {
            background: var(--vscode-notificationsInfoBackground);
            color: var(--vscode-notificationsInfoForeground);
        }
        .error {
            background: var(--vscode-notificationsErrorBackground);
            color: var(--vscode-notificationsErrorForeground);
        }
        .tabs {
            display: flex;
            border-bottom: 1px solid var(--vscode-input-border);
            margin-bottom: 20px;
        }
        .tab {
            padding: 10px 20px;
            cursor: pointer;
            border-bottom: 2px solid transparent;
        }
        .tab.active {
            border-bottom-color: var(--vscode-focusBorder);
        }
        .tab-content {
            display: none;
        }
        .tab-content.active {
            display: block;
        }
        .collection-item, .vector-item {
            background: var(--vscode-list-hoverBackground);
            padding: 10px;
            margin: 5px 0;
            border-radius: 4px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        pre {
            background: var(--vscode-textBlockQuote-background);
            padding: 10px;
            border-radius: 4px;
            overflow-x: auto;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>VectorDB Manager</h1>
        </div>

        <div class="connection-form">
            <h3>Database Connection</h3>
            <div class="form-group">
                <label for="db-type">Database Type:</label>
                <select id="db-type">
                    <option value="milvus">Milvus</option>
                    <option value="chroma">ChromaDB</option>
                </select>
            </div>
            <div class="form-group">
                <label for="host">Host:</label>
                <input type="text" id="host" value="localhost" />
            </div>
            <div class="form-group">
                <label for="port">Port:</label>
                <input type="text" id="port" value="19530" />
            </div>
            <div class="form-group">
                <label for="username">Username:</label>
                <input type="text" id="username" />
            </div>
            <div class="form-group">
                <label for="password">Password:</label>
                <input type="password" id="password" />
            </div>
            <button onclick="connect()">Connect</button>
        </div>

        <div id="connection-status"></div>

        <div class="tabs">
            <div class="tab active" onclick="switchTab('collections')">Collections</div>
            <div class="tab" onclick="switchTab('vectors')">Vectors</div>
            <div class="tab" onclick="switchTab('search')">Search</div>
        </div>

        <div id="collections-tab" class="tab-content active">
            <h3>Collections</h3>
            <button onclick="listCollections()">List Collections</button>
            <button onclick="showCreateCollection()">Create Collection</button>
            <div id="collections-list"></div>
            
            <div id="create-collection-form" style="display: none;">
                <h4>Create Collection</h4>
                <div class="form-group">
                    <label for="collection-name">Name:</label>
                    <input type="text" id="collection-name" />
                </div>
                <div class="form-group">
                    <label for="collection-dimension">Dimension:</label>
                    <input type="number" id="collection-dimension" value="128" />
                </div>
                <div class="form-group">
                    <label for="collection-metric">Metric:</label>
                    <select id="collection-metric">
                        <option value="cosine">Cosine</option>
                        <option value="euclidean">Euclidean</option>
                        <option value="dot">Dot Product</option>
                    </select>
                </div>
                <button onclick="createCollection()">Create</button>
                <button onclick="hideCreateCollection()">Cancel</button>
            </div>
        </div>

        <div id="vectors-tab" class="tab-content">
            <h3>Vectors</h3>
            <button onclick="listVectors()">List Vectors</button>
            <button onclick="showInsertVectors()">Insert Vectors</button>
            <div id="vectors-list"></div>
            
            <div id="insert-vectors-form" style="display: none;">
                <h4>Insert Vectors</h4>
                <div class="form-group">
                    <label for="vectors-collection">Collection:</label>
                    <select id="vectors-collection"></select>
                </div>
                <div class="form-group">
                    <label for="vectors-data">Vectors (JSON array):</label>
                    <textarea id="vectors-data" rows="4" placeholder='[[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]'></textarea>
                </div>
                <div class="form-group">
                    <label for="vectors-ids">IDs (optional, JSON array):</label>
                    <textarea id="vectors-ids" rows="2" placeholder='["id1", "id2"]'></textarea>
                </div>
                <div class="form-group">
                    <label for="vectors-metadata">Metadata (optional, JSON array):</label>
                    <textarea id="vectors-metadata" rows="2" placeholder='[{"key": "value"}, {"key": "value"}]'></textarea>
                </div>
                <button onclick="insertVectors()">Insert</button>
                <button onclick="hideInsertVectors()">Cancel</button>
            </div>
        </div>

        <div id="search-tab" class="tab-content">
            <h3>Search Vectors</h3>
            <div class="form-group">
                <label for="search-collection">Collection:</label>
                <select id="search-collection"></select>
            </div>
            <div class="form-group">
                <label for="query-vector">Query Vector (JSON array):</label>
                <textarea id="query-vector" rows="4" placeholder='[0.1, 0.2, 0.3]'></textarea>
            </div>
            <div class="form-group">
                <label for="top-k">Top K:</label>
                <input type="number" id="top-k" value="5" min="1" max="100" />
            </div>
            <button onclick="searchVectors()">Search</button>
            <div id="search-results"></div>
        </div>
    </div>

    <script>
        let currentType = 'milvus';
        let currentConnection = null;

        function switchTab(tabName) {
            document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            
            document.querySelector(\`[onclick="switchTab('\${tabName}')"]\`).classList.add('active');
            document.getElementById(\`\${tabName}-tab\`).classList.add('active');
        }

        function connect() {
            const type = document.getElementById('db-type').value;
            const host = document.getElementById('host').value;
            const port = document.getElementById('port').value;
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            
            currentType = type;
            
            vscode.postMessage({
                command: 'connect',
                type,
                host,
                port,
                username,
                password
            });
        }

        function listCollections() {
            vscode.postMessage({
                command: 'listCollections',
                type: currentType
            });
        }

        function showCreateCollection() {
            document.getElementById('create-collection-form').style.display = 'block';
        }

        function hideCreateCollection() {
            document.getElementById('create-collection-form').style.display = 'none';
        }

        function createCollection() {
            const name = document.getElementById('collection-name').value;
            const dimension = parseInt(document.getElementById('collection-dimension').value);
            const metric = document.getElementById('collection-metric').value;
            
            vscode.postMessage({
                command: 'createCollection',
                type: currentType,
                name,
                dimension,
                metric
            });
        }

        function deleteCollection(name) {
            if (confirm(\`Are you sure you want to delete collection "\${name}"?\`)) {
                vscode.postMessage({
                    command: 'deleteCollection',
                    type: currentType,
                    name
                });
            }
        }

        function listVectors() {
            const collection = document.getElementById('vectors-collection').value;
            vscode.postMessage({
                command: 'listVectors',
                type: currentType,
                collection
            });
        }

        function showInsertVectors() {
            document.getElementById('insert-vectors-form').style.display = 'block';
        }

        function hideInsertVectors() {
            document.getElementById('insert-vectors-form').style.display = 'none';
        }

        function insertVectors() {
            const collection = document.getElementById('vectors-collection').value;
            const vectors = JSON.parse(document.getElementById('vectors-data').value);
            const ids = document.getElementById('vectors-ids').value ? JSON.parse(document.getElementById('vectors-ids').value) : null;
            const metadata = document.getElementById('vectors-metadata').value ? JSON.parse(document.getElementById('vectors-metadata').value) : null;
            
            vscode.postMessage({
                command: 'insertVectors',
                type: currentType,
                collection,
                vectors,
                ids,
                metadata
            });
        }

        function searchVectors() {
            const collection = document.getElementById('search-collection').value;
            const vector = JSON.parse(document.getElementById('query-vector').value);
            const topK = parseInt(document.getElementById('top-k').value);
            
            vscode.postMessage({
                command: 'searchVectors',
                type: currentType,
                collection,
                vector,
                topK
            });
        }

        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.command) {
                case 'connectionStatus':
                    const statusDiv = document.getElementById('connection-status');
                    if (message.status === 'connected') {
                        statusDiv.innerHTML = \`<div class="status success">Connected to \${message.type} successfully!</div>\`;
                        currentConnection = message.type;
                    } else {
                        statusDiv.innerHTML = \`<div class="status error">Connection failed: \${message.error}</div>\`;
                    }
                    break;
                    
                case 'collectionsList':
                    const collectionsList = document.getElementById('collections-list');
                    collectionsList.innerHTML = '';
                    
                    message.collections.forEach(collection => {
                        const div = document.createElement('div');
                        div.className = 'collection-item';
                        div.innerHTML = \`
                            <span>\${collection.name || collection}</span>
                            <button onclick="deleteCollection('\${collection.name || collection}')">Delete</button>
                        \`;
                        collectionsList.appendChild(div);
                    });
                    
                    updateCollectionSelects();
                    break;
                    
                case 'vectorsList':
                    const vectorsList = document.getElementById('vectors-list');
                    vectorsList.innerHTML = '';
                    
                    if (message.vectors && message.vectors.length > 0) {
                        message.vectors.forEach(vector => {
                            const div = document.createElement('div');
                            div.className = 'vector-item';
                            div.innerHTML = \`<pre>\${JSON.stringify(vector, null, 2)}</pre>\`;
                            vectorsList.appendChild(div);
                        });
                    } else {
                        vectorsList.innerHTML = '<p>No vectors found</p>';
                    }
                    break;
                    
                case 'searchResults':
                    const searchResults = document.getElementById('search-results');
                    searchResults.innerHTML = '';
                    
                    if (message.results && message.results.length > 0) {
                        message.results.forEach(result => {
                            const div = document.createElement('div');
                            div.className = 'vector-item';
                            div.innerHTML = \`<pre>\${JSON.stringify(result, null, 2)}</pre>\`;
                            searchResults.appendChild(div);
                        });
                    } else {
                        searchResults.innerHTML = '<p>No results found</p>';
                    }
                    break;
                    
                case 'collectionCreated':
                case 'collectionDeleted':
                case 'vectorsInserted':
                case 'vectorsDeleted':
                    listCollections();
                    break;
                    
                case 'error':
                    vscode.window.showErrorMessage(message.error);
                    break;
            }
        });

        function updateCollectionSelects() {
            const selects = [
                document.getElementById('vectors-collection'),
                document.getElementById('search-collection')
            ];
            
            selects.forEach(select => {
                select.innerHTML = '';
                // This should be populated when collections are listed
            });
        }

        const vscode = acquireVsCodeApi();
    </script>
</body>
</html>`;
    }
}