#!/usr/bin/env node
'use strict';

/**
 * list-series.js — عرض جميع المسلسلات في الكتالوج
 */

const db = require('./src/db');
const { Pool } = require('pg');

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://postgres:ItqaSByVVVKDVlOEPvTNSrqsOVecsIGu@switchback.proxy.rlwy.net:23361/railway';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  try {
    await db.ensureTables();

    console.log('\n📺 جميع المسلسلات في الكتالوج:\n');

    const result = await pool.query(`
      SELECT 
        id, title, year, genres, episode_count, 
        tmdb_id, lulu_fld_id, uploaded_at
      FROM lulu_catalog
      WHERE vod_type = 'series'
      ORDER BY uploaded_at DESC
    `);

    if (result.rows.length === 0) {
      console.log('❌ لا توجد مسلسلات في الكتالوج بعد');
      console.log('   قم برفع مسلسلات باستخدام: node iptv.js --mode series --limit 5\n');
      process.exit(0);
    }

    console.log(`✅ تم العثور على ${result.rows.length} مسلسل:\n`);
    console.log('═'.repeat(80));

    result.rows.forEach((series, index) => {
      console.log(`\n${index + 1}. ${series.title} ${series.year ? `(${series.year})` : ''}`);
      console.log(`   ID          : ${series.id}`);
      console.log(`   عدد الحلقات : ${series.episode_count}`);
      console.log(`   التصنيف     : ${series.genres || 'غير محدد'}`);
      console.log(`   TMDB ID     : ${series.tmdb_id || 'غير متوفر'}`);
      console.log(`   Folder ID   : ${series.lulu_fld_id}`);
      console.log(`   تاريخ الرفع : ${new Date(series.uploaded_at).toLocaleString('ar')}`);
      console.log(`   \n   للاستعلام عن الحلقات:`);
      console.log(`   node test-series-query.js ${series.id}`);
    });

    console.log('\n' + '═'.repeat(80));
    console.log('\n💡 نصيحة: استخدم check_series.bat [series_id] لعرض حلقات مسلسل محدد\n');

    await pool.end();
    await db.close();

  } catch (err) {
    console.error(`\n❌ خطأ: ${err.message}\n`);
    if (process.env.DEBUG) console.error(err.stack);
    process.exit(1);
  }
}

main();
