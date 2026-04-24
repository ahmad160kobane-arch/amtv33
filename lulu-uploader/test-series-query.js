#!/usr/bin/env node
'use strict';

/**
 * test-series-query.js — اختبار الاستعلامات على المسلسلات
 * 
 * الاستخدام:
 *   node test-series-query.js <series_id>
 *   node test-series-query.js <series_id> <season>
 *   node test-series-query.js <series_id> <season> <episode>
 */

const db = require('./src/db');

async function main() {
  const [seriesId, season, episode] = process.argv.slice(2);

  if (!seriesId) {
    console.log('الاستخدام:');
    console.log('  node test-series-query.js <series_id>              — جميع حلقات المسلسل');
    console.log('  node test-series-query.js <series_id> <season>    — حلقات موسم محدد');
    console.log('  node test-series-query.js <series_id> <season> <episode> — حلقة محددة');
    process.exit(1);
  }

  try {
    await db.ensureTables();

    if (episode) {
      // ─── حلقة محددة ───
      console.log(`\n🔍 البحث عن: المسلسل ${seriesId} - الموسم ${season} - الحلقة ${episode}\n`);
      const ep = await db.getEpisode(seriesId, Number(season), Number(episode));
      
      if (ep) {
        console.log('✅ تم العثور على الحلقة:');
        console.log(`   العنوان    : ${ep.title}`);
        console.log(`   File Code  : ${ep.file_code}`);
        console.log(`   Embed URL  : ${ep.embed_url}`);
        console.log(`   HLS URL    : ${ep.hls_url}`);
        console.log(`   جاهز للتشغيل: ${ep.canplay ? 'نعم' : 'لا'}`);
        console.log(`   تاريخ الرفع : ${new Date(ep.created_at).toLocaleString('ar')}`);
      } else {
        console.log('❌ لم يتم العثور على الحلقة');
      }

    } else if (season) {
      // ─── حلقات موسم محدد ───
      console.log(`\n🔍 البحث عن حلقات: المسلسل ${seriesId} - الموسم ${season}\n`);
      const episodes = await db.getSeasonEpisodes(seriesId, Number(season));
      
      if (episodes.length > 0) {
        console.log(`✅ تم العثور على ${episodes.length} حلقة:\n`);
        episodes.forEach(ep => {
          console.log(`   [ح${ep.episode}] ${ep.title}`);
          console.log(`        File Code: ${ep.file_code}`);
          console.log(`        URL: ${ep.embed_url}`);
          console.log(`        جاهز: ${ep.canplay ? '✓' : '✗'}`);
          console.log('');
        });
      } else {
        console.log('❌ لم يتم العثور على حلقات لهذا الموسم');
      }

    } else {
      // ─── جميع حلقات المسلسل ───
      console.log(`\n🔍 البحث عن المسلسل: ${seriesId}\n`);
      
      // معلومات المسلسل
      const series = await db.getSeriesInfo(seriesId);
      if (!series) {
        console.log('❌ لم يتم العثور على المسلسل');
        process.exit(1);
      }

      console.log('📺 معلومات المسلسل:');
      console.log(`   العنوان     : ${series.title}`);
      console.log(`   السنة       : ${series.year}`);
      console.log(`   التصنيف     : ${series.genres}`);
      console.log(`   عدد الحلقات : ${series.episode_count}`);
      console.log(`   TMDB ID     : ${series.tmdb_id || 'غير متوفر'}`);
      console.log(`   Folder ID   : ${series.lulu_fld_id}`);

      // المواسم
      const seasons = await db.getSeriesSeasons(seriesId);
      console.log(`\n📊 المواسم (${seasons.length}):`);
      seasons.forEach(s => {
        console.log(`   الموسم ${s.season}: ${s.episode_count} حلقة`);
      });

      // جميع الحلقات
      const episodes = await db.getSeriesEpisodes(seriesId);
      console.log(`\n📋 جميع الحلقات (${episodes.length}):\n`);
      
      let currentSeason = null;
      episodes.forEach(ep => {
        if (ep.season !== currentSeason) {
          currentSeason = ep.season;
          console.log(`\n   ═══ الموسم ${ep.season} ═══`);
        }
        console.log(`   [ح${String(ep.episode).padStart(2, '0')}] ${ep.title}`);
        console.log(`        File: ${ep.file_code} | جاهز: ${ep.canplay ? '✓' : '✗'}`);
      });
    }

    console.log('\n');
    await db.close();

  } catch (err) {
    console.error(`\n❌ خطأ: ${err.message}\n`);
    if (process.env.DEBUG) console.error(err.stack);
    process.exit(1);
  }
}

main();
