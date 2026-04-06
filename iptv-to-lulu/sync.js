/**
 * IPTV → LuluStream Auto-Sync (Remote URL Upload)
 * يرسل روابط IPTV مباشرة إلى LuluStream — بدون تحميل على VPS
 * LuluStream تجلب الملف بنفسها من رابط IPTV مباشرة
 */

'use strict';

const fs    = require('fs');
const path  = require('path');
const http  = require('http');
const https = require('https');

// ══════════════════════════════════════════════════════
// الإعدادات
// ══════════════════════════════════════════════════════
const CFG = {
  // IPTV
  IPTV_HOST : process.env.IPTV_HOST || 'myhand.org',
  IPTV_PORT : process.env.IPTV_PORT || 8080,
  IPTV_USER : process.env.IPTV_USER || '3302196097',
  IPTV_PASS : process.env.IPTV_PASS || '2474044847',

  // LuluStream
  LULU_KEY  : process.env.LULU_KEY  || '258176jfw9e96irnxai2fm',

  // ملف تتبع التقدم
  PROGRESS  : process.env.PROGRESS  || '/root/lulu_progress.json',

  // ملف اللوج
  LOG_FILE  : process.env.LOG_FILE  || '/root/lulu_sync.log',

  // تأخير بين كل رفع (ms) — لتجنب rate limiting
  DELAY_MS  : Number(process.env.DELAY_MS || 4000),

  // عدد محاولات الفشل قبل التجاهل
  MAX_RETRY : Number(process.env.MAX_RETRY || 3),
};

// ══════════════════════════════════════════════════════
// أدوات مساعدة
// ══════════════════════════════════════════════════════
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(CFG.LOG_FILE, line + '\n'); } catch {}
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function loadProgress() {
  try { return JSON.parse(fs.readFileSync(CFG.PROGRESS, 'utf8')); }
  catch { return { uploaded: {}, failed: {} }; }
}

function saveProgress(p) {
  fs.writeFileSync(CFG.PROGRESS, JSON.stringify(p, null, 2));
}

function ensureDir(d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }

// خطأ خاص بالحد اليومي
class DailyLimitError extends Error {
  constructor() { super('daily_limit'); this.name = 'DailyLimitError'; }
}

// انتظر حتى منتصف الليل UTC + 5 دقائق ثم تابع
async function sleepUntilMidnightUTC() {
  const now   = new Date();
  const next  = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 5, 0));
  const msLeft = next - now;
  const hrs  = (msLeft / 3600000).toFixed(1);
  log(`⏸ تم بلوغ الحد اليومي 100 رابط — انتظار ${hrs} ساعة حتى ${next.toUTCString()}`);
  await sleep(msLeft);
  log('▶ استئناف الرفع بعد تجديد الحد اليومي');
}

