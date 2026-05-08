const db = require('./db');
db.init().then(async () => {
  try {
    const c = await db.prepare('SELECT COUNT(*) as c FROM lulu_catalog').get();
    console.log('lulu_catalog:', c.c);
    const r1 = await db.query('SELECT COUNT(*) as c FROM lulu_episodes');
    console.log('lulu_episodes:', r1.rows[0].c);
    const f = await db.prepare('SELECT COUNT(*) as c FROM lulu_uploaded_files').get();
    console.log('lulu_uploaded_files:', f.c);
    const s = await db.prepare('SELECT vod_type, canplay, COUNT(*) as c FROM lulu_catalog GROUP BY vod_type, canplay').all();
    console.log('catalog by type:', JSON.stringify(s));
    const r2 = await db.query('SELECT canplay, COUNT(*) as c FROM lulu_episodes GROUP BY canplay');
    console.log('episodes by canplay:', JSON.stringify(r2.rows));
    const sample = await db.prepare("SELECT id, title, vod_type, file_code, canplay FROM lulu_catalog LIMIT 5").all();
    console.log('sample:', JSON.stringify(sample));
  } catch (e) { console.error(e.message); }
  process.exit();
});
