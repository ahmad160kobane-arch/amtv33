#!/usr/bin/env node
'use strict';

/**
 * iptv.js — CLI للرفع من IPTV إلى LuluStream
 *
 * الأوامر:
 *   node iptv.js                          رفع محتوى الأطفال، مسلسلات وأفلام عربية (حد 20 لكل تشغيل)
 *   node iptv.js --mode kids              محتوى الأطفال فقط
 *   node iptv.js --mode movies            أفلام فقط
 *   node iptv.js --mode series            مسلسلات فقط
 *   node iptv.js --limit 50               رفع حتى 50 عنصر
 *   node iptv.js --dry                    اختبار بدون رفع فعلي
 *   node iptv.js --category "مترجم"       تصنيف محدد فقط
 *   node iptv.js account                  معلومات حساب IPTV
 *   node iptv.js categories               عرض التصنيفات العربية المتاحة
 */

const xtream = require('./src/xtream-api');
const { run } = require('./src/iptv-to-lulu');

function parseArgs(argv) {
  const out = {
    command:        null,
    mode:           'all',
    limit:          20,
    dryRun:         false,
    categoryFilter: null,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === 'account' || a === 'categories') { out.command = a; }
    else if (a === '--mode'     && argv[i + 1]) { out.mode           = argv[++i]; }
    else if (a === '--limit'    && argv[i + 1]) { out.limit          = Number(argv[++i]); }
    else if (a === '--category' && argv[i + 1]) { out.categoryFilter = argv[++i]; }
    else if (a === '--dry')                      { out.dryRun         = true; }
  }
  return out;
}

async function cmdAccount() {
  console.log('\nجلب معلومات حساب IPTV...');
  const data = await xtream.getAccountInfo();
  const ui   = data.user_info || data;
  const si   = data.server_info || {};

  console.log('\n=== حساب IPTV ===');
  console.log(`المستخدم       : ${ui.username}`);
  console.log(`الحالة         : ${ui.status}`);
  if (ui.exp_date)
    console.log(`انتهاء الاشتراك: ${new Date(ui.exp_date * 1000).toLocaleDateString('ar')}`);
  console.log(`الاتصالات      : ${ui.active_cons || 0} فعّال / ${ui.max_connections || '?'} حد`);
  if (si.url) console.log(`الخادم         : ${si.url}`);
  console.log();
}

async function cmdCategories() {
  console.log('\nجلب التصنيفات العربية...');

  const [vod, series] = await Promise.all([
    xtream.getVodCategories().catch(() => []),
    xtream.getSeriesCategories().catch(() => []),
  ]);

  const arabicVod    = vod.filter(c => xtream.isArabicCategory(c.category_name));
  const arabicSeries = series.filter(c => xtream.isArabicCategory(c.category_name));

  console.log(`\n── أفلام (${arabicVod.length} تصنيف عربي) ──`);
  arabicVod.forEach(c => console.log(`  [${c.category_id}] ${c.category_name}`));

  console.log(`\n── مسلسلات (${arabicSeries.length} تصنيف عربي) ──`);
  arabicSeries.forEach(c => console.log(`  [${c.category_id}] ${c.category_name}`));
  console.log();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  try {
    if (args.command === 'account') {
      await cmdAccount();
    } else if (args.command === 'categories') {
      await cmdCategories();
    } else {
      console.log(`\n${'═'.repeat(50)}`);
      console.log(`  IPTV → LuluStream`);
      console.log(`  الوضع  : ${args.mode}`);
      console.log(`  الحد   : ${args.limit} عنصر`);
      console.log(`  الاختبار: ${args.dryRun ? 'نعم (بدون رفع)' : 'لا (رفع حقيقي)'}`);
      if (args.categoryFilter)
        console.log(`  التصنيف : ${args.categoryFilter}`);
      console.log(`${'═'.repeat(50)}`);

      await run({
        mode:           args.mode,
        limit:          args.limit,
        dryRun:         args.dryRun,
        categoryFilter: args.categoryFilter,
      });
    }
  } catch (err) {
    console.error(`\nخطأ: ${err.message}\n`);
    if (process.env.DEBUG) console.error(err.stack);
    process.exit(1);
  }
}

main();
