const {Client} = require('ssh2');
const c = new Client();
c.on('ready', () => {
  // Test the full flow: request stream via the API like the webapp does
  // First, let's check the direct IPTV manifest
  const cmd1 = `curl -s -w "\\n---HTTP_CODE:%{http_code}---" "http://myhand.org:8080/live/07740338663/11223344/1017030.m3u8" 2>&1`;
  c.exec(cmd1, (e, s) => {
    let o = '';
    s.on('data', d => o += d);
    s.stderr.on('data', d => o += d);
    s.on('close', () => {
      console.log('=== Direct IPTV manifest ===');
      console.log(o.substring(0, 3000));
      
      // Now test the segment URL from manifest
      const cmd2 = `curl -s -o /dev/null -w "%{http_code}" "http://185.191.124.204:2095/mypro2025/82736475687819901262/2127" 2>&1`;
      c.exec(cmd2, (e2, s2) => {
        let o2 = '';
        s2.on('data', d => o2 += d);
        s2.stderr.on('data', d => o2 += d);
        s2.on('close', () => {
          console.log('\\n=== Segment URL status ===');
          console.log(o2);
          c.end();
        });
      });
    });
  });
}).connect({host:'62.171.153.204', port:22, username:'root', password:'Mustafa7'});
