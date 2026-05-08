const {Client} = require('ssh2');
const c = new Client();
c.on('ready', () => {
  // فحص نوع DB واختبار IPTV
  const cmd = `cd /root/ma-streaming/cloud-server && node -e "
const path = require('path');
// محاولة تحميل DB
let db;
try { db = require('./lib/db'); console.log('DB loaded'); } catch(e) { console.log('DB err:', e.message); }

// اختبار مباشر لرابط IPTV عبر curl
" 2>&1 ; echo '---'; curl -s -o /dev/null -w "%{http_code}" "http://kojplusma.org:2052/player_api.php?username=test&password=test&action=get_series_info&series_id=1" 2>&1`;
  c.exec(cmd, (_, s) => {
    let o = '';
    s.on('data', d => o += d);
    s.stderr.on('data', d => o += d);
    s.on('close', () => { console.log(o.substring(0, 2000)); c.end(); });
  });
}).connect({ host: '62.171.153.204', port: 22, username: 'root', password: 'Mustafa7' });
