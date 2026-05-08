const {Client} = require('ssh2');
const c = new Client();
c.on('ready', () => {
  // Test segment download speed from VPS to CDN
  const cmd = `curl -s -o /dev/null -w "TIME_TOTAL:%{time_total}s SIZE:%{size_download} SPEED:%{speed_upload}" -m 30 "http://185.191.124.204:2095/mypro2025/82736475687819901262/2127" 2>&1`;
  c.exec(cmd, (e, s) => {
    let o = '';
    s.on('data', d => o += d);
    s.stderr.on('data', d => o += d);
    s.on('close', () => { console.log('CDN direct:', o); 
    
      // Test through cloud server proxy
      const cmd2 = `curl -s -o /dev/null -w "TIME_TOTAL:%{time_total}s SIZE:%{size_download}" -m 60 "http://localhost:8090/proxy/live/1017030/seg/http%3A%2F%2F185.191.124.204%3A2095%2Fmypro2025%2F82736475687819901262%2F2127?did=test&st=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIwY2VmOGExZS0zYjNlLTQ5NGYtOTczNi1jNDA4NWFiNWViMTQiLCJzdHJlYW1JZCI6IjEwMTcwMzAiLCJ0Ijoic3RyZWFtIiwibHYiOjMyLCJpYXQiOjE3Nzc3NDQ5NDQsImV4cCI6MTc3Nzc3Mzc0NH0.G_ePxr1KendXORGsf3pQKHVVuuiKxspJC9xgLS5NN98" 2>&1`;
      c.exec(cmd2, (e2, s2) => {
        let o2 = '';
        s2.on('data', d => o2 += d);
        s2.stderr.on('data', d => o2 += d);
        s2.on('close', () => { console.log('Through proxy:', o2); c.end(); });
      });
    });
  });
}).connect({host:'62.171.153.204', port:22, username:'root', password:'Mustafa7'});