// ══════════════════════════════════════════════════════
// طلبات HTTP بسيطة
// ══════════════════════════════════════════════════════
function httpGet(url, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout: timeoutMs }, res => {
      // تتبع الـ redirects
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        return httpGet(res.headers.location, timeoutMs).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function parseJson(body) {
  try { return JSON.parse(body); } catch { return null; }
}

// ══════════════════════════════════════════════════════
// LuluStream — Remote URL Upload (الأهم)
// ══════════════════════════════════════════════════════
// LuluStream تجلب الملف بنفسها من الرابط — لا يحتاج VPS storage
async function luluRemoteUpload(srcUrl, title, fldId = 0) {
  let apiUrl = `https://api.lulustream.com/api/upload/url?key=${CFG.LULU_KEY}&url=${encodeURIComponent(srcUrl)}&title=${encodeURIComponent(title)}&file_public=1`;
  if (fldId) apiUrl += `&fld_id=${fldId}`;
  log(`  ↑ إرسال: ${title}`);

  const res  = await httpGet(apiUrl, 60000);
  const data = parseJson(res.body);

  // كشف الحد اليومي
  if (data && data.msg && data.msg.includes('max URLs limit')) throw new DailyLimitError();

  // الاستجابة الناجحة: {"result":{"filecode":"..."},"status":200,"msg":"OK"}
  if (data && data.result && data.result.filecode)  return data.result.filecode;
  if (data && data.result && data.result.file_code) return data.result.file_code;
  if (Array.isArray(data) && data[0] && (data[0].filecode || data[0].file_code)) return data[0].filecode || data[0].file_code;
  if (data && (data.filecode || data.file_code))    return data.filecode || data.file_code;

  throw new Error(`LuluStream فشل (${res.status}): ${res.body.slice(0, 300)}`);
}

// ══════════════════════════════════════════════════════
// IPTV Xtream API
// ══════════════════════════════════════════════════════
const IPTV_BASE = () =>
  `http://${CFG.IPTV_HOST}:${CFG.IPTV_PORT}/player_api.php?username=${CFG.IPTV_USER}&password=${CFG.IPTV_PASS}`;

async function iptvAPI(action, extra = '') {
  const url = `${IPTV_BASE()}&action=${action}${extra}`;
  const res = await httpGet(url, 60000);
  return parseJson(res.body) || [];
}

async function getVodCategories()      { return iptvAPI('get_vod_categories'); }
async function getVodStreams(catId)     { return iptvAPI('get_vod_streams',    catId ? `&category_id=${catId}` : ''); }
async function getVodInfo(streamId)    { return iptvAPI('get_vod_info',       `&vod_id=${streamId}`); }
async function getSeriesCategories()   { return iptvAPI('get_series_categories'); }
async function getSeries(catId)        { return iptvAPI('get_series',         catId ? `&category_id=${catId}` : ''); }
async function getSeriesInfo(seriesId) { return iptvAPI('get_series_info',    `&series_id=${seriesId}`); }

// ══════════════════════════════════════════════════════
// تحديد نوع اللغة من اسم الفئة
// ══════════════════════════════════════════════════════
function detectLang(catName = '') {
  const n = catName.toLowerCase();
  if (/ar.*sub|مترجم|arabic.*sub/i.test(n))  return 'مترجم للعربية';
  if (/ar.*dub|doblaj|مدبلج/i.test(n))       return 'مدبلج للعربية';
  if (/arabic|عربي/i.test(n))                return 'عربي';
  if (/turkish|تركي/i.test(n))               return 'تركي';
  if (/hindi|indian|هندي/i.test(n))          return 'هندي';
  if (/persian|فارسي/i.test(n))              return 'فارسي';
  if (/french|فرنسي/i.test(n))              return 'فرنسي';
  if (/german|ألماني/i.test(n))             return 'ألماني';
  if (/spanish|إسباني/i.test(n))            return 'إسباني';
  if (/anime|أنمي/i.test(n))               return 'أنمي';
  if (/cartoon|كرتون/i.test(n))            return 'كرتون';
  if (/english|إنجليزي/i.test(n))          return 'إنجليزي';
  return '';
}

// تنظيف اسم الفيلم من البادئات مثل "EN |", "AR |", "NF|"
function cleanTitle(name = '') {
  return name
    .replace(/^(EN|AR|NF|TR|HN|KR|IT|FR|DE|ES|PL|PER|KRD|NL|CH|JP)\s*[|\-]/i, '')
    .replace(/^(NETFLIX|DISNEY|HBO|APPLE|AMAZON|PRIME)\s*[|\-]/i, '')
    .replace(/VOD\s*\d*/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// بناء وصف عربي من metadata الـ IPTV
function buildDescription(info = {}, langLabel = '') {
  const parts = [];
  if (langLabel)     parts.push(`🌐 اللغة: ${langLabel}`);
  if (info.genre)    parts.push(`🎭 النوع: ${info.genre}`);
  if (info.director) parts.push(`🎬 المخرج: ${info.director}`);
  if (info.cast)     parts.push(`👥 الممثلون: ${info.cast.slice(0, 200)}`);
  if (info.rating)   parts.push(`⭐ التقييم: ${info.rating}`);
  if (info.releasedate) parts.push(`📅 تاريخ الإصدار: ${String(info.releasedate).substring(0,10)}`);
  if (info.plot)     parts.push(`\n📖 القصة:\n${info.plot.slice(0, 600)}`);
  return parts.join('\n');
}

// بناء tags من metadata
function buildTags(info = {}, langLabel = '', catName = '') {
  const tags = [];
  if (langLabel) tags.push(langLabel);
  if (info.genre) {
    info.genre.split(/[,\/]/).forEach(g => { const t = g.trim(); if (t && t.length < 30) tags.push(t); });
  }
  if (info.releasedate) tags.push(String(info.releasedate).substring(0,4));
  const clean = cleanTitle(catName);
  if (clean && !tags.includes(clean)) tags.push(clean.slice(0,30));
  return tags.slice(0, 8).join(',');
}

// ══════════════════════════════════════════════════════
// LuluStream — تحديث تفاصيل الملف بعد الرفع
// ══════════════════════════════════════════════════════
async function luluFileEdit(fileCode, { title, descr, tags } = {}) {
  const params = new URLSearchParams({ key: CFG.LULU_KEY, file_code: fileCode, file_public: '1' });
  if (title) params.set('file_title', title.slice(0, 200));
  if (descr) params.set('file_descr', descr.slice(0, 1000));
  if (tags)  params.set('tags', tags.slice(0, 300));
  const url = `https://api.lulustream.com/api/file/edit?${params}`;
  try {
    const res = await httpGet(url, 15000);
    const d = parseJson(res.body);
    return d?.msg === 'OK';
  } catch { return false; }
}

// ══════════════════════════════════════════════════════
// LuluStream — إدارة المجلدات
// ══════════════════════════════════════════════════════
const _luluFolderCache = {}; // name → fld_id

async function ensureLuluFolder(name, parentId = 0) {
  const cacheKey = `${parentId}:${name}`;
  if (_luluFolderCache[cacheKey]) return _luluFolderCache[cacheKey];
  try {
    // قائمة المجلدات الموجودة
    const listRes = await httpGet(
      `https://api.lulustream.com/api/folder/list?key=${CFG.LULU_KEY}&fld_id=${parentId}`, 15000);
    const listData = parseJson(listRes.body);
    const folders = listData?.result?.folders || [];
    const existing = folders.find(f => f.name === name);
    if (existing) {
      _luluFolderCache[cacheKey] = existing.fld_id;
      return existing.fld_id;
    }
    // إنشاء مجلد جديد
    const createRes = await httpGet(
      `https://api.lulustream.com/api/folder/create?key=${CFG.LULU_KEY}&name=${encodeURIComponent(name)}&parent_id=${parentId}`, 15000);
    const createData = parseJson(createRes.body);
    const fld_id = createData?.result?.fld_id || 0;
    if (fld_id) _luluFolderCache[cacheKey] = fld_id;
    return fld_id || 0;
  } catch { return 0; }
}

// روابط البث المباشرة من IPTV
function vodStreamUrl(streamId, ext = 'mp4') {
  return `http://${CFG.IPTV_HOST}:${CFG.IPTV_PORT}/movie/${CFG.IPTV_USER}/${CFG.IPTV_PASS}/${streamId}.${ext}`;
}
function episodeUrl(episodeId, ext = 'mp4') {
  return `http://${CFG.IPTV_HOST}:${CFG.IPTV_PORT}/series/${CFG.IPTV_USER}/${CFG.IPTV_PASS}/${episodeId}.${ext}`;
}


// ══════════════════════════════════════════════════════
// المعالجة الرئيسية
// ══════════════════════════════════════════════════════
async function processVod(progress) {
  log('═══ جلب قائمة الأفلام من IPTV ═══');
  const categories = await getVodCategories();
  log(`  وجدت ${categories.length} فئة أفلام`);

  // المجلد الجذر للأفلام في LuluStream
  const moviesRootId = await ensureLuluFolder('أفلام');

  for (const cat of categories) {
    const catName  = cat.category_name || `cat_${cat.category_id}`;
    const langLabel = detectLang(catName);
    log(`\n► فئة: ${catName}`);

    // مجلد لكل فئة
    const catFolderId = moviesRootId ? await ensureLuluFolder(catName, moviesRootId) : 0;

    let streams;
    try { streams = await getVodStreams(cat.category_id); }
    catch (e) { log(`  ⚠ ${e.message}`); continue; }

    for (const stream of streams) {
      const key = `movie_${stream.stream_id}`;
      if (progress.uploaded[key])                        { log(`  ✓ [مكتمل] ${stream.name}`); continue; }
      if ((progress.failed[key] || 0) >= CFG.MAX_RETRY) { log(`  ✗ [تجاهل] ${stream.name}`); continue; }

      const ext      = stream.container_extension || 'mp4';
      const srcUrl   = vodStreamUrl(stream.stream_id, ext);
      const cleanName = cleanTitle(stream.name);

      // جلب التفاصيل الكاملة من IPTV
      let meta = {};
      try {
        const vodInfo = await getVodInfo(stream.stream_id);
        meta = vodInfo?.info || {};
      } catch {}

      const arabicTitle = cleanName || stream.name;
      const descr = buildDescription(meta, langLabel);
      const tags  = buildTags(meta, langLabel, catName);

      while (true) {
        try {
          const fileCode = await luluRemoteUpload(srcUrl, arabicTitle, catFolderId);
          // تحديث التفاصيل بعد الرفع
          await sleep(1500);
          await luluFileEdit(fileCode, { title: arabicTitle, descr, tags });

          progress.uploaded[key] = {
            fileCode, title: arabicTitle, originalTitle: stream.name,
            cat: catName, lang: langLabel,
            poster: meta.cover || meta.movie_image || '',
            year: meta.releasedate ? String(meta.releasedate).substring(0,4) : '',
            genre: meta.genre || '', rating: meta.rating || '',
            ts: Date.now(),
          };
          saveProgress(progress);
          log(`  ✅ ${arabicTitle} → ${fileCode}`);
          break;
        } catch (e) {
          if (e instanceof DailyLimitError) { await sleepUntilMidnightUTC(); continue; }
          log(`  ✗ ${stream.name} — ${e.message}`);
          progress.failed[key] = (progress.failed[key] || 0) + 1;
          saveProgress(progress);
          break;
        }
      }
      await sleep(CFG.DELAY_MS);
    }
  }
}

async function processSeries(progress) {
  log('\n═══ جلب قائمة المسلسلات من IPTV ═══');
  const categories = await getSeriesCategories();
  log(`  وجدت ${categories.length} فئة مسلسلات`);

  // المجلد الجذر للمسلسلات في LuluStream
  const seriesRootId = await ensureLuluFolder('مسلسلات');

  for (const cat of categories) {
    const catName   = cat.category_name || `cat_${cat.category_id}`;
    const langLabel = detectLang(catName);
    log(`\n► فئة: ${catName}`);

    let seriesList;
    try { seriesList = await getSeries(cat.category_id); }
    catch (e) { log(`  ⚠ ${e.message}`); continue; }

    for (const show of seriesList) {
      const cleanShowName = cleanTitle(show.name);
      log(`  ┌ ${cleanShowName}`);

      let info;
      try { info = await getSeriesInfo(show.series_id); }
      catch (e) { log(`  ⚠ ${e.message}`); continue; }

      const showMeta   = info.info || {};
      const episodes   = info.episodes || {};
      const showDescr  = buildDescription(showMeta, langLabel);
      const showTags   = buildTags(showMeta, langLabel, catName);

      // مجلد لكل مسلسل
      const showFolderId = seriesRootId ? await ensureLuluFolder(cleanShowName, seriesRootId) : 0;

      for (const [seasonNum, eps] of Object.entries(episodes)) {
        // مجلد للموسم
        const seasonFolderId = showFolderId
          ? await ensureLuluFolder(`الموسم ${seasonNum}`, showFolderId) : 0;

        for (const ep of eps) {
          const key = `series_${ep.id}`;
          if (progress.uploaded[key])                       continue;
          if ((progress.failed[key] || 0) >= CFG.MAX_RETRY) continue;

          const ext     = ep.container_extension || 'mp4';
          const epNum   = String(ep.episode_num).padStart(2, '0');
          const sNum    = String(seasonNum).padStart(2, '0');
          const epLabel = ep.title && ep.title !== ep.episode_num ? ep.title : `الحلقة ${ep.episode_num}`;
          const epTitle = `${cleanShowName} - الموسم ${sNum} - ${epLabel}`;
          const srcUrl  = episodeUrl(ep.id, ext);

          while (true) {
            try {
              const fileCode = await luluRemoteUpload(srcUrl, epTitle, seasonFolderId);
              await sleep(1500);
              await luluFileEdit(fileCode, { title: epTitle, descr: showDescr, tags: showTags });

              progress.uploaded[key] = {
                fileCode, title: epTitle,
                show: cleanShowName, season: seasonNum, ep: ep.episode_num,
                lang: langLabel,
                poster: showMeta.cover || showMeta.backdrop_path?.[0] || '',
                genre: showMeta.genre || '', rating: showMeta.rating || '',
                ts: Date.now(),
              };
              saveProgress(progress);
              log(`  ✅ ${epTitle} → ${fileCode}`);
              break;
            } catch (e) {
              if (e instanceof DailyLimitError) { await sleepUntilMidnightUTC(); continue; }
              log(`  ✗ ${epTitle} — ${e.message}`);
              progress.failed[key] = (progress.failed[key] || 0) + 1;
              saveProgress(progress);
              break;
            }
          }
          await sleep(CFG.DELAY_MS);
        }
      }
    }
  }
}

// ══════════════════════════════════════════════════════
// نقطة البداية
// ══════════════════════════════════════════════════════
async function main() {
  ensureDir(path.dirname(CFG.PROGRESS));

  log('══════════════════════════════════════════════════');
  log('  IPTV → LuluStream Remote Sync بدأ');
  log(`  IPTV : ${CFG.IPTV_HOST}:${CFG.IPTV_PORT}`);
  log(`  Lulu : API Key = ${CFG.LULU_KEY.slice(0,6)}...`);
  log(`  طريقة: Remote URL Upload (بدون تحميل محلي)`);
  log('══════════════════════════════════════════════════');

  const progress = loadProgress();
  log(`  مكتمل مسبقاً: ${Object.keys(progress.uploaded).length} ملف`);

  try {
    await processVod(progress);
    await processSeries(progress);
  } catch (e) {
    log(`❌ خطأ رئيسي: ${e.message}\n${e.stack}`);
  }

  const done = Object.keys(progress.uploaded).length;
  log(`\n══ اكتمل ══ إجمالي ${done} ملف على LuluStream`);
  log(`  التقدم : ${CFG.PROGRESS}`);
  log(`  اللوج  : ${CFG.LOG_FILE}`);
}

main().catch(e => { log(`FATAL: ${e.message}`); process.exit(1); });
