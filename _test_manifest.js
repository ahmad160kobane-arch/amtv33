const ssh2 = require('ssh2');
const conn = new ssh2.Client();

conn.on('ready', () => {
  // Step 1: Login to backend
  const loginCmd = `curl -s -X POST https://amtv33-production.up.railway.app/api/auth/login -H "Content-Type: application/json" -d '{"login":"ahmad","password":"ahmad123"}'`;
  
  conn.exec(loginCmd, (err, stream) => {
    let loginData = '';
    stream.on('data', d => loginData += d);
    stream.stderr.on('data', d => process.stderr.write(d));
    stream.on('close', () => {
      try {
        const token = JSON.parse(loginData).token;
        console.log('Got token:', token ? 'yes' : 'no');
        
        // Step 2: Get stream URL
        const streamCmd = `curl -s -X POST http://localhost:8090/api/stream/live/1017030 -H "Content-Type: application/json" -H "Authorization: Bearer ${token}" -d '{}'`;
        
        conn.exec(streamCmd, (err, stream2) => {
          let streamData = '';
          stream2.on('data', d => streamData += d);
          stream2.stderr.on('data', d => process.stderr.write(d));
          stream2.on('close', () => {
            try {
              const result = JSON.parse(streamData);
              const hlsUrl = result.hlsUrl;
              console.log('HLS URL:', hlsUrl);
              
              // Step 3: Fetch manifest
              const manifestCmd = `curl -s "${hlsUrl}" -H "Authorization: Bearer ${token}"`;
              
              conn.exec(manifestCmd, (err, stream3) => {
                let manifestData = '';
                stream3.on('data', d => manifestData += d);
                stream3.stderr.on('data', d => process.stderr.write(d));
                stream3.on('close', () => {
                  console.log('\n=== MANIFEST ===');
                  console.log(manifestData);
                  console.log('================');
                  conn.end();
                });
              });
            } catch (e) {
              console.error('Parse error:', e.message, streamData);
              conn.end();
            }
          });
        });
      } catch (e) {
        console.error('Login parse error:', e.message, loginData.substring(0, 200));
        conn.end();
      }
    });
  });
}).connect({
  host: '62.171.153.204',
  port: 22,
  username: 'root',
  password: 'Mustafa7',
  readyTimeout: 30000,
});
