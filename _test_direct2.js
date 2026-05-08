const {Client} = require('ssh2');
const c = new Client();
c.on('ready', () => {
  // Simulate what the webapp does: POST /api/stream/live/111017030
  // But we need auth token first - let's just test the manifest fetch directly
  // by calling the xtream-proxy internal method
  const cmd = `curl -s -m 15 "http://myhand.org:8080/live/07740338663/11223344/1017030.m3u8" 2>&1`;
  c.exec(cmd, (e, s) => {
    let o = '';
    s.on('data', d => o += d);
    s.stderr.on('data', d => o += d);
    s.on('close', () => {
      console.log('=== Direct IPTV manifest ===');
      console.log(o.substring(0, 2000));
      c.end();
    });
  });
}).connect({host:'62.171.153.204', port:22, username:'root', password:'Mustafa7'});
