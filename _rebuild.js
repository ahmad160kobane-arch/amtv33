const {Client} = require('ssh2');
const c = new Client();
c.on('ready', () => {
  c.exec('cd /home/webapp && grep "LOADING_TIMEOUT" src/components/LivePlayer.tsx && echo "---BUILD---" && npm run build 2>&1', (e, s) => {
    let o = '';
    s.on('data', d => o += d);
    s.stderr.on('data', d => o += d);
    s.on('close', () => {
      console.log(o.substring(0, 500));
      console.log(o.substring(o.length - 1500));
      c.exec('pm2 restart webapp 2>&1', (e2, s2) => {
        let o2 = '';
        s2.on('data', d => o2 += d);
        s2.stderr.on('data', d => o2 += d);
        s2.on('close', () => { console.log(o2); c.end(); });
      });
    });
  });
}).connect({host:'62.171.153.204', port:22, username:'root', password:'Mustafa7'});
