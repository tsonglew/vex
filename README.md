# Vex - Vector Database Manager

A comprehensive VS Code extension for managing vector databases like Milvus and ChromaDB. Create, manage, and query vector collections with an intuitive interface.

## Features

- 🚀 **Easy Connection**: Connect to Milvus and ChromaDB databases with simple configuration
- 📊 **Collection Management**: Create, list, and delete vector collections
- 🔍 **Vector Operations**: Insert, search, and manage vectors with ease
- 🎨 **Modern UI**: Clean, intuitive interface that integrates seamlessly with VS Code
- ⚡ **Fast Performance**: Optimized for quick database operations

## Installation

1. Download the `.vsix` file from the releases
2. In VS Code, go to Extensions (Ctrl+Shift+X)
3. Click the "..." menu and select "Install from VSIX..."
4. Choose the downloaded `.vsix` file
5. Restart VS Code

## Usage

### Automatic Activation

The VectorDB Manager panel will automatically open when VS Code starts.

### Manual Activation

- Use the command palette: `Ctrl+Shift+P` → "Open VectorDB Manager"
- Click the Vector Database icon in the activity bar
- Use the command: `vex.openVectorDBManager`

### Connecting to Databases

1. **Milvus Database**:
   - Host: `localhost` (or your Milvus server)
   - Port: `19530` (default Milvus port)
   - Username/Password: If authentication is enabled

2. **ChromaDB Database**:
   - Host: `localhost` (or your ChromaDB server)
   - Port: `8000` (default ChromaDB port)

### Managing Collections

- **Create Collections**: Define name, dimension, and similarity metric
- **List Collections**: View all available collections
- **Delete Collections**: Remove unwanted collections

### Vector Operations

- **Insert Vectors**: Add new vectors with optional IDs and metadata
- **Search Vectors**: Find similar vectors using query vectors
- **List Vectors**: Browse vectors in collections
- **Delete Vectors**: Remove specific vectors by ID

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
