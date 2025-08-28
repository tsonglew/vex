#!/usr/bin/env python3
"""
Test Connection Script for Vex Extension
Tests connections to ChromaDB and Milvus databases
"""

import requests
import time
import sys
from typing import Dict, Any

def test_chromadb_connection() -> Dict[str, Any]:
    """Test connection to ChromaDB"""
    try:
        # Test basic connectivity
        response = requests.get("http://localhost:8000/api/v1/heartbeat", timeout=5)
        if response.status_code == 200:
            return {"status": "success", "message": "ChromaDB is running and accessible"}
        else:
            return {"status": "error", "message": f"ChromaDB returned status {response.status_code}"}
    except requests.exceptions.RequestException as e:
        return {"status": "error", "message": f"Failed to connect to ChromaDB: {str(e)}"}

def test_milvus_connection() -> Dict[str, Any]:
    """Test connection to Milvus"""
    try:
        # Test health endpoint
        response = requests.get("http://localhost:9091/healthz", timeout=5)
        if response.status_code == 200:
            return {"status": "success", "message": "Milvus is running and accessible"}
        else:
            return {"status": "error", "message": f"Milvus returned status {response.status_code}"}
    except requests.exceptions.RequestException as e:
        return {"status": "error", "message": f"Failed to connect to Milvus: {str(e)}"}

def test_milvus_attu() -> Dict[str, Any]:
    """Test Milvus Attu UI"""
    try:
        response = requests.get("http://localhost:3000", timeout=5)
        if response.status_code == 200:
            return {"status": "success", "message": "Milvus Attu UI is accessible"}
        else:
            return {"status": "error", "message": f"Milvus Attu UI returned status {response.status_code}"}
    except requests.exceptions.RequestException as e:
        return {"status": "error", "message": f"Failed to connect to Milvus Attu UI: {str(e)}"}

def main():
    """Main test function"""
    print("🔍 Testing Vex Extension Database Connections...")
    print("=" * 50)
    
    # Test ChromaDB
    print("\n📊 Testing ChromaDB...")
    chromadb_result = test_chromadb_connection()
    if chromadb_result["status"] == "success":
        print(f"✅ {chromadb_result['message']}")
    else:
        print(f"❌ {chromadb_result['message']}")
    
    # Test Milvus
    print("\n📊 Testing Milvus...")
    milvus_result = test_milvus_connection()
    if milvus_result["status"] == "success":
        print(f"✅ {milvus_result['message']}")
    else:
        print(f"❌ {milvus_result['message']}")
    
    # Test Milvus Attu UI
    print("\n📊 Testing Milvus Attu UI...")
    attu_result = test_milvus_attu()
    if attu_result["status"] == "success":
        print(f"✅ {attu_result['message']}")
    else:
        print(f"❌ {attu_result['message']}")
    
    print("\n" + "=" * 50)
    
    # Summary
    all_success = all([
        chromadb_result["status"] == "success",
        milvus_result["status"] == "success",
        attu_result["status"] == "success"
    ])
    
    if all_success:
        print("🎉 All database connections successful!")
        print("\n📋 Connection Details:")
        print("   ChromaDB: http://localhost:8000")
        print("   Milvus:   localhost:19530")
        print("   Milvus UI: http://localhost:3000")
        print("\n🚀 You can now test your Vex extension!")
    else:
        print("⚠️  Some connections failed. Please check your Docker setup.")
        sys.exit(1)

if __name__ == "__main__":
    main()
