/**
 * IPTV → LuluStream Auto-Sync v2
 * ✅ يرفع الأفلام والمسلسلات العربية والمترجمة/المدبلجة فقط
 * ✅ يجلب ترجمات عربي + كردي من SubDL.com (مجاني)
 * ✅ يحافظ على الفئات والبيانات الكاملة كما هي في المصدر
 */

'use strict';

const fs             = require('fs');
const path           = require('path');
const http           = require('http');
const https          = require('https');
const { execSync }   = require('child_process');

// ══════════════════════════════════════════════════════
// الإعدادات
// ══════════════════════════════════════════════════════
const CFG = {
  // IPTV (proxpanel)
  IPTV_HOST : process.env.IPTV_HOST || 'myhand.org',
  IPTV_PORT : process.env.IPTV_PORT || 8080,
  IPTV_USER : process.env.IPTV_USER || '3302196097',
  IPTV_PASS : process.env.IPTV_PASS || '2474044847',

  // LuluStream
  LULU_KEY  : process.env.LULU_KEY  || '258176jfw9e96irnxai2fm',

  // SubDL.com — ترجمات مجانية
  SUBDL_KEY : process.env.SUBDL_KEY || 'MA5RWk78R1H6Gyd-Xu0B37pLWc3MjUCQ',

  // مجلد تخزين ملفات الترجمة على VPS
  SUBS_DIR  : '/root/subs',
  // رابط VPS لخدمة ملفات الترجمة
  VPS_URL   : process.env.VPS_URL   || 'http://62.171.153.204:8090',

  // ملفات النظام
  PROGRESS  : '/root/lulu_progress.json',
  LOG_FILE  : '/root/lulu_sync.log',

  DELAY_MS  : Number(process.env.DELAY_MS  || 4000),
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

function sleep(ms)          { return new Promise(r => setTimeout(r, ms)); }
function ensureDir(d)       { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }

function loadProgress() {
  try { return JSON.parse(fs.readFileSync(CFG.PROGRESS, 'utf8')); }
  catch { return { uploaded: {}, failed: {} }; }
}
function saveProgress(p) {
  fs.writeFileSync(CFG.PROGRESS, JSON.stringify(p, null, 2));
}

class DailyLimitError extends Error {
  constructor() { super('daily_limit'); this.name = 'DailyLimitError'; }
}

async function sleepUntilMidnightUTC() {
  const now  = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 5, 0));
  const hrs  = ((next - now) / 3600000).toFixed(1);
  log(`⏸ الحد اليومي — انتظار ${hrs} ساعة حتى ${next.toUTCString()}`);
  await sleep(next - now);
  log('▶ استئناف الرفع');
}

// ══════════════════════════════════════════════════════
// طلبات HTTP
// ══════════════════════════════════════════════════════
function httpGet(url, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout: timeoutMs }, res => {
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location)
        return httpGet(res.headers.location, timeoutMs).then(resolve).catch(reject);
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function httpDownload(url, destPath, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);
    const req = mod.get(url, { timeout: timeoutMs }, res => {
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
        file.close();
        fs.unlink(destPath, () => {});
        return httpDownload(res.headers.location, destPath, timeoutMs).then(resolve).catch(reject);
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
      file.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('download timeout')); });
  });
}

function parseJson(body) {
  try { return JSON.parse(body); } catch { return null; }
}

// ══════════════════════════════════════════════════════
// فلتر المحتوى — عربي أو مترجم/مدبلج فقط
// ══════════════════════════════════════════════════════

// فلتر الفئة
function isTargetContent(catName = '') {
  const n = catName;
  // ✅ ضمّن: عربي أو مترجم أو مدبلج
  if (/عرب|arabic|مترجم|مدبلج|رمضان|حصري/i.test(n))       return true;
  if (/\bsub(bed|titled)?\b|dubbed/i.test(n))              return true;
  if (/أكشن|اكشن|دراما|كوميدي|رعب|إثارة|خيال|رومانسي|وثائقي|أنمي/i.test(n)) return true;
  // ❌ استبعد الأجنبي الخالص
  if (/^EN\s*[|\-]/i.test(n))  return false;
  if (/^(TR|HN|FR|DE|KR|JP|IT|ES|PL|PER|NL|RU|CH)\s*[|\-]/i.test(n)) return false;
  if (/^(English|Turkish|Hindi|French|German|Korean|Japanese|Italian|Spanish|Persian|Russian)\s*[|\-]/i.test(n)) return false;
  return true;
}

