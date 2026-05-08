const {Client} = require('ssh2');
const c = new Client();
const stToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIwY2VmOGExZS0zYjNlLTQ5NGYtOTczNi1jNDA4NWFiNWViMTQiLCJzdHJlYW1JZCI6IjEwMTcwMzAiLCJ0Ijoic3RyZWFtIiwibHYiOjI2LCJpYXQiOjE3Nzc3Mzc3OTksImV4cCI6MTc3Nzc2NjU5OX0.oCHe4MrID-G01nURJm_ipnc2nmQvhLyy2-l1DLABOec';
c.on('ready', () => {
  const cmd = `curl -s -m 15 "http://localhost:8090/proxy/live/1017030/index.m3u8?st=${stToken}&did=test123" -w "\\n---HTTP:%{http_code}---" 2>&1`;
  c.exec(cmd, (e, s) => {
    let o = '';
    s.on('data', d => o += d);
    s.stderr.on('data', d => o += d);
    s.on('close', () => { console.log(o.substring(0, 5000)); c.end(); });
  });
}).connect({host:'62.171.153.204', port:22, username:'root', password:'Mustafa7'});
