(function () {
    const vscode = acquireVsCodeApi();

    let currentData = null;
    let activeTab = 'overview';

    // Listen for messages from the extension
    window.addEventListener('message', event => {
        const message = event.data;

        switch (message.command) {
            case 'updateCollectionData':
                currentData = message.data;
                renderUI();
                break;
            case 'showError':
                showError(message.message);
                break;
            case 'operationComplete':
                showSuccess(message.message);
                refreshData();
                break;
        }
    });

    // Universal button click logger using event delegation
    document.addEventListener('click', event => {
        if (event.target.tagName === 'BUTTON' || event.target.closest('button')) {
            const button = event.target.tagName === 'BUTTON' ? event.target : event.target.closest('button');
            // Log the click without interfering with normal behavior
            setTimeout(() => logButtonClick(button), 0);
        }
        // Don't prevent default behavior or stop propagation
    }, true); // Use capture phase to ensure we log before other handlers

    // Log button click details
    function logButtonClick (button) {
        const timestamp = new Date().toISOString();
        const buttonText = button.textContent?.trim() || 'Unknown';
        const buttonClasses = button.className || 'no-classes';
        const onclickFunction = button.getAttribute('onclick') || 'no-onclick';
        const buttonId = button.id || 'no-id';

        console.log(`[BUTTON CLICK] ${timestamp}`, {
            text: buttonText,
            id: buttonId,
            classes: buttonClasses,
            onclick: onclickFunction,
            element: button
        });

        // Also send to VS Code extension if needed for logging
        try {
            vscode.postMessage({
                command: 'buttonClick',
                data: {
                    timestamp: timestamp,
                    buttonText: buttonText,
                    buttonId: buttonId,
                    buttonClasses: buttonClasses,
                    onclickFunction: onclickFunction
                }
            });
        } catch (error) {
            // Fallback if vscode is not available
            console.warn('Could not send button click to VS Code:', error);
        }
    }

    function renderUI () {
        if (!currentData) { return; }

        const content = document.getElementById('content');
        content.innerHTML = `
            <div class="header">
                <h1>📊 Collection: ${currentData.collectionInfo.name}</h1>
                <div class="header-actions">
                    <button class="btn btn-primary" onclick="refreshData()">🔄 Refresh</button>
                    <button class="btn btn-danger" onclick="deleteCollection()">🗑️ Delete Collection</button>
                </div>
            </div>

            <!-- Tab Navigation -->
            <div class="tab-nav">
                <button class="tab-button ${activeTab === 'overview' ? 'active' : ''}" onclick="switchTab('overview')">📋 Overview</button>
                <button class="tab-button ${activeTab === 'schema' ? 'active' : ''}" onclick="switchTab('schema')">🗂️ Schema & Indexes</button>
                <button class="tab-button ${activeTab === 'partitions' ? 'active' : ''}" onclick="switchTab('partitions')">📂 Partitions</button>
                <button class="tab-button ${activeTab === 'aliases' ? 'active' : ''}" onclick="switchTab('aliases')">🔗 Aliases</button>
                <button class="tab-button ${activeTab === 'operations' ? 'active' : ''}" onclick="switchTab('operations')">⚙️ Operations</button>
                <button class="tab-button ${activeTab === 'properties' ? 'active' : ''}" onclick="switchTab('properties')">⚙️ Properties</button>
            </div>

            <div class="tab-content">
                ${renderTabContent()}
            </div>
        `;
    }

    function switchTab (tab) {
        activeTab = tab;
        renderUI();
    }

    function renderTabContent () {
        switch (activeTab) {
            case 'overview':
                return renderOverviewTab();
            case 'schema':
                return renderSchemaTab();
            case 'partitions':
                return renderPartitionsTab();
            case 'aliases':
                return renderAliasesTab();
            case 'operations':
                return renderOperationsTab();
            case 'properties':
                return renderPropertiesTab();
            default:
                return '';
        }
    }

    function renderOverviewTab () {
        return `
            <div class="overview-grid">
                <!-- Collection Status -->
                <div class="card">
                    <h3>📈 Collection Status</h3>
                    <div class="status-grid">
                        <div class="status-item">
                            <span class="label">Load State</span>
                            <span class="value ${currentData.collectionInfo.loadState === 'Loaded' ? 'loaded' : 'unloaded'}">
                                ${currentData.collectionInfo.loadState}
                            </span>
                        </div>
                        <div class="status-item">
                            <span class="label">Consistency Level</span>
                            <span class="value">${currentData.collectionInfo.consistencyLevel}</span>
                        </div>
                        <div class="status-item">
                            <span class="label">Auto ID</span>
                            <span class="value">${currentData.collectionInfo.autoId ? 'Enabled' : 'Disabled'}</span>
                        </div>
                        <div class="status-item">
                            <span class="label">Description</span>
                            <span class="value">${currentData.collectionInfo.description || 'No description'}</span>
                        </div>
                </div>
            </div>

                <!-- Statistics -->
                <div class="card">
                    <h3>📊 Statistics</h3>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <div class="stat-number">${formatNumber(currentData.collectionStats.rowCount)}</div>
                            <div class="stat-label">Total Entities</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-number">${currentData.collectionStats.totalSegments}</div>
                            <div class="stat-label">Total Segments</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-number">${formatBytes(currentData.collectionStats.memorySize)}</div>
                            <div class="stat-label">Memory Usage</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-number">${formatBytes(currentData.collectionStats.diskSize)}</div>
                            <div class="stat-label">Disk Usage</div>
                        </div>
                    </div>
                </div>

                <!-- Quick Actions -->
                <div class="card">
                    <h3>⚡ Quick Actions</h3>
                    <div class="action-grid">
                        <button class="action-btn ${currentData.collectionInfo.loadState === 'Loaded' ? 'disabled' : ''}" 
                                onclick="loadCollection()" ${currentData.collectionInfo.loadState === 'Loaded' ? 'disabled' : ''}>
                            ⬆️ Load Collection
                        </button>
                        <button class="action-btn ${currentData.collectionInfo.loadState !== 'Loaded' ? 'disabled' : ''}" 
                                onclick="releaseCollection()" ${currentData.collectionInfo.loadState !== 'Loaded' ? 'disabled' : ''}>
                            ⬇️ Release Collection
                        </button>
                        <button class="action-btn" onclick="compactCollection()">
                            🗜️ Compact Collection
                        </button>
                        <button class="action-btn" onclick="flushCollection()">
                            💾 Flush Collection
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    function renderSchemaTab () {
        return `
            <div class="schema-container">
                <!-- Collection Schema Overview -->
                <div class="card">
                    <h3>📋 Schema Information</h3>
                    <div class="schema-info">
                        <div class="info-item">
                            <span class="label">Collection Name:</span>
                            <span class="value">${currentData.collectionInfo.name}</span>
                        </div>
                        <div class="info-item">
                            <span class="label">Total Fields:</span>
                            <span class="value">${currentData.collectionInfo.fields.length}</span>
                        </div>
                        <div class="info-item">
                            <span class="label">Vector Fields:</span>
                            <span class="value">${currentData.collectionInfo.fields.filter(f => f.data_type === 101 || f.data_type === 100).length}</span>
                        </div>
                        <div class="info-item">
                            <span class="label">Indexed Fields:</span>
                            <span class="value">${currentData.indexes.length}</span>
                        </div>
                    </div>
                </div>

                <!-- Fields & Indexes Unified Table -->
                <div class="card">
                    <h3>🗂️ Fields & Indexes</h3>
                    <div class="table-container">
                    <table class="fields-table">
                        <thead>
                            <tr>
                                    <th>Field Name</th>
                                    <th>Data Type</th>
                                <th>Dimension</th>
                                <th>Primary Key</th>
                                <th>Auto ID</th>
                                    <th>Index Type</th>
                                    <th>Metric Type</th>
                                    <th>Index Parameters</th>
                                    <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                                ${currentData.collectionInfo.fields.map(field => {
            const fieldIndex = currentData.indexes.find(index =>
                (index.field_name || index.fieldName) === field.name
            );
            return `
                                <tr>
                                    <td><strong>${field.name}</strong></td>
                                            <td>
                                                <span class="data-type ${field.data_type === 101 || field.data_type === 100 ? 'vector-type' : 'scalar-type'}">
                                                    ${getDataTypeName(field.data_type)}
                                                </span>
                                            </td>
                                    <td>${field.type_params?.dim || field.dim || '-'}</td>
                                            <td>${field.is_primary_key ? '🔑' : '-'}</td>
                                            <td>${field.auto_id ? '🤖' : '-'}</td>
                                            <td>${fieldIndex ? fieldIndex.index_type || 'Unknown' : '-'}</td>
                                            <td>${fieldIndex ? fieldIndex.metric_type || '-' : '-'}</td>
                                            <td class="index-params">${fieldIndex ? formatIndexParams(fieldIndex.params) : '-'}</td>
                                            <td class="action-cell">
                                                ${(field.data_type === 101 || field.data_type === 100) && !fieldIndex ? `
                                                    <button class="btn btn-sm btn-primary" onclick="createIndexForField('${field.name}')">
                                                        ➕ Add Index
                                                    </button>
                                                ` : ''}
                                                ${fieldIndex ? `
                                                    <button class="btn btn-sm btn-danger" onclick="dropIndex('${fieldIndex.index_name || fieldIndex.field_name}')">
                                                        🗑️ Drop Index
                                                    </button>
                                                ` : ''}
                                            </td>
                                </tr>
                                    `;
        }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

                <!-- Index Management Actions -->
                <div class="card">
                    <h3>🔍 Index Management</h3>
                    <div class="index-actions">
                        <div class="action-section">
                            <h4>Create New Index</h4>
                            <div class="form-row">
                                <select id="index-field-select" class="form-select">
                                    <option value="">Select vector field</option>
                                ${currentData.collectionInfo.fields
                .filter(f => (f.data_type === 101 || f.data_type === 100) && !currentData.indexes.find(idx => (idx.field_name || idx.fieldName) === f.name))
                .map(f => `<option value="${f.name}">${f.name} (${f.type_params?.dim || f.dim}D ${getDataTypeName(f.data_type)})</option>`)
                .join('')}
                            </select>
                                <select id="index-type-select" class="form-select">
                                    <option value="">Select index type</option>
                                    <option value="FLAT">FLAT - Brute Force</option>
                                    <option value="IVF_FLAT">IVF_FLAT - Inverted File</option>
                                    <option value="IVF_SQ8">IVF_SQ8 - Scalar Quantizer</option>
                                    <option value="IVF_PQ">IVF_PQ - Product Quantizer</option>
                                    <option value="HNSW">HNSW - Hierarchical NSW (Recommended)</option>
                                    <option value="ANNOY">ANNOY - Approximate Nearest</option>
                                    <option value="DISKANN">DiskANN - Disk-based ANN</option>
                                </select>
                                <select id="index-metric-select" class="form-select">
                                    <option value="">Select metric type</option>
                                    <option value="L2">L2 - Euclidean Distance</option>
                                    <option value="IP">IP - Inner Product</option>
                                    <option value="COSINE">COSINE - Cosine Similarity</option>
                                    <option value="HAMMING">HAMMING - Hamming Distance</option>
                                    <option value="JACCARD">JACCARD - Jaccard Distance</option>
                            </select>
                                <button class="btn btn-primary" onclick="createAdvancedIndex()">Create Index</button>
                            </div>
                        </div>
                        
                        <div class="action-section">
                            <h4>Bulk Operations</h4>
                            <div class="form-row">
                                <button class="btn btn-warning" onclick="rebuildAllIndexes()">🔄 Rebuild All Indexes</button>
                                <button class="btn btn-danger" onclick="dropAllIndexes()">🗑️ Drop All Indexes</button>
                                <button class="btn btn-info" onclick="analyzeIndexPerformance()">📊 Analyze Performance</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function renderPartitionsTab () {
        return `
            <div class="partitions-container">
                <!-- Partition Overview -->
                <div class="card">
                    <h3>📂 Partition Management</h3>
                    <div class="partition-overview">
                        <div class="overview-stats">
                            <div class="stat">
                                <span class="stat-number">${currentData.partitions.length}</span>
                                <span class="stat-label">Total Partitions</span>
                            </div>
                            <div class="stat">
                                <span class="stat-number">${currentData.partitions.filter(p => p.loaded).length}</span>
                                <span class="stat-label">Loaded Partitions</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Current Partitions -->
                <div class="card">
                    <h3>📋 Partition Details</h3>
                    <div class="table-container">
                    <table class="partitions-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>ID</th>
                                    <th>Created</th>
                                    <th>Entities</th>
                                    <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${currentData.partitions.map(partition => `
                                <tr>
                                    <td><strong>${partition.name}</strong></td>
                                        <td class="partition-id">${partition.id}</td>
                                    <td>${partition.createdTime ? new Date(partition.createdTime).toLocaleString() : '-'}</td>
                                        <td class="entity-count">${formatNumber(partition.rowCount || 0)}</td>
                                        <td>
                                            <span class="status-badge ${partition.loaded ? 'loaded' : 'unloaded'}">
                                                ${partition.loaded ? '✅ Loaded' : '⏸️ Unloaded'}
                                            </span>
                                        </td>
                                        <td class="action-cell">
                                        ${partition.name !== '_default' ? `
                                                <div class="action-buttons">
                                                    <button class="btn btn-sm btn-danger" 
                                                            onclick="dropPartition('${partition.name}')">
                                                🗑️ Drop
                                            </button>
                                                </div>
                                        ` : ''}
                                    </td>
                                </tr>
                            `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Partition Management -->
                <div class="card">
                    <h3>⚙️ Partition Management</h3>
                    <div class="partition-actions">
                        <div class="action-section">
                            <h4>Create New Partition</h4>
                            <div class="form-row">
                                <input type="text" id="new-partition-name" placeholder="Enter partition name" class="form-input">
                                <button class="btn btn-primary" onclick="createPartition()">➕ Create Partition</button>
                            </div>
                        </div>
                        
                        <div class="action-section">
                            <h4>Bulk Operations</h4>
                            <div class="form-row">
                                <button class="btn btn-secondary" onclick="showPartitionStats()">📊 View Statistics</button>
                                <button class="btn btn-info" onclick="compactPartitions()">🗜️ Compact All</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function renderAliasesTab () {
        return `
            <div class="aliases-container">
                <!-- Alias Overview -->
                <div class="card">
                    <h3>🔗 Collection Aliases</h3>
                    <p class="description">
                        Aliases provide a layer of abstraction for collections, allowing you to switch between 
                        different collection versions without changing application code. Perfect for A/B testing 
                        and seamless data updates.
                    </p>
                </div>

                <!-- Current Aliases -->
                <div class="card">
                    <h3>📋 Current Aliases</h3>
                    <div class="aliases-list">
                        ${currentData.aliases && currentData.aliases.length > 0 ? `
                            <div class="table-container">
                                <table class="aliases-table">
                                    <thead>
                                        <tr>
                                            <th>Alias Name</th>
                                            <th>Target Collection</th>
                                            <th>Created</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${currentData.aliases.map(alias => `
                                            <tr>
                                                <td><strong>${alias.alias}</strong></td>
                                                <td>${alias.collection}</td>
                                                <td>${alias.createdTime ? new Date(alias.createdTime).toLocaleString() : '-'}</td>
                                                <td class="action-cell">
                                                    <button class="btn btn-sm btn-danger" onclick="dropAlias('${alias.alias}')">
                                                        🗑️ Drop Alias
                                                    </button>
                                                </td>
                                            </tr>
                                        `).join('')}
                        </tbody>
                    </table>
                            </div>
                        ` : `
                            <div class="empty-state">
                                <p>No aliases found for this collection</p>
                                <p>Create an alias to provide an alternative name for this collection</p>
                            </div>
                        `}
                    </div>
                </div>

                <!-- Create New Alias -->
                <div class="card">
                    <h3>➕ Create New Alias</h3>
                    <div class="alias-form">
                        <div class="form-row">
                            <input type="text" id="new-alias-name" placeholder="Enter alias name" class="form-input">
                            <button class="btn btn-primary" onclick="createAlias()">Create Alias</button>
                        </div>
                        <p class="form-help">
                            Create an alternative name for this collection. Once created, you can use the alias 
                            name in all operations instead of the collection name.
                        </p>
                    </div>
                </div>

                <!-- Alias Operations -->
                <div class="card">
                    <h3>⚙️ Alias Operations</h3>
                    <div class="alias-operations">
                        <div class="operation-section">
                            <h4>Switch Alias Target</h4>
                            <p>Reassign an existing alias to point to a different collection</p>
                            <div class="form-row">
                                <select id="alias-select" class="form-select">
                                    <option value="">Select existing alias</option>
                                    ${currentData.aliases ? currentData.aliases.map(alias =>
            `<option value="${alias.alias}">${alias.alias}</option>`
        ).join('') : ''}
                                </select>
                                <input type="text" id="new-target-collection" placeholder="New target collection" class="form-input">
                                <button class="btn btn-warning" onclick="switchAliasTarget()">🔄 Switch Target</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function renderPropertiesTab () {
        return `
            <div class="properties-container">
                <!-- Collection Properties -->
                <div class="card">
                    <h3>⚙️ Collection Properties</h3>
                    <div class="properties-form">
                        <div class="property-section">
                            <h4>Basic Properties</h4>
                            <div class="form-grid">
                                <label class="property-label">
                                    <span>Collection Name</span>
                                    <input type="text" id="collection-name" value="${currentData.collectionInfo.name}" class="form-input" readonly>
                                </label>
                                
                                <label class="property-label">
                                    <span>Description</span>
                                    <textarea id="collection-description" class="form-textarea" 
                                              placeholder="Enter collection description...">${currentData.collectionInfo.description || ''}</textarea>
                                </label>
                                
                                <label class="property-label">
                                    <span>Consistency Level</span>
                                    <select id="consistency-level" class="form-select">
                                        <option value="Strong" ${currentData.collectionInfo.consistencyLevel === 'Strong' ? 'selected' : ''}>Strong</option>
                                        <option value="Bounded" ${currentData.collectionInfo.consistencyLevel === 'Bounded' ? 'selected' : ''}>Bounded</option>
                                        <option value="Session" ${currentData.collectionInfo.consistencyLevel === 'Session' ? 'selected' : ''}>Session</option>
                                        <option value="Eventually" ${currentData.collectionInfo.consistencyLevel === 'Eventually' ? 'selected' : ''}>Eventually</option>
                                    </select>
                                </label>
                            </div>
                        </div>

                        <div class="property-section">
                            <h4>Advanced Properties</h4>
                            <div class="form-grid">
                                <label class="property-label">
                                    <span>Time To Live (TTL) - Seconds</span>
                                    <input type="number" id="collection-ttl" placeholder="0 = No expiration" class="form-input" min="0">
                                </label>
                                
                                <label class="property-label">
                                    <span>Enable Dynamic Fields</span>
                                    <select id="enable-dynamic-fields" class="form-select">
                                        <option value="true" ${currentData.collectionInfo.enableDynamicField ? 'selected' : ''}>Enabled</option>
                                        <option value="false" ${!currentData.collectionInfo.enableDynamicField ? 'selected' : ''}>Disabled</option>
                                    </select>
                                </label>

                                <label class="property-label">
                                    <span>Memory Map (MMap) Enabled</span>
                                    <select id="mmap-enabled" class="form-select">
                                        <option value="false">Disabled (Default)</option>
                                        <option value="true">Enabled</option>
                                    </select>
                                </label>
                            </div>
                        </div>

                        <div class="property-section">
                            <h4>Performance Tuning</h4>
                            <div class="form-grid">
                                <label class="property-label">
                                    <span>Segment Size (MB)</span>
                                    <input type="number" id="segment-size" value="512" class="form-input" min="1" max="2048">
                                </label>
                                
                                <label class="property-label">
                                    <span>Index File Size (MB)</span>
                                    <input type="number" id="index-file-size" value="1024" class="form-input" min="1" max="4096">
                                </label>
                            </div>
                        </div>

                        <div class="form-actions">
                            <button class="btn btn-primary" onclick="updateCollectionProperties()">💾 Save Properties</button>
                            <button class="btn btn-secondary" onclick="resetProperties()">🔄 Reset</button>
                            <button class="btn btn-warning" onclick="renameCollection()">✏️ Rename Collection</button>
                        </div>
                    </div>
                </div>

                <!-- Collection Statistics -->
                <div class="card">
                    <h3>📊 Collection Information</h3>
                    <div class="info-grid">
                        <div class="info-item">
                            <span class="info-label">Created Time</span>
                            <span class="info-value">${currentData.collectionInfo.createdTime ? new Date(parseInt(currentData.collectionInfo.createdTime)).toLocaleString() : 'Unknown'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Load State</span>
                            <span class="info-value status-${currentData.collectionInfo.loadState?.toLowerCase()}">${currentData.collectionInfo.loadState}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Auto ID</span>
                            <span class="info-value">${currentData.collectionInfo.autoId ? 'Enabled' : 'Disabled'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Total Entities</span>
                            <span class="info-value">${formatNumber(currentData.collectionStats.rowCount)}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Memory Usage</span>
                            <span class="info-value">${formatBytes(currentData.collectionStats.memorySize)}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Disk Usage</span>
                            <span class="info-value">${formatBytes(currentData.collectionStats.diskSize)}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function renderOperationsTab () {
        return `
            <div class="operations-container">
                <!-- Collection Operations -->
                <div class="card">
                    <h3>⚙️ Collection Operations</h3>
                    <div class="operation-grid">
                        <div class="operation-item">
                            <h4>Load Management</h4>
                            <div class="operation-buttons">
                                <button class="btn ${currentData.collectionInfo.loadState === 'Loaded' ? 'btn-secondary' : 'btn-primary'}" 
                                        onclick="loadCollection()" ${currentData.collectionInfo.loadState === 'Loaded' ? 'disabled' : ''}>
                                    Load Collection
                                </button>
                                <button class="btn ${currentData.collectionInfo.loadState !== 'Loaded' ? 'btn-secondary' : 'btn-primary'}" 
                                        onclick="releaseCollection()" ${currentData.collectionInfo.loadState !== 'Loaded' ? 'disabled' : ''}>
                                    Release Collection
                                </button>
                            </div>
                        </div>
                        
                        <div class="operation-item">
                            <h4>Maintenance</h4>
                            <div class="operation-buttons">
                                <button class="btn btn-warning" onclick="compactCollection()">
                                    Compact Collection
                                </button>
                                <button class="btn btn-info" onclick="flushCollection()">
                                    Flush Collection
                                </button>
                                <button class="btn btn-secondary" onclick="refreshStatistics()">
                                    Refresh Statistics
                                </button>
                            </div>
                        </div>

                        <div class="operation-item">
                            <h4>Data Operations</h4>
                            <div class="operation-buttons">
                                <button class="btn btn-danger" onclick="deleteAllEntities()">
                                    Delete All Entities
                                </button>
                                <button class="btn btn-warning" onclick="truncateCollection()">
                                    Truncate Collection
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Bulk Operations -->
                <div class="card">
                    <h3>📊 Bulk Operations</h3>
                    <div class="operation-grid">
                        <div class="operation-item">
                            <h4>Import Data</h4>
                            <input type="file" id="import-file" accept=".json,.csv" class="form-input">
                            <button class="btn btn-primary" onclick="importData()">Import Data</button>
                        </div>
                        
                        <div class="operation-item">
                            <h4>Export Data</h4>
                            <select id="export-format" class="form-select">
                                <option value="json">JSON</option>
                                <option value="csv">CSV</option>
                            </select>
                            <button class="btn btn-primary" onclick="exportData()">Export Data</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function renderSettingsTab () {
        return `
            <div class="settings-container">
                <!-- Collection Properties -->
                <div class="card">
                    <h3>⚙️ Collection Properties</h3>
                    <div class="form-grid">
                        <label>
                            <span>Consistency Level</span>
                            <select id="consistency-level" class="form-select">
                                <option value="Strong">Strong</option>
                                <option value="Bounded">Bounded</option>
                                <option value="Session">Session</option>
                                <option value="Eventually">Eventually</option>
                            </select>
                        </label>
                        <label>
                            <span>Enable Dynamic Field</span>
                            <input type="checkbox" id="enable-dynamic-field" ${currentData.collectionInfo.enableDynamicField ? 'checked' : ''}>
                        </label>
                        <label>
                            <span>Auto ID</span>
                            <input type="checkbox" id="auto-id" ${currentData.collectionInfo.autoId ? 'checked' : ''} disabled>
                        </label>
                        <button class="btn btn-primary" onclick="updateCollectionProperties()">Update Properties</button>
                    </div>
                </div>

                <!-- Advanced Settings -->
                <div class="card">
                    <h3>🔧 Advanced Settings</h3>
                    <div class="form-grid">
                        <label>
                            <span>MMap Enabled</span>
                            <input type="checkbox" id="mmap-enabled">
                        </label>
                        <label>
                            <span>Index File Size (MB)</span>
                            <input type="number" id="index-file-size" class="form-input" min="1" max="1024" value="1024">
                        </label>
                        <label>
                            <span>Segment Size (MB)</span>
                            <input type="number" id="segment-size" class="form-input" min="1" max="512" value="512">
                        </label>
                        <button class="btn btn-primary" onclick="updateAdvancedSettings()">Update Settings</button>
                    </div>
                </div>

                <!-- Description -->
                <div class="card">
                    <h3>📝 Description</h3>
                    <textarea id="collection-description" class="form-textarea" 
                              placeholder="Collection description...">${currentData.collectionInfo.description || ''}</textarea>
                    <button class="btn btn-primary" onclick="updateDescription()">Update Description</button>
                </div>
            </div>
        `;
    }

    function showError (message) {
        const content = document.getElementById('content');
        content.innerHTML = `
            <div class="error-banner">
                <strong>❌ Error:</strong> ${message}
                <button class="btn btn-sm" onclick="refreshData()">🔄 Retry</button>
            </div>
        `;
    }

    function showSuccess (message) {
        const banner = document.createElement('div');
        banner.className = 'success-banner';
        banner.innerHTML = `
            <strong>✅ Success:</strong> ${message}
            <button class="close-btn" onclick="this.parentElement.remove()">×</button>
        `;
        document.body.insertBefore(banner, document.body.firstChild);
        setTimeout(() => banner.remove(), 5000);
    }

    // CRUD Operations
    function deleteCollection () {
        console.log('call deleteCollection');
        if (confirm(`🚨 Are you sure you want to delete collection "${currentData.collectionInfo.name}"? This action cannot be undone!`)) {
            vscode.postMessage({ command: 'deleteCollection' });
        }
    }

    function addField () {
        const name = document.getElementById('new-field-name').value.trim();
        const type = document.getElementById('new-field-type').value;
        const dim = document.getElementById('new-field-dim').value;
        const nullable = document.getElementById('new-field-nullable').checked;
        const defaultValue = document.getElementById('new-field-default').value;

        if (!name || !type) {
            alert('Please provide field name and type');
            return;
        }

        vscode.postMessage({
            command: 'addField',
            fieldName: name,
            fieldType: type,
            dimension: type === 'FloatVector' || type === 'BinaryVector' ? parseInt(dim) : undefined,
            nullable: nullable,
            defaultValue: defaultValue
        });
    }

    function createIndex () {
        const fieldName = document.getElementById('index-field-select').value;
        const indexType = document.getElementById('index-type-select').value;
        const metricType = document.getElementById('index-metric-select').value;

        if (!fieldName || !indexType || !metricType) {
            alert('Please select field, index type, and metric type');
            return;
        }

        const params = getIndexParams(indexType);
        vscode.postMessage({
            command: 'createIndex',
            fieldName: fieldName,
            indexType: indexType,
            metricType: metricType,
            params: params
        });
    }

    function dropIndex (indexName) {
        if (confirm(`Drop index "${indexName}"?`)) {
            vscode.postMessage({
                command: 'dropIndex',
                indexName: indexName
            });
        }
    }

    function createPartition () {
        const name = document.getElementById('new-partition-name').value.trim();
        if (!name) {
            alert('Please provide partition name');
            return;
        }

        vscode.postMessage({
            command: 'createPartition',
            partitionName: name
        });
    }

    function dropPartition (partitionName) {
        if (confirm(`Drop partition "${partitionName}"?`)) {
            vscode.postMessage({
                command: 'dropPartition',
                partitionName: partitionName
            });
        }
    }

    function loadPartition (partitionName) {
        vscode.postMessage({
            command: 'loadPartition',
            partitionName: partitionName
        });
    }

    function releasePartition (partitionName) {
        vscode.postMessage({
            command: 'releasePartition',
            partitionName: partitionName
        });
    }

    function loadCollection () {
        if (confirm(`Load collection "${currentData.collectionInfo.name}" into memory?`)) {
            vscode.postMessage({ command: 'loadCollection' });
        }
    }

    function releaseCollection () {
        if (confirm(`Release collection "${currentData.collectionInfo.name}" from memory?`)) {
            vscode.postMessage({ command: 'releaseCollection' });
        }
    }

    function compactCollection () {
        if (confirm(`Compact collection "${currentData.collectionInfo.name}" to optimize storage?`)) {
            vscode.postMessage({ command: 'compactCollection' });
        }
    }

    function flushCollection () {
        vscode.postMessage({ command: 'flushCollection' });
    }

    function deleteAllEntities () {
        if (confirm(`🚨 Delete all entities from "${currentData.collectionInfo.name}"? This cannot be undone!`)) {
            vscode.postMessage({ command: 'deleteAllEntities' });
        }
    }

    function truncateCollection () {
        if (confirm(`🚨 Truncate collection "${currentData.collectionInfo.name}"? This will remove all data but keep the schema!`)) {
            vscode.postMessage({ command: 'truncateCollection' });
        }
    }

    function updateCollectionProperties () {
        const consistencyLevel = document.getElementById('consistency-level').value;
        const enableDynamicField = document.getElementById('enable-dynamic-field').checked;

        vscode.postMessage({
            command: 'updateCollectionProperties',
            consistencyLevel: consistencyLevel,
            enableDynamicField: enableDynamicField
        });
    }

    function updateDescription () {
        const description = document.getElementById('collection-description').value.trim();
        vscode.postMessage({
            command: 'updateDescription',
            description: description
        });
    }

    function refreshData () {
        vscode.postMessage({ command: 'refresh' });
    }

    function refreshStatistics () {
        vscode.postMessage({ command: 'refreshStatistics' });
    }

    function getIndexParams (indexType) {
        const defaultParams = {
            'FLAT': {},
            'IVF_FLAT': { nlist: 1024 },
            'IVF_SQ8': { nlist: 1024 },
            'IVF_PQ': { nlist: 1024, m: 16, nbits: 8 },
            'HNSW': { M: 16, efConstruction: 200 },
            'ANNOY': { n_trees: 8 },
            'DISKANN': { max_degree: 128, search_list_size: 100 }
        };
        return defaultParams[indexType] || {};
    }

    // New functions for enhanced features
    function createAdvancedIndex () {
        const fieldName = document.getElementById('index-field-select').value;
        const indexType = document.getElementById('index-type-select').value;
        const metricType = document.getElementById('index-metric-select').value;

        if (!fieldName || !indexType || !metricType) {
            alert('Please select field, index type, and metric type');
            return;
        }

        const params = getIndexParams(indexType);
        vscode.postMessage({
            command: 'createIndex',
            fieldName: fieldName,
            indexType: indexType,
            metricType: metricType,
            params: params
        });
    }

    function rebuildAllIndexes () {
        if (confirm('Rebuild all indexes? This may take some time and will temporarily affect query performance.')) {
            vscode.postMessage({ command: 'rebuildAllIndexes' });
        }
    }

    function dropAllIndexes () {
        if (confirm('🚨 Drop ALL indexes? This will significantly impact query performance until new indexes are created!')) {
            vscode.postMessage({ command: 'dropAllIndexes' });
        }
    }

    function analyzeIndexPerformance () {
        vscode.postMessage({ command: 'analyzeIndexPerformance' });
    }

    function showPartitionStats () {
        vscode.postMessage({ command: 'showPartitionStats' });
    }

    function compactPartitions () {
        if (confirm('Compact all partitions? This will optimize storage and may take some time.')) {
            vscode.postMessage({ command: 'compactPartitions' });
        }
    }

    // Alias management functions
    function createAlias () {
        const aliasName = document.getElementById('new-alias-name').value.trim();
        if (!aliasName) {
            alert('Please enter an alias name');
            return;
        }

        vscode.postMessage({
            command: 'createAlias',
            aliasName: aliasName,
            collectionName: currentData.collectionInfo.name
        });

        document.getElementById('new-alias-name').value = '';
    }

    function dropAlias (aliasName) {
        if (confirm(`Drop alias "${aliasName}"?`)) {
            vscode.postMessage({
                command: 'dropAlias',
                aliasName: aliasName
            });
        }
    }

    function switchAliasTarget () {
        const aliasName = document.getElementById('alias-select').value;
        const newTarget = document.getElementById('new-target-collection').value.trim();

        if (!aliasName || !newTarget) {
            alert('Please select alias and enter new target collection');
            return;
        }

        if (confirm(`Switch alias "${aliasName}" to target collection "${newTarget}"?`)) {
            vscode.postMessage({
                command: 'switchAliasTarget',
                aliasName: aliasName,
                newTargetCollection: newTarget
            });
        }
    }

    // Properties management functions
    function updateCollectionProperties () {
        const description = document.getElementById('collection-description').value.trim();
        const consistencyLevel = document.getElementById('consistency-level').value;
        const ttl = document.getElementById('collection-ttl').value;
        const enableDynamicFields = document.getElementById('enable-dynamic-fields').value === 'true';
        const mmapEnabled = document.getElementById('mmap-enabled').value === 'true';
        const segmentSize = document.getElementById('segment-size').value;
        const indexFileSize = document.getElementById('index-file-size').value;

        vscode.postMessage({
            command: 'updateCollectionProperties',
            properties: {
                description: description,
                consistencyLevel: consistencyLevel,
                ttl: ttl ? parseInt(ttl) : null,
                enableDynamicFields: enableDynamicFields,
                mmapEnabled: mmapEnabled,
                segmentSize: segmentSize ? parseInt(segmentSize) : null,
                indexFileSize: indexFileSize ? parseInt(indexFileSize) : null
            }
        });
    }

    function resetProperties () {
        if (confirm('Reset all properties to their original values?')) {
            renderUI(); // Re-render to reset form values
        }
    }

    function renameCollection () {
        const newName = prompt(`Enter new name for collection "${currentData.collectionInfo.name}":`, currentData.collectionInfo.name);
        if (newName && newName !== currentData.collectionInfo.name) {
            if (confirm(`Rename collection from "${currentData.collectionInfo.name}" to "${newName}"?`)) {
                vscode.postMessage({
                    command: 'renameCollection',
                    newName: newName
                });
            }
        }
    }

    // Enhanced operation functions
    function importData () {
        const fileInput = document.getElementById('import-file');
        if (!fileInput.files.length) {
            alert('Please select a file to import');
            return;
        }

        const file = fileInput.files[0];
        const reader = new FileReader();

        reader.onload = function (e) {
            try {
                const data = JSON.parse(e.target.result);
                vscode.postMessage({
                    command: 'importData',
                    data: data,
                    fileName: file.name
                });
            } catch (error) {
                alert('Invalid JSON file format');
            }
        };

        reader.readAsText(file);
    }

    function exportData () {
        const format = document.getElementById('export-format').value;
        vscode.postMessage({
            command: 'exportData',
            format: format
        });
    }

    // Utility functions
    function formatNumber (num) {
        return new Intl.NumberFormat().format(parseInt(num) || 0);
    }

    function formatBytes (bytes) {
        const size = parseInt(bytes) || 0;
        if (size === 0) { return '0 B'; }
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(size) / Math.log(k));
        return parseFloat((size / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function getDataTypeName (dataType) {
        const typeMap = {
            1: 'Bool', 2: 'Int8', 3: 'Int16', 4: 'Int32', 5: 'Int64',
            10: 'Float', 11: 'Double', 20: 'String', 21: 'VarChar',
            100: 'BinaryVector', 101: 'FloatVector'
        };
        return typeMap[dataType] || dataType;
    }

    // Make all onclick functions globally accessible
    window.deleteCollection = deleteCollection;
    window.refreshData = refreshData;
    window.switchTab = switchTab;
    window.loadCollection = loadCollection;
    window.releaseCollection = releaseCollection;
    window.compactCollection = compactCollection;
    window.flushCollection = flushCollection;
    window.createIndexForField = createIndexForField;
    window.dropIndex = dropIndex;
    window.createAdvancedIndex = createAdvancedIndex;
    window.rebuildAllIndexes = rebuildAllIndexes;
    window.dropAllIndexes = dropAllIndexes;
    window.analyzeIndexPerformance = analyzeIndexPerformance;
    window.dropPartition = dropPartition;
    window.createPartition = createPartition;
    window.showPartitionStats = showPartitionStats;
    window.compactPartitions = compactPartitions;
    window.dropAlias = dropAlias;
    window.createAlias = createAlias;
    window.switchAliasTarget = switchAliasTarget;
    window.updateCollectionProperties = updateCollectionProperties;
    window.resetProperties = resetProperties;
    window.renameCollection = renameCollection;
    window.deleteAllEntities = deleteAllEntities;
    window.truncateCollection = truncateCollection;
    window.refreshStatistics = refreshStatistics;
    window.importData = importData;
    window.exportData = exportData;
    window.updateDescription = updateDescription;

    // Initialize
    refreshData();
})();