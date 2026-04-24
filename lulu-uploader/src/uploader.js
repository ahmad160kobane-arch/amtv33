'use strict';

const fs   = require('fs');
const path = require('path');
const lulu = require('./lulu-api');
const tmdb = require('./tmdb-api');
const db   = require('./db');

const RESULTS_FILE = path.resolve('results.json');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function loadResults() {
  try {
    return JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf8'));
  } catch (_) {
    return [];
  }
}

function saveResults(results) {
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2), 'utf8');
}

function log(prefix, msg) {
  const icons = { ok: '✓', err: '✗', info: '→', warn: '!' };
  console.log(`  [${icons[prefix] || prefix}] ${msg}`);
}

// ─── Folder cache (avoids redundant API calls) ────────────────────────────────

const _folderCache = {};

async function findOrCreateFolder(name, parentId = 0) {
  const key = `${parentId}:${name}`;
  if (_folderCache[key] != null) return _folderCache[key];

  // Check existing folders under parentId
  try {
    const list = await lulu.listFolders(parentId);
    const existing = (list.result?.folders || []).find(f => f.name === name);
    if (existing) {
      _folderCache[key] = Number(existing.fld_id);
      return _folderCache[key];
    }
  } catch (_) { /* ignore listing errors, proceed to create */ }

  // Create
  const res = await lulu.createFolder(name, parentId);
  _folderCache[key] = Number(res.result.fld_id);
  log('info', `أُنشئ مجلد: "${name}" (id=${_folderCache[key]})`);
  return _folderCache[key];
}

// ─── Movie upload ─────────────────────────────────────────────────────────────

async function processMovie(item) {
  // 1. Fetch metadata
  const meta = item.tmdb_id
    ? await tmdb.getMovieDetails(item.tmdb_id)
    : await tmdb.searchAndGetMovie(item.title);

  log('info', `الفيلم: ${meta.title} (${meta.year})`);

  // 2. Folder: أفلام عربية / <year>
  const rootId = await findOrCreateFolder('أفلام عربية');
  const fldId  = meta.year
    ? await findOrCreateFolder(meta.year, rootId)
    : rootId;

  // 3. Upload by URL — server-side, no local download
  log('info', `رفع الملف عبر الخادم: ${item.url}`);
  const upRes    = await lulu.uploadByUrl(item.url, fldId, 1, meta.tags);
  const fileCode = upRes.result.filecode;
  log('ok', `كود الملف: ${fileCode}`);

  // 4. Set metadata
  await lulu.editFile({
    fileCode,
    title:  meta.title,
    descr:  meta.description,
    fldId,
    tags:   meta.tags,
  });
  log('ok', `البيانات الوصفية مُعيَّنة`);

  // 5. Arabic subtitle (optional)
  if (item.subtitle_url) {
    await lulu.uploadSubtitleByUrl(fileCode, 'ara', item.subtitle_url);
    log('ok', `الترجمة العربية مُرفوعة`);
  }

  return {
    type:        'movie',
    id:          fileCode,       // unique ID for catalog (file code)
    title:       meta.title,
    fileCode,
    fldId,
    luluUrl:     `https://lulustream.com/${fileCode}.html`,
    embedUrl:    `https://luluvdo.com/e/${fileCode}`,
    hlsUrl:      `https://luluvdo.com/hls/${fileCode}/master.m3u8`,
    canplay:     false,          // سيتم تحديثه عند اكتمال الترميز
    posterUrl:   meta.posterUrl,
    backdropUrl: meta.backdropUrl,
    overview:    meta.overview,
    year:        meta.year,
    cast:        meta.cast,
    genres:      meta.genres,
    director:    meta.director,
    country:     meta.country,
    runtime:     meta.runtime,
    rating:      meta.rating,
    tmdbId:      meta.tmdbId,
    imdbId:      meta.imdbId,
  };
}

// ─── TV episode upload ────────────────────────────────────────────────────────

async function processTv(item) {
  const season  = Number(item.season  || 1);
  const episode = Number(item.episode || 1);

  // 1. Fetch metadata
  const meta = item.tmdb_id
    ? await tmdb.getTvDetails(item.tmdb_id, season, episode)
    : await tmdb.searchAndGetTv(item.title, season, episode);

  log('info', `المسلسل: ${meta.showTitle} — الموسم ${season} الحلقة ${episode}`);

  // 2. Folder: مسلسلات عربية / <Show> / الموسم <N>
  const rootId   = await findOrCreateFolder('مسلسلات عربية');
  const showId   = await findOrCreateFolder(meta.showTitle, rootId);
  const seasonId = await findOrCreateFolder(`الموسم ${season}`, showId);

  const s = String(season).padStart(2, '0');
  const e = String(episode).padStart(2, '0');
  const epTitle = `${meta.showTitle} - الموسم ${season} - الحلقة ${episode}`;

  // 3. Upload by URL
  log('info', `رفع الملف عبر الخادم: ${item.url}`);
  const upRes    = await lulu.uploadByUrl(item.url, seasonId, 1, meta.tags);
  const fileCode = upRes.result.filecode;
  log('ok', `كود الملف: ${fileCode}`);

  // 4. Set metadata
  await lulu.editFile({
    fileCode,
    title:  epTitle,
    descr:  meta.description,
    fldId:  seasonId,
    tags:   meta.tags,
  });
  log('ok', `البيانات الوصفية مُعيَّنة`);

  // 5. Arabic subtitle (optional)
  if (item.subtitle_url) {
    await lulu.uploadSubtitleByUrl(fileCode, 'ara', item.subtitle_url);
    log('ok', `الترجمة العربية مُرفوعة`);
  }

  return {
    type:        'tv',
    id:          String(showId),  // series ID = LuluStream show folder
    showId,
    showTitle:   meta.showTitle,
    title:       epTitle,
    season,
    episode,
    fileCode,
    fldId:       showId,          // اربط المسلسل بمجلده
    luluUrl:     `https://lulustream.com/${fileCode}.html`,
    embedUrl:    `https://luluvdo.com/e/${fileCode}`,
    hlsUrl:      `https://luluvdo.com/hls/${fileCode}/master.m3u8`,
    canplay:     false,
    posterUrl:   meta.posterUrl,
    backdropUrl: meta.backdropUrl,
    overview:    meta.overview,
    epOverview:  meta.epOverview || '',
    epAirDate:   meta.epAirDate  || '',
    year:        meta.year,
    cast:        meta.cast,
    genres:      meta.genres,
    director:    meta.director,
    country:     meta.country,
    rating:      meta.rating,
    tmdbId:      meta.tmdbId,
    imdbId:      meta.imdbId,
  };
}

