/**
 * fetch_lulu_catalog.js
 * ─────────────────────
 * يجلب جميع الأفلام والمسلسلات من LuluStream
 * يحفظ النتائج في:
 *   - lulu_catalog_full.json  (كامل مع كل التفاصيل)
 *   - lulu_movies.json        (أفلام فقط)
 *   - lulu_series.json        (مسلسلات فقط)
 *   - lulu_catalog.csv        (للفتح في Excel)
 *
 * التشغيل: node fetch_lulu_catalog.js
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

// ─── إعدادات LuluStream ────────────────────────────────────────
const LULU_KEY      = '268476xsqgnehs76lhfq0q';
const LULU_ROOT_FLD = 74466;          // [AR] Arabic Movies — المجلد الجذر
const LULU_API      = 'https://api.lulustream.com/api';

// ─── مسارات الحفظ (يعمل على VPS أو Windows) ──────────────────
const IS_VPS   = process.platform === 'linux';
const VPS_BASE = '/root/ma-streaming/cloud-server/data';
const WIN_BASE = path.join(__dirname, 'lulu_output');
const BASE_DIR = IS_VPS ? VPS_BASE : WIN_BASE;

const OUT_DIR  = BASE_DIR;
const OUT_JSON = path.join(BASE_DIR, 'lulu_catalog.json');       // الملف الذي يقرأه السيرفر مباشرة
const OUT_FULL = path.join(BASE_DIR, 'lulu_catalog_full.json');  // نسخة كاملة مع الحلقات
const OUT_MOV  = path.join(BASE_DIR, 'lulu_movies.json');
const OUT_SER  = path.join(BASE_DIR, 'lulu_series.json');
const OUT_CSV  = path.join(BASE_DIR, 'lulu_catalog.csv');
const OUT_PROG = path.join(BASE_DIR, 'lulu_progress.json');

// ─── Rate Limit Settings ──────────────────────────────────────
const DELAY_BETWEEN_REQUESTS = 1200; // 1.2 ثانية بين كل طلب
const DELAY_ON_RATE_LIMIT    = 70000; // 70 ثانية عند rate limit
const BATCH_SIZE             = 20;    // حفظ كل 20 عنصر

// ─── Helper: HTTP GET → JSON ──────────────────────────────────
function get(url) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
        'Referer': 'https://luluvdo.com/',
        'Origin': 'https://luluvdo.com',
        'Connection': 'keep-alive',
      }
    };
    const req = require('https').request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Parse error for ${url}: ${data.substring(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout: ' + url));
    });
    req.end();
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─── Progress bar in console ──────────────────────────────────
function progressBar(current, total, extra = '') {
  const pct  = Math.floor((current / total) * 40);
  const bar  = '█'.repeat(pct) + '░'.repeat(40 - pct);
  const perc = Math.floor((current / total) * 100);
  process.stdout.write(`\r  [${bar}] ${perc}% (${current}/${total}) ${extra}   `);
}

// ─── تحميل التقدم المحفوظ (عند الاستئناف بعد انقطاع) ─────────
function loadProgress() {
  try {
    if (fs.existsSync(OUT_PROG)) {
      const saved = JSON.parse(fs.readFileSync(OUT_PROG, 'utf8'));
      console.log(`\n  ⟳ استئناف من العنصر ${saved.processedIdx + 1} من أصل ${saved.totalFolders}`);
      return saved;
    }
  } catch {}
  return null;
}

function saveProgress(processedIdx, totalFolders, items, folders) {
  const data = { processedIdx, totalFolders, items, folderIds: folders.map(f => f.fld_id) };
  fs.writeFileSync(OUT_PROG, JSON.stringify(data));
}

// ─── توليد رابط Embed و HLS ───────────────────────────────────
function buildUrls(fileCode) {
  return {
    embedUrl: `https://luluvdo.com/e/${fileCode}`,
    hlsUrl  : `https://luluvdo.com/hls/${fileCode}/master.m3u8`,
    directUrl: `https://luluvdo.com/d/${fileCode}`,
  };
}

// ─── الدالة الرئيسية ──────────────────────────────────────────
async function main() {
  console.log('\n════════════════════════════════════════════════════════');
  console.log('  🎬 LuluStream Catalog Fetcher');
  console.log('════════════════════════════════════════════════════════\n');

  fs.mkdirSync(OUT_DIR, { recursive: true });

  // ── الخطوة 1: جلب قائمة المجلدات ────────────────────────────
  console.log('  📂 جلب قائمة المجلدات من LuluStream...\n');
  let folders = [];
  let page = 1;

  while (true) {
    const url = `${LULU_API}/folder/list?key=${LULU_KEY}&fld_id=${LULU_ROOT_FLD}&page=${page}&per_page=100`;
    try {
      const r = await get(url);
      if (r.status === 403) {
        console.log(`\n  ⚠️  Rate Limited! انتظار 70 ثانية...`);
        await sleep(DELAY_ON_RATE_LIMIT);
        continue;
      }
      if (r.status !== 200) {
        console.error(`\n  ✗ خطأ API: ${r.msg || r.status}`);
        break;
      }
      const list = r.result?.folders || [];
      folders.push(...list);
      process.stdout.write(`  صفحة ${page}: +${list.length} مجلد (المجموع: ${folders.length})\n`);
      if (list.length < 100) break;
      page++;
      await sleep(1000);
    } catch (e) {
      console.error(`\n  ✗ خطأ في جلب المجلدات (صفحة ${page}):`, e.message);
      await sleep(3000);
      continue;
    }
  }

  if (folders.length === 0) {
    console.error('\n  ✗ لم يتم العثور على أي مجلدات. تحقق من المفتاح أو الاتصال.');
    process.exit(1);
  }

  console.log(`\n  ✓ إجمالي المجلدات: ${folders.length}\n`);

  // ── الخطوة 2: جلب ملفات كل مجلد ─────────────────────────────
  console.log('  🎞️  جلب بيانات كل فيلم/مسلسل...\n');

  const items = [];
  let startIdx = 0;

  // استئناف من حيث توقفنا؟
  const saved = loadProgress();
  if (saved && saved.folderIds?.length === folders.length) {
    items.push(...saved.items);
    startIdx = saved.processedIdx + 1;
    console.log(`  ✓ تم تحميل ${items.length} عنصر من جلسة سابقة\n`);
  }

  for (let i = startIdx; i < folders.length; i++) {
    const folder = folders[i];
    progressBar(i + 1, folders.length, folder.name?.substring(0, 30) || '');

    let retries = 0;
    while (retries < 3) {
      try {
        const url = `${LULU_API}/file/list?key=${LULU_KEY}&fld_id=${folder.fld_id}&per_page=100`;
        const r   = await get(url);

        if (r.status === 403) {
          process.stdout.write(`\n  ⚠️  Rate Limited! انتظار ${DELAY_ON_RATE_LIMIT/1000}s...\n`);
          await sleep(DELAY_ON_RATE_LIMIT);
          continue; // retry
        }

        const files    = r.files || r.result?.files || [];
        const mainFile = files.find(f => f.canplay === 1) || files[0];

        if (mainFile) {
          const urls  = buildUrls(mainFile.file_code);
          const isMovie = files.length <= 2;

          const item = {
            id          : String(folder.fld_id),
            title       : folder.name || '',
            vod_type    : isMovie ? 'movie' : 'series',
            episodeCount: files.length,
            poster      : mainFile.thumbnail || '',
            canplay     : mainFile.canplay === 1,
            fileCode    : mainFile.file_code,
            embedUrl    : urls.embedUrl,
            hlsUrl      : urls.hlsUrl,
            directUrl   : urls.directUrl,
            uploadedAt  : mainFile.uploaded || '',
            ts          : new Date(mainFile.uploaded || 0).getTime(),
            // حلقات المسلسل (إذا كان مسلسلاً)
            episodes: !isMovie ? files.map((f, idx) => ({
              episode  : idx + 1,
              title    : f.title || `الحلقة ${idx + 1}`,
              fileCode : f.file_code,
              embedUrl : `https://luluvdo.com/e/${f.file_code}`,
              hlsUrl   : `https://luluvdo.com/hls/${f.file_code}/master.m3u8`,
              canplay  : f.canplay === 1,
              thumbnail: f.thumbnail || '',
            })) : undefined,
          };
          items.push(item);
        }

        break; // success
      } catch (e) {
        retries++;
        if (retries >= 3) {
          process.stdout.write(`\n  ✗ فشل ${folder.name}: ${e.message}\n`);
        } else {
          await sleep(2000);
        }
      }
    }

    // حفظ تدريجي كل BATCH_SIZE
    if ((i + 1) % BATCH_SIZE === 0) {
      saveProgress(i, folders.length, items, folders);
      fs.writeFileSync(OUT_JSON, JSON.stringify({ catalog: items, ts: Date.now(), total: items.length }, null, 2));
    }

    await sleep(DELAY_BETWEEN_REQUESTS);
  }

  console.log(`\n\n  ✓ اكتمل الجلب: ${items.length} عنصر\n`);

  // ── الخطوة 3: فرز وحفظ النتائج ───────────────────────────────
  console.log('  💾 حفظ النتائج...\n');

  const sorted  = [...items].sort((a, b) => b.ts - a.ts);
  const movies  = sorted.filter(i => i.vod_type === 'movie');
  const series  = sorted.filter(i => i.vod_type === 'series');

  // ─── JSON الذي يقرأه السيرفر (بدون حلقات لتخفيف الحجم) ─────
  const catalogLight = sorted.map(({ episodes, ...rest }) => rest);
  fs.writeFileSync(OUT_JSON, JSON.stringify({ catalog: catalogLight, ts: Date.now(), total: sorted.length }, null, 2));
  console.log(`  ✓ lulu_catalog.json → ${catalogLight.length} عنصر (${(fs.statSync(OUT_JSON).size / 1024).toFixed(0)} KB)`);

  // JSON الكامل مع الحلقات
  fs.writeFileSync(OUT_FULL, JSON.stringify({ catalog: sorted, ts: Date.now(), total: sorted.length, movies: movies.length, series: series.length }, null, 2));

  // JSON أفلام فقط
  fs.writeFileSync(OUT_MOV, JSON.stringify({ items: movies, total: movies.length }, null, 2));

  // JSON مسلسلات فقط
  fs.writeFileSync(OUT_SER, JSON.stringify({ items: series, total: series.length }, null, 2));

  // CSV للفتح في Excel
  const csvHeader = 'ID,الاسم,النوع,عدد_الحلقات,يمكن_التشغيل,رابط_Embed,رابط_HLS,الصورة,تاريخ_الرفع\n';
  const csvRows   = sorted.map(item => {
    const title   = (item.title || '').replace(/"/g, '""');
    const type    = item.vod_type === 'movie' ? 'فيلم' : 'مسلسل';
    const canplay = item.canplay ? 'نعم' : 'لا';
    const date    = item.uploadedAt ? new Date(item.uploadedAt).toLocaleDateString('ar-SA') : '';
    return `"${item.id}","${title}","${type}","${item.episodeCount}","${canplay}","${item.embedUrl}","${item.hlsUrl}","${item.poster}","${date}"`;
  }).join('\n');
  fs.writeFileSync(OUT_CSV, '\uFEFF' + csvHeader + csvRows, 'utf8'); // BOM for Excel Arabic

  // حذف ملف التقدم (الآن مكتمل)
  if (fs.existsSync(OUT_PROG)) fs.unlinkSync(OUT_PROG);

  // ── ملخص ──────────────────────────────────────────────────────
  console.log('════════════════════════════════════════════════════════');
  console.log('  ✅ اكتمل بنجاح!\n');
  console.log(`  📊 الإجماليات:`);
  console.log(`     • إجمالي العناصر : ${sorted.length}`);
  console.log(`     • أفلام           : ${movies.length}`);
  console.log(`     • مسلسلات         : ${series.length}`);
  console.log(`     • جاهز للتشغيل   : ${sorted.filter(i => i.canplay).length}`);
  console.log(`\n  📁 الملفات المحفوظة في: ${OUT_DIR}`);
  console.log(`     • lulu_catalog_full.json  (كامل)`);
  console.log(`     • lulu_movies.json        (أفلام فقط)`);
  console.log(`     • lulu_series.json        (مسلسلات فقط)`);
  console.log(`     • lulu_catalog.csv        (Excel)`);

  // طباعة أول 10 عناصر كمعاينة
  console.log('\n  📋 معاينة أحدث 10 عناصر:');
  console.log('  ─────────────────────────────────────────────────────');
  sorted.slice(0, 10).forEach((item, i) => {
    const type  = item.vod_type === 'movie' ? '🎬' : '📺';
    const play  = item.canplay ? '✓' : '✗';
    const name  = (item.title || '').substring(0, 40).padEnd(40);
    console.log(`  ${(i+1).toString().padStart(2)}. ${type} [${play}] ${name}  ${item.embedUrl}`);
  });
  console.log('════════════════════════════════════════════════════════\n');
}

main().catch(e => {
  console.error('\n  ✗ خطأ غير متوقع:', e.message);
  process.exit(1);
});
