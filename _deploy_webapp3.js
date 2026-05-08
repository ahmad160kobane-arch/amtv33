const ssh2 = require('ssh2');
const conn = new ssh2.Client();
const fs = require('fs');
const { execSync } = require('child_process');

conn.on('ready', () => {
  console.log('Connected to VPS');

  const tarPath = 'C:/Users/princ/Desktop/ma/webapp-deploy.tar';
  
  // Check if tar already exists
  try {
    const stat = fs.statSync(tarPath);
    console.log('Using existing tar file: ' + (stat.size / 1024 / 1024).toFixed(1) + 'MB');
  } catch {
    console.log('Creating tar archive of .next...');
    try {
      execSync('tar -cf "' + tarPath + '" .next', { cwd: 'C:/Users/princ/Desktop/ma/web-app', stdio: 'pipe' });
      const stat = fs.statSync(tarPath);
      console.log('Tar created: ' + (stat.size / 1024 / 1024).toFixed(1) + 'MB');
    } catch (e) {
      console.error('Tar error:', e.message);
      conn.end();
      return;
    }
  }

  conn.sftp((err, sftp) => {
    if (err) { console.error('SFTP error:', err); conn.end(); return; }

    const readStream = fs.createReadStream(tarPath);
    const writeStream = sftp.createWriteStream('/tmp/webapp-deploy.tar');

    let uploadedBytes = 0;
    const totalSize = fs.statSync(tarPath).size;
    
    readStream.on('data', (chunk) => {
      uploadedBytes += chunk.length;
      if (uploadedBytes % (5 * 1024 * 1024) < chunk.length) {
        console.log('  Progress: ' + (uploadedBytes / totalSize * 100).toFixed(0) + '% (' + (uploadedBytes / 1024 / 1024).toFixed(1) + '/' + (totalSize / 1024 / 1024).toFixed(1) + 'MB)');
      }
    });

    writeStream.on('close', () => {
      console.log('Tar uploaded successfully');

      conn.exec('rm -rf /home/webapp/.next && cd /home/webapp && tar -xf /tmp/webapp-deploy.tar && pm2 restart webapp --update-env && echo DEPLOY_COMPLETE', (err, stream) => {
        if (err) console.error('Extract error:', err);
        stream.on('data', (data) => process.stdout.write(data.toString()));
        stream.stderr.on('data', (data) => process.stderr.write(data.toString()));
        stream.on('close', () => {
          console.log('Webapp deployed and restarted');
          try { fs.unlinkSync(tarPath); } catch {}
          conn.end();
        });
      });
    });

    writeStream.on('error', (e) => {
      console.error('Upload error:', e.message);
      conn.end();
    });

    console.log('Uploading...');
    readStream.pipe(writeStream);
  });
}).connect({
  host: '62.171.153.204',
  port: 22,
  username: 'root',
  password: 'Mustafa7',
  readyTimeout: 60000,
});
