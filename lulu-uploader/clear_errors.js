'use strict';
// يمسح جميع الرفع الفاشل من طابور LuluStream
const lulu = require('./src/lulu-api');
const axios = require('axios');
const KEY = '258176jfw9e96irnxai2fm';

async function main() {
  console.log('جلب حالة الطابور...');
  const q = await lulu.checkUrlUploads();
  const list = q.result || [];
  const errors = list.filter(f => f.status === 'ERROR' || f.status === 'FAILED');
  console.log(`إجمالي: ${list.length} | فاشل: ${errors.length} | متاح: ${q.requests_available}`);

  if (errors.length === 0) {
    console.log('لا توجد ملفات فاشلة للمسح.');
    return;
  }

  console.log('مسح جميع الرفع الفاشل...');
  const res = await axios.get('https://lulustream.com/api/file/url_actions', {
    params: { key: KEY, delete_errors: 1 },
    timeout: 10000,
  });
  console.log('النتيجة:', res.data.msg, '| requests_available:', res.data.requests_available);

  // Check new state
  const q2 = await lulu.checkUrlUploads();
  console.log('بعد المسح — الطابور:', (q2.result||[]).length, '| متاح:', q2.requests_available);
}

main().catch(e => console.error('خطأ:', e.message));
