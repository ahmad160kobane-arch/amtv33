const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:ItqaSByVVVKDVlOEPvTNSrqsOVecsIGu@switchback.proxy.rlwy.net:23361/railway',
  ssl: { rejectUnauthorized: false }
});

(async () => {
  try {
    const iptv = await pool.query('SELECT id, server_url, username, password FROM iptv_accounts WHERE id=16');
    console.log('IPTV 16:', JSON.stringify(iptv.rows[0]));

    const vod = await pool.query('SELECT xtream_id, container_ext, title FROM vod LIMIT 3');
    console.log('VOD rows:', JSON.stringify(vod.rows));

    if (iptv.rows.length && vod.rows.length) {
      const r = iptv.rows[0];
      const m = vod.rows[0];
      const u = new URL(r.server_url);
      const base = `${u.protocol}//${u.hostname}:${u.port || 8080}`;
      const ext = m.container_ext || 'mp4';
      const url = `${base}/movie/${r.username}/${r.password}/${m.xtream_id}.${ext}`;
      console.log('\nTest URL:', url);
    }
  } catch(e) {
    console.log('Error:', e.message);
  } finally {
    await pool.end();
  }
})();
