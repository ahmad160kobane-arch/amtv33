'use strict';
const axios = require('axios');

async function main() {
  const key = '45158b8crmhf2lib2';

  // Test 1: GET
  try {
    const r = await axios.get('https://lulustream.com/api/account/info', { params: { key } });
    console.log('GET result:', JSON.stringify(r.data, null, 2));
  } catch (e) {
    console.log('GET error:', e.response ? JSON.stringify(e.response.data) : e.message);
  }

  // Test 2: POST with form-urlencoded
  try {
    const params = new URLSearchParams({ key });
    const r = await axios.post('https://lulustream.com/api/account/info', params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    console.log('POST result:', JSON.stringify(r.data, null, 2));
  } catch (e) {
    console.log('POST error:', e.response ? JSON.stringify(e.response.data) : e.message);
  }

  // Test 3: Upload server endpoint
  try {
    const r = await axios.get('https://lulustream.com/api/upload/server', { params: { key } });
    console.log('Upload server:', JSON.stringify(r.data, null, 2));
  } catch (e) {
    console.log('Upload server error:', e.response ? JSON.stringify(e.response.data) : e.message);
  }
}

main();
