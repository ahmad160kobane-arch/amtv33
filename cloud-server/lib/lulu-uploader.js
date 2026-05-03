/**
 * Lulu Uploader v2 — IPTV → LuluStream Upload Manager
 * - سيرفر وسيط بين IPTV و LuluStream (عبر IPTV proxy)
 * - رفع تسلسلي (واحد بعد الآخر) لتجنب الحظر
 * - جلب metadata كامل من IPTV قبل التخزين
 * - تخزين في lulu_catalog فقط عند النجاح (فشل = لا شيء في القاعدة)
 * - تتبع تقدم حقيقي مع SSE
 */
'use strict';

const http  = require('http');
const https = require('https');

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

function parseJson(body) {
  try { return JSON.parse(body); } catch { return null; }
}

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

// ─── LuluStream API helpers ────────────────────────────────────────────────────

async function luluAPI(apiKey, endpoint, params = {}) {
  const p = new URLSearchParams({ key: apiKey, ...params });
  const url = `https://api.lulustream.com/api${endpoint}?${p}`;
  const res = await httpGet(url, 60000);
  return parseJson(res.body);
}

async function luluRemoteUpload(apiKey, srcUrl, title, fldId = 0) {
  const params = { url: srcUrl, title, file_public: '1' };
  if (fldId) params.fld_id = String(fldId);
  const p = new URLSearchParams({ key: apiKey, ...params });
  const url = `https://api.lulustream.com/api/upload/url?${p}`;
  const res = await httpGet(url, 120000);
  const data = parseJson(res.body);
  if (data?.msg?.includes('max URLs limit')) throw new Error('daily_limit');
  const fc =
    data?.result?.filecode ||
    data?.result?.file_code ||
    (Array.isArray(data) && (data[0]?.filecode || data[0]?.file_code)) ||
    data?.filecode ||
    data?.file_code;
  if (!fc) throw new Error(`LuluStream فشل: ${String(res.body).slice(0, 300)}`);
  return fc;
}

async function luluEnsureFolder(apiKey, name, parentId = 0) {
  try {
    const listRes = await httpGet(
      `https://api.lulustream.com/api/folder/list?key=${apiKey}&fld_id=${parentId}`, 30000);
    const listData = parseJson(listRes.body);
    const folders = listData?.result?.folders || [];
    const existing = folders.find(f => f.name === name);
    if (existing) return existing.fld_id;
  } catch {}
  try {
    const p = new URLSearchParams({ key: apiKey, name, parent_id: parentId });
    const res = await httpGet(`https://api.lulustream.com/api/folder/create?${p}`, 30000);
    const data = parseJson(res.body);
    return data?.result?.fld_id || 0;
  } catch { return 0; }
}

async function luluFileEdit(apiKey, fileCode, { title, descr, tags } = {}) {
  const params = new URLSearchParams({ key: apiKey, file_code: fileCode, file_public: '1' });
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

async function luluUploadSubtitle(apiKey, fileCode, subUrl, lang) {
  try {
    const p = new URLSearchParams({ key: apiKey, file_code: fileCode, sub_url: subUrl, sub_lang: lang });
    const res = await httpGet(`https://api.lulustream.com/api/upload/sub?${p}`, 30000);
    const data = parseJson(res.body);
    return data?.status === 200;
  } catch { return false; }
}

async function luluGetAccountInfo(apiKey) {
  return luluAPI(apiKey, '/account/info');
}

async function luluListFolders(apiKey, parentId = 0) {
  try {
    const p = new URLSearchParams({ key: apiKey, fld_id: parentId });
    const res = await httpGet(`https://api.lulustream.com/api/folder/list?${p}`, 30000);
    const data = parseJson(res.body);
    return data?.result || [];
  } catch { return []; }
}

async function luluCheckCanplay(apiKey, fileCode, maxWaitMs = 300000, intervalMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const data = await luluAPI(apiKey, '/file/info', { file_code: fileCode });
      const info = Array.isArray(data?.result) ? data.result[0] : data?.result;
      if (info && (info.canplay === 1 || info.canplay === true || info.status === 'active')) {
        const hlsUrl = info.hls_url || info.download_url || '';
        return { canplay: true, hlsUrl };
      }
    } catch {}
    await sleep(intervalMs);
  }
  return { canplay: false, hlsUrl: '' };
}

// ─── IPTV Xtream API helpers ───────────────────────────────────────────────────

function buildIptvBase(account) {
  const port = account.port || 8080;
  return `http://${account.host}:${port}/player_api.php?username=${account.username}&password=${account.password}`;
}

