'use strict';

/**
 * iptv-to-lulu.js — Stream pipe uploader (no disk writes)
 *
 * Flow: IPTV server → this process (memory pipe) → LuluStream
 *
 * Folders mirror IPTV categories:
 *   [AR] Arabic Movies /
 *     <اسم الفيلم> /
 *   [AR] Arabic Series /
 *     <اسم المسلسل> /
 *       الموسم 1 /
 */

const fs     = require('fs');
const path   = require('path');
const xtream = require('./xtream-api');
const lulu   = require('./lulu-api');
const tmdb   = require('./tmdb-api');
const db     = require('./db');

// زيادة حد المستمعين لتجنب التحذيرات (عدد كبير من الاتصالات المتزامنة)
require('events').EventEmitter.defaultMaxListeners = 50;

const STATE_FILE   = path.resolve('iptv-state.json');
const RESULTS_FILE = path.resolve('iptv-results.json');

// ─── State helpers ─────────────────────────────────────────────────────────────

function loadState()  {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch (_) { return { uploaded: {}, failed: {} }; }
}
function saveState(s) { fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2), 'utf8'); }

function loadResults()  {
  try { return JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf8')); }
  catch (_) { return []; }
}
function saveResults(r) { fs.writeFileSync(RESULTS_FILE, JSON.stringify(r, null, 2), 'utf8'); }

// ─── Folder cache ──────────────────────────────────────────────────────────────

const _fc = {};
async function dir(name, parentId = 0) {
  const safeName = String(name).replace(/[/\\]/g, '-').trim().slice(0, 100);
  const key = `${parentId}::${safeName}`;
  if (_fc[key] != null) return _fc[key];
  
  try {
    const list = await lulu.listFolders(parentId);
    const hit  = (list.result?.folders || []).find(f => f.name === safeName);
    if (hit) { _fc[key] = Number(hit.fld_id); return _fc[key]; }
  } catch (_) {}
  
  // تأخير 1.2 ثانية قبل إنشاء مجلد جديد (تجنب 60 req/min limit)
  await xtream.sleep(1200);
  
  const res = await lulu.createFolder(safeName, parentId);
  _fc[key] = Number(res.result.fld_id);
  console.log(`  [📁 جديد] "${safeName}"`);
  return _fc[key];
}

// ─── TMDB (best-effort) ────────────────────────────────────────────────────────

async function fetchMovieMeta(item) {
  // ستخدم TMDB ID من بيانات IPTV إذا توفرت؛ وإلا يبحث بالاسم
  if (item.tmdb) {
    try { return await tmdb.getMovieDetails(Number(item.tmdb)); } catch (_) {}
  }
  try { return await tmdb.searchAndGetMovie(item.name); } catch (_) { return null; }
}

async function fetchTvMeta(show, s, e) {
  if (show.tmdb) {
    try { return await tmdb.getTvDetails(Number(show.tmdb), s, e); } catch (_) {}
  }
  try { return await tmdb.searchAndGetTv(show.name, s, e); } catch (_) { return null; }
}

// ─── Single VOD upload (stream pipe) ──────────────────────────────────────────

async function uploadVod(item, catName, state, results, dryRun) {
  const stateKey = `movie_${item.stream_id}`;
  if (state.uploaded[stateKey]) {
    process.stdout.write(`  [⏭ تخطي] ${item.name}\n`);
    return 'skip';
  }

  const ext       = item.container_extension || 'mkv';
  const streamUrl = xtream.vodStreamUrl(item.stream_id, ext);

  // جلب بيانات TMDB كاملة
  const meta  = await fetchMovieMeta(item);
  const title = meta?.title || item.name;
  const descr = meta?.description || '';
  const tags  = meta?.genres || '';

  if (dryRun) {
    console.log(`  [🔍] ${title}  (${(await sizeOf(streamUrl))})`);
    return 'dry';
  }

  // ─── إنشاء المجلدات فقط عند الرفع الفعلي ───
  console.log(`\n  [⬆ رفع] ${title}`);
  console.log(`  [📁] إنشاء المجلدات...`);
  
  // Folder: <catName> / <title>
  const rootId = await dir(catName);
  const fldId  = await dir(title, rootId);

  try {
    const filename = sanitize(title) + '.' + ext;
    
    // رفع الفيديو إلى Lulu (قد يستغرق دقائق حسب حجم الملف)
    console.log(`  [📤] جاري الرفع...`);
    const file = await lulu.streamUpload(streamUrl, filename, {
      fldId, fileTitle: title, tags, filePublic: 1,
    });
    
    console.log(`  [✅] اكتمل الرفع - File Code: ${file.filecode}`);

    if (descr) await lulu.editFile({ fileCode: file.filecode, title, descr, fldId, tags }).catch(()=>{});

    // ── حفظ في قاعدة البيانات بعد نجاح الرفع ────────────────────────────────
    console.log(`  [💾] حفظ في قاعدة البيانات...`);
    await db.saveMovieToCatalog({
      id:       String(file.filecode),
      title,
      fileCode: file.filecode,
      fldId,
      embedUrl: `https://luluvdo.com/e/${file.filecode}`,
      hlsUrl:   `https://luluvdo.com/hls/${file.filecode}/master.m3u8`,
      canplay:  false,
      poster:   meta?.posterUrl   || item.stream_icon || '',
      backdrop: meta?.backdropUrl || '',
      overview: meta?.overview    || '',
      year:     meta?.year        || '',
      cast:     meta?.cast        || '',
      genres:   meta?.genres      || '',
      director: meta?.director    || '',
      country:  meta?.country     || '',
      runtime:  meta?.runtime     || '',
      rating:   meta?.rating      || item.rating || '',
      tmdbId:   meta?.tmdbId      || (item.tmdb ? Number(item.tmdb) : null),
      imdbId:   meta?.imdbId      || '',
    }).then(() => {
      console.log(`  [💾 DB] ✓ تم الحفظ`);
    }).catch(e => {
      console.log(`  [💾 DB] ⚠️  ${e.message}`);
    });

    const entry = {
      type: 'vod', stateKey, title, catName,
      fileCode: file.filecode,
      luluUrl:  `https://lulustream.com/${file.filecode}.html`,
      sourceUrl: streamUrl,
      uploadedAt: new Date().toISOString(),
    };

    state.uploaded[stateKey] = {
      fileCode : file.filecode,
      title,
      poster   : meta?.posterUrl  || item.stream_icon || '',
      year     : meta?.year       || '',
      genre    : meta?.genres     || '',
      tmdb_id  : meta?.tmdbId     || item.tmdb || '',
      lang     : 'ar',
      cat      : catName,
      ts       : Date.now(),
    };
    saveState(state);
    results.push(entry);
    saveResults(results);

    console.log(`  ✅ ${file.filecode}  →  ${entry.luluUrl}`);
    
    // تأخير 5-8 ثواني بعد كل رفع ناجح (تجنب rate limit)
    await xtream.sleep(5000 + Math.floor(Math.random() * 3000));
    return 'ok';

  } catch (err) {
    console.log(`\n  ❌ ${err.message}`);
    state.failed[stateKey] = err.message;
    saveState(state);
    return 'err';
  }
}

// ─── Single episode upload (stream pipe) ──────────────────────────────────────

async function uploadEpisode(show, catName, season, ep, state, results, dryRun) {
  const showTitle = show.name;
  const stateKey  = `series_${ep.id}`;
  if (state.uploaded[stateKey]) {
    process.stdout.write(`  [⏭ تخطي] ح${ep.episode_num}\n`);
    return 'skip';
  }

  const ext       = ep.container_extension || 'mkv';
  const streamUrl = xtream.seriesStreamUrl(ep.id, ext);
  const s         = Number(season);
  const e         = Number(ep.episode_num);

  // جلب بيانات TMDB (العرض + الحلقة)
  const meta    = await fetchTvMeta(show, s, e);
  const epTitle = meta?.title || `${showTitle} - الموسم ${s} ح${String(e).padStart(2,'0')}`;
  const descr   = meta?.description || '';
  const tags    = meta?.genres || '';

  if (dryRun) {
    console.log(`  [🔍] ${epTitle}`);
    return 'dry';
  }

  // ─── إنشاء المجلدات فقط عند الرفع الفعلي ───
  console.log(`\n  [⬆ رفع] ${epTitle}`);
  console.log(`  [📁] إنشاء المجلدات...`);
  
  // Folder: <catName> / <showTitle> / الموسم N
  const rootId      = await dir(catName);
  const showFldId   = await dir(showTitle, rootId);
  const seasonId    = await dir(`الموسم ${s}`, showFldId);

  try {
    const filename = sanitize(epTitle) + '.' + ext;
    
    // رفع الحلقة إلى Lulu (قد يستغرق دقائق حسب حجم الملف)
    console.log(`  [📤] جاري الرفع...`);
    const file = await lulu.streamUpload(streamUrl, filename, {
      fldId: seasonId, fileTitle: epTitle, tags, filePublic: 1,
    });
    
    console.log(`  [✅] اكتمل الرفع - File Code: ${file.filecode}`);

    if (descr) await lulu.editFile({ fileCode: file.filecode, title: epTitle, descr, fldId: seasonId, tags }).catch(()=>{});

    // ── حفظ في قاعدة البيانات بعد نجاح الرفع ────────────────────────────────
    console.log(`  [💾] حفظ في قاعدة البيانات...`);
    await db.saveSeriesEpisode(
      { // بيانات المسلسل
        id:       String(show.series_id),
        showTitle,
        fldId:    showFldId,
        poster:   meta?.posterUrl   || show.cover || '',
        backdrop: meta?.backdropUrl || (show.backdrop_path?.[0] || ''),
        overview: meta?.overview    || show.plot  || '',
        year:     meta?.year        || (show.releaseDate?.split('-')[0] || ''),
        cast:     meta?.cast        || show.cast  || '',
        genres:   meta?.genres      || show.genre || '',
        director: meta?.director    || show.director || '',
        country:  meta?.country     || '',
        rating:   meta?.rating      || show.rating || '',
        tmdbId:   meta?.tmdbId      || (show.tmdb ? Number(show.tmdb) : null),
        imdbId:   meta?.imdbId      || '',
      },
      { // بيانات الحلقة
        fileCode:  file.filecode,
        season:    s,
        episode:   e,
        title:     epTitle,
        canplay:   false,
        thumbnail: ep.info?.movie_image || meta?.posterUrl || show.cover || '',
        overview:  meta?.epOverview     || ep.info?.plot   || '',
        airDate:   meta?.epAirDate      || ep.info?.air_date || '',
      }
    ).then(() => {
      console.log(`  [💾 DB] ✓ تم الحفظ`);
    }).catch(e2 => {
      console.log(`  [💾 DB] ⚠️  ${e2.message}`);
    });

    const entry = {
      type: 'episode', stateKey, showTitle, season: s, episode: e, title: epTitle, catName,
      fileCode: file.filecode,
      luluUrl:  `https://lulustream.com/${file.filecode}.html`,
      sourceUrl: streamUrl,
      uploadedAt: new Date().toISOString(),
    };

    state.uploaded[stateKey] = {
      fileCode : file.filecode,
      title    : epTitle,
      show     : showTitle,
      season   : s,
      ep       : e,
      poster   : meta?.posterUrl || show.cover || '',
      genre    : meta?.genres   || show.genre  || '',
      tmdb_id  : meta?.tmdbId   || show.tmdb   || '',
      lang     : 'ar',
      ts       : Date.now(),
    };
    saveState(state);
    results.push(entry);
    saveResults(results);

    console.log(`  ✅ ${file.filecode}  →  ${entry.luluUrl}`);
    
    // تأخير 5-8 ثواني بعد كل رفع ناجح (تجنب rate limit)
    await xtream.sleep(5000 + Math.floor(Math.random() * 3000));
    return 'ok';

  } catch (err) {
    console.log(`\n  ❌ ${err.message}`);
    state.failed[stateKey] = err.message;
    saveState(state);
    return 'err';
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function sanitize(s) {
  return String(s).replace(/[\\/:*?"<>|]/g, '_').trim().slice(0, 120);
}

async function sizeOf(url) {
  try {
    const axios = require('axios');
    const r = await axios.head(url, { timeout: 5000, headers: { 'User-Agent': 'VLC/3.0.18' } });
    const b = Number(r.headers['content-length'] || 0);
    return b ? `${(b/1e6).toFixed(0)} MB` : '? MB';
  } catch (_) { return '? MB'; }
}

// ─── Sync Kids Content ─────────────────────────────────────────────────────────

async function syncKids({ limit, dryRun, categoryFilter }) {
  console.log('\n══ محتوى الأطفال العربي ══');
  
  // جلب تصنيفات الأفلام والمسلسلات
  const [vodCats, seriesCats] = await Promise.all([
    xtream.getVodCategories().catch(() => []),
    xtream.getSeriesCategories().catch(() => []),
  ]);

  // تصفية محتوى الأطفال العربي فقط
  const kidsVodCats = vodCats.filter(c => 
    xtream.isKidsCategory(c.category_name) && xtream.isArabicCategory(c.category_name)
  );
  const kidsSeriesCats = seriesCats.filter(c => 
    xtream.isKidsCategory(c.category_name) && xtream.isArabicCategory(c.category_name)
  );

  if (!kidsVodCats.length && !kidsSeriesCats.length) {
    console.log('لا توجد تصنيفات أطفال عربية.');
    return { ok:0, skip:0, err:0 };
  }

  console.log(`  أفلام الأطفال: ${kidsVodCats.map(c=>c.category_name).join(' | ')}`);
  console.log(`  مسلسلات الأطفال: ${kidsSeriesCats.map(c=>c.category_name).join(' | ')}`);

  const state=loadState(), results=loadResults();
  let ok=0, skip=0, err=0, total=0;

  // ── رفع أفلام الأطفال ──
  for (const cat of kidsVodCats) {
    if (categoryFilter && !cat.category_name.includes(categoryFilter)) continue;
    console.log(`\n  [تصنيف أطفال] ${cat.category_name}`);
    let streams;
    try { streams = await xtream.getVodStreamsByCategory(cat.category_id); }
    catch (e) { console.log(`  ✗ ${e.message}`); continue; }

    for (const item of (streams||[])) {
      if (total >= limit) { 
        console.log(`\n  [توقف] بلغ الحد (${limit})`); 
        return {ok,skip,err}; 
      }
      const res = await uploadVod(item, cat.category_name, state, results, dryRun);
      if (res==='ok')   { ok++;   total++; }
      if (res==='skip') { skip++; }
      if (res==='err')  { err++;  total++; }
    }
  }

  // ── رفع مسلسلات الأطفال ──
  for (const cat of kidsSeriesCats) {
    if (total >= limit) break;
    if (categoryFilter && !cat.category_name.includes(categoryFilter)) continue;
    console.log(`\n  [تصنيف أطفال] ${cat.category_name}`);
    let seriesList;
    try { seriesList = await xtream.getSeriesByCategory(cat.category_id); }
    catch (e) { console.log(`  ✗ ${e.message}`); continue; }

    for (const show of (seriesList||[])) {
      if (total >= limit) { 
        console.log(`\n  [توقف] بلغ الحد (${limit})`); 
        return {ok,skip,err}; 
      }
      console.log(`\n  [مسلسل أطفال] ${show.name}`);
      let info;
      try { info = await xtream.getSeriesInfo(show.series_id); }
      catch (e) { console.log(`  ✗ ${e.message}`); continue; }

      for (const [season, eps] of Object.entries(info?.episodes||{})) {
        for (const ep of (eps||[])) {
          if (total >= limit) { 
            console.log(`\n  [توقف] بلغ الحد (${limit})`); 
            return {ok,skip,err}; 
          }
          const res = await uploadEpisode(show, cat.category_name, season, ep, state, results, dryRun);
          if (res==='ok')   { ok++;   total++; }
          if (res==='skip') { skip++; }
          if (res==='err')  { err++;  total++; }
        }
      }
    }
  }

  return {ok,skip,err};
}

// ─── Sync VOD ──────────────────────────────────────────────────────────────────

async function syncVod({ limit, dryRun, categoryFilter }) {
  console.log('\n══ الأفلام العربية ══');
  const cats       = await xtream.getVodCategories();
  const arabicCats = cats.filter(c => xtream.isArabicCategory(c.category_name));

  if (!arabicCats.length) { console.log('لا توجد تصنيفات عربية.'); return { ok:0,skip:0,err:0 }; }
  console.log(`  التصنيفات: ${arabicCats.map(c=>c.category_name).join(' | ')}`);

  const state=loadState(), results=loadResults();
  let ok=0,skip=0,err=0,total=0;

  for (const cat of arabicCats) {
    if (categoryFilter && !cat.category_name.includes(categoryFilter)) continue;
    console.log(`\n  [تصنيف] ${cat.category_name}`);
    let streams;
    try { streams = await xtream.getVodStreamsByCategory(cat.category_id); }
    catch (e) { console.log(`  ✗ ${e.message}`); continue; }

    for (const item of (streams||[])) {
      if (total >= limit) { console.log(`\n  [توقف] بلغ الحد (${limit})`); return {ok,skip,err}; }
      const res = await uploadVod(item, cat.category_name, state, results, dryRun);
      if (res==='ok')   { ok++;   total++; }
      if (res==='skip') { skip++; }
      if (res==='err')  { err++;  total++; }
    }
  }
  return {ok,skip,err};
}

// ─── Sync Series ───────────────────────────────────────────────────────────────

async function syncSeries({ limit, dryRun, categoryFilter }) {
  console.log('\n══ المسلسلات العربية ══');
  const cats       = await xtream.getSeriesCategories();
  const arabicCats = cats.filter(c => xtream.isArabicCategory(c.category_name));

  if (!arabicCats.length) { console.log('لا توجد تصنيفات عربية.'); return { ok:0,skip:0,err:0 }; }
  console.log(`  التصنيفات: ${arabicCats.map(c=>c.category_name).join(' | ')}`);

  const state=loadState(), results=loadResults();
  let ok=0,skip=0,err=0,total=0;

  for (const cat of arabicCats) {
    if (categoryFilter && !cat.category_name.includes(categoryFilter)) continue;
    console.log(`\n  [تصنيف] ${cat.category_name}`);
    let seriesList;
    try { seriesList = await xtream.getSeriesByCategory(cat.category_id); }
    catch (e) { console.log(`  ✗ ${e.message}`); continue; }

    for (const show of (seriesList||[])) {
      if (total >= limit) { console.log(`\n  [توقف] بلغ الحد (${limit})`); return {ok,skip,err}; }
      console.log(`\n  [مسلسل] ${show.name}`);
      let info;
      try { info = await xtream.getSeriesInfo(show.series_id); }
      catch (e) { console.log(`  ✗ ${e.message}`); continue; }

      for (const [season, eps] of Object.entries(info?.episodes||{})) {
        for (const ep of (eps||[])) {
          if (total >= limit) { console.log(`\n  [توقف] بلغ الحد (${limit})`); return {ok,skip,err}; }
      const res = await uploadEpisode(show, cat.category_name, season, ep, state, results, dryRun);
          if (res==='ok')   { ok++;   total++; }
          if (res==='skip') { skip++; }
          if (res==='err')  { err++;  total++; }
        }
      }
    }
  }
  return {ok,skip,err};
}

// ─── Public entry ──────────────────────────────────────────────────────────────

async function run({ mode='all', limit=20, dryRun=false, categoryFilter=null }) {
  // تهيئة قاعدة البيانات أولاً
  try {
    await db.ensureTables();
    console.log('  [DB] ✓ قاعدة البيانات جاهزة');
  } catch (e) {
    console.warn(`  [DB] ⚠️  ${e.message} — سيكمل بدون حفظ في DB`);
  }

  // Startup delay — avoid duplicate connections if pm2 restarted mid-stream
  const startupDelay = 8000 + Math.floor(Math.random() * 5000);
  console.log(`\n⏳ تأخير البداية: ${(startupDelay/1000).toFixed(1)}s (لتجنب تعارض الاتصالات)...`);
  await xtream.sleep(startupDelay);

  console.log('\nجاري التحقق من حساب IPTV...');
  const info = await xtream.getAccountInfo();
  const ui   = info.user_info || info;
  console.log(`  المستخدم : ${ui.username}`);
  console.log(`  الحالة   : ${ui.status}`);
  console.log(`  الانتهاء : ${ui.exp_date ? new Date(ui.exp_date*1000).toLocaleDateString('ar') : '—'}`);
  console.log(`  الاتصالات: ${ui.active_cons||0} / ${ui.max_connections||'?'}`);

  if (ui.status && ui.status !== 'Active') {
    console.warn(`  ⚠️  الحساب "${ui.status}" — لن يتم الرفع.`); return;
  }

  let okTotal=0, skipTotal=0, errTotal=0;

  // ═══ الأولوية الأولى: محتوى الأطفال العربي ═══
  if (mode==='kids'||mode==='all') {
    console.log('\n🎨 الأولوية الأولى: رفع محتوى الأطفال العربي...\n');
    const r = await syncKids({ limit, dryRun, categoryFilter });
    okTotal+=r.ok; skipTotal+=r.skip; errTotal+=r.err;
  }

  // ═══ الأولوية الثانية: المسلسلات العربية ═══
  if (mode==='series'||mode==='all') {
    const remaining = limit - okTotal;
    if (remaining > 0) {
      console.log('\n🎬 الأولوية الثانية: رفع المسلسلات العربية...\n');
      const r = await syncSeries({ limit: remaining, dryRun, categoryFilter });
      okTotal+=r.ok; skipTotal+=r.skip; errTotal+=r.err;
    } else {
      console.log('\n⚠️  تم بلوغ الحد الأقصى - لن يتم رفع المسلسلات');
    }
  }
  
  // ═══ الأولوية الثالثة: الأفلام العربية ═══
  if (mode==='movies'||mode==='all') {
    const remaining = limit - okTotal;
    if (remaining > 0) {
      console.log('\n🎥 الأولوية الثالثة: رفع الأفلام العربية...\n');
      const r = await syncVod({ limit: remaining, dryRun, categoryFilter });
      okTotal+=r.ok; skipTotal+=r.skip; errTotal+=r.err;
    } else {
      console.log('\n⚠️  تم بلوغ الحد الأقصى - لن يتم رفع الأفلام');
    }
  }

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`  ✅ نجح: ${okTotal}  |  ⏭ تخطي: ${skipTotal}  |  ❌ فشل: ${errTotal}`);
  console.log(`  النتائج: iptv-results.json`);
  console.log(`  الكتالوج محفوظ في: PostgreSQL`);
  console.log(`${'═'.repeat(50)}\n`);

  // ─── إعادة تحميل الكتالوج في السيرفر السحابي ───────────────────────────
  if (okTotal > 0 && !dryRun) {
    console.log('  [🔄] إعادة تحميل الكتالوج في السيرفر السحابي...');
    try {
      const axios = require('axios');
      const CLOUD_SERVER = process.env.CLOUD_SERVER_URL || 'http://62.171.153.204:8090';
      const res = await axios.post(`${CLOUD_SERVER}/api/lulu/reload`, {}, { timeout: 10000 });
      if (res.data && res.data.success) {
        console.log(`  [🔄] ✓ تم إعادة التحميل - ${res.data.count} عنصر في الكتالوج`);
      }
    } catch (e) {
      console.log(`  [🔄] ⚠️  فشل إعادة التحميل: ${e.message}`);
      console.log(`  [💡] يمكنك إعادة التحميل يدوياً: reload_catalog.bat`);
    }
  }

  await db.close().catch(() => {});
}

module.exports = { run };
