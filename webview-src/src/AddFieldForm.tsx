import React, { useState } from 'react';

// Milvus data types based on the documentation
export const DATA_TYPES = {
    'Bool': 'Bool',
    'Int8': 'Int8',
    'Int16': 'Int16', 
    'Int32': 'Int32',
    'Int64': 'Int64',
    'Float': 'Float',
    'Double': 'Double',
    'String': 'String',
    'VarChar': 'VarChar',
    'Array': 'Array',
    'JSON': 'JSON',
    'BinaryVector': 'BinaryVector',
    'FloatVector': 'FloatVector',
    'Float16Vector': 'Float16Vector',
    'BFloat16Vector': 'BFloat16Vector',
    'SparseFloatVector': 'SparseFloatVector'
} as const;

export const ELEMENT_TYPES = {
    'Bool': 'Bool',
    'Int8': 'Int8',
    'Int16': 'Int16',
    'Int32': 'Int32',
    'Int64': 'Int64',
    'Float': 'Float',
    'Double': 'Double',
    'String': 'String',
    'VarChar': 'VarChar'
} as const;

export const ANALYZER_TYPES = {
    'standard': 'standard',
    'english': 'english',
    'chinese': 'chinese'
} as const;

export const TOKENIZER_TYPES = {
    'standard': 'standard',
    'whitespace': 'whitespace',
    'jieba': 'jieba'
} as const;

export const FILTER_TYPES = [
    'lowercase',
    'alphanumonly',
    'asciifolding',
    'stop'
] as const;

export interface FieldConfig {
    name: string;
    data_type: keyof typeof DATA_TYPES;
    description?: string;
    is_clustering_key?: boolean;
    is_partition_key?: boolean;
    is_primary_key?: boolean;
    auto_id?: boolean;
    nullable?: boolean;
    default_value?: any;
    
    // Vector field specific
    dim?: number;
    
    // Array field specific
    element_type?: keyof typeof ELEMENT_TYPES;
    max_capacity?: number;
    
    // VarChar field specific
    max_length?: number;
    enable_analyzer?: boolean;
    enable_match?: boolean;
    
    // Analyzer configuration
    analyzer_params?: {
        type?: keyof typeof ANALYZER_TYPES;
        tokenizer?: keyof typeof TOKENIZER_TYPES;
        filter?: string[];
    };
    
    // Additional type parameters
    type_params?: Record<string, any>;
}

interface AddFieldFormProps {
    onSubmit: (fieldConfig: FieldConfig) => void;
    onCancel: () => void;
    existingFields?: string[];
}

