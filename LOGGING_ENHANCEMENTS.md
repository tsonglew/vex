# Logging Enhancements

## Overview

Enhanced logging has been added to all vector database operations to improve debugging and error tracking. All operations now log their arguments and provide detailed error messages with context.

## Enhanced Operations

### Collection Management

#### Create Collection

- **Logs:** Collection name, dimension, metric type
- **Error Message:** Includes all arguments for debugging
- **Example:** `Failed to create collection with args {"name":"test","dimension":768,"metric":"cosine"}: Connection error`

#### Delete Collection

- **Logs:** Collection name
- **Error Message:** Includes collection name in error context
- **Example:** `Failed to delete collection with args {"name":"test"}: Collection not found`

### Vector Operations

#### Insert Vectors

- **Logs:** Collection name, vector count, vector dimension, presence of IDs/metadata
- **Error Message:** Includes operation context and vector details
- **Example:** `Failed to insert vectors with args {"collection":"test","vectorCount":100,"vectorDimension":768,"hasIds":true,"hasMetadata":false}: Invalid dimension`

#### Search Vectors

- **Logs:** Collection name, vector dimension, topK value
- **Error Message:** Includes search parameters for debugging
- **Example:** `Failed to search vectors with args {"collection":"test","vectorDimension":768,"topK":10}: Collection not loaded`

#### List Vectors

- **Logs:** Collection name, limit value
- **Error Message:** Includes collection and limit information
- **Example:** `Failed to list vectors with args {"collection":"test","limit":100}: Permission denied`

#### Delete Vectors

- **Logs:** Collection name, ID count, first 5 IDs (for privacy)
- **Error Message:** Includes deletion context and ID information
- **Example:** `Failed to delete vectors with args {"collection":"test","idCount":50,"ids":["1","2","3","4","5"]}: Invalid filter`

### Utility Operations

#### List Collections

- **Logs:** Operation start and completion
- **Error Message:** Standard error format
- **Example:** `Failed to list collections: Connection timeout`

## Benefits

1. **Debugging:** Easy to identify which arguments caused an operation to fail
2. **Audit Trail:** Complete record of all operations with their parameters
3. **Error Context:** Error messages now include the exact parameters used
4. **Performance Monitoring:** Track operation success rates and timing
5. **User Experience:** Better error messages help users understand what went wrong

## Console Output

All logs are written to the VS Code Developer Console and can be viewed by:

1. Opening Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. Running "Developer: Toggle Developer Tools"
3. Going to Console tab

## Error Message Format

```
Failed to [operation] with args [JSON_STRINGIFIED_ARGS]: [original_error_message]
```

This format ensures that:

- The operation type is clear
- All arguments are visible for debugging
- The original error is preserved
- Error messages are consistent across all operations
