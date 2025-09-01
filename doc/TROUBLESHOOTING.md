# Troubleshooting Guide

## Milvus Connection Issues

### Error: "Failed to connect to milvus database: Connection dropped"

This error typically occurs when the Milvus server is not running or there are network connectivity issues.

#### Quick Fixes

1. **Check if Milvus is running:**

   ```bash
   docker ps | grep milvus
   ```

2. **Start Milvus using Docker:**

   ```bash
   cd docker
   docker-compose up -d
   ```

3. **Wait for services to be healthy:**

   ```bash
   docker-compose ps
   ```

   All services should show "healthy" status.

4. **Check Milvus logs:**

   ```bash
   docker logs vex-milvus
   ```

#### Configuration Settings

- **Host:** `127.0.0.1` or `localhost`
- **Port:** `19530`
- **Username/Password:** Leave empty for default setup

#### Advanced Troubleshooting

1. **Test port connectivity:**

   ```bash
   netstat -an | grep 19530
   ```

2. **Restart all services:**

   ```bash
   cd docker
   docker-compose down
   docker-compose up -d
   ```

3. **Check Docker network:**

   ```bash
   docker network ls
   docker network inspect docker_vex-network
   ```

## Welcome Page

The welcome page should automatically appear when:

- No database connections are configured
- The extension is first loaded

If the welcome page doesn't appear, try:

1. Reloading the VS Code window (`Cmd+R` or `Ctrl+R`)
2. Opening the Vector Database view from the activity bar
3. Using the command palette: `Vector Database: Add Database Connection`

## Compatibility

- Milvus version: 2.4.x (recommended)
- SDK version: @zilliz/milvus2-sdk-node 2.6.0
- Node.js: 16+ required
