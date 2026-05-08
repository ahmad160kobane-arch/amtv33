const {Pool} = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres:ItqaSByVVVKDVlOEPvTNSrqsOVecsIGu@switchback.proxy.rlwy.net:23361/railway'
});

async function main() {
  const count = await pool.query('SELECT COUNT(*) FROM xtream_channels');
  console.log('xtream_channels count:', count.rows[0].count);
  
  const rows = await pool.query('SELECT id, stream_id, name FROM xtream_channels LIMIT 10');
  console.log('rows:', JSON.stringify(rows.rows, null, 2));
  
  await pool.end();
}
main().catch(console.error);
