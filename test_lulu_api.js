// Test Lulu API endpoints
const https = require('https');
const http = require('http');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

function apiGet(path) {
  return new Promise((resolve, reject) => {
    const url = BACKEND_URL + path;
    const mod = url.startsWith('https') ? https : http;
    
    console.log(`\n🔍 Testing: ${url}`);
    
    mod.get(url, { timeout: 10000 }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          console.log(`✅ Status: ${res.statusCode}`);
          console.log(`📦 Response:`, JSON.stringify(data, null, 2).substring(0, 500));
          resolve({ status: res.statusCode, data });
        } catch {
          console.log(`❌ Invalid JSON response`);
          console.log(`📄 Body:`, body.substring(0, 200));
          resolve({ status: res.statusCode, data: null });
        }
      });
    }).on('error', (err) => {
      console.log(`❌ Error: ${err.message}`);
      reject(err);
    }).on('timeout', function() {
      this.destroy();
      console.log(`❌ Timeout`);
      reject(new Error('timeout'));
    });
  });
}

async function test() {
  try {
    console.log('='.repeat(60));
    console.log('Testing Lulu API Endpoints');
    console.log('='.repeat(60));

    // Test 1: /api/lulu/home
    await apiGet('/api/lulu/home');

    // Test 2: /api/lulu/stats
    await apiGet('/api/lulu/stats');

    // Test 3: /api/lulu/genres
    await apiGet('/api/lulu/genres');

    console.log('\n' + '='.repeat(60));
    console.log('✅ All tests completed');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
  }
}

test();