// فلتر اسم الفيلم/المسلسل — يتخطى ما يبدأ ببادئة أجنبية
function isTargetStream(name = '') {
  const n = name.trim();
  // استبعد البادئات الأجنبية الصريحة مثل: "EN | Movie", "En | Movie"
  if (/^(EN|TR|HN|FR|DE|KR|JP|IT|ES|PL|PER|NL|RU|CH|ENG)\s*[|\-]/i.test(n)) return false;
  if (/^(English|Turkish|Hindi|French|German|Korean|Japanese|Italian|Spanish|Persian|Russian)\s*[|\-]/i.test(n)) return false;
  return true;
}

// تحديد نوع اللغة من اسم الفئة
function detectLang(catName = '') {
  const n = catName.toLowerCase();
  if (/ar.*sub|مترجم|arabic.*sub/i.test(n))  return 'مترجم للعربية';
  if (/ar.*dub|doblaj|مدبلج/i.test(n))       return 'مدبلج للعربية';
  if (/arabic|عربي/i.test(n))                return 'عربي';
  if (/turkish|تركي/i.test(n))               return 'تركي مترجم';
  if (/hindi|indian|هندي/i.test(n))          return 'هندي مترجم';
  if (/persian|فارسي/i.test(n))              return 'فارسي مترجم';
  if (/anime|أنمي/i.test(n))                 return 'أنمي مترجم';
  if (/cartoon|كرتون/i.test(n))              return 'كرتون';
  if (/english|إنجليزي/i.test(n))            return 'إنجليزي مترجم';
  return 'مترجم';
}

