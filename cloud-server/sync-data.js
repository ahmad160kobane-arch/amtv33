/**
 * مزامنة القنوات والأفلام من Xtream
 * يملأ قاعدة البيانات بالمحتوى
 */
const db = require('./db');
const { syncXtreamChannels } = require('./lib/xtream');
const xtreamVod = require('./lib/xtream-vod');

async function syncAll() {
  console.log('🔄 بدء مزامنة المحتوى...\n');
  
  try {
    // 1. تهيئة قاعدة البيانات
    console.log('[1/3] تهيئة قاعدة البيانات...');
    await db.init();
    console.log('✓ قاعدة البيانات جاهزة\n');

    // 2. مزامنة القنوات المباشرة
    console.log('[2/3] مزامنة القنوات المباشرة...');
    const channelsResult = await syncXtreamChannels(db);
    console.log(`✓ تم حفظ ${channelsResult.saved} قناة من أصل ${channelsResult.total}\n`);

    // 3. فحص الأفلام والمسلسلات
    console.log('[3/3] فحص الأفلام والمسلسلات...');
    try {
      const vodCategories = await xtreamVod.getVodCategories();
      console.log(`✓ ${vodCategories.length} فئة أفلام متاحة`);
      
      const seriesCategories = await xtreamVod.getSeriesCategories();
      console.log(`✓ ${seriesCategories.length} فئة مسلسلات متاحة\n`);
    } catch (e) {
      console.log(`⚠ تحذير: ${e.message}\n`);
    }

    console.log('═══════════════════════════════════════');
    console.log('✅ اكتملت المزامنة بنجاح!');
    console.log('═══════════════════════════════════════');
    console.log(`📺 القنوات: ${channelsResult.saved} قناة`);
    console.log(`🎬 الأفلام: متاحة عبر API`);
    console.log(`📺 المسلسلات: متاحة عبر API`);
    console.log('═══════════════════════════════════════\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ خطأ في المزامنة:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

syncAll();
