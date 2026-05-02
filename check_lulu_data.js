/**
 * فحص بيانات Lulu في قاعدة البيانات PostgreSQL
 */

const db = require('./backend-api/db');

async function checkLuluData() {
  try {
    console.log('🔍 فحص بيانات Lulu في PostgreSQL...\n');

    // فحص عدد الأفلام
    const moviesCount = await db.pool.query(
      `SELECT COUNT(*) as count FROM lulu_catalog WHERE vod_type = 'movie'`
    );
    console.log(`📊 عدد الأفلام: ${moviesCount.rows[0].count}`);

    // فحص عدد المسلسلات
    const seriesCount = await db.pool.query(
      `SELECT COUNT(*) as count FROM lulu_catalog WHERE vod_type = 'series'`
    );
    console.log(`📊 عدد المسلسلات: ${seriesCount.rows[0].count}`);

    // فحص عدد الحلقات
    const episodesCount = await db.pool.query(
      `SELECT COUNT(*) as count FROM lulu_episodes`
    );
    console.log(`📊 عدد الحلقات: ${episodesCount.rows[0].count}`);

    // فحص المحتوى القابل للتشغيل
    const playableCount = await db.pool.query(
      `SELECT COUNT(*) as count FROM lulu_catalog 
       WHERE canplay = true OR (embed_url IS NOT NULL AND embed_url != '')`
    );
    console.log(`✅ المحتوى القابل للتشغيل: ${playableCount.rows[0].count}`);

    // عينة من الأفلام
    console.log('\n🎬 عينة من الأفلام:');
    const moviesSample = await db.pool.query(
      `SELECT id, title, year, canplay FROM lulu_catalog 
       WHERE vod_type = 'movie' 
       ORDER BY uploaded_at DESC NULLS LAST LIMIT 5`
    );
    moviesSample.rows.forEach((m, i) => {
      console.log(`   ${i + 1}. ${m.title} (${m.year || 'N/A'}) - canplay: ${m.canplay}`);
    });

    // عينة من المسلسلات
    console.log('\n📺 عينة من المسلسلات:');
    const seriesSample = await db.pool.query(
      `SELECT id, title, year, episode_count, canplay FROM lulu_catalog 
       WHERE vod_type = 'series' 
       ORDER BY uploaded_at DESC NULLS LAST LIMIT 5`
    );
    seriesSample.rows.forEach((s, i) => {
      console.log(`   ${i + 1}. ${s.title} (${s.year || 'N/A'}) - ${s.episode_count || 0} حلقة - canplay: ${s.canplay}`);
    });

    console.log('\n✅ البيانات موجودة في قاعدة البيانات!');

  } catch (error) {
    console.error('❌ خطأ:', error.message);
    console.error(error.stack);
  } finally {
    await db.pool.end();
  }
}

checkLuluData();
