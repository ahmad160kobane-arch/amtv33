const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

ssh.connect({ host: '62.171.153.204', username: 'root', password: 'Mustafa7', readyTimeout: 15000 })
.then(() => ssh.execCommand(`cd /root/ma-streaming && node -e "
const db = require('./cloud-server/db');
db.init().then(async () => {
  // سجلات بدون تفاصيل (poster أو plot فارغة)
  // أولاً: اعرف أعمدة الجدول
  const cols = await db.prepare(\\"SELECT column_name FROM information_schema.columns WHERE table_name = 'lulu_catalog' ORDER BY ordinal_position\\").all();
  console.log('أعمدة lulu_catalog:', cols.map(c => c.column_name).join(', '));

  const missing = await db.prepare(
    \\"SELECT id, title, vod_type, file_code, poster, plot, year, genres, cast_list, director, tmdb_id FROM lulu_catalog WHERE (poster IS NULL OR poster = '') OR (plot IS NULL OR plot = '') ORDER BY uploaded_at DESC LIMIT 20\\"
  ).all();
  console.log('سجلات ناقصة تفاصيل:', missing.length);
  for (const r of missing) {
    const missing_fields = [];
    if (!r.poster) missing_fields.push('poster');
    if (!r.plot) missing_fields.push('plot');
    if (!r.year) missing_fields.push('year');
    if (!r.genres) missing_fields.push('genres');
    if (!r.cast_list) missing_fields.push('cast');
    if (!r.director) missing_fields.push('director');
    if (!r.tmdb_id) missing_fields.push('tmdb_id');
    console.log('  [' + r.vod_type + ']', r.title, '| file_code:', r.file_code, '| ناقص:', missing_fields.join(','));
  }
  process.exit(0);
}).catch(e => { console.error('ERROR:', e.message); process.exit(1); });
"`))
.then(r => { console.log(r.stdout); if(r.stderr) console.error(r.stderr.slice(0,400)); ssh.dispose(); })
.catch(e => { console.error(e.message); ssh.dispose(); });
