const http = require('http');

// اختبار player_api أولاً
const apiUrl = 'http://kojplusma.org:2052/player_api.php?username=jazera&password=amlive&action=get_vod_categories';

http.get(apiUrl, { timeout: 15000 }, res => {
  console.log('API Status:', res.statusCode);
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    console.log('Response (first 300):', body.substring(0, 300));
  });
}).on('error', e => console.log('Error:', e.message));
