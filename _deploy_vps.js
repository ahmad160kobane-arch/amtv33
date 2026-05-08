const { NodeSSH } = require('node-ssh');
const path = require('path');
const fs = require('fs');

const VPS_HOST = '62.171.153.204';
const VPS_USER = 'root';
const VPS_PASS = 'Mustafa7';
const REMOTE_DIR = '/root/ma-streaming';

const FILES = [
  'cloud-server/lib/lulu-uploader.js',
  'cloud-server/server.js',
  'cloud-server/db.js',
  'admin-dashboard/public/app.js',
  'admin-dashboard/public/index.html',
  'admin-dashboard/public/style.css',
  'backend-api/db.js',
];

async function deploy() {
  const ssh = new NodeSSH();
  
  console.log('Connecting to VPS...');
  try {
    await ssh.connect({
      host: VPS_HOST,
      username: VPS_USER,
      password: VPS_PASS,
      readyTimeout: 15000,
    });
  } catch (e) {
    console.error('SSH connection failed:', e.message);
    console.error('Please deploy manually:');
    console.error('  ssh root@62.171.153.204');
    console.error('  cd /root/ma-streaming && git pull origin master && pm2 restart all');
    process.exit(1);
  }

  console.log('Connected!\n');

  // Upload files
  for (const f of FILES) {
    const localPath = path.join(__dirname, f);
    const remotePath = `${REMOTE_DIR}/${f}`;
    
    if (!fs.existsSync(localPath)) {
      console.log(`SKIP: ${f}`);
      continue;
    }

    try {
      await ssh.putFile(localPath, remotePath);
      console.log(`✓ ${f}`);
    } catch (e) {
      console.log(`✗ ${f}: ${e.message}`);
    }
  }

  // Restart services
  console.log('\nRestarting services...');
  try {
    const result = await ssh.execCommand('cd /root/ma-streaming && pm2 restart all');
    console.log(result.stdout || 'PM2 restarted');
    if (result.stderr) console.log('stderr:', result.stderr);
  } catch (e) {
    console.log('Restart failed:', e.message);
  }

  ssh.dispose();
  console.log('\n✓ Deploy complete!');
}

deploy().catch(e => console.error('Error:', e.message));
