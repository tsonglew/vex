import React, { useState } from 'react';
import { useVscode, DatabaseData, VSCodeMessage } from './useVscode';
import Collection from './Collection';
import CreateCollectionForm, { CollectionConfig } from './CreateCollectionForm';
import './App.css';

const App: React.FC = () => {
    const { state: databaseData, isLoading, error, postMessage, clearError } = useVscode<DatabaseData>();
    const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
    const [showCreateCollectionForm, setShowCreateCollectionForm] = useState(false);
    const [currentView, setCurrentView] = useState<'database' | 'collection'>('database');

    // Handler functions
    const handleRefresh = () => {
        postMessage({ command: 'refresh' });
    };

    const handleSelectCollection = (collectionName: string) => {
        setSelectedCollection(collectionName);
        setCurrentView('collection');
        postMessage({ command: 'selectCollection', collectionName });
    };

    const handleBackToDatabase = () => {
        setCurrentView('database');
        setSelectedCollection(null);
    };

    const handleDeleteCollection = (collectionName: string) => {
        postMessage({ command: 'showDeleteCollectionDialog', collectionName });
    };

    const handleLoadCollection = (collectionName: string) => {
        postMessage({ command: 'loadCollection', collectionName });
    };

    const handleReleaseCollection = (collectionName: string) => {
        postMessage({ command: 'releaseCollection', collectionName });
    };

    const handleCreateCollection = () => {
        setShowCreateCollectionForm(true);
    };

    const handleSubmitCreateCollection = (config: CollectionConfig) => {
        postMessage({ 
            command: 'createCollection', 
            collectionConfig: config 
        });
        setShowCreateCollectionForm(false);
    };

    const handleCancelCreateCollection = () => {
        setShowCreateCollectionForm(false);
    };

    if ( isLoading ) {
        return (
            <div className="loading">
                <div className="loading-spinner"></div>
                <p>Loading database data...</p>
            </div>
        );
    }

    if ( error ) {
        return (
            <div className="error-container">
                <div className="error">
                    <h2>Error</h2>
                    <p>{error}</p>
                    <button onClick={() => {
                        clearError();
                        postMessage( { command: 'refresh' } );
                    }}>
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    if ( !databaseData ) {
        return (
            <div className="no-data">
                <p>No database data available</p>
                <div className="no-data-actions">
                    <button onClick={() => postMessage( { command: 'refresh' } )}>
                        Refresh
                    </button>
                </div>
            </div>
        );
    }

    // Part 1: Database Info Section
    const renderDatabaseInfo = () => (
        <div className="database-info-section">
            <div className="card">
                <h3>🗄️ Database Information</h3>
                <div className="database-details">
                    <div className="info-item">
                        <span className="label">Name</span>
                        <span className="value">{databaseData.databaseInfo?.name || 'Unknown'}</span>
                    </div>
                    <div className="info-item">
                        <span className="label">Description</span>
                        <span className="value">{databaseData.databaseInfo?.description || 'No description'}</span>
                    </div>
                    <div className="info-item">
                        <span className="label">Total Collections</span>
                        <span className="value">{databaseData.databaseInfo?.collections?.length || 0}</span>
                    </div>
                    <div className="info-item">
                        <span className="label">Total Rows</span>
                        <span className="value">
                            {databaseData.databaseInfo?.collections?.reduce((sum, col) => sum + (col.rowCount || 0), 0).toLocaleString() || '0'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );

    // Part 2: Collection Switcher Section
    const renderCollectionSwitcher = () => (
        <div className="collection-switcher-section">
            <div className="card">
                <div className="card-header">
                    <h3>📚 Collections</h3>
                    <button className="btn btn-primary" onClick={handleCreateCollection}>
                        🆕 Create Collection
                    </button>
                </div>
                <div className="collections-grid">
                    {databaseData.databaseInfo?.collections?.map((collection, index) => (
                        <div 
                            key={index} 
                            className={`collection-card ${
                                selectedCollection === collection.name ? 'selected' : ''
                            }`}
                            onClick={() => handleSelectCollection(collection.name)}
                        >
                            <div className="collection-header">
                                <h4>{collection.name}</h4>
                                <span className={`load-state ${collection.loadState?.toLowerCase()}`}>
                                    {collection.loadState || 'Unknown'}
                                </span>
                            </div>
                            <div className="collection-stats">
                                <span className="row-count">{collection.rowCount?.toLocaleString() || '0'} rows</span>
                                {collection.description && (
                                    <span className="description">{collection.description}</span>
                                )}
                            </div>
                            <div className="collection-actions">
                                <button 
                                    className="btn btn-sm btn-secondary"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        collection.loadState === 'Loaded' 
                                            ? handleReleaseCollection(collection.name)
                                            : handleLoadCollection(collection.name);
                                    }}
                                >
                                    {collection.loadState === 'Loaded' ? 'Release' : 'Load'}
                                </button>
                                <button 
                                    className="btn btn-sm btn-danger"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteCollection(collection.name);
                                    }}
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    )) || <p>No collections found</p>}
                </div>
            </div>
        </div>
    );

    return (
        <div className="app">
            <div className="header">
                <div className="header-title">
                    {currentView === 'collection' && (
                        <button className="btn btn-secondary back-btn" onClick={handleBackToDatabase}>
                            ← Back to Database
                        </button>
                    )}
                    <h1>
                        {currentView === 'database' 
                            ? `🗄️ Database Management: ${databaseData.databaseInfo?.name}`
                            : `📚 Collection Management: ${selectedCollection}`
                        }
                    </h1>
                </div>
                <div className="header-actions">
                    <button className="btn btn-primary" onClick={handleRefresh}>
                        🔄 Refresh
                    </button>
                </div>
            </div>

            {currentView === 'database' ? (
                <div className="database-layout">
                    {/* Part 1: Database Info */}
                    {renderDatabaseInfo()}
                    
                    {/* Part 2: Collection Switcher */}
                    {renderCollectionSwitcher()}
                </div>
            ) : (
                <div className="collection-layout">
                    {/* Collection Management View */}
                    {selectedCollection && databaseData.currentCollection && (
                        <div className="collection-info-section">
                            <Collection 
                                collectionData={databaseData.currentCollection}
                                postMessage={postMessage}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Create Collection Form Modal */}
            {showCreateCollectionForm && (
                <CreateCollectionForm
                    onSubmit={handleSubmitCreateCollection}
                    onCancel={handleCancelCreateCollection}
                />
            )}
        </div>
    );
};

export default App;
