const db = require('./backend-api/db');

async function checkLuluTables() {
  try {
    console.log('🔍 Checking lulu_catalog table...');
    const catalogCount = await db.pool.query('SELECT COUNT(*) as count FROM lulu_catalog');
    console.log('✅ lulu_catalog rows:', catalogCount.rows[0].count);

    console.log('\n🔍 Checking lulu_episodes table...');
    const episodesCount = await db.pool.query('SELECT COUNT(*) as count FROM lulu_episodes');
    console.log('✅ lulu_episodes rows:', episodesCount.rows[0].count);

    console.log('\n🔍 Sample data from lulu_catalog...');
    const sample = await db.pool.query('SELECT id, title, vod_type, canplay, embed_url FROM lulu_catalog LIMIT 5');
    console.log('Sample rows:', sample.rows);

    console.log('\n🔍 Checking playable content...');
    const playable = await db.pool.query(
      `SELECT COUNT(*) as count FROM lulu_catalog 
       WHERE canplay = true OR (embed_url IS NOT NULL AND embed_url != '')`
    );
    console.log('✅ Playable content:', playable.rows[0].count);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await db.pool.end();
  }
}

checkLuluTables();
