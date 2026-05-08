const jwt = require('jsonwebtoken');
const http = require('http');

const JWT_SECRET = 'ma-streaming-secret-key-change-in-production';
const USER_ID = '0cef8a1e-3b3e-494f-9736-c4085ab5eb14';

const stToken = jwt.sign(
  { userId: USER_ID, streamId: '1017030', t: 'stream', lv: 41, did: 'test-device-123' },
  JWT_SECRET,
  { expiresIn: '8h' }
);

const segUrl = '/proxy/live/1017030/seg/live_0?did=test-device-123&st=' + stToken;
const fullUrl = 'http://62.171.153.204:8090' + segUrl;

console.log('Testing segment URL...');
console.log('URL length:', fullUrl.length);

const req = http.get(fullUrl, { timeout: 120000 }, res => {
  console.log('Status:', res.statusCode);
  console.log('Headers:', JSON.stringify(res.headers).substring(0, 300));
  let size = 0;
  let textData = '';
  res.on('data', c => {
    size += c.length;
    if (size < 500 && typeof c === 'string') textData += c;
  });
  res.on('end', () => {
    console.log('Total bytes:', size);
    if (textData) console.log('Text:', textData.substring(0, 300));
  });
});
req.on('error', e => console.error('Error:', e.message));
