const {Client} = require('ssh2');
const c = new Client();
c.on('ready', () => {
  const cmd = 'curl -sI --max-time 8 -A "VLC/3.0.20 LibVLC/3.0.20" "http://kojplusma.org:2052/movie/jazera/amlive/698146.mp4" 2>/dev/null | grep "HTTP/"';
  c.exec(cmd, (_, s) => {
    let o = '';
    s.on('data', d => o += d);
    s.stderr.on('data', d => o += d);
    s.on('close', () => { console.log('Status:', o.trim()); c.end(); });
  });
}).connect({ host: '62.171.153.204', port: 22, username: 'root', password: 'Mustafa7' });
