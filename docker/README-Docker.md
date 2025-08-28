# Docker Setup for Vex Extension Testing

This directory contains Docker configurations to run ChromaDB and Milvus databases locally for testing the Vex VS Code extension.

## 🚀 Quick Start

### Prerequisites
- Docker installed and running
- Docker Compose installed
- Python 3.7+ (for testing connections)

### Start All Services
```bash
# Make the startup script executable
chmod +x start-test-dbs.sh

# Start all services
./start-test-dbs.sh
```

Or manually:
```bash
docker-compose up -d
```

### Stop All Services
```bash
docker-compose down
```

## 📊 Services

### ChromaDB
- **Port**: 8000
- **URL**: http://localhost:8000
- **API**: REST API available at `/api/v1/*`
- **Health Check**: `/api/v1/heartbeat`

### Milvus
- **Port**: 19530 (gRPC), 9091 (HTTP)
- **URL**: localhost:19530
- **Health Check**: http://localhost:9091/healthz

### Milvus Attu (Web UI)
- **Port**: 3000
- **URL**: http://localhost:3000
- **Purpose**: Web-based Milvus management interface

## 🔧 Configuration

### ChromaDB Configuration
- File: `chromadb-config.yaml`
- Features:
  - CORS enabled for all origins
  - SQLite backend for persistence
  - Authentication disabled for testing
  - Optimized batch sizes

### Milvus Configuration
- File: `milvus-config.yaml`
- Features:
  - Standalone mode
  - SQLite backend
  - Optimized cache settings
  - Performance tuning for testing

## 🧪 Testing Connections

### Python Test Script
```bash
# Install requests if not available
pip install requests

# Run the test script
python test-connection.py
```

### Manual Testing
```bash
# Test ChromaDB
curl http://localhost:8000/api/v1/heartbeat

# Test Milvus
curl http://localhost:9091/healthz

# Test Milvus Attu
curl http://localhost:3000
```

## 📁 File Structure

```
.
├── docker-compose.yml          # Main orchestration file
├── Dockerfile.chromadb         # Custom ChromaDB image
├── Dockerfile.milvus          # Custom Milvus image
├── chromadb-config.yaml       # ChromaDB configuration
├── milvus-config.yaml         # Milvus configuration
├── start-test-dbs.sh          # Startup script
├── test-connection.py         # Connection test script
└── README-Docker.md           # This file
```

## 🐛 Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   # Check what's using the ports
   lsof -i :8000
   lsof -i :19530
   lsof -i :3000
   
   # Stop conflicting services or change ports in docker-compose.yml
   ```

2. **Services Not Starting**
   ```bash
   # Check logs
   docker-compose logs
   
   # Check specific service logs
   docker-compose logs chromadb
   docker-compose logs milvus-standalone
   ```

3. **Permission Issues**
   ```bash
   # Make script executable
   chmod +x start-test-dbs.sh
   ```

### Reset Everything
```bash
# Stop and remove all containers, networks, and volumes
docker-compose down -v

# Remove all images
docker-compose down --rmi all

# Start fresh
docker-compose up -d
```

## 🔒 Security Notes

⚠️ **Warning**: This setup is for testing only and should NOT be used in production:

- Authentication is disabled
- CORS allows all origins
- No SSL/TLS encryption
- Data is stored in local Docker volumes

## 📚 Additional Resources

- [ChromaDB Documentation](https://docs.trychroma.com/)
- [Milvus Documentation](https://milvus.io/docs)
- [Docker Compose Documentation](https://docs.docker.com/compose/)

## 🤝 Contributing

If you encounter issues or have suggestions for improving this Docker setup, please:

1. Check the troubleshooting section above
2. Review the logs: `docker-compose logs`
3. Test individual services: `python test-connection.py`
4. Open an issue with detailed error information
