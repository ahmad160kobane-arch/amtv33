'use strict';

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const os    = require('os');

const TMDB_KEY     = process.env.TMDB_API_KEY || 'e25ac5a68fba3713e572198a050697ca';
const TMDB_BASE    = 'https://api.themoviedb.org/3';
const TMDB_IMG     = 'https://image.tmdb.org/t/p/w500';
const TMDB_IMG_ORG = 'https://image.tmdb.org/t/p/original';
const SUBDL_KEY    = process.env.SUBDL_KEY || 'MA5RWk78R1H6Gyd-Xu0B37pLWc3MjUCQ';
const IPTV_PROXY_SECRET = 'lulu_iptv_proxy_2026';
const LOCAL_PORT   = process.env.PORT || 8090;

function httpGet(url, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout: timeoutMs }, res => {
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location)
        return httpGet(res.headers.location, timeoutMs).then(resolve).catch(reject);
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('HTTP timeout')); });
  });
}

function parseJson(body) { try { return JSON.parse(body); } catch { return null; } }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function cleanTitle(name = '') {
  return name
    .replace(/^(EN|AR|NF|TR|HN|KR|IT|FR|DE|ES|PL|PER|KRD|NL|CH|JP|RU)\s*[|\-]/i, '')
    .replace(/^(NETFLIX|DISNEY|HBO|APPLE|AMAZON|PRIME|SHAHID)\s*[|\-]/i, '')
    .replace(/VOD\s*\d*/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function detectLang(catName = '') {
  const n = catName.toLowerCase();
  if (/ar.*sub|مترجم|arabic.*sub/i.test(n))  return 'مترجم للعربية';
  if (/ar.*dub|دبلجة|مدبلج/i.test(n))       return 'مدبلج للعربية';
  if (/arabic|عربي/i.test(n))                return 'عربي';
  if (/turkish|تركي/i.test(n))               return 'تركي';
  if (/hindi|هندي/i.test(n))                 return 'هندي';
  if (/persian|فارسي/i.test(n))              return 'فارسي';
  if (/french|فرنسي/i.test(n))               return 'فرنسي';
  if (/german|ألماني/i.test(n))              return 'ألماني';
  if (/spanish|إسباني/i.test(n))             return 'إسباني';
  if (/anime|أنمي/i.test(n))                return 'أنمي';
  if (/cartoon|كرتون/i.test(n))             return 'كرتون';
  if (/english|إنجليزي/i.test(n))           return 'إنمليزي';
  return '';
}

// ─── Global IPTV Connection Manager ──────────────────────────────────────────
const { streamingSem, apiSem } = require('./iptv-connection-manager');

// ─── LuluStream API ────────────────────────────────────────────────────────────

async function luluAPI(apiKey, endpoint, params = {}) {
  const p = new URLSearchParams({ key: apiKey, ...params });
  const url = `https://api.lulustream.com/api${endpoint}?${p}`;
  const res = await httpGet(url, 60000);
  return parseJson(res.body);
}

async function luluEnsureFolder(apiKey, name, parentId = 0) {
  try {
    const listRes = await httpGet(`https://api.lulustream.com/api/folder/list?key=${apiKey}&fld_id=${parentId}`, 30000);
    const listData = parseJson(listRes.body);
    const existing = (listData?.result?.folders || []).find(f => f.name === name);
    if (existing) return existing.fld_id;
  } catch {}
  try {
    const p = new URLSearchParams({ key: apiKey, name, parent_id: parentId });
    const res = await httpGet(`https://api.lulustream.com/api/folder/create?${p}`, 30000);
    const data = parseJson(res.body);
    return data?.result?.fld_id || 0;
  } catch { return 0; }
}

async function luluFindFileByTitle(apiKey, title, fldId = 0) {
  try {
    const p = new URLSearchParams({ key: apiKey, per_page: '50', fld_id: fldId || '' });
    const res = await httpGet(`https://api.lulustream.com/api/file/list?${p}`, 30000);
    const files = parseJson(res.body)?.result?.files || [];
    const clean = cleanTitle(title).toLowerCase();
    for (const f of files) {
      const ft = (f.title || f.file_title || '').toLowerCase();
      if (ft.includes(clean) || clean.includes(ft)) return f.file_code || f.filecode || '';
    }
  } catch {}
  return '';
}

async function luluFileEdit(apiKey, fileCode, { title, descr, tags } = {}) {
  const params = new URLSearchParams({ key: apiKey, file_code: fileCode, file_public: '1' });
  if (title) params.set('file_title', title.slice(0, 200));
  if (descr) params.set('file_descr', descr.slice(0, 1000));
  if (tags)  params.set('tags', tags.slice(0, 300));
  try { const res = await httpGet(`https://api.lulustream.com/api/file/edit?${params}`, 15000); return parseJson(res.body)?.msg === 'OK'; } catch { return false; }
}

async function luluUploadSubtitle(apiKey, fileCode, subUrl, lang) {
  try {
    const p = new URLSearchParams({ key: apiKey, file_code: fileCode, sub_url: subUrl, sub_lang: lang });
    const res = await httpGet(`https://api.lulustream.com/api/upload/sub?${p}`, 30000);
    return parseJson(res.body)?.status === 200;
  } catch { return false; }
}

async function luluCheckCanplay(apiKey, fileCode, maxWaitMs = 600000, intervalMs = 20000) {
  const start = Date.now();
  let attempt = 0;
  let notFound = 0;
  while (Date.now() - start < maxWaitMs) {
    attempt++;
    try {
      const data = await luluAPI(apiKey, '/file/info', { file_code: fileCode });
      const info = Array.isArray(data?.result) ? data.result[0] : data?.result;
      if (info && (info.canplay === 1 || info.canplay === true || info.status === 'active')) {
        return { canplay: true, hlsUrl: info.hls_url || info.download_url || '' };
      }
      const is404 = data?.status === 404 || info?.status === 404 || (!info && data?.msg?.includes('not found'));
      if (is404) {
        notFound++;
        if (notFound >= 6) return { canplay: false, hlsUrl: '', failedRemote: true };
      } else { notFound = 0; }
    } catch {}
    await sleep(intervalMs);
  }
  return { canplay: false, hlsUrl: '' };
}

// ─── تحميل من IPTV عبر البروكسي (يمنع 456) ────────────────────────────────────

function _buildProxyUrl(iptvAccountId, type, streamId, ext) {
  return `http://127.0.0.1:${LOCAL_PORT}/iptv-proxy/${IPTV_PROXY_SECRET}/${iptvAccountId}/${type}/${streamId}.${ext}`;
}

// رابط البروكسي العام (LuluStream يحتاج رابط إنترنت وليس localhost)
function _buildPublicProxyUrl(iptvAccountId, type, streamId, ext) {
  const publicUrl = process.env.PUBLIC_URL || `http://62.171.153.204:${LOCAL_PORT}`;
  return `${publicUrl}/iptv-proxy/${IPTV_PROXY_SECRET}/${iptvAccountId}/${type}/${streamId}.${ext}`;
}

// Remote Upload: أرسل رابط لـ LuluStream ليحمّل مباشرة — بدون تحميل محلي
async function _remoteUpload(apiKey, srcUrl, title, fldId = 0) {
  const params = { url: srcUrl, title, file_public: '1' };
  if (fldId) params.fld_id = String(fldId);
  const p = new URLSearchParams({ key: apiKey, ...params });
  const url = `https://api.lulustream.com/api/upload/url?${p}`;
  console.log(`[RemoteUpload] Sending to LuluStream: ${title}`);
  const res = await httpGet(url, 120000);
  const data = parseJson(res.body);
  if (data?.msg?.includes('max URLs limit')) throw new Error('Daily remote upload limit reached');
  const fc = data?.result?.filecode || data?.result?.file_code
    || (Array.isArray(data) && (data[0]?.filecode || data[0]?.file_code))
    || data?.filecode || data?.file_code;
  if (!fc) throw new Error(`LuluStream remote upload failed: ${res.body.slice(0, 300)}`);
  return fc;
}

// ─── تم حذف _downloadFile و _uploadToLulu — لا نحتاج تحميل محلي بعد الآن

// ─── TMDB ─────────────────────────────────────────────────────────────────────

async function tmdbGet(endpoint, params = {}) {
  const p = new URLSearchParams({ api_key: TMDB_KEY, ...params });
  try { const r = await httpGet(`${TMDB_BASE}${endpoint}?${p}`, 15000); return parseJson(r.body); } catch { return null; }
}

async function fetchTMDBMetadata(title, year = '', type = 'movie') {
  if (!title) return null;
  try {
    const cleanName = cleanTitle(title).replace(/\s*[-–]\s*\d{4}$/, '').trim();
    if (!cleanName) return null;
    const searchType = (type === 'episode' || type === 'series') ? 'tv' : 'movie';
    const searchEp = searchType === 'tv' ? '/search/tv' : '/search/movie';
    const sp = { query: cleanName, language: 'ar' };
    if (year) sp.year = String(year).substring(0, 4);
    if (searchType === 'tv' && year) sp.first_air_date_year = String(year).substring(0, 4);

    let searchData = await tmdbGet(searchEp, sp);
    let results = searchData?.results || [];
    if (results.length === 0) {
      searchData = await tmdbGet(searchEp, { query: cleanName, language: 'en-US' });
      results = searchData?.results || [];
    }
    if (results.length === 0) return null;

    const r = results[0];
    const detailEp = searchType === 'tv' ? `/tv/${r.id}` : `/movie/${r.id}`;
    const [detailAR, detailEN, credits] = await Promise.all([
      tmdbGet(detailEp, { language: 'ar' }),
      tmdbGet(detailEp, { language: 'en-US' }),
      tmdbGet(`${detailEp}/credits`),
    ]);
    const d = detailAR || detailEN || r;
    const fb = detailEN || r;
    const cast = (credits?.cast || []).slice(0, 8).map(c => c.name).join(' ، ');
    const director = (credits?.crew || []).find(c => c.job === 'Director')?.name || '';
    const genres = (d.genres || []).map(g => g.name).join(' ، ');
    const countries = d.production_countries || d.origin_country || [];

    return {
      tmdbId: r.id, mediaType: searchType === 'tv' ? 'series' : 'movie',
      poster: d.poster_path ? `${TMDB_IMG}${d.poster_path}` : '',
      backdrop: d.backdrop_path ? `${TMDB_IMG_ORG}${d.backdrop_path}` : '',
      plot: d.overview || fb.overview || '',
      year: (d.release_date || d.first_air_date || '').substring(0, 4),
      rating: d.vote_average ? String(Math.round(d.vote_average * 10) / 10) : '',
      genres, castList: cast, director,
      country: Array.isArray(countries) ? countries.map(c => typeof c === 'string' ? c : c.name).join(' ، ') : '',
      runtime: d.runtime ? `${d.runtime} دقيقة` : '',
      imdbId: d.imdb_id || '',
      title_ar: d.title || d.name || '',
      title_en: fb.title || fb.name || '',
    };
  } catch { return null; }
}

// ─── SubDL ────────────────────────────────────────────────────────────────────

async function searchSubtitles(title, year = '', type = 'movie', imdbId = '') {
  try {
    const p = new URLSearchParams({ api_key: SUBDL_KEY, film_name: title, languages: 'AR,KU', type });
    if (year) p.set('year', String(year).substring(0, 4));
    if (imdbId) p.set('imdb_id', imdbId);
    const r = await httpGet(`https://api.subdl.com/api/v1/subtitles?${p}`, 25000);
    const d = parseJson(r.body);
    return d?.subtitles || [];
  } catch { return []; }
}

// ─── IPTV Xtream helpers ──────────────────────────────────────────────────────

function buildIptvBase(account) {
  return `http://${account.host}:${account.port || 8080}/player_api.php?username=${account.username}&password=${account.password}`;
}

async function iptvFetch(account, action, extra = '') {
  await apiSem.acquire(`api:${action}`);
  try {
    const res = await httpGet(`${buildIptvBase(account)}&action=${action}${extra}`, 60000);
    return parseJson(res.body) || [];
  } finally {
    apiSem.release();
  }
}

function getVodCategories(account) { return iptvFetch(account, 'get_vod_categories'); }
function getSeriesCategories(account) { return iptvFetch(account, 'get_series_categories'); }
function getVodStreams(account, catId) { return iptvFetch(account, 'get_vod_streams', catId ? `&category_id=${catId}` : ''); }
function getSeriesList(account, catId) { return iptvFetch(account, 'get_series', catId ? `&category_id=${catId}` : ''); }
function getSeriesInfo(account, id) { return iptvFetch(account, 'get_series_info', `&series_id=${id}`); }
function getVodInfo(account, id) { return iptvFetch(account, 'get_vod_info', `&vod_id=${id}`); }

// ─── DB ──────────────────────────────────────────────────────────────────────
let _db = null;
function initDB(dbModule) { _db = dbModule; }

// ═══════════════════════════════════════════════════════════════════════════════
// Remote Upload مباشر — بدون job، بدون تحميل محلي
// LuluStream يحمّل من البروكسي العام مباشرة
// ═══════════════════════════════════════════════════════════════════════════════

async function remoteUploadItems(params) {
  const { items, account, apiKey, iptvAccountId, mainFolderId = 0 } = params;
  const total = items.length;
  let done = 0, failed = 0;
  console.log(`[RemoteUpload] Starting: ${total} items`);

  let mFolderId = mainFolderId;
  if (!mFolderId) mFolderId = await luluEnsureFolder(apiKey, 'محتوى عربي');
  const catFolders = {};

  async function ensureFolders(item) {
    let catId = catFolders[item.catName];
    if (catId === undefined) { catId = await luluEnsureFolder(apiKey, item.catName, mFolderId); catFolders[item.catName] = catId; }
    let target = catId;
    if (item.type === 'episode' && item.showName) {
      let showId = catFolders[`s:${item.showName}`];
      if (showId === undefined) { showId = await luluEnsureFolder(apiKey, cleanTitle(item.showName), catId); catFolders[`s:${item.showName}`] = showId; }
      let seasonId = catFolders[`se:${item.showName}:${item.season}`];
      if (seasonId === undefined) { seasonId = await luluEnsureFolder(apiKey, `الموسم ${item.season || 1}`, showId); catFolders[`se:${item.showName}:${item.season}`] = seasonId; }
      target = seasonId;
    }
    return target;
  }

  // تجهيز المجلدات
  const itemFolders = [];
  for (const item of items) { try { itemFolders.push(await ensureFolders(item)); } catch { itemFolders.push(0); } }

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const title = cleanTitle(item.name) || item.name;
    console.log(`\n[RemoteUpload] ═══ [${i + 1}/${total}] ${title} ═══`);

    const ext = item.ext || 'ts';
    const streamType = item.type === 'episode' ? 'series' : 'movie';
    const publicProxyUrl = _buildPublicProxyUrl(iptvAccountId, streamType, item.streamId, ext);
    console.log(`[RemoteUpload] URL: ${publicProxyUrl.replace(IPTV_PROXY_SECRET, '***')}`);

    if (!publicProxyUrl) {
      console.log(`[RemoteUpload] ✗ No proxy URL: ${title}`);
      failed++;
      await sleep(3000);
      continue;
    }

    let fileCode = null;
    try {
      fileCode = await _remoteUpload(apiKey, publicProxyUrl, title, itemFolders[i]);
      console.log(`[RemoteUpload] ✓ Sent: ${title} → ${fileCode}`);
      done++;
    } catch (e) {
      console.log(`[RemoteUpload] ✗ Failed: ${title}: ${e.message}`);
      failed++;
      await sleep(5000);
      continue;
    }

    // finalize في الخلفية (metadata + canplay + DB)
    (async () => {
      try {
        let meta = {};
        try {
          if (item.type === 'episode') meta = (await getSeriesInfo(account, item.seriesId || item.streamId))?.info || {};
          else meta = (await getVodInfo(account, item.streamId))?.info || {};
        } catch {}

        const isNumeric = /^\d+$/.test(title.trim());
        const iptvName = meta.name ? cleanTitle(meta.name) : '';
        const displayTitle = isNumeric ? (iptvName || meta.name || title) : title;
        const searchTitle = item.type === 'episode' ? (item.showName || iptvName || title) : (isNumeric ? (iptvName || title) : (iptvName || title));
        const searchType = (item.type === 'episode' || item.type === 'series') ? 'tv' : 'movie';
        const langLabel = detectLang(item.catName || '');

        let tmdb = null;
        try { tmdb = await fetchTMDBMetadata(searchTitle, item.year || meta.releasedate || '', searchType); } catch {}

        // ترجمات
        try {
          const subs = await searchSubtitles(tmdb?.title_en || title, tmdb?.year || item.year || '', searchType === 'tv' ? 'tv' : 'movie', tmdb?.imdbId || '');
          const byLang = {};
          for (const s of subs) {
            const lang = (s.lang || s.language || '').toLowerCase();
            const code = (lang.includes('arab') || lang === 'ar') ? 'ar' : (lang.includes('kurd') || lang === 'ku') ? 'ku' : null;
            if (code && !byLang[code]) byLang[code] = s.url || s.zipLink || s.download_url;
          }
          for (const [lang, url] of Object.entries(byLang)) {
            if (url) await luluUploadSubtitle(apiKey, fileCode, url.startsWith('http') ? url : `https://dl.subdl.com${url}`, lang);
          }
        } catch {}

        // canplay
        const canplayResult = await luluCheckCanplay(apiKey, fileCode, 1800000, 30000);
        if (canplayResult.canplay) {
          const bestTitle = (tmdb?.title_ar || tmdb?.title_en || displayTitle).slice(0, 200);
          const descr = [langLabel ? `اللغة: ${langLabel}` : '', tmdb?.genres ? `النوع: ${tmdb.genres}` : '', tmdb?.year ? `السنة: ${tmdb.year}` : '', tmdb?.plot ? `\n${tmdb.plot.slice(0, 500)}` : ''].filter(Boolean).join('\n');
          await luluFileEdit(apiKey, fileCode, { title: bestTitle, descr, tags: [langLabel, tmdb?.genres, tmdb?.year].filter(Boolean).join(',').slice(0, 300) });
        }

        // حفظ في DB
        if (_db) {
          try {
            const now = Date.now();
            const finalTitle = tmdb?.title_ar || tmdb?.title_en || displayTitle;
            const poster = tmdb?.poster || meta.movie_image || meta.cover || '';
            const backdrop = tmdb?.backdrop || meta.movie_image || '';
            const plot = tmdb?.plot || meta.plot || meta.description || '';
            const year = tmdb?.year || (meta.releasedate ? String(meta.releasedate).substring(0, 4) : '') || item.year || '';
            const rating = tmdb?.rating || (meta.rating ? String(meta.rating) : '') || '';
            const genres = tmdb?.genres || meta.genre || '';
            const castList = tmdb?.castList || meta.cast || meta.actors || '';
            const director = tmdb?.director || meta.director || '';
            const country = tmdb?.country || meta.country || '';
            const runtime = tmdb?.runtime || (meta.duration ? `${meta.duration} دقيقة` : '') || '';
            const imdbId = tmdb?.imdbId || meta.imdb_id || '';
            const embedUrl = `https://lulustream.com/e/${fileCode}`;
            const canplay = canplayResult.canplay;
            const hlsUrl = canplayResult.hlsUrl || '';

            if (item.type === 'episode' && item.showName) {
              const showTitle = cleanTitle(item.showName) || item.showName;
              const seriesTitle = tmdb?.title_ar || tmdb?.title_en || showTitle;
              let catalogRow = await _db.prepare("SELECT id, episode_count FROM lulu_catalog WHERE title ILIKE ? AND vod_type = 'series'").get(showTitle);
              let catalogId;
              if (catalogRow) {
                catalogId = catalogRow.id;
                await _db.prepare("UPDATE lulu_catalog SET poster=COALESCE(NULLIF(poster,''),?),backdrop=COALESCE(NULLIF(backdrop,''),?),plot=COALESCE(NULLIF(plot,''),?),year=COALESCE(NULLIF(year,''),?),rating=COALESCE(NULLIF(rating,''),?),genres=COALESCE(NULLIF(genres,''),?),cast_list=COALESCE(NULLIF(cast_list,''),?),director=COALESCE(NULLIF(director,''),?),country=COALESCE(NULLIF(country,''),?),runtime=COALESCE(NULLIF(runtime,''),?),imdb_id=COALESCE(NULLIF(imdb_id,''),?),tmdb_id=COALESCE(tmdb_id,?),lang=COALESCE(NULLIF(lang,''),?),updated_at=? WHERE id=?")
                  .run(poster, backdrop, plot, year, rating, genres, castList, director, country, runtime, imdbId, tmdb?.tmdbId || null, langLabel, now, catalogId);
              } else {
                const newId = 'ser-' + now + '-' + Math.random().toString(36).slice(2, 6);
                const row = await _db.prepare("INSERT INTO lulu_catalog (id,title,vod_type,poster,backdrop,plot,year,rating,genres,cast_list,director,country,runtime,imdb_id,tmdb_id,lang,canplay,episode_count,uploaded_at,updated_at) VALUES (?,?,'series',?,?,?,?,?,?,?,?,?,?,?,false,0,?,?) RETURNING id")
                  .get(newId, seriesTitle, poster, backdrop, plot, year, rating, genres, castList, director, country, runtime, imdbId, tmdb?.tmdbId || null, langLabel, now, now);
                catalogId = row?.id || newId;
              }
              await _db.prepare("INSERT INTO lulu_episodes (id,catalog_id,season,episode,title,file_code,hls_url,embed_url,canplay) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT (id) DO UPDATE SET file_code=EXCLUDED.file_code,hls_url=EXCLUDED.hls_url,embed_url=EXCLUDED.embed_url,canplay=EXCLUDED.canplay")
                .run('ep-' + fileCode, catalogId, item.season || 1, item.ep || item.episode_num || 0, displayTitle, fileCode, hlsUrl, embedUrl, canplay);
              const totalC = await _db.prepare("SELECT COUNT(*) as c FROM lulu_episodes WHERE catalog_id=?").get(catalogId);
              const playC = await _db.prepare("SELECT COUNT(*) as c FROM lulu_episodes WHERE catalog_id=? AND canplay=true").get(catalogId);
              await _db.prepare("UPDATE lulu_catalog SET episode_count=?,canplay=?,hls_url=COALESCE(NULLIF(hls_url,''),?),embed_url=?,updated_at=? WHERE id=?")
                .run(totalC?.c || 0, (playC?.c || 0) > 0, hlsUrl, embedUrl, now, catalogId);
            } else {
              const catId = 'mov-' + fileCode;
              await _db.prepare("INSERT INTO lulu_catalog (id,title,vod_type,poster,backdrop,plot,year,rating,genres,cast_list,director,country,runtime,imdb_id,tmdb_id,lang,file_code,hls_url,embed_url,canplay,episode_count,lulu_fld_id,uploaded_at,updated_at) VALUES (?,?,'movie',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,?,?) ON CONFLICT (id) DO UPDATE SET file_code=EXCLUDED.file_code,embed_url=EXCLUDED.embed_url,hls_url=COALESCE(NULLIF(lulu_catalog.hls_url,''),EXCLUDED.hls_url),canplay=CASE WHEN lulu_catalog.canplay=true THEN true ELSE EXCLUDED.canplay END,poster=COALESCE(NULLIF(lulu_catalog.poster,''),EXCLUDED.poster),plot=COALESCE(NULLIF(lulu_catalog.plot,''),EXCLUDED.plot),year=COALESCE(NULLIF(lulu_catalog.year,''),EXCLUDED.year),updated_at=EXCLUDED.updated_at")
                .run(catId, finalTitle, poster, backdrop, plot, year, rating, genres, castList, director, country, runtime, imdbId, tmdb?.tmdbId || null, langLabel, fileCode, hlsUrl, embedUrl, canplay, itemFolders[i], now, now);
            }
          } catch (e) { console.error(`[RemoteUpload] DB save error: ${e.message}`); }
        }

        console.log(`[RemoteUpload] ✓ Finalized: ${title} canplay=${canplayResult.canplay}`);
      } catch (e) { console.log(`[RemoteUpload] ⚠ Finalize error for ${title}: ${e.message}`); }
    })();
  }

  console.log(`[RemoteUpload] ✅ Done: ${done} succeeded, ${failed} failed, ${total} total`);
  return { done, failed, total };
}

module.exports = {
  getVodCategories, getSeriesCategories, getVodStreams, getVodInfo,
  getSeriesList, getSeriesInfo, luluGetAccountInfo: (apiKey) => luluAPI(apiKey, '/account/info'),
  luluListFolders: (apiKey, parentId = 0) => httpGet(`https://api.lulustream.com/api/folder/list?key=${apiKey}&fld_id=${parentId}`, 30000).then(r => parseJson(r.body)?.result || []).catch(() => []),
  luluEnsureFolder, remoteUploadItems, initDB,
};
