#!/bin/bash

# Vex Extension Test Database Startup Script
# This script starts ChromaDB and Milvus for testing the Vex extension

set -e

echo "🚀 Starting Vex Extension Test Databases..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose is not installed. Please install it first."
    exit 1
fi

# Function to cleanup on exit
cleanup() {
    echo "🧹 Cleaning up..."
    docker-compose down
    echo "✅ Cleanup complete"
}

# Set trap to cleanup on script exit
trap cleanup EXIT

# Start the services
echo "📦 Starting ChromaDB and Milvus..."
docker-compose up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be ready..."

# Wait for ChromaDB
echo "🔍 Waiting for ChromaDB..."
until docker-compose exec -T chromadb curl -f http://localhost:8000/api/v1/heartbeat > /dev/null 2>&1; do
    echo "   ChromaDB not ready yet, waiting..."
    sleep 5
done
echo "✅ ChromaDB is ready!"

# Wait for Milvus
echo "🔍 Waiting for Milvus..."
until docker-compose exec -T milvus-standalone curl -f http://localhost:9091/healthz > /dev/null 2>&1; do
    echo "   Milvus not ready yet, waiting..."
    sleep 5
done
echo "✅ Milvus is ready!"

echo ""
echo "🎉 All test databases are running!"
echo ""
echo "📊 Service Status:"
echo "   ChromaDB: http://localhost:8000"
echo "   Milvus:   localhost:19530"
echo "   Milvus UI: http://localhost:3000"
echo ""
echo "🔧 To stop the services, run: docker-compose down"
echo "📝 To view logs, run: docker-compose logs -f"
echo ""
echo "Press Ctrl+C to stop all services..."

# Keep the script running
docker-compose logs -f
