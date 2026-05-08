const {Client} = require('ssh2');
const fs = require('fs');
const c = new Client();
c.on('ready', () => {
  const content = fs.readFileSync('C:\\Users\\princ\\Desktop\\ma\\_nginx_conf.js', 'utf8');
  c.sftp((err, sftp) => {
    if (err) { console.error('SFTP error:', err); c.end(); return; }
    const stream = sftp.createWriteStream('/etc/nginx/sites-enabled/web-amlive');
    stream.write(content);
    stream.end();
    stream.on('close', () => {
      console.log('Nginx config uploaded. Testing...');
      c.exec('nginx -t 2>&1 && nginx -s reload 2>&1', (e, s) => {
        let o = '';
        s.on('data', d => o += d);
        s.stderr.on('data', d => o += d);
        s.on('close', () => { console.log(o); c.end(); });
      });
    });
  });
}).connect({host:'62.171.153.204', port:22, username:'root', password:'Mustafa7'});
