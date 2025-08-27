// The module 'vscode' contains the VS Code extensibility API
import * as vscode from 'vscode';
import { VectorDBManager } from './vectorDBManager';
import { CollectionsProvider } from './collectionsProvider';
import { ConnectionsProvider } from './connectionsProvider';

// This method is called when your extension is activated
export function activate( context: vscode.ExtensionContext ) {
    console.log( 'Vex VectorDB Manager extension is now active!' );

    const manager = new VectorDBManager( context );
    
    // Create view providers for the sidebar
    const collectionsProvider = new CollectionsProvider( manager );
    const connectionsProvider = new ConnectionsProvider( manager );

    // Register the tree data providers
    vscode.window.registerTreeDataProvider( 'vexCollections', collectionsProvider );
    vscode.window.registerTreeDataProvider( 'vexConnections', connectionsProvider );

    // Register commands
    const openManagerCommand = vscode.commands.registerCommand( 'vex.openVectorDBManager', () => {
        manager.showPanel();
    } );

    const refreshCollectionsCommand = vscode.commands.registerCommand( 'vex.refreshCollections', () => {
        collectionsProvider.refresh();
    } );

    const connectToDatabaseCommand = vscode.commands.registerCommand( 'vex.connectToDatabase', () => {
        manager.showPanel();
    } );

    // Add commands to subscriptions
    context.subscriptions.push( openManagerCommand, refreshCollectionsCommand, connectToDatabaseCommand );

    // Automatically show the panel when extension is activated
    // Use a small delay to ensure VS Code is fully loaded
    setTimeout( () => {
        manager.showPanel();
    }, 1000 );
}

// This method is called when your extension is deactivated
export function deactivate() { }
