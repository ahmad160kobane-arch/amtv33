const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  const script = [
    'cd /root/ma-streaming/cloud-server',
    'TOKEN=$(curl -s -m 10 -X POST https://amtv33-production.up.railway.app/api/auth/login -H "Content-Type: application/json" -d \'{"login":"ahmad","password":"ahmad123"}\' | node -e "process.stdin.on(\'data\',d=>{try{const r=JSON.parse(d);console.log(r.token||\'NO_TOKEN\')}catch(e){console.log(\'PARSE_ERR\')}})")',
    'echo "Token: $TOKEN"',
    'if [ "$TOKEN" = "NO_TOKEN" ] || [ -z "$TOKEN" ]; then',
    '  echo "Trying mustafa..."',
    '  TOKEN=$(curl -s -m 10 -X POST https://amtv33-production.up.railway.app/api/auth/login -H "Content-Type: application/json" -d \'{"login":"mustafa","password":"Mustafa7"}\' | node -e "process.stdin.on(\'data\',d=>{try{const r=JSON.parse(d);console.log(r.token||\'NO_TOKEN\')}catch(e){console.log(\'PARSE_ERR\')}})")',
    '  echo "Token2: $TOKEN"',
    'fi',
    'RESULT=$(curl -s -m 20 -X POST http://localhost:8090/api/stream/live/111017030 -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d \'{"deviceId":"test-dev-123"}\')',
    'echo "Stream: $RESULT"',
  ].join('\n');
  
  conn.exec(script, (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    let out = '';
    stream.on('data', d => out += d);
    stream.stderr.on('data', d => out += d);
    stream.on('close', () => {
      console.log(out);
      conn.end();
    });
  });
}).connect({
  host: '62.171.153.204',
  port: 22,
  username: 'root',
  password: 'Mustafa7',
  readyTimeout: 30000,
});