export const AddFieldForm: React.FC<AddFieldFormProps> = ({ 
    onSubmit, 
    onCancel, 
    existingFields = [] 
}) => {
    const [fieldConfig, setFieldConfig] = useState<FieldConfig>({
        name: '',
        data_type: 'VarChar',
        description: '',
        is_clustering_key: false,
        is_partition_key: false,
        is_primary_key: false,
        auto_id: false,
        nullable: false,
        max_length: 65535
    });

    const [analyzerType, setAnalyzerType] = useState<'built-in' | 'custom'>('built-in');
    const [customFilters, setCustomFilters] = useState<string[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const validateField = (): boolean => {
        const newErrors: Record<string, string> = {};

        // Name validation
        if (!fieldConfig.name.trim()) {
            newErrors.name = 'Field name is required';
        } else if (existingFields.includes(fieldConfig.name)) {
            newErrors.name = 'Field name already exists';
        } else if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(fieldConfig.name)) {
            newErrors.name = 'Field name must start with letter or underscore and contain only letters, numbers, and underscores';
        }

        // Vector dimension validation
        if (['FloatVector', 'BinaryVector', 'Float16Vector', 'BFloat16Vector'].includes(fieldConfig.data_type)) {
            if (!fieldConfig.dim || fieldConfig.dim < 1) {
                newErrors.dim = 'Vector dimension must be greater than 0';
            } else if (fieldConfig.dim > 32768) {
                newErrors.dim = 'Vector dimension cannot exceed 32768';
            }
        }

        // VarChar max_length validation
        if (fieldConfig.data_type === 'VarChar') {
            if (!fieldConfig.max_length || fieldConfig.max_length < 1) {
                newErrors.max_length = 'Max length must be greater than 0';
            } else if (fieldConfig.max_length > 65535) {
                newErrors.max_length = 'Max length cannot exceed 65535';
            }
        }

        // Array field validation
        if (fieldConfig.data_type === 'Array') {
            if (!fieldConfig.element_type) {
                newErrors.element_type = 'Element type is required for array fields';
            }
            if (!fieldConfig.max_capacity || fieldConfig.max_capacity < 1) {
                newErrors.max_capacity = 'Max capacity must be greater than 0';
            } else if (fieldConfig.max_capacity > 4096) {
                newErrors.max_capacity = 'Max capacity cannot exceed 4096';
            }
        }

        // Primary key validation
        if (fieldConfig.is_primary_key) {
            if (!['Int64', 'VarChar'].includes(fieldConfig.data_type)) {
                newErrors.is_primary_key = 'Primary key must be Int64 or VarChar type';
            }
            if (fieldConfig.nullable) {
                newErrors.nullable = 'Primary key cannot be nullable';
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!validateField()) {
            return;
        }

        // Prepare final field configuration
        const finalConfig: FieldConfig = { ...fieldConfig };

        // Set analyzer params if enabled
        if (fieldConfig.data_type === 'VarChar' && fieldConfig.enable_analyzer) {
            if (analyzerType === 'built-in') {
                finalConfig.analyzer_params = {
                    type: fieldConfig.analyzer_params?.type || 'standard'
                };
            } else {
                finalConfig.analyzer_params = {
                    tokenizer: fieldConfig.analyzer_params?.tokenizer || 'standard',
                    filter: customFilters.length > 0 ? customFilters : ['lowercase']
                };
            }
        }

        // Clean up unused properties based on data type
        if (!['FloatVector', 'BinaryVector', 'Float16Vector', 'BFloat16Vector'].includes(fieldConfig.data_type)) {
            delete finalConfig.dim;
        }
        
        if (fieldConfig.data_type !== 'VarChar') {
            delete finalConfig.max_length;
            delete finalConfig.enable_analyzer;
            delete finalConfig.enable_match;
            delete finalConfig.analyzer_params;
        }
        
        if (fieldConfig.data_type !== 'Array') {
            delete finalConfig.element_type;
            delete finalConfig.max_capacity;
        }

        onSubmit(finalConfig);
    };

    const updateFieldConfig = (updates: Partial<FieldConfig>) => {
        setFieldConfig(prev => ({ ...prev, ...updates }));
    };

    const addCustomFilter = () => {
        const newFilter = prompt('Enter filter name:');
        if (newFilter && !customFilters.includes(newFilter)) {
            setCustomFilters(prev => [...prev, newFilter]);
        }
    };

    const removeCustomFilter = (index: number) => {
        setCustomFilters(prev => prev.filter((_, i) => i !== index));
    };

    const isVectorType = ['FloatVector', 'BinaryVector', 'Float16Vector', 'BFloat16Vector', 'SparseFloatVector'].includes(fieldConfig.data_type);
    const isVarCharType = fieldConfig.data_type === 'VarChar';
    const isArrayType = fieldConfig.data_type === 'Array';

    return (
        <div className="add-field-form-overlay">
            <div className="add-field-form">
                <div className="form-header">
                    <h2>Add New Field</h2>
                    <button className="close-btn" onClick={onCancel}>×</button>
                </div>

                <form onSubmit={handleSubmit} className="field-form">
                    {/* Basic Information */}
                    <div className="form-section">
                        <h3>Basic Information</h3>
                        
                        <div className="form-group">
                            <label htmlFor="name">Field Name *</label>
                            <input
                                id="name"
                                type="text"
                                value={fieldConfig.name}
                                onChange={(e) => updateFieldConfig({ name: e.target.value })}
                                placeholder="Enter field name"
                                className={errors.name ? 'error' : ''}
                            />
                            {errors.name && <span className="error-text">{errors.name}</span>}
                        </div>

                        <div className="form-group">
                            <label htmlFor="data_type">Data Type *</label>
                            <select
                                id="data_type"
                                value={fieldConfig.data_type}
                                onChange={(e) => updateFieldConfig({ 
                                    data_type: e.target.value as keyof typeof DATA_TYPES,
                                    // Reset type-specific fields when changing data type
                                    dim: undefined,
                                    max_length: e.target.value === 'VarChar' ? 65535 : undefined,
                                    element_type: undefined,
                                    max_capacity: undefined,
                                    enable_analyzer: false,
                                    enable_match: false
                                })}
                            >
                                {Object.entries(DATA_TYPES).map(([key, value]) => (
                                    <option key={key} value={key}>{value}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label htmlFor="description">Description</label>
                            <textarea
                                id="description"
                                value={fieldConfig.description || ''}
                                onChange={(e) => updateFieldConfig({ description: e.target.value })}
                                placeholder="Optional field description"
                                rows={2}
                            />
                        </div>
                    </div>

                    {/* Field Properties */}
                    <div className="form-section">
                        <h3>Field Properties</h3>
                        
                        <div className="checkbox-group">
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={fieldConfig.is_primary_key || false}
                                    onChange={(e) => updateFieldConfig({ 
                                        is_primary_key: e.target.checked,
                                        nullable: e.target.checked ? false : fieldConfig.nullable
                                    })}
                                />
                                Primary Key
                            </label>
                            {errors.is_primary_key && <span className="error-text">{errors.is_primary_key}</span>}
                        </div>

                        <div className="checkbox-group">
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={fieldConfig.auto_id || false}
                                    onChange={(e) => updateFieldConfig({ auto_id: e.target.checked })}
                                    disabled={!fieldConfig.is_primary_key}
                                />
                                Auto ID (Primary Key Only)
                            </label>
                        </div>

                        <div className="checkbox-group">
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={fieldConfig.is_partition_key || false}
                                    onChange={(e) => updateFieldConfig({ is_partition_key: e.target.checked })}
                                />
                                Partition Key
                            </label>
                        </div>

                        <div className="checkbox-group">
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={fieldConfig.is_clustering_key || false}
                                    onChange={(e) => updateFieldConfig({ is_clustering_key: e.target.checked })}
                                />
                                Clustering Key
                            </label>
                        </div>

                        <div className="checkbox-group">
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={fieldConfig.nullable || false}
                                    onChange={(e) => updateFieldConfig({ nullable: e.target.checked })}
                                    disabled={fieldConfig.is_primary_key}
                                />
                                Nullable
                            </label>
                            {errors.nullable && <span className="error-text">{errors.nullable}</span>}
                        </div>
                    </div>

                    {/* Vector-specific Configuration */}
                    {isVectorType && (
                        <div className="form-section">
                            <h3>Vector Configuration</h3>
                            
                            <div className="form-group">
                                <label htmlFor="dim">Dimension *</label>
                                <input
                                    id="dim"
                                    type="number"
                                    min="1"
                                    max="32768"
                                    value={fieldConfig.dim || ''}
                                    onChange={(e) => updateFieldConfig({ dim: parseInt(e.target.value) || undefined })}
                                    placeholder="Vector dimension (e.g., 768)"
                                    className={errors.dim ? 'error' : ''}
                                />
                                {errors.dim && <span className="error-text">{errors.dim}</span>}
                            </div>
                        </div>
                    )}

                    {/* VarChar-specific Configuration */}
                    {isVarCharType && (
                        <div className="form-section">
                            <h3>VarChar Configuration</h3>
                            
                            <div className="form-group">
                                <label htmlFor="max_length">Max Length *</label>
                                <input
                                    id="max_length"
                                    type="number"
                                    min="1"
                                    max="65535"
                                    value={fieldConfig.max_length || ''}
                                    onChange={(e) => updateFieldConfig({ max_length: parseInt(e.target.value) || undefined })}
                                    placeholder="Maximum string length"
                                    className={errors.max_length ? 'error' : ''}
                                />
                                {errors.max_length && <span className="error-text">{errors.max_length}</span>}
                            </div>

                            <div className="checkbox-group">
                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={fieldConfig.enable_analyzer || false}
                                        onChange={(e) => updateFieldConfig({ enable_analyzer: e.target.checked })}
                                    />
                                    Enable Text Analysis
                                </label>
                            </div>

                            <div className="checkbox-group">
                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={fieldConfig.enable_match || false}
                                        onChange={(e) => updateFieldConfig({ enable_match: e.target.checked })}
                                    />
                                    Enable Keyword Matching
                                </label>
                            </div>

                            {/* Analyzer Configuration */}
                            {fieldConfig.enable_analyzer && (
                                <div className="analyzer-config">
                                    <h4>Analyzer Configuration</h4>
                                    
                                    <div className="form-group">
                                        <label>Analyzer Type</label>
                                        <div className="radio-group">
                                            <label className="radio-label">
                                                <input
                                                    type="radio"
                                                    name="analyzerType"
                                                    checked={analyzerType === 'built-in'}
                                                    onChange={() => setAnalyzerType('built-in')}
                                                />
                                                Built-in Analyzer
                                            </label>
                                            <label className="radio-label">
                                                <input
                                                    type="radio"
                                                    name="analyzerType"
                                                    checked={analyzerType === 'custom'}
                                                    onChange={() => setAnalyzerType('custom')}
                                                />
                                                Custom Analyzer
                                            </label>
                                        </div>
                                    </div>

                                    {analyzerType === 'built-in' ? (
                                        <div className="form-group">
                                            <label htmlFor="analyzer_type">Built-in Type</label>
                                            <select
                                                id="analyzer_type"
                                                value={fieldConfig.analyzer_params?.type || 'standard'}
                                                onChange={(e) => updateFieldConfig({
                                                    analyzer_params: {
                                                        ...fieldConfig.analyzer_params,
                                                        type: e.target.value as keyof typeof ANALYZER_TYPES
                                                    }
                                                })}
                                            >
                                                {Object.entries(ANALYZER_TYPES).map(([key, value]) => (
                                                    <option key={key} value={key}>{value}</option>
                                                ))}
                                            </select>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="form-group">
                                                <label htmlFor="tokenizer">Tokenizer</label>
                                                <select
                                                    id="tokenizer"
                                                    value={fieldConfig.analyzer_params?.tokenizer || 'standard'}
                                                    onChange={(e) => updateFieldConfig({
                                                        analyzer_params: {
                                                            ...fieldConfig.analyzer_params,
                                                            tokenizer: e.target.value as keyof typeof TOKENIZER_TYPES
                                                        }
                                                    })}
                                                >
                                                    {Object.entries(TOKENIZER_TYPES).map(([key, value]) => (
                                                        <option key={key} value={key}>{value}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="form-group">
                                                <label>Filters</label>
                                                <div className="filter-list">
                                                    {customFilters.map((filter, index) => (
                                                        <div key={index} className="filter-item">
                                                            <span>{filter}</span>
                                                            <button 
                                                                type="button" 
                                                                onClick={() => removeCustomFilter(index)}
                                                                className="remove-filter-btn"
                                                            >
                                                                ×
                                                            </button>
                                                        </div>
                                                    ))}
                                                    <button 
                                                        type="button" 
                                                        onClick={addCustomFilter}
                                                        className="add-filter-btn"
                                                    >
                                                        + Add Filter
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Array-specific Configuration */}
                    {isArrayType && (
                        <div className="form-section">
                            <h3>Array Configuration</h3>
                            
                            <div className="form-group">
                                <label htmlFor="element_type">Element Type *</label>
                                <select
                                    id="element_type"
                                    value={fieldConfig.element_type || ''}
                                    onChange={(e) => updateFieldConfig({ element_type: e.target.value as keyof typeof ELEMENT_TYPES })}
                                    className={errors.element_type ? 'error' : ''}
                                >
                                    <option value="">Select element type</option>
                                    {Object.entries(ELEMENT_TYPES).map(([key, value]) => (
                                        <option key={key} value={key}>{value}</option>
                                    ))}
                                </select>
                                {errors.element_type && <span className="error-text">{errors.element_type}</span>}
                            </div>

                            <div className="form-group">
                                <label htmlFor="max_capacity">Max Capacity *</label>
                                <input
                                    id="max_capacity"
                                    type="number"
                                    min="1"
                                    max="4096"
                                    value={fieldConfig.max_capacity || ''}
                                    onChange={(e) => updateFieldConfig({ max_capacity: parseInt(e.target.value) || undefined })}
                                    placeholder="Maximum array size"
                                    className={errors.max_capacity ? 'error' : ''}
                                />
                                {errors.max_capacity && <span className="error-text">{errors.max_capacity}</span>}
                            </div>
                        </div>
                    )}

                    {/* Default Value */}
                    <div className="form-section">
                        <h3>Default Value</h3>
                        
                        <div className="form-group">
                            <label htmlFor="default_value">Default Value</label>
                            <input
                                id="default_value"
                                type="text"
                                value={fieldConfig.default_value || ''}
                                onChange={(e) => updateFieldConfig({ default_value: e.target.value || undefined })}
                                placeholder="Optional default value"
                                disabled={fieldConfig.is_primary_key && fieldConfig.auto_id}
                            />
                            {fieldConfig.is_primary_key && fieldConfig.auto_id && (
                                <small className="help-text">Default value not applicable for auto-generated primary keys</small>
                            )}
                        </div>
                    </div>

                    {/* Form Actions */}
                    <div className="form-actions">
                        <button type="button" onClick={onCancel} className="btn btn-secondary">
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary">
                            Add Field
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddFieldForm;