async function iptvFetch(account, action, extra = '') {
  const url = `${buildIptvBase(account)}&action=${action}${extra}`;
  const res = await httpGet(url, 60000);
  return parseJson(res.body) || [];
}

async function getVodCategories(account) {
  return iptvFetch(account, 'get_vod_categories');
}

async function getSeriesCategories(account) {
  return iptvFetch(account, 'get_series_categories');
}

async function getVodStreams(account, catId) {
  return iptvFetch(account, 'get_vod_streams', catId ? `&category_id=${catId}` : '');
}

async function getSeriesList(account, catId) {
  return iptvFetch(account, 'get_series', catId ? `&category_id=${catId}` : '');
}

async function getSeriesInfo(account, seriesId) {
  return iptvFetch(account, 'get_series_info', `&series_id=${seriesId}`);
}

async function getVodInfo(account, vodId) {
  return iptvFetch(account, 'get_vod_info', `&vod_id=${vodId}`);
}

// ─── SubDL subtitle search ─────────────────────────────────────────────────────

const SUBDL_KEY = process.env.SUBDL_KEY || 'MA5RWk78R1H6Gyd-Xu0B37pLWc3MjUCQ';

async function searchSubtitles(title, year = '', type = 'movie', imdbId = '') {
  if (!SUBDL_KEY) return [];
  try {
    const p1 = new URLSearchParams({
      api_key: SUBDL_KEY,
      film_name: title,
      languages: 'AR,KU',
      type,
    });
    if (year)   p1.set('year', String(year).substring(0, 4));
    if (imdbId) p1.set('imdb_id', imdbId);
    const r1 = await httpGet(`https://api.subdl.com/api/v1/subtitles?${p1}`, 25000);
    const d1 = parseJson(r1.body);
    if (d1?.subtitles?.length) return d1.subtitles;
    const sdId = d1?.results?.[0]?.sd_id;
    if (!sdId) return [];
    const p2 = new URLSearchParams({ api_key: SUBDL_KEY, sd_id: sdId, languages: 'AR,KU' });
    const r2 = await httpGet(`https://api.subdl.com/api/v1/subtitles?${p2}`, 25000);
    const d2 = parseJson(r2.body);
    return d2?.subtitles || [];
  } catch { return []; }
}

// ─── SSE Progress Manager ──────────────────────────────────────────────────────

const _sseClients = new Set();

function addSSEClient(res) {
  _sseClients.add(res);
  res.on('close', () => _sseClients.delete(res));
}

function broadcastProgress(jobId, data) {
  const msg = `data: ${JSON.stringify({ jobId, ...data })}\n\n`;
  for (const client of _sseClients) {
    try { client.write(msg); } catch {}
  }
}

// ─── Job Manager ──────────────────────────────────────────────────────────────

let _jobIdCounter = 0;
const _jobs        = new Map();
let _workerRunning = false;
let _db = null;

function initDB(dbModule) {
  _db = dbModule;
}

function _buildJob({ items, account, apiKey, vpsUrl, proxySecret, mainFolderId, type, luluAccountId, iptvAccountId }) {
  _jobIdCounter++;
  return {
    id          : _jobIdCounter,
    items       : [...items],
    account,
    apiKey,
    vpsUrl,
    proxySecret,
    mainFolderId: mainFolderId || 0,
    type,
    luluAccountId: luluAccountId || 0,
    iptvAccountId: iptvAccountId || 0,
    status      : 'queued',
    total       : items.length,
    done        : 0,
    failed      : 0,
    current     : null,
    currentItemStatus : '',
    itemProgress: 0,
    results     : [],
    startedAt   : null,
    finishedAt  : null,
    _cancelled  : false,
    _dbJobId    : null,
  };
}

function createJob(params) {
  const job = _buildJob(params);
  _jobs.set(job.id, job);
  _runWorkerLoop();
  return job;
}

function getJobsSummary() {
  return [..._jobs.values()].map(j => ({
    id        : j.id,
    status    : j.status,
    total     : j.total,
    done      : j.done,
    failed    : j.failed,
    current   : j.current,
    currentItemStatus : j.currentItemStatus,
    itemProgress: j.itemProgress,
    startedAt : j.startedAt,
    finishedAt: j.finishedAt,
    type      : j.type,
  }));
}

function getJobDetail(id) {
  const j = _jobs.get(Number(id));
  if (!j) return null;
  return {
    id        : j.id,
    status    : j.status,
    total     : j.total,
    done      : j.done,
    failed    : j.failed,
    current   : j.current,
    currentItemStatus : j.currentItemStatus,
    itemProgress: j.itemProgress,
    results   : j.results,
    startedAt : j.startedAt,
    finishedAt: j.finishedAt,
    type      : j.type,
  };
}

