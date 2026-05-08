// check lulu catalog
const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
ssh.connect({ host: '62.171.153.204', username: 'root', password: 'Mustafa7', readyTimeout: 15000 })
.then(() => ssh.execCommand(`node -e "
const db = require('/root/ma-streaming/cloud-server/db');
async function check() {
  // 1. عدد السجلات في lulu_catalog
  const count = await db.prepare('SELECT COUNT(*) as c FROM lulu_catalog').get();
  console.log('lulu_catalog total rows:', count?.c);

  // 2. آخر 5 سجلات
  const rows = await db.prepare('SELECT id, title, vod_type, poster, plot, year, genres, file_code, canplay, uploaded_at FROM lulu_catalog ORDER BY uploaded_at DESC LIMIT 5').all();
  console.log('\\nآخر 5 سجلات:');
  for (const r of rows) {
    console.log('  id:', r.id);
    console.log('  title:', r.title);
    console.log('  type:', r.vod_type);
    console.log('  poster:', r.poster ? 'موجود' : 'فارغ');
    console.log('  plot:', r.plot ? r.plot.slice(0,50)+'...' : 'فارغ');
    console.log('  year:', r.year);
    console.log('  genres:', r.genres);
    console.log('  file_code:', r.file_code);
    console.log('  canplay:', r.canplay);
    console.log('  ---');
  }

  // 3. عدد السجلات الفارغة التفاصيل
  const empty = await db.prepare('SELECT COUNT(*) as c FROM lulu_catalog WHERE (plot IS NULL OR plot = \\'\\') AND (poster IS NULL OR poster = \\'\\')').get();
  console.log('\\nسجلات بدون poster و plot:', empty?.c);

  // 4. اختبار INSERT بيانات
  const schema = await db.prepare(\"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'lulu_catalog' ORDER BY ordinal_position\").all().catch(() => null);
  if (schema) {
    console.log('\\nأعمدة جدول lulu_catalog:', schema.map(c => c.column_name).join(', '));
  }
}
check().catch(e => console.error('ERROR:', e.message, e.stack));
"`))
.then(r => { console.log(r.stdout); if(r.stderr) console.error('STDERR:', r.stderr.slice(0,500)); ssh.dispose(); })
.catch(e => { console.error(e.message); ssh.dispose(); });
