#!/usr/bin/env node
const axios = require('axios');

const SERVER = 'http://62.171.153.204:8090';

async function reload() {
  console.log('\n🔄 إعادة تحميل الكتالوج...\n');
  
  try {
    const res = await axios.post(`${SERVER}/api/lulu/reload`, {}, { timeout: 10000 });
    console.log('✅ النتيجة:', JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error('❌ خطأ:', err.message);
    if (err.response) {
      console.error('الاستجابة:', err.response.data);
    }
  }
}

reload();
