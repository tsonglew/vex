(function () {
    const vscode = acquireVsCodeApi();

    let currentData = null;

    // Listen for messages from the extension
    window.addEventListener('message', event => {
        const message = event.data;

        switch (message.command) {
            case 'updateCollectionData':
                currentData = message.data;
                updateUI();
                break;
            case 'showError':
                showError(message.message);
                break;
        }
    });

    function updateUI () {
        if (!currentData) { return; }

        const content = document.getElementById('content');
        content.innerHTML = `
            <h2>Collection: ${currentData.collectionInfo.name}</h2>
            
            <!-- Collection Info Section -->
            <div class="section">
                <div class="section-header collapsible" onclick="toggleCollapse(this)">
                    📋 Collection Information
                </div>
                <div class="collapsible-content">
                    <div class="stats-grid">
                        <div class="stat-item">
                            <div class="stat-label">Load State</div>
                            <div class="stat-value">${currentData.collectionInfo.loadState}</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">Consistency Level</div>
                            <div class="stat-value">${currentData.collectionInfo.consistencyLevel}</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">Auto ID</div>
                            <div class="stat-value">${currentData.collectionInfo.autoId ? 'Yes' : 'No'}</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">Field Count</div>
                            <div class="stat-value">${currentData.collectionInfo.fields.length}</div>
                        </div>
                    </div>
                    ${currentData.collectionInfo.description ? `
                        <p><strong>Description:</strong> ${currentData.collectionInfo.description}</p>
                    ` : ''}
                    <div class="action-buttons">
                        <button class="btn btn-secondary" onclick="loadCollection()">⬆️ Load Collection</button>
                        <button class="btn btn-secondary" onclick="releaseCollection()">⬇️ Release Collection</button>
                    </div>
                </div>
            </div>

            <!-- Statistics Section -->
            <div class="section">
                <div class="section-header collapsible" onclick="toggleCollapse(this)">
                    📊 Statistics
                </div>
                <div class="collapsible-content">
                    <div class="stats-grid">
                        <div class="stat-item">
                            <div class="stat-label">Total Vectors</div>
                            <div class="stat-value">${formatNumber(currentData.collectionStats.rowCount)}</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">Indexed Segments</div>
                            <div class="stat-value">${currentData.collectionStats.indexedSegments}</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">Total Segments</div>
                            <div class="stat-value">${currentData.collectionStats.totalSegments}</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">Memory Size</div>
                            <div class="stat-value">${formatBytes(currentData.collectionStats.memorySize)}</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">Disk Size</div>
                            <div class="stat-value">${formatBytes(currentData.collectionStats.diskSize)}</div>
                        </div>
                    </div>
                    <div class="action-buttons">
                        <button class="btn" onclick="refreshData()">🔄 Refresh Statistics</button>
                    </div>
                </div>
            </div>

            <!-- Fields & Indexes Section -->
            <div class="section">
                <div class="section-header collapsible" onclick="toggleCollapse(this)">
                    🗂️ Fields & Indexes (${currentData.collectionInfo.fields.length} fields, ${currentData.indexes.length} indexes)
                </div>
                <div class="collapsible-content">
                    <table class="fields-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Type</th>
                                <th>Dimension</th>
                                <th>Primary Key</th>
                                <th>Auto ID</th>
                                <th>Index Type</th>
                                <th>Metric Type</th>
                                <th>Index Params</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${currentData.collectionInfo.fields.map(field => {
                                // Find associated index for this field
                                const fieldIndex = currentData.indexes.find(index => 
                                    (index.field_name || index.fieldName) === field.name
                                );
                                
                                return `
                                <tr>
                                    <td><strong>${field.name}</strong></td>
                                    <td>${getDataTypeName(field.data_type)}</td>
                                    <td>${field.type_params?.dim || field.dim || '-'}</td>
                                    <td>${field.is_primary_key ? '✅' : '❌'}</td>
                                    <td>${field.auto_id ? '✅' : '❌'}</td>
                                    <td>${fieldIndex ? (fieldIndex.index_type || 'Unknown') : '-'}</td>
                                    <td>${fieldIndex ? (fieldIndex.metric_type || '-') : '-'}</td>
                                    <td>${fieldIndex ? formatIndexParams(fieldIndex.params) : '-'}</td>
                                    <td>
                                        ${field.data_type === 101 && !fieldIndex ? `
                                            <button class="btn btn-secondary btn-sm" onclick="createIndexForField('${field.name}')">
                                                ➕ Add Index
                                            </button>
                                        ` : ''}
                                        ${fieldIndex ? `
                                            <button class="btn btn-danger btn-sm" onclick="dropIndex('${fieldIndex.index_name || fieldIndex.field_name}')">
                                                🗑️ Drop Index
                                            </button>
                                        ` : ''}
                                    </td>
                                </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                    
                    <div class="action-buttons">
                        <h4>Create New Index:</h4>
                        <div class="input-row">
                            <select id="field-select">
                                <option value="">Select Vector Field</option>
                                ${currentData.collectionInfo.fields
                .filter(field => field.data_type === 101 && !currentData.indexes.find(index => (index.field_name || index.fieldName) === field.name)) // FloatVector without index
                .map(field => `<option value="${field.name}">${field.name} (${field.type_params?.dim || field.dim}D)</option>`)
                .join('')}
                            </select>
                            <select id="index-type-select">
                                <option value="">Select Index Type</option>
                                <option value="FLAT">FLAT</option>
                                <option value="IVF_FLAT">IVF_FLAT</option>
                                <option value="IVF_SQ8">IVF_SQ8</option>
                                <option value="IVF_PQ">IVF_PQ</option>
                                <option value="HNSW">HNSW (Recommended)</option>
                                <option value="ANNOY">ANNOY</option>
                            </select>
                            <button class="btn" onclick="createIndex()">➕ Create Index</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Partitions Section -->
            <div class="section">
                <div class="section-header collapsible" onclick="toggleCollapse(this)">
                    📂 Partitions (${currentData.partitions.length})
                </div>
                <div class="collapsible-content">
                    <table class="partitions-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>ID</th>
                                <th>Created Time</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${currentData.partitions.map(partition => `
                                <tr>
                                    <td><strong>${partition.name}</strong></td>
                                    <td>${partition.id}</td>
                                    <td>${partition.createdTime ? new Date(partition.createdTime).toLocaleString() : '-'}</td>
                                    <td>
                                        ${partition.name !== '_default' ? `
                                            <button class="btn btn-danger btn-sm" onclick="dropPartition('${partition.name}')">
                                                🗑️ Drop
                                            </button>
                                        ` : ''}
                                    </td>
                                </tr>
                            `).join('')}
                            ${currentData.partitions.length === 0 ? '<tr><td colspan="4">No partitions found</td></tr>' : ''}
                        </tbody>
                    </table>
                    
                    <div class="action-buttons">
                        <h4>Create New Partition:</h4>
                        <div class="input-row">
                            <input type="text" id="partition-name-input" placeholder="Partition name">
                            <button class="btn" onclick="createPartition()">➕ Create Partition</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function showError (message) {
        const content = document.getElementById('content');
        content.innerHTML = `
            <div class="error">
                <strong>Error:</strong> ${message}
            </div>
            <button class="btn" onclick="refreshData()">🔄 Retry</button>
        `;
    }

    function toggleCollapse (element) {
        element.classList.toggle('collapsed');
    }

    function refreshData () {
        vscode.postMessage({ command: 'refresh' });
    }

    function createIndex () {
        const fieldName = document.getElementById('field-select').value;
        const indexType = document.getElementById('index-type-select').value;

        if (!fieldName || !indexType) {
            alert('Please select both field and index type');
            return;
        }

        const params = getDefaultIndexParams(indexType);
        vscode.postMessage({
            command: 'createIndex',
            fieldName: fieldName,
            indexType: indexType,
            params: params
        });
    }

    function createIndexForField (fieldName) {
        // Show a simple prompt for index type selection
        const indexTypes = ['FLAT', 'IVF_FLAT', 'IVF_SQ8', 'IVF_PQ', 'HNSW', 'ANNOY'];
        const selectedType = prompt(
            `Create index for field "${fieldName}".\n\nSelect index type:\n` +
            indexTypes.map((type, i) => `${i + 1}. ${type}${type === 'HNSW' ? ' (Recommended)' : ''}`).join('\n') +
            '\n\nEnter number (1-6):'
        );

        if (!selectedType || isNaN(selectedType) || selectedType < 1 || selectedType > 6) {
            return;
        }

        const indexType = indexTypes[parseInt(selectedType) - 1];
        const params = getDefaultIndexParams(indexType);
        
        vscode.postMessage({
            command: 'createIndex',
            fieldName: fieldName,
            indexType: indexType,
            params: params
        });
    }

    function dropIndex (indexName) {
        if (confirm(`Are you sure you want to drop the index "${indexName}"?`)) {
            vscode.postMessage({
                command: 'dropIndex',
                indexName: indexName
            });
        }
    }

    function createPartition () {
        const partitionName = document.getElementById('partition-name-input').value.trim();

        if (!partitionName) {
            alert('Please enter a partition name');
            return;
        }

        vscode.postMessage({
            command: 'createPartition',
            partitionName: partitionName
        });

        document.getElementById('partition-name-input').value = '';
    }

    function dropPartition (partitionName) {
        if (confirm(`Are you sure you want to drop the partition "${partitionName}"?`)) {
            vscode.postMessage({
                command: 'dropPartition',
                partitionName: partitionName
            });
        }
    }

    function loadCollection () {
        if (confirm('Loading the collection will make it available for queries and operations. Continue?')) {
            vscode.postMessage({
                command: 'loadCollection'
            });
        }
    }

    function releaseCollection () {
        if (confirm('Releasing the collection will free up memory resources but make it unavailable for queries. Continue?')) {
            vscode.postMessage({
                command: 'releaseCollection'
            });
        }
    }



    function getDataTypeName (dataType) {
        const typeMap = {
            1: 'Bool',
            2: 'Int8',
            3: 'Int16',
            4: 'Int32',
            5: 'Int64',
            10: 'Float',
            11: 'Double',
            20: 'String',
            21: 'VarChar',
            100: 'BinaryVector',
            101: 'FloatVector'
        };
        return typeMap[dataType] || `Unknown (${dataType})`;
    }

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

    function formatIndexParams (params) {
        if (!params || typeof params !== 'object') { return '-'; }
        return Object.entries(params)
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ');
    }

    function getDefaultIndexParams (indexType) {
        const defaultParams = {
            'FLAT': {},
            'IVF_FLAT': { nlist: 1024 },
            'IVF_SQ8': { nlist: 1024 },
            'IVF_PQ': { nlist: 1024, m: 16, nbits: 8 },
            'HNSW': { M: 16, efConstruction: 200 },
            'ANNOY': { n_trees: 8 }
        };
        return defaultParams[indexType] || {};
    }

    // Initialize
    refreshData();
})();
