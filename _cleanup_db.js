const { NodeSSH } = require('node-ssh');

const VPS_HOST = '62.171.153.204';
const VPS_USER = 'root';
const VPS_PASS = 'Mustafa7';

async function cleanup() {
  const ssh = new NodeSSH();
  await ssh.connect({ host: VPS_HOST, username: VPS_USER, password: VPS_PASS, readyTimeout: 15000 });
  
  console.log('=== تنظيف lulu_catalog: حذف canplay=false بدون hls_url ===');
  const result = await ssh.execCommand(`cd /root/ma-streaming && node -e "
    const db = require('./cloud-server/db');
    db.init().then(async () => {
      // 1. عد العناصر المكسورة
      const broken = await db.prepare('SELECT COUNT(*) as c FROM lulu_catalog WHERE canplay = false AND (hls_url IS NULL OR hls_url = \\'\\')').get();
      console.log('عناصر مكسورة سيتم حذفها:', broken.c);
      
      // 2. اعرض عينة قبل الحذف
      const sample = await db.prepare('SELECT id, title, file_code FROM lulu_catalog WHERE canplay = false AND (hls_url IS NULL OR hls_url = \\'\\')  LIMIT 5').all();
      sample.forEach(r => console.log('  DELETE:', r.id, '-', r.title));
      
      // 3. احذف الحلقات المتعلقة بالمسلسلات المكسورة
      const delEps = await db.prepare('DELETE FROM lulu_episodes WHERE catalog_id IN (SELECT id FROM lulu_catalog WHERE canplay = false AND (hls_url IS NULL OR hls_url = \\'\\'))').run();
      console.log('حلقات محذوفة:', delEps.changes || delEps.rowsAffected || 0);
      
      // 4. احذف العناصر المكسورة
      const delCats = await db.prepare('DELETE FROM lulu_catalog WHERE canplay = false AND (hls_url IS NULL OR hls_url = \\'\\')').run();
      console.log('كاتالوج محذوف:', delCats.changes || delCats.rowsAffected || 0);
      
      // 5. إحصائيات بعد الحذف
      const total = await db.prepare('SELECT COUNT(*) as c FROM lulu_catalog').get();
      const canplayTrue = await db.prepare('SELECT COUNT(*) as c FROM lulu_catalog WHERE canplay = true').get();
      const canplayFalse = await db.prepare('SELECT COUNT(*) as c FROM lulu_catalog WHERE canplay = false').get();
      console.log('\\nبعد التنظيف:');
      console.log('Total:', total.c);
      console.log('canplay=true:', canplayTrue.c);
      console.log('canplay=false:', canplayFalse.c);
      
      process.exit(0);
    }).catch(e => { console.error(e.message); process.exit(1); });
  " 2>&1`);
  console.log(result.stdout);
  if (result.stderr && !result.stderr.includes('Migration')) console.log('ERR:', result.stderr.slice(-500));
  
  ssh.dispose();
}

cleanup().catch(e => console.error('Error:', e.message));
