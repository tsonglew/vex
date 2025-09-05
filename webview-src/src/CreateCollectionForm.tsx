import React, { useState } from 'react';

export interface CollectionConfig {
    name: string;
    description: string;
    consistencyLevel: 'Strong' | 'Session' | 'Bounded' | 'Eventually';
    enableDynamicField: boolean;
    fields: FieldDefinition[];
    vectorField: VectorFieldConfig;
    indexConfig: IndexConfig;
}

export interface FieldDefinition {
    name: string;
    dataType: string;
    isPrimaryKey: boolean;
    autoId: boolean;
    nullable: boolean;
    defaultValue?: string;
    maxLength?: number;
    description?: string;
}

export interface VectorFieldConfig {
    name: string;
    dimension: number;
    description?: string;
}

export interface IndexConfig {
    indexType: 'FLAT' | 'IVF_FLAT' | 'IVF_SQ8' | 'IVF_PQ' | 'HNSW' | 'SCANN';
    metricType: 'L2' | 'IP' | 'COSINE' | 'HAMMING' | 'JACCARD';
    params: Record<string, any>;
}

interface CreateCollectionFormProps {
    onSubmit: (config: CollectionConfig) => void;
    onCancel: () => void;
}

const CreateCollectionForm: React.FC<CreateCollectionFormProps> = ({ onSubmit, onCancel }) => {
    const [formData, setFormData] = useState<CollectionConfig>({
        name: '',
        description: '',
        consistencyLevel: 'Session',
        enableDynamicField: false,
        fields: [{
            name: 'id',
            dataType: 'Int64',
            isPrimaryKey: true,
            autoId: true,
            nullable: false,
            description: 'Primary key field'
        }],
        vectorField: {
            name: 'vector',
            dimension: 768,
            description: 'Vector embeddings field'
        },
        indexConfig: {
            indexType: 'HNSW',
            metricType: 'COSINE',
            params: { M: 16, efConstruction: 200 }
        }
    });

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [currentStep, setCurrentStep] = useState(1);

    const dataTypes = [
        'Bool', 'Int8', 'Int16', 'Int32', 'Int64', 
        'Float', 'Double', 'String', 'VarChar', 'JSON'
    ];

    const indexTypes = [
        { value: 'FLAT', label: 'FLAT - Exact search', description: 'Brute force search, 100% recall' },
        { value: 'IVF_FLAT', label: 'IVF_FLAT - Fast approximate search', description: 'Good balance of speed and accuracy' },
        { value: 'IVF_SQ8', label: 'IVF_SQ8 - Memory efficient', description: 'Quantized vectors, lower memory usage' },
        { value: 'HNSW', label: 'HNSW - High performance', description: 'Hierarchical graph, excellent performance' },
        { value: 'SCANN', label: 'SCANN - Google optimized', description: 'Google\'s optimized approximate search' }
    ];

    const metricTypes = [
        { value: 'L2', label: 'Euclidean (L2)', description: 'Euclidean distance' },
        { value: 'IP', label: 'Inner Product (IP)', description: 'Dot product similarity' },
        { value: 'COSINE', label: 'Cosine Similarity', description: 'Normalized dot product' },
        { value: 'HAMMING', label: 'Hamming Distance', description: 'For binary vectors' },
        { value: 'JACCARD', label: 'Jaccard Distance', description: 'For binary vectors' }
    ];

    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!formData.name.trim()) {
            newErrors.name = 'Collection name is required';
        } else if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(formData.name)) {
            newErrors.name = 'Collection name must start with letter and contain only letters, numbers, and underscores';
        }

        if (!formData.vectorField.name.trim()) {
            newErrors.vectorFieldName = 'Vector field name is required';
        }

        if (formData.vectorField.dimension < 1 || formData.vectorField.dimension > 32768) {
            newErrors.vectorDimension = 'Vector dimension must be between 1 and 32768';
        }

        const fieldNames = formData.fields.map(f => f.name);
        const duplicateFields = fieldNames.filter((name, index) => fieldNames.indexOf(name) !== index);
        if (duplicateFields.length > 0) {
            newErrors.fields = `Duplicate field names: ${duplicateFields.join(', ')}`;
        }

        if (fieldNames.includes(formData.vectorField.name)) {
            newErrors.vectorFieldName = 'Vector field name conflicts with existing field';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (validateForm()) {
            onSubmit(formData);
        }
    };

    const addField = () => {
        setFormData(prev => ({
            ...prev,
            fields: [...prev.fields, {
                name: '',
                dataType: 'VarChar',
                isPrimaryKey: false,
                autoId: false,
                nullable: true,
                description: ''
            }]
        }));
    };

    const removeField = (index: number) => {
        setFormData(prev => ({
            ...prev,
            fields: prev.fields.filter((_, i) => i !== index)
        }));
    };

    const updateField = (index: number, field: Partial<FieldDefinition>) => {
        setFormData(prev => ({
            ...prev,
            fields: prev.fields.map((f, i) => i === index ? { ...f, ...field } : f)
        }));
    };

    const renderStep1 = () => (
        <div className="form-step">
            <h3>📝 Basic Information</h3>
            <div className="form-group">
                <label htmlFor="name">Collection Name *</label>
                <input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className={errors.name ? 'error' : ''}
                    placeholder="my_collection"
                />
                {errors.name && <span className="error-text">{errors.name}</span>}
            </div>

            <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe your collection..."
                    rows={3}
                />
            </div>

            <div className="form-group">
                <label htmlFor="consistencyLevel">Consistency Level</label>
                <select
                    id="consistencyLevel"
                    value={formData.consistencyLevel}
                    onChange={(e) => setFormData(prev => ({ ...prev, consistencyLevel: e.target.value as any }))}
                >
                    <option value="Strong">Strong - Highest consistency</option>
                    <option value="Session">Session - Default, good balance</option>
                    <option value="Bounded">Bounded - Eventual with time bound</option>
                    <option value="Eventually">Eventually - Lowest latency</option>
                </select>
            </div>

            <div className="form-group">
                <label className="checkbox-label">
                    <input
                        type="checkbox"
                        checked={formData.enableDynamicField}
                        onChange={(e) => setFormData(prev => ({ ...prev, enableDynamicField: e.target.checked }))}
                    />
                    Enable Dynamic Fields
                    <span className="help-text">Allow insertion of fields not defined in schema</span>
                </label>
            </div>
        </div>
    );

    const renderStep2 = () => (
        <div className="form-step">
            <h3>🗂️ Schema Fields</h3>
            {errors.fields && <div className="error-text">{errors.fields}</div>}
            
            {formData.fields.map((field, index) => (
                <div key={index} className="field-config">
                    <div className="field-header">
                        <h4>Field {index + 1} {field.isPrimaryKey && <span className="primary-key-badge">Primary Key</span>}</h4>
                        {!field.isPrimaryKey && (
                            <button type="button" onClick={() => removeField(index)} className="btn-remove">×</button>
                        )}
                    </div>
                    
                    <div className="field-grid">
                        <div className="form-group">
                            <label>Field Name *</label>
                            <input
                                type="text"
                                value={field.name}
                                onChange={(e) => updateField(index, { name: e.target.value })}
                                placeholder="field_name"
                                disabled={field.isPrimaryKey}
                            />
                        </div>

                        <div className="form-group">
                            <label>Data Type</label>
                            <select
                                value={field.dataType}
                                onChange={(e) => updateField(index, { dataType: e.target.value })}
                                disabled={field.isPrimaryKey}
                            >
                                {dataTypes.map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                        </div>

                        {(field.dataType === 'VarChar' || field.dataType === 'String') && (
                            <div className="form-group">
                                <label>Max Length</label>
                                <input
                                    type="number"
                                    value={field.maxLength || 65535}
                                    onChange={(e) => updateField(index, { maxLength: parseInt(e.target.value) })}
                                    min="1"
                                    max="65535"
                                />
                            </div>
                        )}

                        <div className="form-group">
                            <label>Description</label>
                            <input
                                type="text"
                                value={field.description || ''}
                                onChange={(e) => updateField(index, { description: e.target.value })}
                                placeholder="Field description"
                            />
                        </div>
                    </div>

                    <div className="field-options">
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={field.nullable}
                                onChange={(e) => updateField(index, { nullable: e.target.checked })}
                                disabled={field.isPrimaryKey}
                            />
                            Nullable
                        </label>

                        {field.isPrimaryKey && (
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={field.autoId}
                                    onChange={(e) => updateField(index, { autoId: e.target.checked })}
                                />
                                Auto ID
                            </label>
                        )}
                    </div>
                </div>
            ))}

            <button type="button" onClick={addField} className="btn btn-secondary">
                + Add Field
            </button>
        </div>
    );

    const renderStep3 = () => (
        <div className="form-step">
            <h3>🎯 Vector Configuration</h3>
            
            <div className="form-group">
                <label htmlFor="vectorName">Vector Field Name *</label>
                <input
                    id="vectorName"
                    type="text"
                    value={formData.vectorField.name}
                    onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        vectorField: { ...prev.vectorField, name: e.target.value }
                    }))}
                    className={errors.vectorFieldName ? 'error' : ''}
                    placeholder="vector"
                />
                {errors.vectorFieldName && <span className="error-text">{errors.vectorFieldName}</span>}
            </div>

            <div className="form-group">
                <label htmlFor="dimension">Vector Dimension *</label>
                <input
                    id="dimension"
                    type="number"
                    value={formData.vectorField.dimension}
                    onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        vectorField: { ...prev.vectorField, dimension: parseInt(e.target.value) }
                    }))}
                    className={errors.vectorDimension ? 'error' : ''}
                    min="1"
                    max="32768"
                    placeholder="768"
                />
                {errors.vectorDimension && <span className="error-text">{errors.vectorDimension}</span>}
                <span className="help-text">Common dimensions: 384 (sentence-transformers), 768 (BERT), 1536 (OpenAI)</span>
            </div>

            <div className="form-group">
                <label htmlFor="vectorDescription">Vector Description</label>
                <input
                    id="vectorDescription"
                    type="text"
                    value={formData.vectorField.description || ''}
                    onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        vectorField: { ...prev.vectorField, description: e.target.value }
                    }))}
                    placeholder="Vector embeddings for similarity search"
                />
            </div>
        </div>
    );

    const renderStep4 = () => (
        <div className="form-step">
            <h3>🔍 Index Configuration</h3>
            
            <div className="form-group">
                <label htmlFor="indexType">Index Type</label>
                <select
                    id="indexType"
                    value={formData.indexConfig.indexType}
                    onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        indexConfig: { ...prev.indexConfig, indexType: e.target.value as any }
                    }))}
                >
                    {indexTypes.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                </select>
                <span className="help-text">
                    {indexTypes.find(t => t.value === formData.indexConfig.indexType)?.description}
                </span>
            </div>

            <div className="form-group">
                <label htmlFor="metricType">Distance Metric</label>
                <select
                    id="metricType"
                    value={formData.indexConfig.metricType}
                    onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        indexConfig: { ...prev.indexConfig, metricType: e.target.value as any }
                    }))}
                >
                    {metricTypes.map(metric => (
                        <option key={metric.value} value={metric.value}>{metric.label}</option>
                    ))}
                </select>
                <span className="help-text">
                    {metricTypes.find(m => m.value === formData.indexConfig.metricType)?.description}
                </span>
            </div>

            {formData.indexConfig.indexType === 'HNSW' && (
                <div className="index-params">
                    <h4>HNSW Parameters</h4>
                    <div className="param-grid">
                        <div className="form-group">
                            <label>M (Connections)</label>
                            <input
                                type="number"
                                value={formData.indexConfig.params.M || 16}
                                onChange={(e) => setFormData(prev => ({ 
                                    ...prev, 
                                    indexConfig: { 
                                        ...prev.indexConfig, 
                                        params: { ...prev.indexConfig.params, M: parseInt(e.target.value) }
                                    }
                                }))}
                                min="4"
                                max="64"
                            />
                            <span className="help-text">Higher M = better recall, more memory</span>
                        </div>
                        <div className="form-group">
                            <label>efConstruction</label>
                            <input
                                type="number"
                                value={formData.indexConfig.params.efConstruction || 200}
                                onChange={(e) => setFormData(prev => ({ 
                                    ...prev, 
                                    indexConfig: { 
                                        ...prev.indexConfig, 
                                        params: { ...prev.indexConfig.params, efConstruction: parseInt(e.target.value) }
                                    }
                                }))}
                                min="8"
                                max="512"
                            />
                            <span className="help-text">Higher ef = better quality, slower build</span>
                        </div>
                    </div>
                </div>
            )}

            {formData.indexConfig.indexType.startsWith('IVF') && (
                <div className="index-params">
                    <h4>IVF Parameters</h4>
                    <div className="form-group">
                        <label>nlist (Clusters)</label>
                        <input
                            type="number"
                            value={formData.indexConfig.params.nlist || 1024}
                            onChange={(e) => setFormData(prev => ({ 
                                ...prev, 
                                indexConfig: { 
                                    ...prev.indexConfig, 
                                    params: { ...prev.indexConfig.params, nlist: parseInt(e.target.value) }
                                }
                            }))}
                            min="1"
                            max="65536"
                        />
                        <span className="help-text">More clusters = better accuracy, slower search</span>
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <div className="modal-overlay">
            <div className="modal-content large">
                <div className="modal-header">
                    <h2>🆕 Create New Collection</h2>
                    <button type="button" onClick={onCancel} className="close-btn">×</button>
                </div>

                <div className="step-indicator">
                    {[1, 2, 3, 4].map(step => (
                        <div key={step} className={`step ${currentStep >= step ? 'active' : ''}`}>
                            <span className="step-number">{step}</span>
                            <span className="step-label">
                                {step === 1 && 'Basic Info'}
                                {step === 2 && 'Schema'}
                                {step === 3 && 'Vector'}
                                {step === 4 && 'Index'}
                            </span>
                        </div>
                    ))}
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        {currentStep === 1 && renderStep1()}
                        {currentStep === 2 && renderStep2()}
                        {currentStep === 3 && renderStep3()}
                        {currentStep === 4 && renderStep4()}
                    </div>

                    <div className="modal-footer">
                        <div className="footer-left">
                            {currentStep > 1 && (
                                <button 
                                    type="button" 
                                    onClick={() => setCurrentStep(prev => prev - 1)}
                                    className="btn btn-secondary"
                                >
                                    ← Previous
                                </button>
                            )}
                        </div>
                        <div className="footer-right">
                            <button type="button" onClick={onCancel} className="btn btn-secondary">
                                Cancel
                            </button>
                            {currentStep < 4 ? (
                                <button 
                                    type="button" 
                                    onClick={() => setCurrentStep(prev => prev + 1)}
                                    className="btn btn-primary"
                                >
                                    Next →
                                </button>
                            ) : (
                                <button type="submit" className="btn btn-primary">
                                    🚀 Create Collection
                                </button>
                            )}
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateCollectionForm;
