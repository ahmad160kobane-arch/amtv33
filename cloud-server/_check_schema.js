const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL || 'postgresql://amtv:amtv2024@localhost:5432/amtv' });
async function main() {
  await client.connect();
  const res = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'lulu_upload_jobs' ORDER BY ordinal_position");
  console.log('lulu_upload_jobs columns:');
  for (const r of res.rows) console.log(`  ${r.column_name} (${r.data_type})`);
  await client.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
