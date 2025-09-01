# Connection Operations in Tree View

## Overview

The tree view now includes comprehensive connect and disconnect operations that can be accessed through right-click context menus on server connection items.

## Available Operations

### Server Connection Context Menu

When you right-click on a server connection item in the tree view, you'll see the following options:

#### Connection Management

- **🟢 Connect:** Establishes connection to the server
  - Available when: Connection is disconnected
  - Action: Attempts to connect using stored credentials
  - Result: Updates connection status and refreshes tree view

- **🔴 Disconnect:** Terminates the server connection
  - Available when: Connection is active
  - Action: Closes the connection and clears active sessions
  - Result: Updates connection status and hides databases/collections

- **🔄 Refresh Connection Status:** Checks current connection state
  - Available when: Connection exists (connected or disconnected)
  - Action: Verifies if connection is still active
  - Result: Updates status if changed and shows current state

#### Connection Configuration

- **✏️ Edit Connection:** Modify connection parameters
  - Available when: Connection exists
  - Action: Opens dialog to edit host, port, username, password
  - Result: Updates connection details

- **🗑️ Delete Server:** Remove server connection from tree view
  - Available when: Connection exists
  - Action: Disconnects if connected, then removes connection
  - Result: Server connection disappears from tree view
  - Note: Does not affect actual server or data

#### Database Operations

- **📁 Create Database:** Add new database to server
  - Available when: Connection is active
  - Action: Prompts for database name
  - Result: Creates new database on server

## Visual Indicators

### Connection Status

- **🟢 Connected:** Server is actively connected and ready
- **🔴 Disconnected:** Server connection is not active

### Icons

- **🔌 Plug Icon (Red):** Disconnected state
- **🖥️ Server Icon (Blue/Purple):** Connected state
  - Blue: Milvus servers
  - Purple: ChromaDB servers

### Tooltips

Hover over server items to see:

- Server type and address
- Current connection status
- Available right-click actions

## Usage Examples

### Connecting to a Server

1. Right-click on a disconnected server connection
2. Select "Connect"
3. Wait for connection to establish
4. Server status changes to "🟢 Connected"
5. Expand server to see databases

### Disconnecting from a Server

1. Right-click on a connected server connection
2. Select "Disconnect"
3. Wait for disconnection to complete
4. Server status changes to "🔴 Disconnected"
5. Databases and collections are hidden

### Checking Connection Status

1. Right-click on any server connection
2. Select "Refresh Connection Status"
3. Extension checks if connection is still active
4. Status is updated if changed
5. Current status is displayed in notification

### Deleting a Server Connection

1. Right-click on any server connection
2. Select "Delete Server"
3. Confirm deletion in warning dialog
4. Extension disconnects if connected
5. Server connection is removed from tree view
6. Note: Server data remains intact on the actual server

## Error Handling

### Connection Failures

- **Network Issues:** Shows specific error messages
- **Authentication Failures:** Prompts for correct credentials
- **Server Unavailable:** Provides troubleshooting guidance

### Disconnection Issues

- **Graceful Shutdown:** Attempts clean disconnection
- **Force Cleanup:** Clears local connection state
- **Error Recovery:** Continues operation even if disconnect fails

## Context-Aware Menus

The context menu adapts based on connection state:

### Disconnected State

- Connect
- Edit Connection
- Delete Server

### Connected State

- Disconnect
- Edit Connection
- Delete Server
- Create Database
- Refresh Connection Status

## Implementation Details

### Commands Added

- `vex.connectToDatabase`: Establishes server connection
- `vex.disconnectFromDatabase`: Terminates server connection
- `vex.refreshConnectionStatus`: Checks connection state

### Menu Integration

- **Group:** `connection@1`, `connection@2`, `connection@3`
- **Context:** `viewItem == serverConnection`
- **Visibility:** Based on connection state

### Status Updates

- Real-time connection status monitoring
- Automatic tree view refresh
- User-friendly status messages

## Best Practices

### Connection Management

1. **Connect when needed:** Only connect to servers you're actively working with
2. **Disconnect when done:** Close connections to free up resources
3. **Monitor status:** Use refresh to check connection health

### Error Recovery

1. **Check credentials:** Verify username/password are correct
2. **Verify server:** Ensure server is running and accessible
3. **Network issues:** Check firewall and network connectivity

### Performance

1. **Limit connections:** Don't keep unnecessary connections open
2. **Regular cleanup:** Disconnect from unused servers
3. **Status monitoring:** Use refresh sparingly to avoid overhead

This comprehensive connection management system provides users with full control over their vector database connections while maintaining clear visual feedback about connection status.
