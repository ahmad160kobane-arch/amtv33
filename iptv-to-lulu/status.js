/**
 * عرض حالة التزامن مع LuluStream
 */
'use strict';

const fs = require('fs');
const PROGRESS = process.env.PROGRESS || '/root/lulu_progress.json';

let p;
try { p = JSON.parse(fs.readFileSync(PROGRESS, 'utf8')); }
catch { console.log('لا يوجد ملف تقدم بعد.'); process.exit(0); }

const uploaded = Object.values(p.uploaded || {});
const failed   = Object.entries(p.failed   || {});

const movies  = uploaded.filter(x => x.fileCode && !x.show);
const series  = uploaded.filter(x => x.show);
const failedN = failed.filter(([,v]) => v >= 3).length;

console.log('\n══════════════════════════════════════');
console.log('  حالة IPTV → LuluStream Sync');
console.log('══════════════════════════════════════');
console.log(`  ✅ أفلام مرفوعة   : ${movies.length}`);
console.log(`  ✅ حلقات مرفوعة  : ${series.length}`);
console.log(`  ✗  فشل نهائي     : ${failedN}`);
console.log(`  📁 إجمالي مكتمل  : ${uploaded.length}`);

if (uploaded.length > 0) {
  const last = uploaded.sort((a,b) => (b.ts||0)-(a.ts||0))[0];
  const d = new Date(last.ts);
  console.log(`\n  آخر ملف مرفوع: ${last.title}`);
  console.log(`  الوقت: ${d.toLocaleString('ar')}`);
}

console.log('\n══════════════════════════════════════\n');
