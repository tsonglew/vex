import React, { useState, useEffect } from 'react';
import { CollectionData } from './useVscode';
import AddFieldForm, { FieldConfig } from './AddFieldForm';

type TabType = 'overview' | 'schema' | 'partitions' | 'data' | 'aliases' | 'operations' | 'properties';

interface CollectionProps {
    collectionData: CollectionData;
    postMessage: (message: any) => void;
}

const Collection: React.FC<CollectionProps> = ({ collectionData, postMessage }) => {
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [showAddFieldForm, setShowAddFieldForm] = useState(false);
    const [vectors, setVectors] = useState<any[]>([]);
    const [vectorsLoading, setVectorsLoading] = useState(false);
    const [vectorsPagination, setVectorsPagination] = useState({ offset: 0, limit: 100, total: 0 });
    const [showDataModal, setShowDataModal] = useState(false);
    const [modalData, setModalData] = useState<{ field: string; value: any; rowIndex: number } | null>(null);

    // Listen for vector data updates
    useEffect(() => {
        const handleVectorsUpdate = (event: CustomEvent) => {
            const { vectors: vectorsData, pagination } = event.detail;
            setVectors(vectorsData || []);
            setVectorsPagination(pagination || { offset: 0, limit: 100, total: 0 });
            setVectorsLoading(false);
        };

        window.addEventListener('vectorsUpdate', handleVectorsUpdate as EventListener);
        return () => {
            window.removeEventListener('vectorsUpdate', handleVectorsUpdate as EventListener);
        };
    }, []);

    // Handler functions
    const handleLoadCollection = () => {
        postMessage({ command: 'loadCollection', collectionName: collectionData.collectionInfo?.name });
    };

    const handleReleaseCollection = () => {
        postMessage({ command: 'releaseCollection', collectionName: collectionData.collectionInfo?.name });
    };

    const handleCreateIndex = () => {
        postMessage({ command: 'showCreateIndexDialog' });
    };

    const handleDropIndex = (indexName: string) => {
        postMessage({ command: 'showDropIndexDialog', indexName });
    };

    const handleCreatePartition = () => {
        postMessage({ command: 'showCreatePartitionDialog' });
    };

    const handleDropPartition = (partitionName: string) => {
        postMessage({ command: 'showDropPartitionDialog', partitionName });
    };

    const handleCreateField = () => {
        setShowAddFieldForm(true);
    };

    const handleAddField = (fieldConfig: FieldConfig) => {
        postMessage({ 
            command: 'addField', 
            collectionName: collectionData.collectionInfo?.name,
            fieldName: fieldConfig.name,
            fieldType: fieldConfig.data_type,
            dimension: fieldConfig.dim,
            nullable: fieldConfig.nullable,
            defaultValue: fieldConfig.default_value,
            fieldConfig 
        });
        setShowAddFieldForm(false);
    };

    const handleCancelAddField = () => {
        setShowAddFieldForm(false);
    };

    const handleDeleteField = (fieldName: string) => {
        postMessage({ command: 'showDeleteFieldDialog', collectionName: collectionData.collectionInfo?.name, fieldName });
    };

    const handleLoadVectors = (offset: number = 0, limit: number = 100) => {
        setVectorsLoading(true);
        postMessage({ 
            command: 'loadVectors', 
            collectionName: collectionData.collectionInfo?.name,
            offset,
            limit
        });
    };

    const handleNextPage = () => {
        const newOffset = vectorsPagination.offset + vectorsPagination.limit;
        if (newOffset < vectorsPagination.total) {
            handleLoadVectors(newOffset, vectorsPagination.limit);
        }
    };

    const handlePrevPage = () => {
        const newOffset = Math.max(0, vectorsPagination.offset - vectorsPagination.limit);
        handleLoadVectors(newOffset, vectorsPagination.limit);
    };

    const handleCellClick = (rowIndex: number, field: string, value: any) => {
        setModalData({ field, value, rowIndex });
        setShowDataModal(true);
    };

    const handleCloseModal = () => {
        setShowDataModal(false);
        setModalData(null);
    };

    const formatCellValue = (value: any, fieldType: string) => {
        if (fieldType === 'FloatVector' || fieldType === 'BinaryVector') {
            const arr = value || [];
            if (arr.length > 3) {
                return `[${arr.slice(0, 3).join(', ')}...]`;
            }
            return `[${arr.join(', ')}]`;
        }
        const str = String(value || 'N/A');
        return str.length > 30 ? str.substring(0, 30) + '...' : str;
    };

    // Listen for vectors updates from backend
    useEffect(() => {
        const handleVectorsUpdate = (event: CustomEvent) => {
            const data = event.detail;
            setVectors(data.vectors);
            setVectorsPagination({
                offset: data.offset,
                limit: data.limit,
                total: data.total
            });
            setVectorsLoading(false);
        };

        window.addEventListener('vectorsUpdate', handleVectorsUpdate as EventListener);
        
        return () => {
            window.removeEventListener('vectorsUpdate', handleVectorsUpdate as EventListener);
        };
    }, []);

    const renderOverviewTab = () => (
        <div className="overview-grid">
            <div className="card">
                <h3>📈 Collection Status</h3>
                <div className="status-grid">
                    <div className="status-item">
                        <span className="label">Load State</span>
                        <span className={`value ${collectionData.collectionInfo?.loadState === 'Loaded' ? 'loaded' : 'unloaded'}`}>
                            {collectionData.collectionInfo?.loadState || 'Unknown'}
                        </span>
                    </div>
                    <div className="status-item">
                        <span className="label">Consistency Level</span>
                        <span className="value">{collectionData.collectionInfo?.consistencyLevel || 'Unknown'}</span>
                    </div>
                    <div className="status-item">
                        <span className="label">Auto ID</span>
                        <span className="value">{collectionData.collectionInfo?.autoId ? 'Enabled' : 'Disabled'}</span>
                    </div>
                    <div className="status-item">
                        <span className="label">Description</span>
                        <span className="value">{collectionData.collectionInfo?.description || 'No description'}</span>
                    </div>
                </div>
            </div>

            <div className="card">
                <h3>📊 Collection Statistics</h3>
                <div className="stats-grid">
                    <div className="stat-item">
                        <span className="label">Row Count</span>
                        <span className="value">{collectionData.collectionStats?.rowCount?.toLocaleString() || '0'}</span>
                    </div>
                    <div className="stat-item">
                        <span className="label">Data Size</span>
                        <span className="value">{Math.round((collectionData.collectionStats?.dataSize || 0) / 1024)} KB</span>
                    </div>
                    <div className="stat-item">
                        <span className="label">Index Size</span>
                        <span className="value">{Math.round((collectionData.collectionStats?.indexSize || 0) / 1024)} KB</span>
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
                    <button className="btn btn-primary" onClick={handleCreateField}>
                        Add Field
                    </button>
                </div>
                {collectionData.collectionInfo?.fields && (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Field Name</th>
                                <th>Type</th>
                                <th>Primary Key</th>
                                <th>Auto ID</th>
                                <th>Description</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {collectionData.collectionInfo.fields.map((field: any, index: number) => (
                                <tr key={index}>
                                    <td>{field.name}</td>
                                    <td>{field.type}</td>
                                    <td>{field.isPrimaryKey ? '✓' : '✗'}</td>
                                    <td>{field.autoId ? '✓' : '✗'}</td>
                                    <td>{field.description || '-'}</td>
                                    <td>
                                        {!field.isPrimaryKey && (
                                            <button
                                                className="btn btn-danger btn-sm"
                                                onClick={() => handleDeleteField(field.name)}
                                            >
                                                Delete
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
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
                {collectionData.indexes && collectionData.indexes.length > 0 ? (
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
                            {collectionData.indexes.map((index: any, i: number) => (
                                <tr key={i}>
                                    <td>{index.fieldName}</td>
                                    <td>{index.indexName}</td>
                                    <td>{index.indexType}</td>
                                    <td>{JSON.stringify(index.params || {})}</td>
                                    <td>
                                        <button
                                            className="btn btn-danger btn-sm"
                                            onClick={() => handleDropIndex(index.indexName)}
                                        >
                                            Drop
                                        </button>
                                    </td>
                                </tr>
                            ))}
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
                {collectionData.partitions && collectionData.partitions.length > 0 ? (
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
                            {collectionData.partitions.map((partition: any, i: number) => (
                                <tr key={i}>
                                    <td>{partition.partitionName}</td>
                                    <td>{partition.state}</td>
                                    <td>{partition.inMemoryPercentage || '0'}%</td>
                                    <td>
                                        {partition.partitionName !== '_default' && (
                                            <button
                                                className="btn btn-danger btn-sm"
                                                onClick={() => handleDropPartition(partition.partitionName)}
                                            >
                                                Drop
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <p>No partitions found</p>
                )}
            </div>
        </div>
    );

    const renderDataTab = () => {
        if (vectorsLoading) {
            return (
                <div className="card">
                    <div className="loading">Loading vector data...</div>
                </div>
            );
        }

        if (!vectors || vectors.length === 0) {
            return (
                <div className="card">
                    <div className="controls">
                        <button className="btn btn-primary" onClick={() => handleLoadVectors()}>
                            Load Data
                        </button>
                    </div>
                    <p>No vector data available. Click "Load Data" to fetch data.</p>
                </div>
            );
        }

        const fields = collectionData?.collectionInfo?.fields || [];
        
        return (
            <div className="card">
                <div className="controls">
                    <button className="btn btn-primary" onClick={() => handleLoadVectors()}>
                        Refresh
                    </button>
                    <div className="pagination-controls">
                        <button 
                            className="btn btn-secondary" 
                            onClick={handlePrevPage}
                            disabled={vectorsPagination.offset === 0}
                        >
                            Previous
                        </button>
                        <span>
                            Showing {vectorsPagination.offset + 1} - {Math.min(vectorsPagination.offset + vectorsPagination.limit, vectorsPagination.offset + vectors.length)} 
                            {vectorsPagination.total > 0 && ` of ${vectorsPagination.total}`}
                        </span>
                        <button 
                            className="btn btn-secondary" 
                            onClick={handleNextPage}
                            disabled={vectors.length < vectorsPagination.limit}
                        >
                            Next
                        </button>
                    </div>
                </div>
                
                <div className="data-table-container">
                    <table className="table data-table">
                        <thead>
                            <tr>
                                {fields.map((field: any) => (
                                    <th key={field.name}>{field.name}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {vectors.map((row: any, rowIndex: number) => (
                                <tr key={rowIndex}>
                                    {fields.map((field: any) => (
                                        <td 
                                            key={field.name}
                                            className="data-cell"
                                            onClick={() => handleCellClick(rowIndex, field.name, row[field.name])}
                                            title="Click to view full data"
                                        >
                                            {JSON.stringify(row[field.name] || null)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

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
        switch (activeTab) {
            case 'overview':
                return renderOverviewTab();
            case 'schema':
                return renderSchemaTab();
            case 'partitions':
                return renderPartitionsTab();
            case 'data':
                return renderDataTab();
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
        <div className="collection-container">
            <div className="collection-header">
                <h2>📊 Collection: {collectionData.collectionInfo?.name}</h2>
            </div>

            <div className="tab-nav">
                <button
                    className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
                    onClick={() => setActiveTab('overview')}
                >
                    📋 Overview
                </button>
                <button
                    className={`tab-button ${activeTab === 'schema' ? 'active' : ''}`}
                    onClick={() => setActiveTab('schema')}
                >
                    🗂️ Schema & Indexes
                </button>
                <button
                    className={`tab-button ${activeTab === 'partitions' ? 'active' : ''}`}
                    onClick={() => setActiveTab('partitions')}
                >
                    📂 Partitions
                </button>
                <button
                    className={`tab-button ${activeTab === 'data' ? 'active' : ''}`}
                    onClick={() => setActiveTab('data')}
                >
                    📊 Data
                </button>
                <button
                    className={`tab-button ${activeTab === 'aliases' ? 'active' : ''}`}
                    onClick={() => setActiveTab('aliases')}
                >
                    🔗 Aliases
                </button>
                <button
                    className={`tab-button ${activeTab === 'operations' ? 'active' : ''}`}
                    onClick={() => setActiveTab('operations')}
                >
                    ⚙️ Operations
                </button>
                <button
                    className={`tab-button ${activeTab === 'properties' ? 'active' : ''}`}
                    onClick={() => setActiveTab('properties')}
                >
                    ⚙️ Properties
                </button>
            </div>

            <div className="tab-content">
                {renderTabContent()}
            </div>

            {/* Add Field Form Modal */}
            {showAddFieldForm && (
                <AddFieldForm
                    onSubmit={handleAddField}
                    onCancel={handleCancelAddField}
                    existingFields={collectionData?.collectionInfo?.fields?.map((f: any) => f.name) || []}
                />
            )}

            {/* Data Modal */}
            {showDataModal && modalData && (
                <div className="modal-overlay" onClick={handleCloseModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Field Data: {modalData.field}</h3>
                            <button className="modal-close" onClick={handleCloseModal}>×</button>
                        </div>
                        <div className="modal-body">
                            <div className="data-info">
                                <p><strong>Row:</strong> {modalData.rowIndex + 1}</p>
                                <p><strong>Field:</strong> {modalData.field}</p>
                            </div>
                            <div className="data-content">
                                <pre>{JSON.stringify(modalData.value, null, 2)}</pre>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={handleCloseModal}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Collection;
