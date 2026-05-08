const {Client} = require('ssh2');
const c = new Client();
c.on('ready', () => {
  // اختبار Zom 100 (stream_id=465300) من VPS
  const cmd = 'curl -sv --max-time 10 -A "VLC/3.0.20 LibVLC/3.0.20" "http://kojplusma.org:2052/movie/jazera/amlive/465300.mp4" 2>&1 | grep -E "< HTTP|< Location|< Content" | head -10';
  c.exec(cmd, (_, s) => {
    let o = '';
    s.on('data', d => o += d);
    s.stderr.on('data', d => o += d);
    s.on('close', () => { console.log('Zom 100 from VPS:', o.substring(0, 500)); c.end(); });
  });
}).connect({ host: '62.171.153.204', port: 22, username: 'root', password: 'Mustafa7' });
