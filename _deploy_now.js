const { NodeSSH } = require('node-ssh');
const path = require('path');
const fs = require('fs');

const VPS_HOST = '62.171.153.204';
const VPS_USER = 'root';
const VPS_PASS = 'Mustafa7';
const REMOTE_DIR = '/root/ma-streaming';

// الملفات المعدلة فقط
const FILES = [
  'cloud-server/lib/lulu-uploader.js',
  'cloud-server/server.js',
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
    process.exit(1);
  }

  console.log('Connected!\n');

  // تحقق من وجود الملفات على VPS
  console.log('Checking remote files...');
  const checkResult = await ssh.execCommand(`ls -la ${REMOTE_DIR}/cloud-server/lib/lulu-uploader.js ${REMOTE_DIR}/cloud-server/server.js 2>&1`);
  console.log('Remote files:', checkResult.stdout || checkResult.stderr);

  // Upload files
  for (const f of FILES) {
    const localPath = path.join(__dirname, f);
    const remotePath = `${REMOTE_DIR}/${f}`;
    
    if (!fs.existsSync(localPath)) {
      console.log(`SKIP: ${f} (not found locally)`);
      continue;
    }

    try {
      await ssh.putFile(localPath, remotePath);
      console.log(`✓ Uploaded: ${f}`);
    } catch (e) {
      console.log(`✗ Failed: ${f}: ${e.message}`);
    }
  }

  // تحقق من الملفات بعد الرفع
  console.log('\nVerifying uploaded files...');
  const verifyResult = await ssh.execCommand(`head -3 ${REMOTE_DIR}/cloud-server/lib/lulu-uploader.js && echo "---" && grep -c "canplay_failed" ${REMOTE_DIR}/cloud-server/lib/lulu-uploader.js && echo "---" && grep -c "_iptvProxyRequest" ${REMOTE_DIR}/cloud-server/server.js && echo "---" && grep "62.171.153.204" ${REMOTE_DIR}/cloud-server/server.js | head -3`);
  console.log('Verification:', verifyResult.stdout);

  // Restart services
  console.log('\nRestarting PM2 services...');
  try {
    const result = await ssh.execCommand('cd /root/ma-streaming && pm2 restart all && sleep 2 && pm2 status');
    console.log(result.stdout || 'PM2 restarted');
    if (result.stderr) console.log('stderr:', result.stderr);
  } catch (e) {
    console.log('Restart failed:', e.message);
  }

  ssh.dispose();
  console.log('\n✓ Deploy complete!');
}

deploy().catch(e => console.error('Error:', e.message));
