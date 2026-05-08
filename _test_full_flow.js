const {Client} = require('ssh2');
const c = new Client();
c.on('ready', () => {
  // Test the complete flow from cloud server side
  // 1. Login via backend API
  const cmd1 = `curl -s -m 10 -X POST "https://amtv33-production.up.railway.app/api/auth/login" -H "Content-Type: application/json" -d '{"login":"mustafa","password":"Mustafa7"}' 2>&1`;
  c.exec(cmd1, (e, s) => {
    let o = '';
    s.on('data', d => o += d);
    s.stderr.on('data', d => o += d);
    s.on('close', () => {
      try {
        const data = JSON.parse(o);
        if (!data.token) { console.log('Login failed:', o); c.end(); return; }
        console.log('Login OK, token:', data.token.substring(0, 40) + '...');
        console.log('User plan:', data.user?.plan, 'role:', data.user?.role);
        
        // 2. Request stream via cloud server
        const token = data.token;
        const cmd2 = `curl -s -m 15 -X POST "http://localhost:8090/api/stream/live/111017030" -H "Content-Type: application/json" -H "Authorization: Bearer ${token}" -d '{"deviceId":"test-device-123"}' 2>&1`;
        c.exec(cmd2, (e2, s2) => {
          let o2 = '';
          s2.on('data', d => o2 += d);
          s2.stderr.on('data', d => o2 += d);
          s2.on('close', () => {
            console.log('\\nStream response:', o2.substring(0, 2000));
            try {
              const streamData = JSON.parse(o2);
              if (streamData.hlsUrl) {
                console.log('\\nHLS URL:', streamData.hlsUrl);
                // 3. Test the HLS manifest
                const hlsUrl = 'http://localhost:8090' + streamData.hlsUrl;
                const cmd3 = `curl -s -m 15 -H "Authorization: Bearer ${token}" "${hlsUrl}" 2>&1`;
                console.log('\\nFetching manifest from:', hlsUrl.substring(0, 100));
                c.exec(cmd3, (e3, s3) => {
                  let o3 = '';
                  s3.on('data', d => o3 += d);
                  s3.stderr.on('data', d => o3 += d);
                  s3.on('close', () => {
                    console.log('\\nManifest response:', o3.substring(0, 2000));
                    c.end();
                  });
                });
              } else {
                c.end();
              }
            } catch { c.end(); }
          });
        });
      } catch { console.log('Parse error:', o); c.end(); }
    });
  });
}).connect({host:'62.171.153.204', port:22, username:'root', password:'Mustafa7'});
