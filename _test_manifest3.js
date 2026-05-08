const {Client} = require('ssh2');
const c = new Client();
c.on('ready', () => {
  // Wait for server to start, then test the full flow
  const cmd = `sleep 3 && curl -s -m 15 "http://localhost:8090/proxy/live/1017030/index.m3u8?st=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIwY2VmOGExZS0zYjNlLTQ5NGYtOTczNi1jNDA4NWFiNWViMTQiLCJzdHJlYW1JZCI6IjEwMTcwMzAiLCJ0Ijoic3RyZWFtIiwibHYiOjI2LCJpYXQiOjE3Nzc3MzYyNjgsImV4cCI6MTc3Nzc2NTA2OH0.5oohNdm_zmVnvaAAEv4uL3kle49MmSkck3YDcRl3lGE&did=2653cfe2-055c-4759-86ff-54743572b8dd" -w "\\n---HTTP:%{http_code}---" -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIwY2VmOGExZS0zYjNlLTQ5NGYtOTczNi1jNDA4NWFiNWViMTQiLCJzdHJlYW1JZCI6IjEwMTcwMzAiLCJ0Ijoic3RyZWFtIiwibHYiOjI2LCJpYXQiOjE3Nzc3MzYyNjgsImV4cCI6MTc3Nzc2NTA2OH0.5oohNdm_zmVnvaAAEv4uL3kle49MmSkck3YDcRl3lGE" 2>&1`;
  c.exec(cmd, (e, s) => {
    let o = '';
    s.on('data', d => o += d);
    s.stderr.on('data', d => o += d);
    s.on('close', () => { console.log(o.substring(0, 3000)); c.end(); });
  });
}).connect({host:'62.171.153.204', port:22, username:'root', password:'Mustafa7'});
