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
console.log('Fetching segment...');

http.get('http://62.171.153.204:8090' + segUrl, { timeout: 60000 }, res => {
  console.log('Status:', res.statusCode);
  console.log('Content-Type:', res.headers['content-type']);
  let data = '';
  res.on('data', c => {
    if (Buffer.isBuffer(c)) {
      console.log('Got chunk:', c.length, 'bytes');
    } else {
      data += c;
    }
  });
  res.on('end', () => {
    if (data) console.log('Body:', data.substring(0, 300));
  });
}).on('error', e => console.error('Error:', e.message));
