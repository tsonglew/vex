# Milvus API Integration

## Overview

The extension now properly integrates with the Milvus API for all database operations, ensuring that database management is handled directly by the Milvus server rather than through local operations.

## Database Operations

### 1. List Databases (`listDatabases`)

**API Call:** `client.listDatabases()`

**Purpose:** Retrieves all databases available on the Milvus server

**Implementation:**

```typescript
const response = await this.client.listDatabases();
```

**Response Handling:**

- Supports multiple response formats from different Milvus versions
- Handles direct array responses, `data` property, `names` property, and `databases` property
- Falls back to default database if no databases found
- Provides detailed logging of API responses

**Error Handling:**

- Method not supported: Falls back to default database
- Permission denied: Clear error message about credentials
- Timeout: Indicates server overload
- Other errors: Detailed error information

### 2. Create Database (`createDatabase`)

**API Call:** `client.createDatabase({ db_name: name })`

**Purpose:** Creates a new database on the Milvus server

**Implementation:**

```typescript
await this.client.createDatabase({ db_name: name });
```

**Error Handling:**

- Database already exists: Clear duplicate error message
- Permission denied: Credential/permission guidance
- Invalid name: Naming convention requirements
- Other errors: Detailed API error information

### 3. Delete Database (`deleteDatabase`)

**API Call:** `client.dropDatabase({ db_name: name })`

**Purpose:** Removes a database and all its contents from the Milvus server

**Implementation:**

```typescript
await this.client.dropDatabase({ db_name: name });
```

**Error Handling:**

- Database not found: Clear existence error message
- Permission denied: Credential/permission guidance
- Database in use: Indicates active usage
- Other errors: Detailed API error information

### 4. Use Database (`useDatabase`)

**API Call:** `client.useDatabase({ db_name: name })`

**Purpose:** Sets the current database context for subsequent operations

**Implementation:**

```typescript
await this.client.useDatabase({ db_name: name });
```

**Error Handling:**

- Method not supported: Graceful fallback (continues operation)
- Database not found: Clear existence error message
- Permission denied: Credential/permission guidance
- Other errors: Detailed API error information

## API Response Handling

### Flexible Response Parsing

The implementation handles various response formats from different Milvus versions:

```typescript
// Direct array response
if (Array.isArray(responseAny)) {
    databases = responseAny.map(db => ({
        name: db.name || db.toString(),
        id: db.id || db.name || db.toString()
    }));
}

// Response with data property
else if (responseAny.data && Array.isArray(responseAny.data)) {
    databases = responseAny.data.map(db => ({
        name: db.name || db.toString(),
        id: db.id || db.name || db.toString()
    }));
}

// Response with names property
else if (responseAny.names && Array.isArray(responseAny.names)) {
    databases = responseAny.names.map(name => ({
        name: name,
        id: name
    }));
}

// Response with databases property
else if (responseAny.databases && Array.isArray(responseAny.databases)) {
    databases = responseAny.databases.map(db => ({
        name: db.name || db.toString(),
        id: db.id || db.name || db.toString()
    }));
}
```

### Fallback Strategy

If no databases are found through the API:

1. **Check Collections:** Attempt to list collections to determine if in default database
2. **Default Database:** If collections exist, assume default database setup
3. **Graceful Degradation:** Continue operation with default database context

## Logging and Debugging

### Comprehensive Logging

All database operations include detailed logging:

```typescript
console.log('Listing databases using Milvus API...');
console.log('Milvus listDatabases response:', response);
console.log('Successfully listed ${databases.length} databases from Milvus API');
```

### Error Context

Errors include operation context and arguments:

```typescript
throw new Error(`Failed to create database via Milvus API with args ${JSON.stringify(args)}: ${error.message}`);
```

## Compatibility

### Milvus Version Support

- **v2.4+:** Full database support with `listDatabases`, `createDatabase`, `deleteDatabase`, `useDatabase`
- **v2.3.x:** Limited database support, falls back to default database
- **Older versions:** Graceful degradation with single database assumption

### Response Format Adaptation

- Automatically detects response format
- Handles different property names (`data`, `names`, `databases`)
- Supports both object and array responses

## Error Recovery

### Graceful Degradation

- **Unsupported methods:** Continue with fallback behavior
- **API errors:** Provide clear error messages and guidance
- **Network issues:** Retry logic and timeout handling

### User Guidance

- **Permission issues:** Clear guidance on credential requirements
- **Validation errors:** Specific feedback on naming conventions
- **Server issues:** Troubleshooting suggestions

## Performance Considerations

### API Efficiency

- **Single API calls:** Each operation uses one API call
- **Minimal overhead:** No unnecessary local processing
- **Response caching:** Avoids redundant API calls

### Error Handling

- **Fast failure:** Quick detection of unsupported operations
- **Fallback logic:** Minimal delay when switching to alternatives
- **Resource cleanup:** Proper cleanup on errors

## Best Practices

### Database Management

1. **Use descriptive names:** Choose meaningful database names
2. **Check permissions:** Ensure proper access rights
3. **Monitor usage:** Regular status checks

### Error Handling

1. **Read error messages:** Clear guidance provided
2. **Check credentials:** Verify username/password
3. **Server status:** Ensure Milvus is running

### Development

1. **API-first approach:** Always use Milvus API methods
2. **Response validation:** Handle different response formats
3. **Graceful fallbacks:** Provide alternatives when possible

This implementation ensures that all database operations are properly delegated to the Milvus server, providing a robust and reliable database management experience while maintaining compatibility across different Milvus versions.
