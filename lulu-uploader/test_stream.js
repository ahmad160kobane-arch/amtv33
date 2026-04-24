'use strict';
// اختبار الرفع عبر pipe لملف واحد محدد
const lulu = require('./src/lulu-api');

const TEST_URL = 'http://proxpanel.cc/movie/8490652101/3172325197/646386.mkv'; // Cairo Station ~1.2GB

async function main() {
  console.log('الحصول على خادم الرفع...');
  const server = await lulu.getUploadServer();
  console.log('خادم الرفع:', server);

  console.log('\nبدء الرفع عبر pipe (بدون حفظ على القرص)...');
  console.log('الملف: Cairo Station - 1958\n');

  const start = Date.now();
  const file  = await lulu.streamUpload(TEST_URL, 'Cairo_Station_1958.mkv', {
    fileTitle:  'محطة القاهرة - 1958',
    tags:       'مصري, كلاسيكي',
    filePublic: 1,
  });

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n✅ تم الرفع في ${elapsed} ثانية`);
  console.log('الكود:', file.filecode);
  console.log('الرابط: https://lulustream.com/' + file.filecode + '.html');
}

main().catch(e => {
  console.error('\n❌ فشل:', e.message);
  if (process.env.DEBUG) console.error(e.stack);
});
