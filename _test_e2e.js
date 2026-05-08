const {Client} = require('ssh2');
const jwt = require('jsonwebtoken');
const c = new Client();
const JWT_SECRET = 'ma-streaming-secret-key-change-in-production';

// Generate a valid JWT token
const token = jwt.sign(
  { userId: '0cef8a1e-3b3e-494f-9736-c4085ab5eb14', lv: 0 },
  JWT_SECRET,
  { expiresIn: '1h' }
);
console.log('Generated token:', token.substring(0, 40) + '...');

c.on('ready', () => {
  // Request stream via cloud server with our generated token
  const cmd = `curl -s -m 15 -X POST "http://localhost:8090/api/stream/live/111017030" -H "Content-Type: application/json" -H "Authorization: Bearer ${token}" -d '{"deviceId":"test-device-123"}' 2>&1`;
  c.exec(cmd, (e, s) => {
    let o = '';
    s.on('data', d => o += d);
    s.stderr.on('data', d => o += d);
    s.on('close', () => {
      console.log('Stream response:', o.substring(0, 2000));
      try {
        const data = JSON.parse(o);
        if (data.hlsUrl) {
          console.log('\nHLS URL:', data.hlsUrl);
          // Test the HLS manifest
          const hlsUrl = 'http://localhost:8090' + data.hlsUrl;
          const cmd2 = `curl -s -m 15 -H "Authorization: Bearer ${token}" "${hlsUrl}" 2>&1`;
          console.log('\nFetching manifest...');
          c.exec(cmd2, (e2, s2) => {
            let o2 = '';
            s2.on('data', d => o2 += d);
            s2.stderr.on('data', d => o2 += d);
            s2.on('close', () => {
              console.log('\nManifest response:', o2.substring(0, 3000));
              c.end();
            });
          });
        } else {
          c.end();
        }
      } catch { c.end(); }
    });
  });
}).connect({host:'62.171.153.204', port:22, username:'root', password:'Mustafa7'});
