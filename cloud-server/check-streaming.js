const db = require('./db');
(async () => {
  await db.init();
  const rows = await db.prepare('SELECT id,name,is_streaming,account_id,stream_id FROM xtream_channels ORDER BY id LIMIT 20').all();
  console.log('Channels:', JSON.stringify(rows, null, 2));
  const c = await db.prepare('SELECT COUNT(*) as c FROM xtream_channels WHERE is_streaming = true').get();
  console.log('Streaming count:', c);
  const total = await db.prepare('SELECT COUNT(*) as c FROM xtream_channels').get();
  console.log('Total channels:', total);
  const accts = await db.prepare('SELECT * FROM iptv_accounts').all();
  console.log('Accounts:', JSON.stringify(accts, null, 2));
  const streaming = await db.prepare('SELECT * FROM xtream_channels WHERE is_streaming = true').all();
  console.log('Streaming channels:', JSON.stringify(streaming, null, 2));
  const errors = await db.prepare('SELECT * FROM stream_errors ORDER BY created_at DESC LIMIT 10').all();
  console.log('Recent errors:', JSON.stringify(errors, null, 2));
  process.exit(0);
})();
