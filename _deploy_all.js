const {Client} = require('ssh2');
const fs = require('fs');
const path = require('path');

const c = new Client();
c.on('ready', () => {
  // 1. Deploy xtream-proxy.js
  const proxyFile = fs.readFileSync(path.join(__dirname, 'cloud-server/lib/xtream-proxy.js'));
  console.log(`Uploading xtream-proxy.js (${proxyFile.length} bytes)...`);
  c.sftp((err, sftp) => {
    if (err) { console.error('SFTP error:', err); c.end(); return; }
    let done = 0;
    const checkDone = () => {
      done++;
      if (done < 3) return;
      console.log('All uploaded. Restarting services...');
      c.exec('pm2 restart cloud-server && nginx -s reload', (e, s) => {
        let o = '';
        s.on('data', d => o += d);
        s.stderr.on('data', d => o += d);
        s.on('close', () => { console.log(o); c.end(); });
      });
    };

    const s1 = sftp.createWriteStream('/root/ma-streaming/cloud-server/lib/xtream-proxy.js');
    s1.write(proxyFile); s1.end();
    s1.on('close', () => { console.log('xtream-proxy.js uploaded'); checkDone(); });

    // 2. Deploy nginx config
    const nginxContent = fs.readFileSync(path.join(__dirname, '_nginx_conf.js'), 'utf8');
    const s2 = sftp.createWriteStream('/etc/nginx/sites-enabled/web-amlive');
    s2.write(nginxContent); s2.end();
    s2.on('close', () => { console.log('nginx config uploaded'); checkDone(); });

    // 3. Deploy LivePlayer.tsx
    const playerFile = fs.readFileSync(path.join(__dirname, 'web-app/src/components/LivePlayer.tsx'));
    const s3 = sftp.createWriteStream('/home/webapp/src/components/LivePlayer.tsx');
    s3.write(playerFile); s3.end();
    s3.on('close', () => { console.log('LivePlayer.tsx uploaded'); checkDone(); });
  });
}).connect({host:'62.171.153.204', port:22, username:'root', password:'Mustafa7'});
