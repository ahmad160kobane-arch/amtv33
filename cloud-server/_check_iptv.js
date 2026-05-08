const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL || 'postgresql://amtv:amtv2024@localhost:5432/amtv' });
async function main() {
  await client.connect();
  const res = await client.query('SELECT id, name, server_url, username, password, status FROM iptv_accounts');
  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
