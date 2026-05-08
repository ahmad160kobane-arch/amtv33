const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
async function main() {
  await client.connect();
  
  // Check current accounts
  const res = await client.query('SELECT id, name, server_url, username, password, status FROM iptv_accounts');
  console.log('Current IPTV accounts:');
  for (const r of res.rows) console.log(`  id=${r.id} name="${r.name}" url=${r.server_url} user=${r.username} pass=${r.password} status=${r.status}`);
  
  // Update with new credentials
  const newCreds = {
    server_url: 'http://myhand.org:8080',
    username: '95283542873',
    password: '34648347188',
  };
  
  if (res.rows.length > 0) {
    const id = res.rows[0].id;
    await client.query('UPDATE iptv_accounts SET server_url = $1, username = $2, password = $3, status = $4 WHERE id = $5',
      [newCreds.server_url, newCreds.username, newCreds.password, 'active', id]);
    console.log(`\nUpdated account id=${id} with new credentials`);
  } else {
    await client.query('INSERT INTO iptv_accounts (name, server_url, username, password, status) VALUES ($1, $2, $3, $4, $5)',
      ['تحميل محتوى وليس للبث', newCreds.server_url, newCreds.username, newCreds.password, 'active']);
    console.log('\nInserted new IPTV account');
  }
  
  // Verify
  const res2 = await client.query('SELECT id, name, server_url, username, password, status FROM iptv_accounts');
  console.log('\nAfter update:');
  for (const r of res2.rows) console.log(`  id=${r.id} name="${r.name}" url=${r.server_url} user=${r.username} pass=${r.password} status=${r.status}`);
  
  await client.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