// ─── Main batch uploader ──────────────────────────────────────────────────────

async function uploadAll(items) {
  // ── تهيئة قاعدة البيانات ────────────────────────────────────
  try {
    await db.ensureTables();
    log('ok', 'قاعدة البيانات جاهزة');
  } catch (e) {
    log('warn', `تحذير DB: ${e.message} — سيُكمَل الرفع بدون حفظ DB`);
  }

  // Verify API key first
  const acct = await lulu.getAccountInfo();
  const r    = acct.result;
  const gb = r.storage_left === 'unlimited' ? 'غير محدودة' : `${(Number(r.storage_left) / 1e9).toFixed(2)} GB`;
  console.log(`\n╔═══════════════════════════════════════════╗`);
  console.log(`║  LuluStream — ${r.login.padEnd(28)}║`);
  console.log(`║  الملفات: ${String(r.files_total).padEnd(34)}║`);
  console.log(`║  المساحة المتبقية: ${gb.padEnd(25)}║`);
  console.log(`║  الرصيد: $${String(r.balance).padEnd(32)}║`);
  console.log(`╚═══════════════════════════════════════════╝\n`);

  const results   = loadResults();
  let   succeeded = 0;
  let   failed    = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const label = item.title || `tmdb:${item.tmdb_id}` || item.url;
    console.log(`\n[${i + 1}/${items.length}] ${label}`);

    try {
      let result;
      const type = (item.type || '').toLowerCase();

      if (type === 'movie' || type === 'film') {
        result = await processMovie(item);
      } else if (type === 'tv' || type === 'series' || type === 'show') {
        result = await processTv(item);
      } else {
        log('warn', `النوع غير معروف (${item.type}) — تخطي`);
        continue;
      }

      results.push({
        ...result,
        sourceUrl:  item.url,
        uploadedAt: new Date().toISOString(),
      });
      saveResults(results);

      // ── حفظ في قاعدة البيانات ──────────────────────────────
      try {
        if (result.type === 'movie') {
          await db.saveMovieToCatalog(result);
          log('ok', `✓ حفظ في DB: فيلم "${result.title}"`);
        } else if (result.type === 'tv') {
          await db.saveSeriesEpisode(
            { // بيانات المسلسل
              id:          result.id,
              showTitle:   result.showTitle,
              fldId:       result.fldId,
              poster:      result.posterUrl,
              backdrop:    result.backdropUrl,
              overview:    result.overview,
              year:        result.year,
              cast:        result.cast,
              genres:      result.genres,
              director:    result.director,
              country:     result.country,
              rating:      result.rating,
              tmdbId:      result.tmdbId,
              imdbId:      result.imdbId,
            },
            { // بيانات الحلقة
              fileCode:    result.fileCode,
              season:      result.season,
              episode:     result.episode,
              title:       result.title,
              canplay:     result.canplay,
              overview:    result.epOverview,
              airDate:     result.epAirDate,
              thumbnail:   result.posterUrl,
            }
          );
          log('ok', `✓ حفظ في DB: مسلسل "${result.showTitle}" S${result.season}E${result.episode}`);
        }
      } catch (dbErr) {
        log('warn', `تحذير DB: ${dbErr.message}`);
      }

      succeeded++;
      console.log(`  ✓ تم الرفع: ${result.luluUrl}`);
    } catch (err) {
      log('err', err.message);
      results.push({
        sourceUrl: item.url,
        label,
        error:     err.message,
        failedAt:  new Date().toISOString(),
      });
      saveResults(results);
      failed++;
    }

    // Small delay between items to respect rate limits
    if (i < items.length - 1) await sleep(800);
  }

  console.log(`\n${'─'.repeat(46)}`);
  console.log(`  النتيجة: ✓ ${succeeded} نجح  |  ✗ ${failed} فشل`);
  console.log(`  النتائج محفوظة في: results.json`);
  console.log(`  الكتالوج محفوظ في: PostgreSQL`);
  console.log(`${'─'.repeat(46)}\n`);

  await db.close();
}

module.exports = { uploadAll };
