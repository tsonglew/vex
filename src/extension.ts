// The module 'vscode' contains the VS Code extensibility API
import * as vscode from 'vscode';
import { VectorDBTreeProvider, DatabaseConnection } from './vectorDBTreeProvider';
import { DataViewerPanel } from './dataViewerPanel';
import { ConnectionManager } from './connectionManager';
import { VectorWebviewProvider } from './webview/VectorWebviewProvider';

// This method is called when your extension is activated
export function activate( context: vscode.ExtensionContext ) {
    console.log( 'Vex VectorDB Manager extension is now active!' );

    // Create the connection manager
    const connectionManager = new ConnectionManager( context );

    // Create the unified tree provider with context for persistence
    const treeProvider = new VectorDBTreeProvider( connectionManager, context );

    // Register the tree data provider
    vscode.window.registerTreeDataProvider( 'vexVectorDBTree', treeProvider );

    // Register the vectors webview provider
    const vectorsWebviewProvider = new VectorWebviewProvider( context.extensionUri );
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider( 'vex.vectorsView', vectorsWebviewProvider )
    );

    // Register commands
    const refreshTreeViewCommand = vscode.commands.registerCommand( 'vex.refreshTreeView', () => {
        treeProvider.refresh();
    } );

    const addConnectionCommand = vscode.commands.registerCommand( 'vex.addConnection', async () => {
        const connectionDetails = await showAddConnectionDialog();
        if ( connectionDetails ) {
            const connection: DatabaseConnection = {
                id: generateId(),
                name: connectionDetails.name,
                type: connectionDetails.type,
                host: connectionDetails.host,
                port: connectionDetails.port,
                username: connectionDetails.username,
                password: connectionDetails.password,
                isConnected: false
            };

            await treeProvider.addConnection( connection );
            vscode.window.showInformationMessage( `Added database connection: ${connection.name}` );

            // Optionally auto-connect
            if ( connectionDetails.autoConnect ) {
                // Create a DatabaseConnectionItem for the command
                const connectionItem = { connection };
                vscode.commands.executeCommand( 'vex.connectToDatabase', connectionItem );
            }
        }
    } );

    const connectToDatabaseCommand = vscode.commands.registerCommand( 'vex.connectToDatabase', async ( item?: any ) => {
        if ( item?.connection ) {
            try {
                await connectionManager.connectToDatabase( item.connection );
                treeProvider.updateConnection( item.connection.id, { isConnected: true, lastConnected: new Date() } );
                vscode.window.showInformationMessage( `Connected to ${item.connection.name}` );
                treeProvider.refresh(); // Refresh to show real collections
            } catch ( error ) {
                vscode.window.showErrorMessage( `Failed to connect: ${error}` );
            }
        }
    } );

    const disconnectFromDatabaseCommand = vscode.commands.registerCommand( 'vex.disconnectFromDatabase', async ( item?: any ) => {
        if ( item?.connection ) {
            try {
                await connectionManager.disconnectFromDatabase( item.connection.id );
                treeProvider.updateConnection( item.connection.id, { isConnected: false } );
                vscode.window.showInformationMessage( `Disconnected from ${item.connection.name}` );
                treeProvider.refresh(); // Refresh to hide collections
            } catch ( error ) {
                vscode.window.showErrorMessage( `Failed to disconnect: ${error}` );
            }
        }
    } );

    const editConnectionCommand = vscode.commands.registerCommand( 'vex.editConnection', async ( item?: any ) => {
        if ( item?.connection ) {
            const updatedDetails = await showEditConnectionDialog( item.connection );
            if ( updatedDetails ) {
                await treeProvider.updateConnection( item.connection.id, updatedDetails );
                vscode.window.showInformationMessage( `Updated connection ${updatedDetails.name || item.connection.name}` );
            }
        }
    } );

    const deleteConnectionCommand = vscode.commands.registerCommand( 'vex.deleteConnection', async ( item?: any ) => {
        if ( item?.connection ) {
            const confirmed = await vscode.window.showWarningMessage(
                `Are you sure you want to delete connection "${item.connection.name}"?`,
                'Delete',
                'Cancel'
            );
            if ( confirmed === 'Delete' ) {
                await treeProvider.removeConnection( item.connection.id );
                vscode.window.showInformationMessage( `Deleted connection ${item.connection.name}` );
            }
        }
    } );

    const createCollectionCommand = vscode.commands.registerCommand( 'vex.createCollection', async ( item?: any ) => {
        if ( item?.connection ) {
            const collectionDetails = await showCreateCollectionDialog();
            if ( collectionDetails ) {
                try {
                    await connectionManager.createCollection(
                        item.connection.id,
                        collectionDetails.name,
                        collectionDetails.dimension,
                        collectionDetails.metric
                    );
                    vscode.window.showInformationMessage(
                        `Created collection "${collectionDetails.name}" with dimension ${collectionDetails.dimension}`
                    );
                    treeProvider.refresh();
                } catch ( error ) {
                    vscode.window.showErrorMessage( `Failed to create collection: ${error}` );
                }
            }
        }
    } );

    const viewCollectionCommand = vscode.commands.registerCommand( 'vex.viewCollection', async ( item?: any ) => {
        if ( item?.collection ) {
            const collection = item.collection;
            const details = [
                `**Collection:** ${collection.name}`,
                `**Dimension:** ${collection.dimension || 'Unknown'}`,
                `**Vector Count:** ${collection.vectorCount || 0}`,
                `**Database Type:** ${item.connection?.type || 'Unknown'}`,
                `**Host:** ${item.connection?.host || 'Unknown'}:${item.connection?.port || 'Unknown'}`
            ].join( '\n\n' );

            vscode.window.showInformationMessage(
                `Collection Details:\n${details}`,
                { modal: true }
            );
        }
    } );

    const listVectorsCommand = vscode.commands.registerCommand( 'vex.listVectors', async ( item?: any ) => {
        if ( item?.collection && item?.connection ) {
            try {
                // Show loading message
                vscode.window.withProgress( {
                    location: vscode.ProgressLocation.Notification,
                    title: `Loading vectors from "${item.collection.name}"...`,
                    cancellable: false
                }, async ( progress ) => {
                    // Get real vectors from the database with pagination (start with first page)
                    const vectorsResult = await connectionManager.listVectors( item.connection.id, item.collection.name, 0, 100 );

                    const data = {
                        collection: item.collection,
                        vectors: vectorsResult.vectors,
                        total: vectorsResult.total,
                        offset: vectorsResult.offset,
                        limit: vectorsResult.limit,
                        connection: item.connection
                    };

                    // Open the data viewer panel
                    DataViewerPanel.show(
                        context,
                        connectionManager,
                        `Vectors - ${item.collection.name}`,
                        'vectors',
                        data
                    );
                } );

            } catch ( error ) {
                vscode.window.showErrorMessage( `Failed to list vectors: ${error}` );
            }
        }
    } );

    const insertVectorsCommand = vscode.commands.registerCommand( 'vex.insertVectors', async ( item?: any ) => {
        if ( item?.collection && item?.connection ) {
            const vectorData = await showInsertVectorsDialog( item.collection );
            if ( vectorData ) {
                try {
                    const insertedCount = await connectionManager.insertVectors(
                        item.connection.id,
                        item.collection.name,
                        vectorData.vectors,
                        vectorData.ids,
                        vectorData.metadata
                    );
                    vscode.window.showInformationMessage(
                        `Inserted ${insertedCount} vectors into "${item.collection.name}"`
                    );
                    treeProvider.refresh();
                } catch ( error ) {
                    vscode.window.showErrorMessage( `Failed to insert vectors: ${error}` );
                }
            }
        }
    } );

    const searchVectorsCommand = vscode.commands.registerCommand( 'vex.searchVectors', async ( item?: any ) => {
        if ( item?.collection && item?.connection ) {
            const searchData = await showSearchVectorsDialog( item.collection );
            if ( searchData ) {
                try {
                    // Show loading message
                    vscode.window.withProgress( {
                        location: vscode.ProgressLocation.Notification,
                        title: `Searching vectors in "${item.collection.name}"...`,
                        cancellable: false
                    }, async ( progress ) => {
                        // Get real search results from the database
                        const results = await connectionManager.searchVectors(
                            item.connection.id,
                            item.collection.name,
                            searchData.vector,
                            searchData.topK
                        );

                        const data = {
                            results: results,
                            query: {
                                vector: searchData.vector,
                                collection: item.collection.name,
                                topK: searchData.topK
                            },
                            collection: item.collection,
                            connection: item.connection
                        };

                        // Open the data viewer panel
                        DataViewerPanel.show(
                            context,
                            connectionManager,
                            `Search Results - ${item.collection.name}`,
                            'search_results',
                            data
                        );
                    } );

                } catch ( error ) {
                    vscode.window.showErrorMessage( `Failed to search vectors: ${error}` );
                }
            }
        }
    } );

    const deleteCollectionCommand = vscode.commands.registerCommand( 'vex.deleteCollection', async ( item?: any ) => {
        if ( item?.collection && item?.connection ) {
            const confirmed = await vscode.window.showWarningMessage(
                `Are you sure you want to delete collection "${item.collection.name}"?`,
                'Delete',
                'Cancel'
            );
            if ( confirmed === 'Delete' ) {
                try {
                    await connectionManager.deleteCollection( item.connection.id, item.collection.name );
                    vscode.window.showInformationMessage( `Deleted collection ${item.collection.name}` );
                    treeProvider.refresh();
                } catch ( error ) {
                    vscode.window.showErrorMessage( `Failed to delete collection: ${error}` );
                }
            }
        }
    } );

    const viewVectorsCommand = vscode.commands.registerCommand( 'vex.viewVectors', async ( item?: any ) => {
        if ( item?.collectionName ) {
            try {
                // Find the connection for this collection
                const connections = treeProvider.getConnections();
                const connection = connections.find( conn => conn.isConnected );

                if ( !connection ) {
                    vscode.window.showErrorMessage( 'No active database connection found' );
                    return;
                }

                // Show loading message
                vscode.window.withProgress( {
                    location: vscode.ProgressLocation.Notification,
                    title: `Loading vectors from "${item.collectionName}"...`,
                    cancellable: false
                }, async ( progress ) => {
                    // Get real vectors from the database with pagination (start with first page)
                    const vectorsResult = await connectionManager.listVectors( connection.id, item.collectionName, 0, 100 );

                    const data = {
                        collection: { name: item.collectionName },
                        vectors: vectorsResult.vectors,
                        total: vectorsResult.total,
                        offset: vectorsResult.offset,
                        limit: vectorsResult.limit,
                        connection: connection
                    };

                    // Open the data viewer panel
                    DataViewerPanel.show(
                        context,
                        connectionManager,
                        `Vectors - ${item.collectionName}`,
                        'vectors',
                        data
                    );
                } );

            } catch ( error ) {
                vscode.window.showErrorMessage( `Failed to view vectors: ${error}` );
            }
        }
    } );

    const viewVectorDetailsCommand = vscode.commands.registerCommand( 'vex.viewVectorDetails', async ( item?: any ) => {
        if ( item?.vector ) {
            const vector = item.vector;
            const details = [
                `**Vector ID:** ${vector.id || vector._id || 'Unknown'}`,
                `**Dimension:** ${vector.vector?.length || vector.embedding?.length || 'Unknown'}`,
                `**Collection:** ${item.collectionName || 'Unknown'}`,
                `**Metadata:** ${JSON.stringify( vector.metadata || {}, null, 2 )}`,
                `**Vector Data:** ${JSON.stringify( vector.vector || vector.embedding || [], null, 2 )}`
            ].join( '\n\n' );

            vscode.window.showInformationMessage(
                `Vector Details:\n${details}`,
                { modal: true }
            );
        }
    } );

    const viewVectorsInWebviewCommand = vscode.commands.registerCommand( 'vex.viewVectorsInWebview', async ( item?: any ) => {
        if ( item?.collection && item?.connection ) {
            try {
                // Show loading message
                await vscode.window.withProgress( {
                    location: vscode.ProgressLocation.Notification,
                    title: `Loading vectors from "${item.collection.name}"...`,
                    cancellable: false
                }, async ( progress ) => {
                    // Get vectors from the database (all vectors for webview)
                    const vectorsResult = await connectionManager.listVectors( item.connection.id, item.collection.name, 0, 1000 );
                    const vectors = vectorsResult.vectors;

                    // Open the webview panel
                    const panel = vscode.window.createWebviewPanel(
                        'vectorDetails',
                        `Vectors - ${item.collection.name}`,
                        vscode.ViewColumn.One,
                        {
                            enableScripts: true,
                            retainContextWhenHidden: true,
                            localResourceRoots: [vscode.Uri.joinPath( context.extensionUri, 'media' )]
                        }
                    );

                    // Get the webview HTML
                    const scriptUri = panel.webview.asWebviewUri( vscode.Uri.joinPath( context.extensionUri, 'media', 'vectors.js' ) );
                    const styleUri = panel.webview.asWebviewUri( vscode.Uri.joinPath( context.extensionUri, 'media', 'vectors.css' ) );

                    panel.webview.html = getVectorsWebviewHTML( panel.webview, vectors, item.collection.name, styleUri, scriptUri );
                } );

            } catch ( error ) {
                vscode.window.showErrorMessage( `Failed to view vectors: ${error}` );
            }
        }
    } );

    const createDatabaseCommand = vscode.commands.registerCommand( 'vex.createDatabase', async ( item?: any ) => {
        if ( item?.connection ) {
            const databaseName = await vscode.window.showInputBox( {
                prompt: 'Enter database name',
                placeHolder: 'my_database'
            } );

            if ( databaseName ) {
                try {
                    await connectionManager.createDatabase( item.connection.id, databaseName );
                    vscode.window.showInformationMessage( `Created database "${databaseName}"` );
                    // Refresh the tree view to show the new database
                    treeProvider.refresh();
                } catch ( error ) {
                    vscode.window.showErrorMessage( `Failed to create database: ${error}` );
                }
            }
        }
    } );

    const deleteDatabaseCommand = vscode.commands.registerCommand( 'vex.deleteDatabase', async ( item?: any ) => {
        if ( item?.database && item?.connection ) {
            const confirmed = await vscode.window.showWarningMessage(
                `Are you sure you want to delete database "${item.database.name}"? This will also delete all collections and vectors within it.`,
                'Delete',
                'Cancel'
            );
            if ( confirmed === 'Delete' ) {
                try {
                    await connectionManager.deleteDatabase( item.connection.id, item.database.name );
                    vscode.window.showInformationMessage( `Deleted database ${item.database.name}` );
                    // Refresh the tree view to reflect the deleted database
                    treeProvider.refresh();
                } catch ( error ) {
                    vscode.window.showErrorMessage( `Failed to delete database: ${error}` );
                }
            }
        }
    } );

    const refreshConnectionStatusCommand = vscode.commands.registerCommand( 'vex.refreshConnectionStatus', async ( item?: any ) => {
        if ( item?.connection ) {
            try {
                // Check if the connection is still active
                const isConnected = connectionManager.isConnected( item.connection.id );

                if ( isConnected !== item.connection.isConnected ) {
                    // Update the connection status if it changed
                    treeProvider.updateConnection( item.connection.id, { isConnected } );
                    vscode.window.showInformationMessage(
                        `Connection status updated: ${isConnected ? 'Connected' : 'Disconnected'}`
                    );
                } else {
                    vscode.window.showInformationMessage(
                        `Connection status: ${isConnected ? 'Connected' : 'Disconnected'}`
                    );
                    treeProvider.refresh();
                }

                treeProvider.refresh();
            } catch ( error ) {
                vscode.window.showErrorMessage( `Failed to refresh connection status: ${error}` );
            }
        }
    } );

    const refreshDatabasesCommand = vscode.commands.registerCommand( 'vex.refreshDatabases', async () => {
        try {
            vscode.window.showInformationMessage( 'Refreshing databases from all servers...' );
            // Refresh the entire tree view to get updated database lists
            treeProvider.refresh();
        } catch ( error ) {
            vscode.window.showErrorMessage( `Failed to refresh databases: ${error}` );
        }
    } );

    const deleteServerCommand = vscode.commands.registerCommand( 'vex.deleteServer', async ( item?: any ) => {
        if ( item?.connection ) {
            const confirmed = await vscode.window.showWarningMessage(
                `Are you sure you want to delete server "${item.connection.name}"?\n\nThis will remove the server connection and all its databases, collections, and vectors from the tree view.\n\nNote: This only removes the connection from VS Code - it does not affect the actual server or its data.`,
                'Delete Server',
                'Cancel'
            );

            if ( confirmed === 'Delete Server' ) {
                try {
                    // First disconnect if connected
                    if ( item.connection.isConnected ) {
                        try {
                            await connectionManager.disconnectFromDatabase( item.connection.id );
                            vscode.window.showInformationMessage( `Disconnected from server "${item.connection.name}"` );
                        } catch ( disconnectError ) {
                            console.warn( 'Failed to disconnect before deletion:', disconnectError );
                            // Continue with deletion even if disconnect fails
                        }
                    }

                    // Remove the server connection
                    await treeProvider.removeConnection( item.connection.id );
                    vscode.window.showInformationMessage( `Deleted server connection "${item.connection.name}"` );
                } catch ( error ) {
                    vscode.window.showErrorMessage( `Failed to delete server: ${error}` );
                }
            }
        }
    } );

    // Command to clear all connections (for debugging/reset)
    const clearAllConnectionsCommand = vscode.commands.registerCommand( 'vex.clearAllConnections', async () => {
        const confirmed = await vscode.window.showWarningMessage(
            'Are you sure you want to clear all database connections? This action cannot be undone.',
            'Clear All',
            'Cancel'
        );
        if ( confirmed === 'Clear All' ) {
            await treeProvider.clearAllConnections();
        }
    } );

    // Add all commands to subscriptions
    context.subscriptions.push(
        refreshTreeViewCommand,
        addConnectionCommand,
        connectToDatabaseCommand,
        disconnectFromDatabaseCommand,
        editConnectionCommand,
        deleteConnectionCommand,
        createCollectionCommand,
        viewCollectionCommand,
        listVectorsCommand,
        insertVectorsCommand,
        searchVectorsCommand,
        deleteCollectionCommand,
        viewVectorsCommand,
        viewVectorDetailsCommand,
        viewVectorsInWebviewCommand,
        createDatabaseCommand,
        deleteDatabaseCommand,
        refreshConnectionStatusCommand,
        refreshDatabasesCommand,
        deleteServerCommand,
        clearAllConnectionsCommand
    );
}

