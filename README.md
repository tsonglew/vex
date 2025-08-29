# Vex - Vector Database Manager

A comprehensive VS Code extension for managing vector databases like Milvus and ChromaDB. Create, manage, and query vector collections with an intuitive interface.

## Features

- 🚀 **Easy Connection**: Connect to Milvus and ChromaDB databases with simple configuration
- 📊 **Collection Management**: Create, view, delete and manage vector collections from tree view
- 🔍 **Vector Operations**: Insert, search, and list vectors with rich data visualization and export capabilities
- 🔗 **Database Operations**: Connect, disconnect, and manage database connections
- 🎨 **Tree View Interface**: Clean, intuitive tree view that integrates seamlessly with VS Code
- 📋 **Rich Data Viewer**: Modern webview panels for displaying vectors, search results, and statistics
- ⚡ **Fast Performance**: Optimized for quick database operations with efficient data rendering

## Installation

1. Download the `.vsix` file from the releases
2. In VS Code, go to Extensions (Ctrl+Shift+X)
3. Click the "..." menu and select "Install from VSIX..."
4. Choose the downloaded `.vsix` file
5. Restart VS Code

## Usage

### Getting Started

The extension provides a tree view in the activity bar for managing your real vector database connections.

### Accessing the Tree View

- Click the Vector Database icon in the activity bar
- Add your real database connections using the "+" button
- Connect to your databases to see actual collections and data

### Connecting to Databases

1. **Milvus Database**:
   - Host: `localhost` (or your Milvus server)
   - Port: `19530` (default Milvus port)
   - Username/Password: If authentication is enabled

2. **ChromaDB Database**:
   - Host: `localhost` (or your ChromaDB server)
   - Port: `8000` (default ChromaDB port)

### Managing Database Connections

- **Add Connections**: Add new Milvus or ChromaDB database connections
- **Connect/Disconnect**: Manage connection status for your databases
- **Edit Connections**: Modify connection settings
- **Delete Connections**: Remove database connections

### Working with Collections

- **View Collections**: Browse collections in the tree view for connected databases
- **Create Collections**: Add new collections by right-clicking on database connections
- **View Collection Details**: Right-click on collections to see detailed information
- **Delete Collections**: Remove collections (when connected to database)
- **Collection Management**: Access all features through right-click context menus

### Vector Operations

- **List Vectors**: View vectors in a beautifully designed data table with full vector data, metadata, and statistics
- **Insert Vectors**: Add new vectors to collections with optional IDs and metadata through intuitive dialogs
- **Search Vectors**: Perform similarity searches with results displayed in a comprehensive results viewer
- **Vector Management**: All operations accessible via collection context menus with rich visual feedback

### Data Viewer Features

- **Rich Data Display**: Modern, responsive data tables with VS Code theme integration
- **Vector Visualization**: Expandable vector data display with hover interactions
- **Search Results**: Ranked similarity results with score visualization and metadata
- **Export Functionality**: Copy data to clipboard for external analysis
- **Performance Optimized**: Efficient rendering of large datasets with pagination
- **Statistics Dashboard**: Real-time stats showing collection info, dimensions, and counts

## Supported Databases

- **Milvus**: Open-source vector database for production
- **ChromaDB**: Embedding database for AI applications

## Requirements

- VS Code 1.99.0 or higher
- Node.js 18+ (for development)

## Development

```bash
# Clone the repository
git clone https://github.com/tsonglew/vex.git
cd vex

# Install dependencies
npm install

# Build the extension
npm run package

# Run tests
npm test
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

If you encounter any issues or have questions, please open an issue on GitHub.

---

**Made with ❤️ for the VS Code community**
