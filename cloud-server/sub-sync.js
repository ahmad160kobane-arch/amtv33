/**
 * sub-sync.js — جلب روابط ترجمات من SubDL وتخزينها في progress.json
 * لا يحتاج رفع لـ LuluStream — يخزّن روابط التحميل المباشر
 */

'use strict';

const fs    = require('fs');
const http  = require('http');
const https = require('https');

const CFG = {
  SUBDL_KEY : process.env.SUBDL_KEY || 'MA5RWk78R1H6Gyd-Xu0B37pLWc3MjUCQ',
  PROGRESS  : '/root/lulu_progress.json',
  LOG_FILE  : '/root/sub_sync.log',
  DELAY_MS  : 2500,
};

const SUBDL_LANGS = ['AR', 'KU'];

// ── أدوات ──────────────────────────────────────────────
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(CFG.LOG_FILE, line + '\n'); } catch {}
}
function sleep(ms)    { return new Promise(r => setTimeout(r, ms)); }
function parseJson(b) { try { return JSON.parse(b); } catch { return null; } }

// ── HTTP GET ──────────────────────────────────────────────
function httpGet(url, ms = 25000) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout: ms }, res => {
      if ([301,302,307,308].includes(res.statusCode) && res.headers.location)
        return httpGet(res.headers.location, ms).then(resolve).catch(reject);
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// ── تنظيف العنوان ────────────────────────────────────────────
function cleanForSearch(name = '') {
  return name
    .replace(/^(EN|AR|NF|TR|HN|KR|IT|FR|DE|ES|PL|PER|KRD|NL|CH|JP|RU|ENG)\s*[|\-]/i, '')
    .replace(/^(NETFLIX|DISNEY|HBO|APPLE|AMAZON|PRIME|SHAHID)\s*[|\-]/i, '')
    .replace(/^(English|Turkish|Hindi|French|German|Korean|Japanese|Italian|Spanish|Persian|Russian)\s*[|\-]/i, '')
    .replace(/\s*\d{4}\s*$/, '').replace(/\s{2,}/g, ' ').trim();
}

// ── SubDL API ───────────────────────────────────────────────
async function searchSubDL(name, year = '', type = 'movie') {
  try {
    const p1 = new URLSearchParams({ api_key: CFG.SUBDL_KEY, film_name: name, languages: SUBDL_LANGS.join(','), type });
    if (year) p1.set('year', String(year).substring(0, 4));
    const r1 = await httpGet(`https://api.subdl.com/api/v1/subtitles?${p1}`);
    const d1 = parseJson(r1.body);
    if (d1?.subtitles?.length) return d1.subtitles;
    const sdId = d1?.results?.[0]?.sd_id;
    if (!sdId) return [];
    const p2 = new URLSearchParams({ api_key: CFG.SUBDL_KEY, sd_id: sdId, languages: SUBDL_LANGS.join(',') });
    const r2 = await httpGet(`https://api.subdl.com/api/v1/subtitles?${p2}`);
    return parseJson(r2.body)?.subtitles || [];
  } catch (e) { log(`  ⚠ SubDL: ${e.message}`); return []; }
}

// ── المعالجة ─────────────────────────────────────────────────
async function main() {
  log('══════════════════════════════════════════════');
  log('  Sub-Sync — جلب روابط ترجمات وتخزينها في progress.json');
  log(`  SubDL: ${CFG.SUBDL_KEY.slice(0,8)}...`);
  log('══════════════════════════════════════════════');

  const progress = parseJson(fs.readFileSync(CFG.PROGRESS, 'utf8'));
  const entries  = Object.entries(progress.uploaded);
  log(`  إجمالي الملفات: ${entries.length}`);

  let found = 0, skipped = 0, noSub = 0;

  for (const [key, entry] of entries) {
    if (entry.subtitleUrls) { skipped++; continue; }  // موجود مسبقاً

    const type      = key.startsWith('movie_') ? 'movie' : 'tv';
    const rawTitle  = entry.show || entry.title || '';
    const title     = cleanForSearch(rawTitle)
      .replace(/\s*-\s*الموسم.*$/, '').replace(/\s*-\s*الحلقة.*$/, '').trim();
    const year      = entry.year || '';
    if (!entry.fileCode || !title) { skipped++; continue; }

    log(`\n[${found + skipped + noSub + 1}/${entries.length}] ${title}`);

    const subs = await searchSubDL(title, year, type);
    if (!subs.length) { log('  ℹ لا توجد ترجمات'); noSub++; await sleep(CFG.DELAY_MS); continue; }

    const urls = {};
    for (const s of subs) {
      const l   = (s.lang || s.language || '').toLowerCase();
      const isAr = l.includes('arab') || l === 'ar';
      const isKu = l.includes('kurd') || l === 'ku' || l.includes('sorani');
      const code = isAr ? 'ar' : isKu ? 'ku' : null;
      if (code && !urls[code]) {
        const relUrl = s.url || s.zipLink || '';
        if (relUrl) urls[code] = relUrl.startsWith('http') ? relUrl : `https://dl.subdl.com${relUrl}`;
      }
    }

    if (Object.keys(urls).length) {
      entry.subtitleUrls = urls;  // { ar: 'https://...', ku: 'https://...' }
      fs.writeFileSync(CFG.PROGRESS, JSON.stringify(progress, null, 2));
      log(`  ✅ ترجمات: ${Object.keys(urls).join(', ')}`);
      found++;
    } else {
      noSub++;
    }

    await sleep(CFG.DELAY_MS);
  }

  log(`\n══ انتهى ══`);
  log(`  ✅ وُجدت ترجمات: ${found} ملف`);
  log(`  ℹ بدون ترجمة: ${noSub} ملف`);
  log(`  ↷ متخطى: ${skipped} ملف`);
}

main().catch(e => { log(`FATAL: ${e.message}`); process.exit(1); });
