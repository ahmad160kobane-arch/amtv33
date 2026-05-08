const { Client } = require('ssh2');
const fs = require('fs');
const { execSync } = require('child_process');

const LOCAL = 'C:/Users/princ/Desktop/ma/admin-dashboard';
const REMOTE = '/home/cloud-server/admin-dashboard';
const TAR = 'C:/Users/princ/Desktop/ma/admin-deploy.tar';

console.log('Creating archive...');
execSync('tar -cf ../admin-deploy.tar --exclude=node_modules .', { cwd: LOCAL, stdio: 'pipe' });
console.log('Archive: ' + (fs.statSync(TAR).size / 1024).toFixed(0) + 'KB');

const c = new Client();
c.on('ready', () => {
  console.log('Connected to VPS');
  c.sftp((_, sftp) => {
    const r = fs.createReadStream(TAR);
    const w = sftp.createWriteStream('/tmp/admin-deploy.tar');
    w.on('close', () => {
      console.log('Uploaded. Extracting & restarting...');
      c.exec(`cd ${REMOTE} && tar -xf /tmp/admin-deploy.tar && pm2 restart admin-dashboard --update-env && pm2 save`, (_, s) => {
        s.on('data', d => process.stdout.write(d.toString()));
        s.stderr.on('data', d => process.stderr.write(d.toString()));
        s.on('close', code => {
          console.log(code === 0 ? '✅ Admin dashboard deployed!' : '❌ Failed: ' + code);
          try { fs.unlinkSync(TAR); } catch {}
          c.end();
        });
      });
    });
    console.log('Uploading...');
    r.pipe(w);
  });
}).connect({ host: '62.171.153.204', port: 22, username: 'root', password: 'Mustafa7' });
