const ssh2 = require('ssh2');
const { NodeSSH } = require('node-ssh');
const path = require('path');
const fs = require('fs');

// Use ssh2 SFTP to upload files, then build on VPS
const Client = require('ssh2').Client;
const conn = new Client();

const LOCAL_SRC = 'C:/Users/princ/Desktop/ma/web-app';
const REMOTE_PATH = '/root/ma-streaming/webapp';

const UPLOAD_FILES = [
  'package.json',
  'next.config.js',
  'tailwind.config.js',
  'postcss.config.js',
  'tsconfig.json',
];

const { execSync } = require('child_process');

// Create tar of src + config files only (no node_modules, no .next)
const tarPath = 'C:/Users/princ/Desktop/ma/webapp-src.tar';
console.log('Creating source archive...');
try {
  execSync(
    'tar -cf ../webapp-src.tar src public package.json package-lock.json next.config.js postcss.config.js tailwind.config.js tsconfig.json next-env.d.ts',
    { cwd: LOCAL_SRC, stdio: 'pipe' }
  );
  const sizeMB = (fs.statSync(tarPath).size / 1024 / 1024).toFixed(1);
  console.log(`Archive created: ${sizeMB}MB`);
} catch (e) {
  console.error('Tar error:', e.message);
  process.exit(1);
}

conn.on('ready', () => {
  console.log('Connected to VPS');

  conn.sftp((err, sftp) => {
    if (err) { console.error('SFTP error:', err); conn.end(); return; }

    const readStream = fs.createReadStream(tarPath);
    const writeStream = sftp.createWriteStream('/tmp/webapp-src.tar');

    writeStream.on('close', () => {
      console.log('Source uploaded. Building on VPS...');

      const buildCmd = [
        `mkdir -p ${REMOTE_PATH}`,
        `cd ${REMOTE_PATH}`,
        'tar -xf /tmp/webapp-src.tar',
        'echo "Source extracted"',
        'export NODE_OPTIONS=--max-old-space-size=1024',
        'npm install --prefer-offline 2>&1 | tail -5',
        'echo "npm install done"',
        'npm run build 2>&1 | tail -15',
        'echo "Build done"',
        'pm2 restart webapp --update-env',
        'echo "PM2 restarted"',
      ].join(' && ');

      conn.exec(buildCmd, (err, stream) => {
        if (err) { console.error('Build error:', err); conn.end(); return; }
        stream.on('data', (data) => process.stdout.write(data.toString()));
        stream.stderr.on('data', (data) => process.stderr.write(data.toString()));
        stream.on('close', (code) => {
          if (code === 0) {
            console.log('\n✅ Webapp deployed successfully!');
          } else {
            console.error('\n❌ Build failed with code:', code);
          }
          try { fs.unlinkSync(tarPath); } catch {}
          conn.end();
        });
      });
    });

    const sizeMB = (fs.statSync(tarPath).size / 1024 / 1024).toFixed(1);
    console.log(`Uploading ${sizeMB}MB source files...`);
    readStream.pipe(writeStream);
  });

}).connect({
  host: '62.171.153.204',
  port: 22,
  username: 'root',
  password: 'Mustafa7',
  readyTimeout: 30000,
});
