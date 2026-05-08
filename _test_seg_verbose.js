const {Client} = require('ssh2');
const c = new Client();
const stToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIwY2VmOGExZS0zYjNlLTQ5NGYtOTczNi1jNDA4NWFiNWViMTQiLCJzdHJlYW1JZCI6IjEwMTcwMzAiLCJ0Ijoic3RyZWFtIiwibHYiOjI3LCJpYXQiOjE3Nzc3Mzg3MjYsImV4cCI6MTc3Nzc2NzUyNn0.5nBTXthEnrf6fvhxhMf9bDVIgQuQpe7TVVB03D1jZPY';
const authToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIwY2VmOGExZS0zYjNlLTQ5NGYtOTczNi1jNDA4NWFiNWViMTQiLCJsdiI6MjcsImlhdCI6MTc3NzM4NzI0LCJleHAiOjE3Nzc3NDIzMjR9.v0IDx1PJ7ImTSiu0JALhDyS38qMb4B5q2rGMdBMtWMQ';
c.on('ready', () => {
  const cmd = `curl -v -m 30 "http://localhost:8090/proxy/live/1017030/seg/http%3A%2F%2F185.191.124.204%3A2095%2Fmypro2025%2F82736475687819901262%2F2127?did=test-device-123&st=${stToken}" -H "Authorization: Bearer ${authToken}" 2>&1 | tail -20`;
  c.exec(cmd, (e, s) => {
    let o = '';
    s.on('data', d => o += d);
    s.stderr.on('data', d => o += d);
    s.on('close', () => { console.log(o.substring(0, 5000)); c.end(); });
  });
}).connect({host:'62.171.153.204', port:22, username:'root', password:'Mustafa7'});
