'use strict';
const lulu = require('./src/lulu-api');
lulu.checkUrlUploads().then(r => {
  const list = r.result || [];
  const byStatus = {};
  list.forEach(f => { byStatus[f.status] = (byStatus[f.status]||0)+1; });
  console.log('إجمالي في الطابور:', list.length);
  console.log('requests_available:', r.requests_available);
  console.log('حسب الحالة:', JSON.stringify(byStatus, null, 2));
  const errors = list.filter(f => f.status === 'ERROR' || f.status === 'FAILED').slice(0, 5);
  if (errors.length) {
    console.log('\nأمثلة فاشلة:');
    errors.forEach(e => console.log(' -', e.remote_url, '→', e.status));
  }
  const pending = list.filter(f => f.status === 'PENDING' || f.status === 'DOWNLOADING').slice(0, 3);
  if (pending.length) {
    console.log('\nأمثلة جارية:');
    pending.forEach(e => console.log(' -', e.file_code, '|', e.status, '|', e.progress+'%'));
  }
}).catch(e => console.log('خطأ:', e.message));
