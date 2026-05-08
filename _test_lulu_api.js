const https = require('https');

const apiKey = '268974pf854aqdw63ui5sw';

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 15000 }, res => {
      let b = '';
      res.on('data', d => b += d);
      res.on('end', () => resolve({ status: res.statusCode, body: b }));
    }).on('error', reject).on('timeout', () => reject(new Error('timeout')));
  });
}

(async () => {
  // اختبار 1: upload server
  console.log('=== Test upload server ===');
  try {
    const r = await httpGet(`https://api.lulustream.com/api/upload/server?key=${apiKey}`);
    console.log('Status:', r.status);
    console.log('Body:', r.body.substring(0, 300));
  } catch(e) { console.log('Error:', e.message); }

  // اختبار 2: account info
  console.log('\n=== Test account info ===');
  try {
    const r2 = await httpGet(`https://api.lulustream.com/api/account/info?key=${apiKey}`);
    console.log('Status:', r2.status);
    console.log('Body:', r2.body.substring(0, 300));
  } catch(e) { console.log('Error:', e.message); }

  // اختبار 3: نسخة بديلة من الـ endpoint
  console.log('\n=== Test luluvdo upload server ===');
  try {
    const r3 = await httpGet(`https://luluvdo.com/api/upload/server?key=${apiKey}`);
    console.log('Status:', r3.status);
    console.log('Body:', r3.body.substring(0, 300));
  } catch(e) { console.log('Error:', e.message); }
})();
