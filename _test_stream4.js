const jwt = require('jsonwebtoken');
const http = require('http');

const JWT_SECRET = 'ma-streaming-secret-key-change-in-production';
const USER_ID = '0cef8a1e-3b3e-494f-9736-c4085ab5eb14';

const token = jwt.sign(
  { userId: USER_ID, lv: 41 },
  JWT_SECRET,
  { expiresIn: '1h' }
);
console.log('Generated token for ahmed');

const data = JSON.stringify({ deviceId: 'test-device-123' });
const opts = {
  hostname: '62.171.153.204',
  port: 8090,
  path: '/api/stream/live/111017030',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
    'Authorization': 'Bearer ' + token,
  },
};

console.log('Calling stream endpoint...');
const req = http.request(opts, res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', d.substring(0, 800));
    
    try {
      const result = JSON.parse(d);
      if (result.hlsUrl) {
        let manifestUrl = result.hlsUrl;
        if (manifestUrl.startsWith('/')) {
          manifestUrl = 'http://62.171.153.204:8090' + manifestUrl;
        }
        console.log('\nManifest URL:', manifestUrl);
        
        http.get(manifestUrl, { timeout: 15000 }, mres => {
          let md = '';
          mres.on('data', c => md += c);
          mres.on('end', () => {
            console.log('Manifest status:', mres.statusCode);
            console.log('Manifest body:', md.substring(0, 600));
          });
        }).on('error', e => console.error('Manifest error:', e.message));
      }
    } catch(e) {}
  });
});
req.on('error', e => console.error('Request error:', e.message));
req.write(data);
req.end();
