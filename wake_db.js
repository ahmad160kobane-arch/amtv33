// Repeatedly try connecting to wake up sleeping Railway PostgreSQL
const { Client } = require('pg');
const url = process.env.DATABASE_URL;

async function tryOnce(attempt) {
  const c = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
  try {
    await c.connect();
    const r = await c.query('SELECT 1 as ok');
    console.log(`[OK] Attempt ${attempt}:`, JSON.stringify(r.rows));
    await c.end();
    return true;
  } catch (e) {
    console.error(`[FAIL] Attempt ${attempt}: ${e.code} ${e.message}`);
    try { await c.end(); } catch (_) {}
    return false;
  }
}

(async () => {
  for (let i = 1; i <= 20; i++) {
    const ok = await tryOnce(i);
    if (ok) { console.log('DB is awake!'); process.exit(0); }
    if (i < 20) await new Promise(r => setTimeout(r, 3000));
  }
  console.log('Could not wake DB after 20 attempts');
  process.exit(1);
})();
