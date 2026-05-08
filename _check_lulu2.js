const db = require('./db');
db.init().then(async () => {
  try {
    // Check iptv_accounts columns and data
    const iptvCols = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'iptv_accounts' ORDER BY ordinal_position");
    console.log('iptv_accounts columns:', JSON.stringify(iptvCols.rows));
    
    const iptvAll = await db.prepare('SELECT * FROM iptv_accounts').all();
    console.log('iptv_accounts all:', JSON.stringify(iptvAll));
    
    // Check lulu_uploaded_files - full count and sample
    const total = await db.prepare('SELECT COUNT(*) as c FROM lulu_uploaded_files').get();
    console.log('uploaded_files total:', total.c);
    
    const byType = await db.prepare('SELECT type, COUNT(*) as c FROM lulu_uploaded_files GROUP BY type').all();
    console.log('by type:', JSON.stringify(byType));
    
    // Check lulu_upload_jobs
    const jobs = await db.prepare('SELECT id, status, type, total, done, failed, cat_name FROM lulu_upload_jobs ORDER BY id').all();
    console.log('jobs:', JSON.stringify(jobs));
    
    // Check if there's a different DB with more data
    const luluAcc = await db.prepare('SELECT * FROM lulu_upload_accounts').all();
    console.log('lulu accounts:', JSON.stringify(luluAcc));
    
    // Check vod table columns
    const vodCols = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'vod' ORDER BY ordinal_position");
    console.log('vod columns:', JSON.stringify(vodCols.rows.map(r=>r.column_name)));
    
    // Check episodes table
    const epCols = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'episodes' ORDER BY ordinal_position");
    console.log('episodes columns:', JSON.stringify(epCols.rows.map(r=>r.column_name)));
    
  } catch (e) {
    console.error('Error:', e.message);
  }
  process.exit();
}).catch(e => { console.error('Init error:', e.message); process.exit(); });
