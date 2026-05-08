const ssh2 = require('ssh2');
const conn = new ssh2.Client();
const fs = require('fs');
const { execSync } = require('child_process');

conn.on('ready', () => {
  console.log('Connected to VPS');

  const WEBAPP_PATH = '/root/ma-streaming/webapp';
  conn.exec(`rm -rf ${WEBAPP_PATH}/.next`, (err, stream) => {
    if (err) console.error('rm error:', err);
    stream.on('data', () => {});
    stream.stderr.on('data', () => {});
    stream.on('close', () => {
      console.log('Cleared old .next');

      const localPath = 'C:/Users/princ/Desktop/ma/web-app/webapp-deploy.tar';

      console.log('Creating tar archive...');
      try {
        execSync('tar -cf webapp-deploy.tar .next', { cwd: 'C:/Users/princ/Desktop/ma/web-app', stdio: 'pipe' });
        console.log('Tar created');
      } catch (e) {
        console.error('Tar error:', e.message);
        conn.end();
        return;
      }

      conn.sftp((err, sftp) => {
        if (err) { console.error('SFTP error:', err); conn.end(); return; }

        const readStream = fs.createReadStream(localPath);
        const writeStream = sftp.createWriteStream('/tmp/webapp-deploy.tar');

        writeStream.on('close', () => {
          console.log('Tar uploaded');

          conn.exec(`cd ${WEBAPP_PATH} && tar -xf /tmp/webapp-deploy.tar && pm2 restart webapp --update-env`, (err, stream) => {
            if (err) console.error('Extract error:', err);
            stream.on('data', (data) => process.stdout.write(data.toString()));
            stream.stderr.on('data', (data) => process.stderr.write(data.toString()));
            stream.on('close', () => {
              console.log('Webapp deployed and restarted');
              try { fs.unlinkSync(localPath); } catch {}
              conn.end();
            });
          });
        });

        const stats = fs.statSync(localPath);
        console.log('Uploading ' + (stats.size / 1024 / 1024).toFixed(1) + 'MB...');
        readStream.pipe(writeStream);
      });
    });
  });
}).connect({
  host: '62.171.153.204',
  port: 22,
  username: 'root',
  password: 'Mustafa7',
  readyTimeout: 30000,
});
