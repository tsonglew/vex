import { useEffect, useState, useCallback } from 'react';

// VS Code API type definitions
interface VSCodeAPI {
    postMessage( message: any ): void;
    getState(): any;
    setState( state: any ): void;
}

declare global {
    interface Window {
        acquireVsCodeApi(): VSCodeAPI;
    }
}

// Message types based on the existing communication protocol
export interface VSCodeMessage {
    command: string;
    [key: string]: any;
}

export interface CollectionData {
    collectionInfo: any;
    collectionStats: any;
    indexes: any[];
    partitions: any[];
}

let vscodeApi: VSCodeAPI | null = null;

// Initialize VS Code API
export const getVSCodeAPI = (): VSCodeAPI => {
    if ( !vscodeApi ) {
        vscodeApi = window.acquireVsCodeApi();
    }
    return vscodeApi;
};

// Hook for VS Code communication
export function useVscode<T = any>() {
    const [state, setState] = useState<T | null>( null );
    const [isLoading, setIsLoading] = useState( true );
    const [error, setError] = useState<string | null>( null );

    const postMessage = useCallback( ( message: VSCodeMessage ) => {
        const api = getVSCodeAPI();
        api.postMessage( message );
    }, [] );

    useEffect( () => {
        const handleMessage = ( event: MessageEvent<VSCodeMessage> ) => {
            const message = event.data;

            switch ( message.command ) {
                case 'updateCollectionData':
                    setState( message.data );
                    setIsLoading( false );
                    setError( null );
                    break;
                case 'showError':
                    setError( message.message );
                    setIsLoading( false );
                    break;
                case 'operationComplete':
                    // Show success and refresh data
                    setIsLoading( true );
                    postMessage( { command: 'refresh' } );
                    break;
                default:
                    // Handle other messages generically
                    setState( message as T );
                    break;
            }
        };

        window.addEventListener( 'message', handleMessage );

        // Request initial data
        postMessage( { command: 'refresh' } );

        return () => {
            window.removeEventListener( 'message', handleMessage );
        };
    }, [postMessage] );

    return {
        state,
        isLoading,
        error,
        postMessage,
        clearError: () => setError( null ),
    };
}