function getVectorsWebviewHTML( webview: vscode.Webview, vectors: any[], collectionName: string, styleUri: vscode.Uri, scriptUri: vscode.Uri ): string {
    const vectorsJson = JSON.stringify( vectors );

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="${styleUri}" rel="stylesheet">
        <title>Vectors - ${collectionName}</title>
    </head>
    <body>
        <div class="header">
            <h1>Vectors: ${collectionName}</h1>
            <div class="collection-info">
                <span id="collection-name">${collectionName}</span>
                <span id="vector-count">${vectors.length} vectors</span>
            </div>
        </div>
        
        <div class="controls">
            <button id="refresh-btn" class="btn">Refresh</button>
            <button id="clear-btn" class="btn">Clear</button>
        </div>

        <div class="search-container">
            <input type="text" id="search-input" placeholder="Search vectors..." class="search-input">
            <button id="search-btn" class="btn">Search</button>
        </div>

        <div id="vectors-container" class="vectors-container">
            ${vectors.length === 0 ? `
                <div class="empty-state">
                    <p>No vectors found in collection "${collectionName}"</p>
                    <p>Use the insert command to add vectors</p>
                </div>
            ` : ''}
        </div>

        <script src="${scriptUri}"></script>
        <script>
            // Initialize with vectors data
            const vectors = ${vectorsJson};
            const collectionName = "${collectionName}";
            
            // Initialize the webview
            if (window.initializeVectors) {
                window.initializeVectors(vectors, collectionName);
            }
        </script>
    </body>
    </html>`;
}

// Helper functions
function generateId(): string {
    return Math.random().toString( 36 ).substring( 2, 9 );
}

async function showAddConnectionDialog(): Promise<any> {
    const name = await vscode.window.showInputBox( {
        prompt: 'Enter connection name',
        placeHolder: 'My Vector Database'
    } );
    if ( !name ) { return null; }

    const type = await vscode.window.showQuickPick( ['milvus', 'chroma'], {
        title: 'Select database type'
    } );
    if ( !type ) { return null; }

    const host = await vscode.window.showInputBox( {
        prompt: 'Enter host',
        placeHolder: '127.0.0.1',
        value: '127.0.0.1'
    } );
    if ( !host ) { return null; }

    const port = await vscode.window.showInputBox( {
        prompt: 'Enter port',
        placeHolder: type === 'milvus' ? '19530' : '8000',
        value: type === 'milvus' ? '19530' : '8000'
    } );
    if ( !port ) { return null; }

    const username = await vscode.window.showInputBox( {
        prompt: 'Enter username (optional)',
        placeHolder: 'Leave empty if not required'
    } );

    const password = await vscode.window.showInputBox( {
        prompt: 'Enter password (optional)',
        placeHolder: 'Leave empty if not required',
        password: true
    } );

    const autoConnect = await vscode.window.showQuickPick( ['Yes', 'No'], {
        title: 'Connect immediately?'
    } ) === 'Yes';

    return { name, type, host, port, username, password, autoConnect };
}

async function showEditConnectionDialog( connection: DatabaseConnection ): Promise<any> {
    const name = await vscode.window.showInputBox( {
        prompt: 'Enter connection name',
        value: connection.name
    } );
    if ( !name ) { return null; }

    const host = await vscode.window.showInputBox( {
        prompt: 'Enter host',
        value: connection.host
    } );
    if ( !host ) { return null; }

    const port = await vscode.window.showInputBox( {
        prompt: 'Enter port',
        value: connection.port
    } );
    if ( !port ) { return null; }

    const username = await vscode.window.showInputBox( {
        prompt: 'Enter username (optional)',
        value: connection.username || ''
    } );

    const password = await vscode.window.showInputBox( {
        prompt: 'Enter password (optional)',
        password: true
    } );

    return { name, host, port, username, password };
}

async function showCreateCollectionDialog(): Promise<any> {
    const name = await vscode.window.showInputBox( {
        prompt: 'Enter collection name',
        placeHolder: 'my_collection'
    } );
    if ( !name ) { return null; }

    const dimension = await vscode.window.showInputBox( {
        prompt: 'Enter vector dimension',
        placeHolder: '768',
        validateInput: ( value ) => {
            const num = parseInt( value );
            if ( isNaN( num ) || num <= 0 ) {
                return 'Please enter a positive number';
            }
            return null;
        }
    } );
    if ( !dimension ) { return null; }

    const metric = await vscode.window.showQuickPick(
        [
            { label: 'Cosine Similarity', value: 'cosine' },
            { label: 'Euclidean Distance', value: 'euclidean' },
            { label: 'Dot Product', value: 'dot' }
        ],
        {
            title: 'Select similarity metric',
            placeHolder: 'Choose how vectors will be compared'
        }
    );
    if ( !metric ) { return null; }

    return {
        name,
        dimension: parseInt( dimension ),
        metric: metric.value
    };
}

async function showInsertVectorsDialog( collection: any ): Promise<any> {
    const vectorData = await vscode.window.showInputBox( {
        prompt: `Enter vectors for "${collection.name}" (JSON array format)`,
        placeHolder: `[[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]  (dimension: ${collection.dimension})`,
        validateInput: ( value ) => {
            try {
                const vectors = JSON.parse( value );
                if ( !Array.isArray( vectors ) ) {
                    return 'Please enter a valid JSON array';
                }
                if ( vectors.length === 0 ) {
                    return 'Please enter at least one vector';
                }
                for ( const vector of vectors ) {
                    if ( !Array.isArray( vector ) ) {
                        return 'Each vector must be an array of numbers';
                    }
                    if ( collection.dimension && vector.length !== collection.dimension ) {
                        return `Each vector must have ${collection.dimension} dimensions`;
                    }
                }
                return null;
            } catch ( error ) {
                return 'Please enter valid JSON format';
            }
        }
    } );
    if ( !vectorData ) { return null; }

    const ids = await vscode.window.showInputBox( {
        prompt: 'Enter vector IDs (optional, JSON array format)',
        placeHolder: '["id1", "id2", "id3"]'
    } );

    const metadata = await vscode.window.showInputBox( {
        prompt: 'Enter metadata (optional, JSON array format)',
        placeHolder: '[{"category": "A"}, {"category": "B"}]'
    } );

    try {
        const vectors = JSON.parse( vectorData );
        const parsedIds = ids ? JSON.parse( ids ) : null;
        const parsedMetadata = metadata ? JSON.parse( metadata ) : null;

        return { vectors, ids: parsedIds, metadata: parsedMetadata };
    } catch ( error ) {
        vscode.window.showErrorMessage( 'Failed to parse input data' );
        return null;
    }
}

async function showSearchVectorsDialog( collection: any ): Promise<any> {
    const queryVector = await vscode.window.showInputBox( {
        prompt: `Enter query vector for "${collection.name}" (JSON array format)`,
        placeHolder: `[0.1, 0.2, 0.3, 0.4, 0.5]  (dimension: ${collection.dimension})`,
        validateInput: ( value ) => {
            try {
                const vector = JSON.parse( value );
                if ( !Array.isArray( vector ) ) {
                    return 'Please enter a valid JSON array';
                }
                if ( collection.dimension && vector.length !== collection.dimension ) {
                    return `Vector must have ${collection.dimension} dimensions`;
                }
                return null;
            } catch ( error ) {
                return 'Please enter valid JSON format';
            }
        }
    } );
    if ( !queryVector ) { return null; }

    const topK = await vscode.window.showInputBox( {
        prompt: 'Enter number of results to return',
        value: '5',
        validateInput: ( value ) => {
            const num = parseInt( value );
            if ( isNaN( num ) || num <= 0 || num > 100 ) {
                return 'Please enter a number between 1 and 100';
            }
            return null;
        }
    } );
    if ( !topK ) { return null; }

    try {
        const vector = JSON.parse( queryVector );
        return { vector, topK: parseInt( topK ) };
    } catch ( error ) {
        vscode.window.showErrorMessage( 'Failed to parse query vector' );
        return null;
    }
}

// This method is called when your extension is deactivated
export function deactivate() {
    // Clean up connections when extension is deactivated
    // Note: connectionManager cleanup will be handled automatically when extension context is disposed
}
