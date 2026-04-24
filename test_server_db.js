#!/usr/bin/env node
'use strict';

// نفس إعدادات السيرفر السحابي
const { Pool } = require('pg');

// جرب DATABASE_URL من متغيرات البيئة أو القيمة الافتراضية
const DATABASE_URL = process.env.DATABASE_URL || 
  'postgresql://postgres:ItqaSByVVVKDVlOEPvTNSrqsOVecsIGu@switchback.proxy.rlwy.net:23361/railway';

console.log('\n════════════════════════════════════════════════════');
console.log('  🔍 اختبار قاعدة البيانات (إعدادات السيرفر)');
console.log('════════════════════════════════════════════════════\n');

console.log('DATABASE_URL:', DATABASE_URL.replace(/:[^:@]+@/, ':****@'));

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function test() {
  try {
    // اختبار الاتصال
    console.log('\n  ⏳ جاري الاتصال...');
    await pool.query('SELECT NOW()');
    console.log('  ✅ الاتصال ناجح!\n');

    // التحقق من وجود الجدول
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'lulu_catalog'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('  ❌ الجدول lulu_catalog غير موجود!');
      console.log('  💡 قم بتشغيل: node lulu-uploader/src/db.js لإنشاء الجداول\n');
      process.exit(1);
    }
    
    console.log('  ✅ الجدول lulu_catalog موجود\n');

    // عد السجلات
    const { rows } = await pool.query('SELECT * FROM lulu_catalog ORDER BY uploaded_at DESC');
    
    console.log(`  📊 عدد السجلات: ${rows.length}\n`);

    if (rows.length === 0) {
      console.log('  ⚠️  الجدول فارغ! لا يوجد محتوى مرفوع.\n');
    } else {
      console.log('  ─── آخر 5 عناصر ───\n');
      rows.slice(0, 5).forEach((row, i) => {
        const type = row.vod_type === 'movie' ? '🎬' : '📺';
        console.log(`  ${i + 1}. ${type} ${row.title}`);
        console.log(`     ID: ${row.id}`);
        console.log(`     Type: ${row.vod_type}`);
        console.log(`     File Code: ${row.file_code || 'N/A'}\n`);
      });
    }

    // اختبار دالة التحويل (نفس السيرفر)
    console.log('  ─── اختبار دالة _rowToCatalogItem ───\n');
    
    function _rowToCatalogItem(row) {
      return {
        id:           String(row.id),
        title:        row.title || '',
        vod_type:     row.vod_type,
        poster:       row.poster || '',
        backdrop:     row.backdrop || '',
        plot:         row.plot || '',
        year:         row.year || '',
        rating:       row.rating || '',
        genres:       row.genres ? row.genres.split(',').map(g => g.trim()) : [],
        genre:        row.genres || '',
        cast:         row.cast_list || '',
        director:     row.director || '',
        country:      row.country || '',
        runtime:      row.runtime || '',
        tmdb_id:      row.tmdb_id || null,
        tmdb_type:    row.tmdb_type || (row.vod_type === 'movie' ? 'movie' : 'tv'),
        imdb_id:      row.imdb_id || '',
        file_code:    row.file_code || '',
        embedUrl:     row.embed_url || (row.file_code ? `https://luluvdo.com/e/${row.file_code}` : ''),
        hlsUrl:       row.hls_url  || (row.file_code ? `https://luluvdo.com/hls/${row.file_code}/master.m3u8` : ''),
        canplay:      !!row.canplay,
        episodeCount: row.episode_count || 0,
        lulu_fld_id:  row.lulu_fld_id || 0,
        ts:           Number(row.uploaded_at) || 0,
        uploadedAt:   row.uploaded_at ? new Date(Number(row.uploaded_at)).toISOString() : null,
      };
    }

    const catalog = rows.map(_rowToCatalogItem);
    console.log(`  ✅ تم تحويل ${catalog.length} عنصر بنجاح\n`);

    if (catalog.length > 0) {
      console.log('  مثال على عنصر محول:\n');
      console.log(JSON.stringify(catalog[0], null, 2));
    }

  } catch (err) {
    console.error('\n  ❌ خطأ:', err.message);
    console.error('  التفاصيل:', err.stack);
    process.exit(1);
  }

  console.log('\n════════════════════════════════════════════════════\n');
  await pool.end();
}

test();
