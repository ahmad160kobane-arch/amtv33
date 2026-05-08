const http = require('http');

// اختبار من جهاز محلي (residential IP) - هل يوجد redirect لـ CDN؟
const url = 'http://kojplusma.org:2052/movie/jazera/amlive/698146.mp4';

const req = http.request(url, {
  method: 'HEAD',
  timeout: 15000,
  headers: {
    'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20',
    'Accept': '*/*',
  }
}, res => {
  console.log('Status:', res.statusCode);
  console.log('Headers:', JSON.stringify(res.headers, null, 2));
  res.resume();
});
req.on('error', e => console.log('Error:', e.message));
req.end();
