const {Client} = require('ssh2');
const c = new Client();
c.on('ready', () => {
  // جلب بيانات حساب IPTV من قاعدة البيانات واختبار رابط مباشر
  const cmd = `cd /root/ma-streaming/cloud-server && node -e "
const Database = require('better-sqlite3');
const db = new Database('/root/ma-streaming/cloud-server/data/streaming.db');

// جلب الحسابات
const accounts = db.prepare('SELECT id, server_url, username, password, status FROM iptv_accounts WHERE status = ?').all('active');
console.log('Active IPTV accounts:', JSON.stringify(accounts.slice(0,3), null, 2));

// جلب عنصر من الجوب الفاشل لاختبار الرابط
const item = db.prepare('SELECT * FROM catalog WHERE type=? AND lulu_file_code IS NULL LIMIT 1').get('movie');
if (item) console.log('\\nTest item:', JSON.stringify({id:item.id, name:item.name, stream_id:item.stream_id, ext:item.ext}, null, 2));
db.close();
" 2>&1`;
  c.exec(cmd, (_, s) => {
    let o = '';
    s.on('data', d => o += d);
    s.stderr.on('data', d => o += d);
    s.on('close', () => { console.log(o.substring(0, 2000)); c.end(); });
  });
}).connect({ host: '62.171.153.204', port: 22, username: 'root', password: 'Mustafa7' });
