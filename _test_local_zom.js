const http = require('http');

// اختبار من جهاز محلي - residential IP
const req = http.request('http://kojplusma.org:2052/movie/jazera/amlive/465300.mp4', {
  method: 'HEAD',
  timeout: 15000,
  headers: { 'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20' }
}, res => {
  console.log('Local status:', res.statusCode);
  console.log('Server:', res.headers.server || 'N/A');
  console.log('CF-Ray:', res.headers['cf-ray'] || 'N/A');
  console.log('Content-Length:', res.headers['content-length'] || 'N/A');
  res.resume();
});
req.on('error', e => console.log('Error:', e.message));
req.end();
