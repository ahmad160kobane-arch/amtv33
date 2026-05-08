const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  console.log('Connected to VPS');
  
  const loginCmd = `curl -s -m 10 -X POST https://amtv33-production.up.railway.app/api/auth/login -H "Content-Type: application/json" -d '{"login":"ahmad","password":"ahmad123"}'`;
  
  conn.exec(loginCmd, (err, stream) => {
    if (err) { console.error('Login exec error:', err); conn.end(); return; }
    let loginData = '';
    stream.on('data', d => loginData += d);
    stream.stderr.on('data', d => process.stderr.write(d));
    stream.on('close', () => {
      console.log('Login response:', loginData.substring(0, 200));
      
      let token;
      try {
        token = JSON.parse(loginData).token;
      } catch (e) {
        console.error('Failed to parse login response');
        conn.end();
        return;
      }
      
      if (!token) {
        console.error('No token in login response');
        conn.end();
        return;
      }
      
      console.log('Got token');
      
      const streamCmd = `curl -s -m 20 -X POST http://localhost:8090/api/stream/live/111017030 -H "Content-Type: application/json" -H "Authorization: Bearer ${token}" -d '{"deviceId":"test-dev-123"}'`;
      
      conn.exec(streamCmd, (err2, stream2) => {
        if (err2) { console.error('Stream exec error:', err2); conn.end(); return; }
        let streamData = '';
        stream2.on('data', d => streamData += d);
        stream2.stderr.on('data', d => process.stderr.write(d));
        stream2.on('close', () => {
          console.log('Stream response:', streamData.substring(0, 500));
          
          try {
            const result = JSON.parse(streamData);
            if (result.hlsUrl) {
              console.log('\nHLS URL:', result.hlsUrl);
              
              const manifestCmd = `curl -s -m 15 "${result.hlsUrl}"`;
              conn.exec(manifestCmd, (err3, stream3) => {
                if (err3) { console.error('Manifest exec error:', err3); conn.end(); return; }
                let manifestData = '';
                stream3.on('data', d => manifestData += d);
                stream3.stderr.on('data', d => process.stderr.write(d));
                stream3.on('close', () => {
                  console.log('\nManifest:', manifestData.substring(0, 500));
                  conn.end();
                });
              });
            } else {
              conn.end();
            }
          } catch (e) {
            conn.end();
          }
        });
      });
    });
  });
}).connect({
  host: '62.171.153.204',
  port: 22,
  username: 'root',
  password: 'Mustafa7',
  readyTimeout: 30000,
});
