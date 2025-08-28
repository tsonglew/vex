// The module 'vscode' contains the VS Code extensibility API
import * as vscode from 'vscode';
import { VectorDBManager } from './vectorDBManager';
import { VectorDBTreeProvider, DatabaseConnection } from './vectorDBTreeProvider';

// This method is called when your extension is activated
export function activate( context: vscode.ExtensionContext ) {
    console.log( 'Vex VectorDB Manager extension is now active!' );

    const manager = new VectorDBManager( context );

    // Create the unified tree provider
    const treeProvider = new VectorDBTreeProvider( manager );

    // Register the tree data provider
    vscode.window.registerTreeDataProvider( 'vexVectorDBTree', treeProvider );

    // Register commands
    const openManagerCommand = vscode.commands.registerCommand( 'vex.openVectorDBManager', () => {
        manager.showPanel();
    } );

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
            treeProvider.addConnection( connection );
            // Optionally auto-connect
            if ( connectionDetails.autoConnect ) {
                vscode.commands.executeCommand( 'vex.connectToDatabase', connection );
            }
        }
    } );

    const connectToDatabaseCommand = vscode.commands.registerCommand( 'vex.connectToDatabase', async ( item?: any ) => {
        if ( item?.connection ) {
            try {
                // Use the existing manager to connect
                await connectToDatabase( manager, item.connection );
                treeProvider.updateConnection( item.connection.id, { isConnected: true, lastConnected: new Date() } );
                vscode.window.showInformationMessage( `Connected to ${item.connection.name}` );
            } catch ( error ) {
                vscode.window.showErrorMessage( `Failed to connect: ${error}` );
            }
        } else {
            manager.showPanel();
        }
    } );

    const disconnectFromDatabaseCommand = vscode.commands.registerCommand( 'vex.disconnectFromDatabase', async ( item?: any ) => {
        if ( item?.connection ) {
            try {
                // await manager.disconnect(); // TODO: Implement disconnect method in VectorDBManager
                treeProvider.updateConnection( item.connection.id, { isConnected: false } );
                vscode.window.showInformationMessage( `Disconnected from ${item.connection.name}` );
            } catch ( error ) {
                vscode.window.showErrorMessage( `Failed to disconnect: ${error}` );
            }
        }
    } );

    const editConnectionCommand = vscode.commands.registerCommand( 'vex.editConnection', async ( item?: any ) => {
        if ( item?.connection ) {
            const updatedDetails = await showEditConnectionDialog( item.connection );
            if ( updatedDetails ) {
                treeProvider.updateConnection( item.connection.id, updatedDetails );
                vscode.window.showInformationMessage( `Updated connection ${item.connection.name}` );
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
                treeProvider.removeConnection( item.connection.id );
                vscode.window.showInformationMessage( `Deleted connection ${item.connection.name}` );
            }
        }
    } );

    const createCollectionCommand = vscode.commands.registerCommand( 'vex.createCollection', ( item?: any ) => {
        if ( item?.connection ) {
            manager.showPanel(); // Open the manager with create collection flow
        }
    } );

    const deleteCollectionCommand = vscode.commands.registerCommand( 'vex.deleteCollection', async ( item?: any ) => {
        if ( item?.collection ) {
            const confirmed = await vscode.window.showWarningMessage(
                `Are you sure you want to delete collection "${item.collection.name}"?`,
                'Delete',
                'Cancel'
            );
            if ( confirmed === 'Delete' ) {
                // Implement collection deletion through manager
                vscode.window.showInformationMessage( `Deleted collection ${item.collection.name}` );
                treeProvider.refresh();
            }
        }
    } );

    const viewCollectionCommand = vscode.commands.registerCommand( 'vex.viewCollection', ( item?: any ) => {
        if ( item?.collection ) {
            manager.showPanel(); // Open the manager with collection view
        }
    } );

    const insertVectorsCommand = vscode.commands.registerCommand( 'vex.insertVectors', ( item?: any ) => {
        if ( item?.collection ) {
            manager.showPanel(); // Open the manager with insert vectors flow
        }
    } );

    const searchVectorsCommand = vscode.commands.registerCommand( 'vex.searchVectors', ( item?: any ) => {
        if ( item?.collection ) {
            manager.showPanel(); // Open the manager with search vectors flow
        }
    } );

    // Add all commands to subscriptions
    context.subscriptions.push(
        openManagerCommand,
        refreshTreeViewCommand,
        addConnectionCommand,
        connectToDatabaseCommand,
        disconnectFromDatabaseCommand,
        editConnectionCommand,
        deleteConnectionCommand,
        createCollectionCommand,
        deleteCollectionCommand,
        viewCollectionCommand,
        insertVectorsCommand,
        searchVectorsCommand
    );

    // Automatically show the panel when extension is activated
    // Use a small delay to ensure VS Code is fully loaded
    setTimeout( () => {
        manager.showPanel();
    }, 1000 );
}

// Helper functions
function generateId(): string {
    return Math.random().toString( 36 ).substr( 2, 9 );
}

async function showAddConnectionDialog(): Promise<any> {
    const name = await vscode.window.showInputBox( {
        prompt: 'Enter connection name',
        placeHolder: 'My Vector Database'
    } );
    if ( !name ) return null;

    const type = await vscode.window.showQuickPick( ['milvus', 'chroma'], {
        title: 'Select database type'
    } );
    if ( !type ) return null;

    const host = await vscode.window.showInputBox( {
        prompt: 'Enter host',
        placeHolder: 'localhost',
        value: 'localhost'
    } );
    if ( !host ) return null;

    const port = await vscode.window.showInputBox( {
        prompt: 'Enter port',
        placeHolder: type === 'milvus' ? '19530' : '8000',
        value: type === 'milvus' ? '19530' : '8000'
    } );
    if ( !port ) return null;

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
    if ( !name ) return null;

    const host = await vscode.window.showInputBox( {
        prompt: 'Enter host',
        value: connection.host
    } );
    if ( !host ) return null;

    const port = await vscode.window.showInputBox( {
        prompt: 'Enter port',
        value: connection.port
    } );
    if ( !port ) return null;

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

async function connectToDatabase( manager: VectorDBManager, connection: DatabaseConnection ): Promise<void> {
    // This will integrate with the existing VectorDBManager connection logic
    // For now, simulate the connection
    await new Promise( resolve => setTimeout( resolve, 1000 ) );
}

// This method is called when your extension is deactivated
export function deactivate() { }
