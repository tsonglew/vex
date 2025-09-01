# Tree View Hierarchy

## Overview

The tree view now correctly implements the proper Milvus hierarchy: **Server → Database → Collection → Vector**. This matches the actual Milvus architecture where users connect to a server, then navigate through databases, collections, and vectors.

## Correct Hierarchy Structure

### 1. Server Level (Root)

- **Icon:** Server icon with blue color
- **Purpose:** Represents a Milvus/ChromaDB server connection
- **Display:** Connection name and server address
- **Example:** `My Milvus Server localhost:19530 🟢`
- **State:** Collapsed by default, expandable to show databases
- **Context:** Right-click to create new databases

### 2. Database Level

- **Icon:** Database icon with blue color
- **Purpose:** Databases within the Milvus server
- **Display:** Database name and ID
- **Example:** `my_database default`
- **State:** Collapsed by default, expandable to show collections
- **Context:** Right-click to create new collections or delete database

### 3. Collection Level

- **Icon:** Array icon with orange color
- **Purpose:** Vector collections within a database
- **Display:** Collection name and metadata
- **Example:** `my_collection 768D (1000 vectors)`
- **State:** Collapsed by default, expandable to show vectors
- **Context:** Right-click to view, insert, search, or delete collections

### 4. Vector Level

- **Icon:** Number icon with green color
- **Purpose:** Individual vector entries within a collection
- **Display:** Vector ID and dimension
- **Example:** `Vector 123 768D`
- **State:** Leaf node (no expansion)
- **Context:** Right-click to view vector details

## User Workflow

### 1. Connect to Server

1. User inputs Milvus server address, username, password
2. Extension connects to the server
3. Server appears in tree view with connection status

### 2. Navigate Databases

1. Expand server connection to see databases
2. Create new database if needed
3. Select database to work with

### 3. Manage Collections

1. Expand database to see collections
2. Create new collection with specified dimension and metric
3. Select collection for vector operations

### 4. Work with Vectors

1. Expand collection to see vectors
2. Insert new vectors
3. Search vectors
4. View vector details

## Context Menus

### Server Connection

- **Connect/Disconnect:** Manage connection state
- **Edit Connection:** Modify connection parameters
- **Delete Connection:** Remove connection
- **Create Database:** Add new database to server

### Database

- **Create Collection:** Add new collection to database
- **Delete Database:** Remove database and all its contents

### Collection

- **View Collection Details:** Show metadata
- **List Vectors:** View all vectors in collection
- **Insert Vectors:** Add new vectors
- **Search Vectors:** Query vectors
- **Delete Collection:** Remove collection

### Individual Vector

- **View Vector Details:** Show vector metadata and data

## Implementation Details

- **Database Operations:** Added `listDatabases()`, `createDatabase()`, `deleteDatabase()`, `useDatabase()` methods
- **Proper Context Switching:** Database context is set before listing collections
- **Error Handling:** Graceful fallbacks for unsupported operations
- **Performance:** Vectors loaded on-demand with 100 vector limit
- **Compatibility:** Works with both Milvus and ChromaDB (ChromaDB treats collections as databases)

## Benefits of Correct Hierarchy

1. **Accurate Architecture:** Matches actual Milvus server structure
2. **Logical Workflow:** Natural progression from server to vectors
3. **Proper Isolation:** Collections are properly scoped to databases
4. **Better Organization:** Clear separation of concerns
5. **Standard Operations:** Follows Milvus best practices

## Usage Examples

### Adding a New Database

1. Right-click on server connection
2. Select "Create Database"
3. Enter database name
4. Database appears in tree view

### Creating a Collection

1. Right-click on database
2. Select "Create Collection"
3. Enter collection name, dimension, and metric
4. Collection appears under database

### Working with Vectors

1. Expand collection to see vectors
2. Right-click collection for operations
3. Insert, search, or view vectors as needed

## Technical Notes

- **Milvus v2.4+:** Supports multiple databases per server
- **ChromaDB:** Treats collections as databases for compatibility
- **Context Management:** Database context is maintained per operation
- **Error Recovery:** Graceful handling of unsupported operations
- **Performance:** Lazy loading prevents UI blocking

This hierarchy now correctly represents the Milvus architecture and provides a much more intuitive and accurate way to manage vector databases.
