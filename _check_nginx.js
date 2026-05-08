const {Client} = require('ssh2');
const c = new Client();
c.on('ready', () => {
  // Check nginx config for amlive.shop
  c.exec('cat /etc/nginx/sites-enabled/amlive.shop 2>/dev/null || cat /etc/nginx/conf.d/amlive.shop.conf 2>/dev/null || ls /etc/nginx/sites-enabled/ 2>/dev/null || ls /etc/nginx/conf.d/ 2>/dev/null', (e, s) => {
    let o = '';
    s.on('data', d => o += d);
    s.stderr.on('data', d => o += d);
    s.on('close', () => { console.log(o.substring(0, 5000)); c.end(); });
  });
}).connect({host:'62.171.153.204', port:22, username:'root', password:'Mustafa7'});
