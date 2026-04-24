#!/usr/bin/env node
'use strict';

const { Pool } = require('pg');

const DATABASE_URL = 'postgresql://postgres:ItqaSByVVVKDVlOEPvTNSrqsOVecsIGu@switchback.proxy.rlwy.net:23361/railway';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function check() {
  console.log('\n════════════════════════════════════════════════════');
  console.log('  🔍 التحقق من قاعدة البيانات');
  console.log('════════════════════════════════════════════════════\n');

  try {
    // التحقق من الأفلام
    const movies = await pool.query('SELECT COUNT(*) as count FROM lulu_catalog WHERE vod_type = $1', ['movie']);
    console.log(`  🎬 الأفلام: ${movies.rows[0].count}`);

    // التحقق من المسلسلات
    const series = await pool.query('SELECT COUNT(*) as count FROM lulu_catalog WHERE vod_type = $1', ['series']);
    console.log(`  📺 المسلسلات: ${series.rows[0].count}`);

    // التحقق من الحلقات
    const episodes = await pool.query('SELECT COUNT(*) as count FROM lulu_episodes');
    console.log(`  📋 الحلقات: ${episodes.rows[0].count}`);

    console.log('\n  ─── آخر 5 عناصر مرفوعة ───\n');

    // عرض آخر 5 عناصر
    const latest = await pool.query(`
      SELECT id, title, vod_type, uploaded_at 
      FROM lulu_catalog 
      ORDER BY uploaded_at DESC 
      LIMIT 5
    `);

    latest.rows.forEach((row, i) => {
      const type = row.vod_type === 'movie' ? '🎬' : '📺';
      const date = row.uploaded_at ? new Date(Number(row.uploaded_at)).toLocaleString('ar') : 'غير محدد';
      console.log(`  ${i + 1}. ${type} ${row.title}`);
      console.log(`     ID: ${row.id}`);
      console.log(`     تاريخ: ${date}\n`);
    });

    // إذا كان هناك مسلسلات، عرض حلقاتها
    if (series.rows[0].count > 0) {
      console.log('  ─── حلقات المسلسلات ───\n');
      const seriesWithEpisodes = await pool.query(`
        SELECT c.id, c.title, COUNT(e.id) as episode_count
        FROM lulu_catalog c
        LEFT JOIN lulu_episodes e ON c.id = e.catalog_id
        WHERE c.vod_type = 'series'
        GROUP BY c.id, c.title
        ORDER BY c.uploaded_at DESC
        LIMIT 5
      `);

      seriesWithEpisodes.rows.forEach((row, i) => {
        console.log(`  ${i + 1}. 📺 ${row.title}`);
        console.log(`     ID: ${row.id}`);
        console.log(`     الحلقات: ${row.episode_count}\n`);
      });
    }

  } catch (err) {
    console.error('  ❌ خطأ:', err.message);
    process.exit(1);
  }

  console.log('════════════════════════════════════════════════════\n');
  await pool.end();
}

check();
