const {Client} = require('ssh2');
const c = new Client();
const stToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIwY2VmOGExZS0zYjNlLTQ5NGYtOTczNi1jNDA4NWFiNWViMTQiLCJzdHJlYW1JZCI6IjEwMTcwMzAiLCJ0Ijoic3RyZWFtIiwibHYiOjI2LCJpYXQiOjE3Nzc3Mzc3OTksImV4cCI6MTc3Nzc2NjU5OX0.oCHe4MrID-G01nURJm_ipnc2nmQvhLyy2-l1DLABOec';
c.on('ready', () => {
  c.exec('pm2 logs cloud-server --lines 10 --nostream 2>&1', (e, s) => {
    let o = '';
    s.on('data', d => o += d);
    s.stderr.on('data', d => o += d);
    s.on('close', () => {
      console.log('=== LOGS ===');
      console.log(o.substring(0, 3000));
      
      // Now try the request and check logs after
      const cmd = `curl -s -m 15 "http://localhost:8090/proxy/live/1017030/index.m3u8?st=${stToken}&did=test123" 2>&1`;
      c.exec(cmd, (e2, s2) => {
        let o2 = '';
        s2.on('data', d => o2 += d);
        s2.stderr.on('data', d => o2 += d);
        s2.on('close', () => {
          console.log('\\n=== RESPONSE ===');
          console.log(o2.substring(0, 2000));
          
          // Check logs after request
          c.exec('pm2 logs cloud-server --lines 5 --nostream 2>&1', (e3, s3) => {
            let o3 = '';
            s3.on('data', d => o3 += d);
            s3.stderr.on('data', d => o3 += d);
            s3.on('close', () => { console.log('\\n=== AFTER LOGS ==='); console.log(o3.substring(0, 2000)); c.end(); });
          });
        });
      });
    });
  });
}).connect({host:'62.171.153.204', port:22, username:'root', password:'Mustafa7'});
