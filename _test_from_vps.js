const {Client} = require('ssh2');
const c = new Client();
c.on('ready', () => {
  const cmd = `curl -sI -A "VLC/3.0.20 LibVLC/3.0.20" --max-time 10 "http://kojplusma.org:2052/movie/jazera/amlive/698146.mp4" 2>&1 | head -15`;
  c.exec(cmd, (_, s) => {
    let o = '';
    s.on('data', d => o += d);
    s.stderr.on('data', d => o += d);
    s.on('close', () => { console.log('VPS response:\n', o.substring(0, 600)); c.end(); });
  });
}).connect({ host: '62.171.153.204', port: 22, username: 'root', password: 'Mustafa7' });
