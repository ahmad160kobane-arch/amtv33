const { Client } = require('pg');
const db = new Client({ connectionString: 'postgresql://postgres:ItqaSByVVVKDVlOEPvTNSrqsOVecsIGu@switchback.proxy.rlwy.net:23361/railway' });
db.connect().then(async () => {
  const r = await db.query(`SELECT status, COUNT(*) as cnt FROM lulu_upload_jobs GROUP BY status ORDER BY status`);
  console.log('=== lulu_upload_jobs status ===');
  r.rows.forEach(row => console.log('  ' + row.status + ': ' + row.cnt));

  const r2 = await db.query(`SELECT id, job_uuid, status, cat_name, failed, done, total FROM lulu_upload_jobs WHERE status='failed' ORDER BY id DESC LIMIT 10`);
  console.log('\n=== آخر 10 فاشلة ===');
  if (r2.rows.length === 0) console.log('  لا يوجد');
  r2.rows.forEach(r => console.log('  #' + r.id, '| cat:', r.cat_name, '| done/total:', r.done+'/'+r.total));

  const r3 = await db.query(`SELECT id, job_uuid, status, cat_name, done, total, started_at FROM lulu_upload_jobs WHERE status='running' ORDER BY id DESC LIMIT 10`);
  console.log('\n=== running الآن ===');
  if (r3.rows.length === 0) console.log('  لا يوجد');
  r3.rows.forEach(r => console.log('  #' + r.id, '| cat:', r.cat_name, '| done/total:', r.done+'/'+r.total, '| started:', r.started_at));

  const r4 = await db.query(`SELECT id, job_uuid, cat_name, done, total, finished_at FROM lulu_upload_jobs WHERE status='done' ORDER BY id DESC LIMIT 5`);
  console.log('\n=== آخر 5 مكتملة ===');
  r4.rows.forEach(r => console.log('  #' + r.id, '| cat:', r.cat_name, '| done/total:', r.done+'/'+r.total));

  await db.end();
}).catch(e => { console.error('DB error:', e.message); process.exit(1); });
