const {Client} = require('ssh2');
const c = new Client();
c.on('ready', () => {
  // PM2 runs the process, so it must have resolved modules. Let's check PM2's env
  c.exec('pm2 show cloud-server 2>&1 | grep -i "exec cwd\\|script path"', (e, s) => {
    let o = '';
    s.on('data', d => o += d);
    s.stderr.on('data', d => o += d);
    s.on('close', () => { console.log(o); c.end(); });
  });
}).connect({host:'62.171.153.204', port:22, username:'root', password:'Mustafa7'});
