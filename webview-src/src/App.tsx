import React, { useState } from 'react';
import { useVscode, CollectionData, VSCodeMessage } from './useVscode';
import './App.css';

type TabType = 'overview' | 'schema' | 'partitions' | 'aliases' | 'operations' | 'properties';

const App: React.FC = () => {
    const { state: currentData, isLoading, error, postMessage, clearError } = useVscode<CollectionData>();
    const [activeTab, setActiveTab] = useState<TabType>( 'overview' );

    if ( isLoading ) {
        return (
            <div className="loading">
                <div className="loading-spinner"></div>
                <p>Loading collection data...</p>
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

    if ( !currentData ) {
        return (
            <div className="no-data">
                <p>No collection data available</p>
                <button onClick={() => postMessage( { command: 'refresh' } )}>
                    Refresh
                </button>
            </div>
        );
    }

    const handleRefresh = () => {
        postMessage( { command: 'refresh' } );
    };

    const handleDeleteCollection = () => {
        if ( window.confirm( `Are you sure you want to delete the collection "${currentData.collectionInfo?.name}"? This action cannot be undone.` ) ) {
            postMessage( { command: 'deleteCollection' } );
        }
    };

    const handleLoadCollection = () => {
        postMessage( { command: 'loadCollection' } );
    };

    const handleReleaseCollection = () => {
        postMessage( { command: 'releaseCollection' } );
    };

    const handleCreateIndex = () => {
        const fieldName = prompt( 'Enter field name for index:' );
        if ( fieldName ) {
            postMessage( {
                command: 'createIndex',
                fieldName,
                indexType: 'IVF_FLAT',
                params: {}
            } );
        }
    };

    const handleDropIndex = ( indexName: string ) => {
        if ( window.confirm( `Are you sure you want to drop the index "${indexName}"?` ) ) {
            postMessage( { command: 'dropIndex', indexName } );
        }
    };

    const handleCreatePartition = () => {
        const partitionName = prompt( 'Enter partition name:' );
        if ( partitionName ) {
            postMessage( { command: 'createPartition', partitionName } );
        }
    };

    const handleDropPartition = ( partitionName: string ) => {
        if ( window.confirm( `Are you sure you want to drop the partition "${partitionName}"?` ) ) {
            postMessage( { command: 'dropPartition', partitionName } );
        }
    };

    const renderOverviewTab = () => (
        <div className="overview-grid">
            <div className="card">
                <h3>📈 Collection Status</h3>
                <div className="status-grid">
                    <div className="status-item">
                        <span className="label">Load State</span>
                        <span className={`value ${currentData.collectionInfo?.loadState === 'Loaded' ? 'loaded' : 'unloaded'}`}>
                            {currentData.collectionInfo?.loadState || 'Unknown'}
                        </span>
                    </div>
                    <div className="status-item">
                        <span className="label">Consistency Level</span>
                        <span className="value">{currentData.collectionInfo?.consistencyLevel || 'Unknown'}</span>
                    </div>
                    <div className="status-item">
                        <span className="label">Auto ID</span>
                        <span className="value">{currentData.collectionInfo?.autoId ? 'Enabled' : 'Disabled'}</span>
                    </div>
                    <div className="status-item">
                        <span className="label">Description</span>
                        <span className="value">{currentData.collectionInfo?.description || 'No description'}</span>
                    </div>
                </div>
            </div>

            <div className="card">
                <h3>📊 Collection Statistics</h3>
                <div className="stats-grid">
                    <div className="stat-item">
                        <span className="label">Row Count</span>
                        <span className="value">{currentData.collectionStats?.rowCount?.toLocaleString() || '0'}</span>
                    </div>
                    <div className="stat-item">
                        <span className="label">Data Size</span>
                        <span className="value">{Math.round( ( currentData.collectionStats?.dataSize || 0 ) / 1024 )} KB</span>
                    </div>
                    <div className="stat-item">
                        <span className="label">Index Size</span>
                        <span className="value">{Math.round( ( currentData.collectionStats?.indexSize || 0 ) / 1024 )} KB</span>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderSchemaTab = () => (
        <div className="schema-container">
            <div className="card">
                <div className="card-header">
                    <h3>🗂️ Fields Schema</h3>
                </div>
                {currentData.collectionInfo?.fields && (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Field Name</th>
                                <th>Type</th>
                                <th>Primary Key</th>
                                <th>Auto ID</th>
                                <th>Description</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentData.collectionInfo.fields.map( ( field: any, index: number ) => (
                                <tr key={index}>
                                    <td>{field.name}</td>
                                    <td>{field.type}</td>
                                    <td>{field.isPrimaryKey ? '✓' : '✗'}</td>
                                    <td>{field.autoId ? '✓' : '✗'}</td>
                                    <td>{field.description || '-'}</td>
                                </tr>
                            ) )}
                        </tbody>
                    </table>
                )}
            </div>

            <div className="card">
                <div className="card-header">
                    <h3>🔍 Indexes</h3>
                    <button className="btn btn-primary" onClick={handleCreateIndex}>
                        Create Index
                    </button>
                </div>
                {currentData.indexes && currentData.indexes.length > 0 ? (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Field</th>
                                <th>Index Name</th>
                                <th>Index Type</th>
                                <th>Parameters</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentData.indexes.map( ( index: any, i: number ) => (
                                <tr key={i}>
                                    <td>{index.fieldName}</td>
                                    <td>{index.indexName}</td>
                                    <td>{index.indexType}</td>
                                    <td>{JSON.stringify( index.params || {} )}</td>
                                    <td>
                                        <button
                                            className="btn btn-danger btn-sm"
                                            onClick={() => handleDropIndex( index.indexName )}
                                        >
                                            Drop
                                        </button>
                                    </td>
                                </tr>
                            ) )}
                        </tbody>
                    </table>
                ) : (
                    <p>No indexes found</p>
                )}
            </div>
        </div>
    );

    const renderPartitionsTab = () => (
        <div className="partitions-container">
            <div className="card">
                <div className="card-header">
                    <h3>📂 Partitions</h3>
                    <button className="btn btn-primary" onClick={handleCreatePartition}>
                        Create Partition
                    </button>
                </div>
                {currentData.partitions && currentData.partitions.length > 0 ? (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Partition Name</th>
                                <th>State</th>
                                <th>In Memory %</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentData.partitions.map( ( partition: any, i: number ) => (
                                <tr key={i}>
                                    <td>{partition.partitionName}</td>
                                    <td>{partition.state}</td>
                                    <td>{partition.inMemoryPercentage || '0'}%</td>
                                    <td>
                                        {partition.partitionName !== '_default' && (
                                            <button
                                                className="btn btn-danger btn-sm"
                                                onClick={() => handleDropPartition( partition.partitionName )}
                                            >
                                                Drop
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ) )}
                        </tbody>
                    </table>
                ) : (
                    <p>No partitions found</p>
                )}
            </div>
        </div>
    );

    const renderOperationsTab = () => (
        <div className="operations-container">
            <div className="card">
                <h3>⚙️ Collection Operations</h3>
                <div className="operations-grid">
                    <div className="operation-card">
                        <h4>Load Collection</h4>
                        <p>Load the collection into memory for queries</p>
                        <button className="btn btn-primary" onClick={handleLoadCollection}>
                            Load Collection
                        </button>
                    </div>
                    <div className="operation-card">
                        <h4>Release Collection</h4>
                        <p>Release the collection from memory</p>
                        <button className="btn btn-secondary" onClick={handleReleaseCollection}>
                            Release Collection
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderTabContent = () => {
        switch ( activeTab ) {
            case 'overview':
                return renderOverviewTab();
            case 'schema':
                return renderSchemaTab();
            case 'partitions':
                return renderPartitionsTab();
            case 'aliases':
                return <div className="card"><p>Aliases functionality coming soon...</p></div>;
            case 'operations':
                return renderOperationsTab();
            case 'properties':
                return <div className="card"><p>Properties functionality coming soon...</p></div>;
            default:
                return null;
        }
    };

    return (
        <div className="app">
            <div className="header">
                <h1>📊 Collection: {currentData.collectionInfo?.name}</h1>
                <div className="header-actions">
                    <button className="btn btn-primary" onClick={handleRefresh}>
                        🔄 Refresh
                    </button>
                    <button className="btn btn-danger" onClick={handleDeleteCollection}>
                        🗑️ Delete Collection
                    </button>
                </div>
            </div>

            <div className="tab-nav">
                <button
                    className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
                    onClick={() => setActiveTab( 'overview' )}
                >
                    📋 Overview
                </button>
                <button
                    className={`tab-button ${activeTab === 'schema' ? 'active' : ''}`}
                    onClick={() => setActiveTab( 'schema' )}
                >
                    🗂️ Schema & Indexes
                </button>
                <button
                    className={`tab-button ${activeTab === 'partitions' ? 'active' : ''}`}
                    onClick={() => setActiveTab( 'partitions' )}
                >
                    📂 Partitions
                </button>
                <button
                    className={`tab-button ${activeTab === 'aliases' ? 'active' : ''}`}
                    onClick={() => setActiveTab( 'aliases' )}
                >
                    🔗 Aliases
                </button>
                <button
                    className={`tab-button ${activeTab === 'operations' ? 'active' : ''}`}
                    onClick={() => setActiveTab( 'operations' )}
                >
                    ⚙️ Operations
                </button>
                <button
                    className={`tab-button ${activeTab === 'properties' ? 'active' : ''}`}
                    onClick={() => setActiveTab( 'properties' )}
                >
                    ⚙️ Properties
                </button>
            </div>

            <div className="tab-content">
                {renderTabContent()}
            </div>
        </div>
    );
};

export default App;