// تنظيف اسم من البادئات مثل "AR |", "EN |"
function cleanTitle(name = '') {
  return name
    .replace(/^(EN|AR|NF|TR|HN|KR|IT|FR|DE|ES|PL|PER|KRD|NL|CH|JP|RU)\s*[|\-]/i, '')
    .replace(/^(NETFLIX|DISNEY|HBO|APPLE|AMAZON|PRIME|SHAHID)\s*[|\-]/i, '')
    .replace(/VOD\s*\d*/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// بناء وصف عربي كامل من metadata
function buildDescription(info = {}, langLabel = '', catName = '') {
  const parts = [];
  if (langLabel)        parts.push(`🌐 اللغة: ${langLabel}`);
  if (catName)          parts.push(`📂 الفئة: ${catName}`);
  if (info.genre)       parts.push(`🎭 النوع: ${info.genre}`);
  if (info.director)    parts.push(`🎬 المخرج: ${info.director}`);
  if (info.cast)        parts.push(`👥 الممثلون: ${info.cast.slice(0, 200)}`);
  if (info.rating)      parts.push(`⭐ التقييم: ${info.rating}`);
  if (info.releasedate) parts.push(`📅 تاريخ الإصدار: ${String(info.releasedate).substring(0, 10)}`);
  if (info.duration_secs) {
    const mins = Math.round(info.duration_secs / 60);
    parts.push(`⏱ المدة: ${mins} دقيقة`);
  }
  if (info.country)     parts.push(`🗺 الدولة: ${info.country}`);
  if (info.plot)        parts.push(`\n📖 القصة:\n${info.plot.slice(0, 600)}`);
  return parts.join('\n');
}

// بناء tags كاملة من metadata (بما فيها النوع والفئة)
function buildTags(info = {}, langLabel = '', catName = '') {
  const tags = [];
  if (langLabel) tags.push(langLabel);
  // أضف جميع الأنواع (genre)
  if (info.genre) {
    info.genre.split(/[,\/]/).forEach(g => {
      const t = g.trim();
      if (t && t.length < 30) tags.push(t);
    });
  }
  if (info.releasedate) tags.push(String(info.releasedate).substring(0, 4));
  if (info.country)     tags.push(info.country.split(',')[0].trim().slice(0, 20));
  // أضف اسم الفئة الأصلي كما هو
  const catClean = cleanTitle(catName);
  if (catClean && !tags.includes(catClean)) tags.push(catClean.slice(0, 30));
  return tags.slice(0, 10).join(',');
}

// ══════════════════════════════════════════════════════
// LuluStream API
// ══════════════════════════════════════════════════════
async function luluAPI(endpoint, params = {}) {
  const p = new URLSearchParams({ key: CFG.LULU_KEY, ...params });
  const url = `https://api.lulustream.com/api${endpoint}?${p}`;
  const res = await httpGet(url, 60000);
  return parseJson(res.body);
}

async function luluRemoteUpload(srcUrl, title, fldId = 0) {
  const params = { url: srcUrl, title, file_public: '1' };
  if (fldId) params.fld_id = String(fldId);
  const p = new URLSearchParams({ key: CFG.LULU_KEY, ...params });
  const url = `https://api.lulustream.com/api/upload/url?${p}`;
  log(`  ↑ إرسال: ${title}`);
  const res  = await httpGet(url, 60000);
  const data = parseJson(res.body);
  if (data?.msg?.includes('max URLs limit')) throw new DailyLimitError();
  const fc = data?.result?.filecode || data?.result?.file_code
    || (Array.isArray(data) && (data[0]?.filecode || data[0]?.file_code))
    || data?.filecode || data?.file_code;
  if (!fc) throw new Error(`LuluStream فشل: ${res.body.slice(0, 300)}`);
  return fc;
}

async function luluFileEdit(fileCode, opts = {}) {
  try {
    await luluAPI('/file/set_folder', { file_code: fileCode, fld_id: opts.fldId || '0' });
  } catch {}
  try {
    const p = new URLSearchParams({
      key: CFG.LULU_KEY, file_code: fileCode,
      file_title: opts.title || '', file_descr: opts.descr || '',
    });
    if (opts.tags) p.set('file_tags', opts.tags);
    await httpGet(`https://api.lulustream.com/api/file/update?${p}`, 30000);
  } catch {}
}

async function ensureLuluFolder(name, parentId = 0) {
  try {
    const p = new URLSearchParams({ key: CFG.LULU_KEY, name, parent_id: parentId });
    const res  = await httpGet(`https://api.lulustream.com/api/folder/create?${p}`, 30000);
    const data = parseJson(res.body);
    return data?.result?.fld_id || data?.fld_id || 0;
  } catch { return 0; }
}

// رفع ترجمة لملف على LuluStream
async function luluUploadSubtitle(fileCode, subUrl, lang) {
  try {
    const p = new URLSearchParams({ key: CFG.LULU_KEY, file_code: fileCode, sub_url: subUrl, sub_lang: lang });
    const res = await httpGet(`https://api.lulustream.com/api/upload/sub?${p}`, 30000);
    const data = parseJson(res.body);
    if (data?.status === 200) {
      log(`    🔤 تم رفع ترجمة [${lang}]`);
      return true;
    }
    return false;
  } catch (e) {
    log(`    ⚠ فشل رفع ترجمة [${lang}]: ${e.message}`);
    return false;
  }
}

// رابط بث IPTV
function vodStreamUrl(streamId, ext = 'mp4') {
  return `http://${CFG.IPTV_HOST}:${CFG.IPTV_PORT}/movie/${CFG.IPTV_USER}/${CFG.IPTV_PASS}/${streamId}.${ext}`;
}
function episodeUrl(episodeId, ext = 'mp4') {
  return `http://${CFG.IPTV_HOST}:${CFG.IPTV_PORT}/series/${CFG.IPTV_USER}/${CFG.IPTV_PASS}/${episodeId}.${ext}`;
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

const getVodCategories    = ()          => iptvAPI('get_vod_categories');
const getVodStreams        = (catId)     => iptvAPI('get_vod_streams',    catId ? `&category_id=${catId}` : '');
const getVodInfo          = (streamId)  => iptvAPI('get_vod_info',       `&vod_id=${streamId}`);
const getSeriesCategories = ()          => iptvAPI('get_series_categories');
const getSeries           = (catId)     => iptvAPI('get_series',         catId ? `&category_id=${catId}` : '');
const getSeriesInfo       = (seriesId)  => iptvAPI('get_series_info',    `&series_id=${seriesId}`);

// ══════════════════════════════════════════════════════
// SubDL.com — ترجمات مجانية (عربي + كردي)
// ══════════════════════════════════════════════════════
const SUBDL_LANGS = ['AR', 'KU'];  // Arabic, Kurdish

async function searchSubDL(name, year = '', type = 'movie', imdbId = '') {
  if (!CFG.SUBDL_KEY) return [];
  try {
    // الخطوة 1: بحث بالاسم للحصول على sd_id
    const p1 = new URLSearchParams({
      api_key   : CFG.SUBDL_KEY,
      film_name : name,
      languages : SUBDL_LANGS.join(','),
      type,
    });
    if (year)   p1.set('year', String(year).substring(0, 4));
    if (imdbId) { p1.set('imdb_id', imdbId); }
    const r1   = await httpGet(`https://api.subdl.com/api/v1/subtitles?${p1}`, 25000);
    const d1   = parseJson(r1.body);
    // إذا أرجع ترجمات مباشرة (sd_id مدرج) استخدمها
    if (d1?.subtitles?.length) return d1.subtitles;
    // وإلا جلب أول نتيجة sd_id ثم اجلب ترجماتها
    const sdId = d1?.results?.[0]?.sd_id;
    if (!sdId) return [];
    // الخطوة 2: جلب الترجمات بالـ sd_id
    const p2 = new URLSearchParams({ api_key: CFG.SUBDL_KEY, sd_id: sdId, languages: SUBDL_LANGS.join(',') });
    const r2   = await httpGet(`https://api.subdl.com/api/v1/subtitles?${p2}`, 25000);
    const d2   = parseJson(r2.body);
    return d2?.subtitles || [];
  } catch (e) {
    log(`    ⚠ SubDL بحث فشل: ${e.message}`);
    return [];
  }
}

// تحميل ملف zip وفك ضغطه للحصول على أول srt
function extractSrtFromZip(zipPath, outDir) {
  try {
    execSync(`unzip -jo "${zipPath}" "*.srt" -d "${outDir}" 2>/dev/null`);
    const files = fs.readdirSync(outDir).filter(f => f.endsWith('.srt'));
    return files.length ? path.join(outDir, files[0]) : null;
  } catch { return null; }
}

async function downloadSubtitleSrt(zipUrl, fileCode, lang) {
  const subDir = path.join(CFG.SUBS_DIR, fileCode);
  ensureDir(subDir);
  const zipPath = path.join(subDir, `${lang}.zip`);
  const srtDest = path.join(CFG.SUBS_DIR, `${fileCode}_${lang}.srt`);

  // إذا موجود مسبقاً
  if (fs.existsSync(srtDest)) return srtDest;

  try {
    const fullUrl = zipUrl.startsWith('http') ? zipUrl : `https://dl.subdl.com${zipUrl}`;
    await httpDownload(fullUrl, zipPath, 30000);

    // حاول استخراج srt من zip
    const extracted = extractSrtFromZip(zipPath, subDir);
    if (extracted) {
      fs.copyFileSync(extracted, srtDest);
      // نظّف
      try { fs.rmSync(subDir, { recursive: true }); } catch {}
      return srtDest;
    }

    // ربما الملف srt مباشرة
    const content = fs.readFileSync(zipPath, 'utf8');
    if (content.includes('-->')) {
      fs.copyFileSync(zipPath, srtDest);
      try { fs.unlinkSync(zipPath); } catch {}
      return srtDest;
    }
  } catch (e) {
    log(`    ⚠ تحميل ترجمة فشل: ${e.message}`);
  }
  return null;
}

// جلب ورفع الترجمات لملف LuluStream
async function fetchAndUploadSubtitles(fileCode, title, year, imdbId = '', type = 'movie') {
  if (!CFG.SUBDL_KEY) return;

  const subs = await searchSubDL(title, year, type, imdbId);
  if (!subs.length) { log(`    ℹ لا توجد ترجمات لـ ${title}`); return; }

  // جمّع أول ترجمة لكل لغة
  const byLang = {};
  for (const s of subs) {
    const lang = (s.lang || s.language || '').toLowerCase();
    const isAr = lang.includes('arab') || lang === 'ar';
    const isKu = lang.includes('kurd') || lang === 'ku' || lang.includes('sorani');
    const code = isAr ? 'ar' : isKu ? 'ku' : null;
    if (code && !byLang[code]) byLang[code] = s.url || s.zipLink || s.download_url;
  }

  for (const [lang, url] of Object.entries(byLang)) {
    if (!url) continue;
    const srtPath = await downloadSubtitleSrt(url, fileCode, lang);
    if (!srtPath) continue;

    // رفع الملف عبر VPS URL
    const filename  = path.basename(srtPath);
    const serveUrl  = `${CFG.VPS_URL}/subs/${filename}`;
    await luluUploadSubtitle(fileCode, serveUrl, lang);
  }
}

// ══════════════════════════════════════════════════════
// معالجة الأفلام
// ══════════════════════════════════════════════════════
async function processVod(progress) {
  log('\n═══ جلب فئات الأفلام من IPTV ═══');
  const categories = await getVodCategories();
  log(`  وجدت ${categories.length} فئة أفلام`);

  const moviesRootId = await ensureLuluFolder('أفلام');

  for (const cat of categories) {
    const catName  = cat.category_name || `cat_${cat.category_id}`;

    // ✅ فلتر: تجاهل الفئات الأجنبية غير المترجمة
    if (!isTargetContent(catName)) {
      log(`\n► تجاهل فئة (أجنبية): ${catName}`);
      continue;
    }

    const langLabel  = detectLang(catName);
    log(`\n► فئة: ${catName}`);

    let streams;
    try { streams = await getVodStreams(cat.category_id); }
    catch (e) { log(`  ⚠ ${e.message}`); continue; }

    // مجلد لكل فئة باسمها الأصلي
    const catFolderId = moviesRootId
      ? await ensureLuluFolder(catName, moviesRootId) : 0;

    for (const stream of streams) {
      const key = `movie_${stream.stream_id}`;
      if (progress.uploaded[key])                       { log(`  ✓ [مكتمل] ${stream.name}`); continue; }
      if ((progress.failed[key] || 0) >= CFG.MAX_RETRY) { log(`  ✗ [تجاهل] ${stream.name}`); continue; }
      // ✅ فلتر اسم الفيلم
      if (!isTargetStream(stream.name)) { log(`  ↷ [تخطي أجنبي] ${stream.name}`); continue; }

      const ext        = stream.container_extension || 'mp4';
      const srcUrl     = vodStreamUrl(stream.stream_id, ext);
      const cleanName  = cleanTitle(stream.name);

      // جلب بيانات الفيلم الكاملة
      let meta = {};
      try {
        const vodInfo = await getVodInfo(stream.stream_id);
        meta = vodInfo?.info || {};
      } catch {}

      const title  = cleanName || stream.name;
      const year   = meta.releasedate ? String(meta.releasedate).substring(0, 4) : '';
      const descr  = buildDescription(meta, langLabel, catName);
      const tags   = buildTags(meta, langLabel, catName);

      while (true) {
        try {
          const fileCode = await luluRemoteUpload(srcUrl, title, catFolderId);
          await sleep(1500);
          await luluFileEdit(fileCode, { title, descr, tags });

          progress.uploaded[key] = {
            fileCode,
            title,
            originalTitle  : stream.name,
            cat            : catName,
            lang           : langLabel,
            poster         : meta.cover || meta.movie_image || '',
            year,
            genre          : meta.genre    || '',
            rating         : meta.rating   || '',
            director       : meta.director || '',
            country        : meta.country  || '',
            plot           : meta.plot     ? meta.plot.slice(0, 300) : '',
            subtitles      : {},
            ts             : Date.now(),
          };
          saveProgress(progress);
          log(`  ✅ ${title} → ${fileCode}`);

          // جلب ورفع الترجمات
          await fetchAndUploadSubtitles(fileCode, title, year, meta.tmdb_id || '', 'movie');
          // تحديث حالة الترجمة في progress
          progress.uploaded[key].subtitles = { attempted: true, ts: Date.now() };
          saveProgress(progress);
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

// ══════════════════════════════════════════════════════
// معالجة المسلسلات
// ══════════════════════════════════════════════════════
async function processSeries(progress) {
  log('\n═══ جلب فئات المسلسلات من IPTV ═══');
  const categories = await getSeriesCategories();
  log(`  وجدت ${categories.length} فئة مسلسلات`);

  const seriesRootId = await ensureLuluFolder('مسلسلات');

  for (const cat of categories) {
    const catName  = cat.category_name || `cat_${cat.category_id}`;

    // ✅ فلتر: تجاهل الفئات الأجنبية غير المترجمة
    if (!isTargetContent(catName)) {
      log(`\n► تجاهل فئة (أجنبية): ${catName}`);
      continue;
    }

    const langLabel = detectLang(catName);
    log(`\n► فئة: ${catName}`);

    let seriesList;
    try { seriesList = await getSeries(cat.category_id); }
    catch (e) { log(`  ⚠ ${e.message}`); continue; }

    for (const show of seriesList) {
      // ✅ فلتر اسم المسلسل
      if (!isTargetStream(show.name)) { log(`  ↷ [تخطي أجنبي] ${show.name}`); continue; }

      const cleanShowName = cleanTitle(show.name);
      log(`  ┌ ${cleanShowName}`);

      let info;
      try { info = await getSeriesInfo(show.series_id); }
      catch (e) { log(`  ⚠ ${e.message}`); continue; }

      const showMeta  = info.info     || {};
      const episodes  = info.episodes || {};
      const showDescr = buildDescription(showMeta, langLabel, catName);
      const showTags  = buildTags(showMeta, langLabel, catName);
      const showYear  = showMeta.releaseDate ? String(showMeta.releaseDate).substring(0, 4) : '';

      // مجلد المسلسل باسمه الأصلي
      const showFolderId = seriesRootId
        ? await ensureLuluFolder(cleanShowName, seriesRootId) : 0;

      for (const [seasonNum, eps] of Object.entries(episodes)) {
        const seasonFolderId = showFolderId
          ? await ensureLuluFolder(`الموسم ${seasonNum}`, showFolderId) : 0;

        for (const ep of eps) {
          const key = `series_${ep.id}`;
          if (progress.uploaded[key])                       continue;
          if ((progress.failed[key] || 0) >= CFG.MAX_RETRY) continue;

          const ext     = ep.container_extension || 'mp4';
          const epNum   = String(ep.episode_num).padStart(2, '0');
          const sNum    = String(seasonNum).padStart(2, '0');
          const epLabel = ep.title && ep.title !== String(ep.episode_num) ? ep.title : `الحلقة ${ep.episode_num}`;
          const epTitle = `${cleanShowName} - الموسم ${sNum} - ${epLabel}`;
          const srcUrl  = episodeUrl(ep.id, ext);

          while (true) {
            try {
              const fileCode = await luluRemoteUpload(srcUrl, epTitle, seasonFolderId);
              await sleep(1500);
              await luluFileEdit(fileCode, { title: epTitle, descr: showDescr, tags: showTags });

              progress.uploaded[key] = {
                fileCode,
                title      : epTitle,
                show       : cleanShowName,
                cat        : catName,
                season     : Number(seasonNum),
                ep         : ep.episode_num,
                lang       : langLabel,
                poster     : showMeta.cover || showMeta.backdrop_path?.[0] || '',
                year       : showYear,
                genre      : showMeta.genre  || '',
                rating     : showMeta.rating || '',
                country    : showMeta.country || '',
                subtitles  : {},
                ts         : Date.now(),
              };
              saveProgress(progress);
              log(`  ✅ ${epTitle} → ${fileCode}`);

              // جلب ورفع الترجمات للحلقة
              await fetchAndUploadSubtitles(
                fileCode, cleanShowName, showYear, showMeta.tmdb_id || '', 'tv'
              );
              progress.uploaded[key].subtitles = { attempted: true, ts: Date.now() };
              saveProgress(progress);
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
  ensureDir(CFG.SUBS_DIR);

  log('══════════════════════════════════════════════════');
  log('  IPTV → LuluStream Sync v2 بدأ');
  log(`  IPTV   : ${CFG.IPTV_HOST}:${CFG.IPTV_PORT}`);
  log(`  Lulu   : ${CFG.LULU_KEY.slice(0, 6)}...`);
  log(`  SubDL  : ${CFG.SUBDL_KEY ? 'مفعّل ✓' : '⚠ لم يُضبط SUBDL_KEY — الترجمات معطّلة'}`);
  log(`  فلتر   : محتوى عربي/مترجم/مدبلج فقط`);
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
}

main().catch(e => { log(`FATAL: ${e.message}`); process.exit(1); });
