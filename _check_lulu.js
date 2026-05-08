const db = require('./db');
db.init().then(async () => {
  try {
    const total = await db.prepare('SELECT COUNT(*) as c FROM lulu_uploaded_files').get();
    console.log('uploaded_files total:', JSON.stringify(total));
    
    const byStatus = await db.prepare('SELECT status, COUNT(*) as c FROM lulu_uploaded_files GROUP BY status').all();
    console.log('by_status:', JSON.stringify(byStatus));
    
    const accounts = await db.prepare('SELECT COUNT(*) as c FROM lulu_upload_accounts').get();
    console.log('accounts:', JSON.stringify(accounts));
    
    const jobs = await db.prepare('SELECT COUNT(*) as c FROM lulu_upload_jobs').get();
    console.log('jobs:', JSON.stringify(jobs));
    
    const sample = await db.prepare('SELECT file_code, title, status, type FROM lulu_uploaded_files LIMIT 5').all();
    console.log('sample files:', JSON.stringify(sample));
    
    const vodCount = await db.prepare("SELECT COUNT(*) as c FROM vod").get();
    console.log('vod count:', JSON.stringify(vodCount));
    
    const epCount = await db.prepare("SELECT COUNT(*) as c FROM episodes").get();
    console.log('episodes count:', JSON.stringify(epCount));
    
    const iptvAcc = await db.prepare("SELECT id, name, server_url, status FROM iptv_accounts LIMIT 5").all();
    console.log('iptv accounts:', JSON.stringify(iptvAcc));
  } catch (e) {
    console.error('Error:', e.message);
  }
  process.exit();
}).catch(e => { console.error('Init error:', e.message); process.exit(); });