function cancelJob(id) {
  const j = _jobs.get(Number(id));
  if (j && j.status !== 'done') {
    j._cancelled = true;
    if (j.status === 'queued') j.status = 'cancelled';
  }
}

function getSSEClients() { return _sseClients; }

async function _runWorkerLoop() {
  if (_workerRunning) return;
  _workerRunning = true;
  try {
    while (true) {
      const job = [..._jobs.values()].find(j => j.status === 'queued');
      if (!job) break;
      await _processJob(job);
    }
  } finally {
    _workerRunning = false;
  }
}

function _emitProgress(job, itemStatus, itemProgress) {
  job.currentItemStatus = itemStatus;
  job.itemProgress = itemProgress;
  broadcastProgress(job.id, {
    status: job.status,
    done: job.done,
    failed: job.failed,
    total: job.total,
    current: job.current,
    currentItemStatus: itemStatus,
    itemProgress,
  });
}

async function _processJob(job) {
  job.status    = 'running';
  job.startedAt = Date.now();

  if (_db) {
    try {
      const row = await _db.prepare(
        "INSERT INTO lulu_upload_jobs (job_uuid, status, type, total, done, failed, cat_name, lulu_account_id, iptv_account_id, started_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id"
      ).get(
        String(job.id), 'running', job.type, job.total, 0, 0,
        job.items[0]?.catName || '', job.luluAccountId, job.iptvAccountId,
        job.startedAt, job.startedAt
      );
      if (row) job._dbJobId = row.id;
    } catch (e) { console.error('[LuluJob] DB insert error:', e.message); }
  }

  let mainFolderId = job.mainFolderId;
  if (!mainFolderId) {
    mainFolderId = await luluEnsureFolder(job.apiKey, 'محتوى عربي');
  }

  const catFolders = {};

  for (const item of job.items) {
    if (job._cancelled) break;
    job.current = item.name;

    try {
      _emitProgress(job, 'preparing', 0);

      let catFolderId = catFolders[item.catName];
      if (catFolderId === undefined) {
        catFolderId = await luluEnsureFolder(job.apiKey, item.catName, mainFolderId);
        catFolders[item.catName] = catFolderId;
      }

      const ext       = item.ext || 'mp4';
      const proxyType = item.type === 'episode' ? 'series' : 'movie';
      const iptvId    = job.iptvAccountId || 0;
      const srcUrl    = `${job.vpsUrl}/iptv-proxy/${job.proxySecret}/${iptvId}/${proxyType}/${item.streamId}.${ext}`;

      const title    = cleanTitle(item.name) || item.name;

      let targetFolderId = catFolderId;
      if (item.type === 'episode' && item.showName) {
        let showFolderId = catFolders[`show:${item.showName}`];
        if (showFolderId === undefined) {
          showFolderId = await luluEnsureFolder(job.apiKey, cleanTitle(item.showName), catFolderId);
          catFolders[`show:${item.showName}`] = showFolderId;
        }
        let seasonFolderId = catFolders[`season:${item.showName}:${item.season}`];
        if (seasonFolderId === undefined) {
          seasonFolderId = await luluEnsureFolder(job.apiKey, `الموسم ${item.season || 1}`, showFolderId);
          catFolders[`season:${item.showName}:${item.season}`] = seasonFolderId;
        }
        targetFolderId = seasonFolderId;
      }

      _emitProgress(job, 'uploading', 10);

      const fileCode = await luluRemoteUpload(job.apiKey, srcUrl, title, targetFolderId);

      _emitProgress(job, 'uploaded', 40);

      const langLabel = detectLang(item.catName || '');
      const arabicDescr = [];
      if (langLabel) arabicDescr.push(`اللغة: ${langLabel}`);
      if (item.genre) arabicDescr.push(`النوع: ${item.genre}`);
      if (item.year) arabicDescr.push(`السنة: ${item.year}`);
      const descr = arabicDescr.join('\n');
      const tags = [langLabel, item.genre, item.year].filter(Boolean).join(',');

      await sleep(1500);
      await luluFileEdit(job.apiKey, fileCode, { title, descr, tags });

      _emitProgress(job, 'subtitles', 50);

      try {
        const subType = item.type === 'episode' ? 'tv' : 'movie';
        const subs    = await searchSubtitles(title, item.year || '', subType, item.imdbId || '');
        const byLang  = {};
        for (const s of subs) {
          const lang  = (s.lang || s.language || '').toLowerCase();
          const isAr  = lang.includes('arab') || lang === 'ar';
          const isKu  = lang.includes('kurd') || lang === 'ku' || lang.includes('sorani');
          const code  = isAr ? 'ar' : isKu ? 'ku' : null;
          if (code && !byLang[code]) byLang[code] = s.url || s.zipLink || s.download_url;
        }
        for (const [lang, url] of Object.entries(byLang)) {
          if (!url) continue;
          const fullUrl = url.startsWith('http') ? url : `https://dl.subdl.com${url}`;
          await luluUploadSubtitle(job.apiKey, fileCode, fullUrl, lang);
        }
      } catch {}

      _emitProgress(job, 'processing', 60);

      const embedUrl = `https://lulustream.com/e/${fileCode}`;
      const checkResult = await luluCheckCanplay(job.apiKey, fileCode);

      _emitProgress(job, 'fetching_metadata', 80);

      let meta = {};
      try {
        if (item.type === 'episode' && item.showName) {
          const sInfo = await getSeriesInfo(job.account, item.seriesId || item.streamId);
          meta = sInfo?.info || {};
        } else {
          const vInfo = await getVodInfo(job.account, item.streamId);
          meta = vInfo?.info || {};
        }
      } catch (e) {
        console.log(`[LuluJob] metadata fetch failed for ${title}: ${e.message}`);
      }

      if (!checkResult.canplay) {
        console.log(`[LuluJob] ${title} uploaded but not yet playable — NOT storing in catalog`);
        job.done++;
        job.results.push({ name: item.name, status: 'ok', fileCode, note: 'processing_not_in_catalog' });
        _updateDBJob(job);
        await sleep(3500);
        continue;
      }

      _emitProgress(job, 'saving', 90);

      const hlsUrl = checkResult.hlsUrl || '';
      job.done++;
      job.results.push({ name: item.name, status: 'ok', fileCode });

      if (_db) {
        try {
          const poster = meta.cover || meta.movie_image || meta.backdrop_path?.[0] || item.poster || '';
          const backdrop = meta.backdrop_path?.[0] || meta.movie_image || '';
          const plot = meta.plot || meta.description || '';
          const year = meta.releasedate ? String(meta.releasedate).substring(0,4) : (item.year || '');
          const rating = meta.rating || item.rating || '';
          const genres = meta.genre || item.genre || '';
          const castList = meta.cast || '';
          const director = meta.director || '';
          const country = meta.country || '';
          const runtime = meta.duration || meta.runtime || '';
          const imdbId = meta.imdb_id || item.imdbId || '';
          const now = Date.now();

          if (item.type === 'episode' && item.showName) {
            const showTitle = cleanTitle(item.showName) || item.showName;
            let catalogRow = await _db.prepare("SELECT id, episode_count FROM lulu_catalog WHERE title ILIKE ? AND vod_type = 'series'").get(showTitle);
            let catalogId;

            if (catalogRow) {
              catalogId = catalogRow.id;
              await _db.prepare(
                "UPDATE lulu_catalog SET poster = COALESCE(NULLIF(poster,''),?), backdrop = COALESCE(NULLIF(backdrop,''),?), plot = COALESCE(NULLIF(plot,''),?), year = COALESCE(NULLIF(year,''),?), rating = COALESCE(NULLIF(rating,''),?), genres = COALESCE(NULLIF(genres,''),?), cast_list = COALESCE(NULLIF(cast_list,''),?), director = COALESCE(NULLIF(director,''),?), country = COALESCE(NULLIF(country,''),?), runtime = COALESCE(NULLIF(runtime,''),?), imdb_id = COALESCE(NULLIF(imdb_id,''),?), lang = COALESCE(NULLIF(lang,''),?), updated_at = ? WHERE id = ?"
              ).run(poster, backdrop, plot, year, rating, genres, castList, director, country, runtime, imdbId, langLabel, now, catalogId);
            } else {
              const newId = 'ser-' + now + '-' + Math.random().toString(36).slice(2,6);
              const row = await _db.prepare(
                "INSERT INTO lulu_catalog (id, title, vod_type, poster, backdrop, plot, year, rating, genres, cast_list, director, country, runtime, imdb_id, lang, canplay, episode_count, uploaded_at, updated_at) VALUES (?, ?, 'series', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, false, 0, ?, ?) RETURNING id"
              ).get(newId, showTitle, poster, backdrop, plot, year, rating, genres, castList, director, country, runtime, imdbId, langLabel, now, now);
              catalogId = row?.id || newId;
            }

            const epId = 'ep-' + fileCode;
            await _db.prepare(
              "INSERT INTO lulu_episodes (id, catalog_id, season, episode, title, file_code, hls_url, embed_url, canplay) VALUES (?, ?, ?, ?, ?, ?, ?, ?, true) ON CONFLICT (id) DO UPDATE SET file_code = EXCLUDED.file_code, hls_url = EXCLUDED.hls_url, embed_url = EXCLUDED.embed_url, canplay = true"
            ).run(
              epId, catalogId, item.season || 1, item.ep || item.episode_num || 0,
              title, fileCode, hlsUrl, embedUrl
            );

            await _db.prepare(
              "UPDATE lulu_catalog SET episode_count = (SELECT COUNT(*) FROM lulu_episodes WHERE catalog_id = ?), canplay = true, hls_url = ?, embed_url = ?, file_code = ? WHERE id = ?"
            ).run(catalogId, hlsUrl, embedUrl, fileCode, catalogId);

          } else {
            const catId = 'mov-' + fileCode;
            await _db.prepare(
              "INSERT INTO lulu_catalog (id, title, vod_type, poster, backdrop, plot, year, rating, genres, cast_list, director, country, runtime, imdb_id, lang, file_code, hls_url, embed_url, canplay, episode_count, lulu_fld_id, uploaded_at, updated_at) VALUES (?, ?, 'movie', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, true, 0, ?, ?, ?) ON CONFLICT (id) DO UPDATE SET file_code = EXCLUDED.file_code, hls_url = EXCLUDED.hls_url, embed_url = EXCLUDED.embed_url, canplay = true, poster = COALESCE(NULLIF(poster,''),EXCLUDED.poster), backdrop = COALESCE(NULLIF(backdrop,''),EXCLUDED.backdrop), plot = COALESCE(NULLIF(plot,''),EXCLUDED.plot), year = COALESCE(NULLIF(year,''),EXCLUDED.year), rating = COALESCE(NULLIF(rating,''),EXCLUDED.rating), genres = COALESCE(NULLIF(genres,''),EXCLUDED.genres), cast_list = COALESCE(NULLIF(cast_list,''),EXCLUDED.cast_list), director = COALESCE(NULLIF(director,''),EXCLUDED.director), country = COALESCE(NULLIF(country,''),EXCLUDED.country), runtime = COALESCE(NULLIF(runtime,''),EXCLUDED.runtime), imdb_id = COALESCE(NULLIF(imdb_id,''),EXCLUDED.imdb_id), lang = COALESCE(NULLIF(lang,''),EXCLUDED.lang), updated_at = EXCLUDED.updated_at"
            ).run(catId, title, poster, backdrop, plot, year, rating, genres, castList, director, country, runtime, imdbId, langLabel, fileCode, hlsUrl, embedUrl, targetFolderId, now, now);
          }

        } catch (e) { console.error('[LuluJob] DB catalog insert error:', e.message); }
      }

      _emitProgress(job, 'done', 100);

    } catch (e) {
      job.failed++;
      job.results.push({ name: item.name, status: 'error', error: e.message });

      // ─── على الفشل: لا نخزن أي شيء في القاعدة ───
      console.log(`[LuluJob] FAILED ${item.name}: ${e.message} — لا تخزين في القاعدة`);

      if (e.message === 'daily_limit') {
        job.current = null;
        job.status  = 'daily_limit';
        job.finishedAt = Date.now();
        _updateDBJob(job);
        _emitProgress(job, 'daily_limit', 0);
        return;
      }

      _emitProgress(job, 'error', 0);
    }

    _updateDBJob(job);
    await sleep(3500);
  }

  job.current    = null;
  job.status     = job._cancelled ? 'cancelled' : 'done';
  job.finishedAt = Date.now();
  _updateDBJob(job);
  _emitProgress(job, job.status, 100);
}

async function _updateDBJob(job) {
  if (!_db || !job._dbJobId) return;
  try {
    await _db.prepare(
      "UPDATE lulu_upload_jobs SET status = ?, done = ?, failed = ?, finished_at = ? WHERE id = ?"
    ).run(job.status, job.done, job.failed, job.finishedAt || 0, job._dbJobId);
  } catch (e) { console.error('[LuluJob] DB update error:', e.message); }
}

module.exports = {
  getVodCategories,
  getSeriesCategories,
  getVodStreams,
  getVodInfo,
  getSeriesList,
  getSeriesInfo,
  luluGetAccountInfo,
  luluListFolders,
  luluEnsureFolder,
  createJob,
  getJobsSummary,
  getJobDetail,
  cancelJob,
  initDB,
  addSSEClient,
  getSSEClients,
};
