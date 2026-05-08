const { NodeSSH } = require('node-ssh');

const VPS_HOST = '62.171.153.204';
const VPS_USER = 'root';
const VPS_PASS = 'Mustafa7';

async function verify() {
  const ssh = new NodeSSH();
  await ssh.connect({ host: VPS_HOST, username: VPS_USER, password: VPS_PASS, readyTimeout: 15000 });
  
  console.log('=== 1. PM2 Logs (آخر 20 سطر) ===');
  const logs = await ssh.execCommand('pm2 logs cloud-server --lines 20 --nostream 2>&1');
  console.log(logs.stdout.slice(-2000));
  
  console.log('\n=== 2. تحقق من البروكسي (HEAD request) ===');
  const headTest = await ssh.execCommand('curl -sI "http://localhost:8090/iptv-proxy/lulu_iptv_proxy_2026/0/movie/12345.mp4" 2>&1 | head -10');
  console.log(headTest.stdout);
  
  console.log('\n=== 3. تحقق من GET proxy ===');
  const getTest = await ssh.execCommand('curl -s -o /dev/null -w "HTTP Status: %{http_code}\\nSize: %{size_download}\\n" "http://localhost:8090/iptv-proxy/lulu_iptv_proxy_2026/0/movie/12345.mp4" 2>&1');
  console.log(getTest.stdout);
  
  console.log('\n=== 4. تحقق من canplay_failed في lulu-uploader ===');
  const grepTest = await ssh.execCommand('grep -c "canplay_failed\\|CANPLAY FAILED" /root/ma-streaming/cloud-server/lib/lulu-uploader.js');
  console.log('canplay_failed occurrences:', grepTest.stdout.trim());
  
  console.log('\n=== 5. تحقق من _iptvProxyRequest في server.js ===');
  const grepTest2 = await ssh.execCommand('grep -c "_iptvProxyRequest" /root/ma-streaming/cloud-server/server.js');
  console.log('_iptvProxyRequest occurrences:', grepTest2.stdout.trim());
  
  console.log('\n=== 6. تحقق من vpsUrl default ===');
  const grepTest3 = await ssh.execCommand('grep "62.171.153.204" /root/ma-streaming/cloud-server/server.js | head -5');
  console.log(grepTest3.stdout);
  
  console.log('\n=== 7. تحقق من HEAD route ===');
  const grepTest4 = await ssh.execCommand('grep -c "app.head.*iptv-proxy" /root/ma-streaming/cloud-server/server.js');
  console.log('HEAD route count:', grepTest4.stdout.trim());
  
  ssh.dispose();
  console.log('\n✓ Verification complete!');
}

verify().catch(e => console.error('Error:', e.message));
