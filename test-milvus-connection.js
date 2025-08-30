#!/usr/bin/env node

const { MilvusClient } = require('@zilliz/milvus2-sdk-node');

async function testMilvusConnection () {
    console.log('=== Milvus Connection Test ===\n');

    const configs = [
        // Standard configuration
        {
            name: 'Standard Config',
            config: {
                address: 'localhost:19530',
                timeout: 30000
            }
        },
        // Enhanced gRPC configuration
        {
            name: 'Enhanced gRPC Config',
            config: {
                address: 'localhost:19530',
                timeout: 30000,
                channelOptions: {
                    'grpc.keepalive_time_ms': 30000,
                    'grpc.keepalive_timeout_ms': 5000,
                    'grpc.keepalive_permit_without_calls': true,
                    'grpc.http2.max_pings_without_data': 0,
                    'grpc.http2.min_time_between_pings_ms': 10000,
                    'grpc.http2.min_ping_interval_without_data_ms': 300000,
                    'grpc.max_connection_idle_ms': 30000,
                    'grpc.max_connection_age_ms': 30000,
                    'grpc.max_connection_age_grace_ms': 5000,
                    'grpc.http2.max_ping_strikes': 2
                }
            }
        },
        // Simple configuration
        {
            name: 'Simple Config',
            config: {
                address: 'localhost:19530'
            }
        }
    ];

    for (const { name, config } of configs) {
        console.log(`\n--- Testing ${name} ---`);
        try {
            const client = new MilvusClient(config);
            console.log('✓ Client created');

            const collections = await client.listCollections();
            console.log(`✓ Connection successful! Found ${collections.data?.length || 0} collections`);

            if (collections.data && collections.data.length > 0) {
                console.log('Collections:', collections.data.map(c => c.name || c));
            }

            return true; // Success, exit the loop
        } catch (error) {
            console.log(`✗ Failed: ${error.message}`);

            if (error.code === 14) {
                console.log('  → gRPC UNAVAILABLE error detected');
            }
        }
    }

    console.log('\n=== Troubleshooting Guide ===');
    console.log('1. Check if Milvus is running:');
    console.log('   docker ps | grep milvus');
    console.log('');
    console.log('2. Check if port is accessible:');
    console.log('   lsof -i :19530');
    console.log('');
    console.log('3. Try restarting Milvus:');
    console.log('   docker restart milvus-standalone');
    console.log('');
    console.log('4. Check Milvus logs:');
    console.log('   docker logs milvus-standalone');
    console.log('');
    console.log('5. If using Docker Desktop, try using 127.0.0.1 instead of localhost');

    return false;
}

// Run the test
testMilvusConnection().then(success => {
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('Test failed with error:', error);
    process.exit(1);
});
