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

async function _downloadFile(url, destPath, label) {
  const MAX_RETRIES = 5;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    // لا نستخدم streamingSem هنا لأن التحميل يتم عبر iptv-proxy المحلي
    // والبروكسي نفسه يتحكم بالسيمافور العالمي
    let stream = null;
    try {
      stream = await new Promise((resolve, reject) => {
        const mod = url.startsWith('https') ? https : http;
        const req = mod.get(url, {
          headers: { 'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20', 'Accept': '*/*' },
          timeout: 300000,
        }, res => {
          if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
            res.resume();
            return _downloadFollowRedirect(res.headers.location, destPath).then(resolve).catch(reject);
          }
          if (res.statusCode === 456) {
            res.resume();
            return reject(Object.assign(new Error('456 Too Many Connections'), { retryable: true }));
          }
          if (res.statusCode !== 200 && res.statusCode !== 206) {
            res.resume();
            return reject(new Error(`HTTP ${res.statusCode}`));
          }
          resolve(res);
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('download timeout')); });
      });

      await new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destPath);
        stream.pipe(file);
        file.on('finish', resolve);
        file.on('error', reject);
        stream.on('error', reject);
      });

      const size = fs.statSync(destPath).size;
      if (size < 1024) throw new Error(`File too small: ${size} bytes`);
      console.log(`[Download] ✓ ${label} → ${(size / 1024 / 1024).toFixed(1)}MB`);
      return destPath;
    } catch (e) {
      try { if (stream) stream.destroy(); } catch {}
      try { fs.unlinkSync(destPath); } catch {}
      if (e.retryable && attempt < MAX_RETRIES) {
        const waitSec = attempt * 30;
        console.log(`[Download] ⚠ ${e.message} — retry ${attempt}/${MAX_RETRIES} in ${waitSec}s...`);
        await sleep(waitSec * 1000);
        continue;
      }
      throw e;
    }
  }
  throw new Error('Download: exhausted retries');
}

function _downloadFollowRedirect(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { headers: { 'User-Agent': 'VLC/3.0.20' }, timeout: 30000 }, res => {
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        return _downloadFollowRedirect(res.headers.location).then(resolve).catch(reject);
      }
      resolve(res);
    }).on('error', reject);
  });
}

// ─── رفع ملف إلى LuluStream ──────────────────────────────────────────────────

async function _uploadToLulu(apiKey, filePath, title, fldId = 0, onProgress) {
  const fileSize = fs.statSync(filePath).size;
  const safeName = title.replace(/[^\w\u0600-\u06FF .-]/g, '_').trim() + '.mp4';
  const boundary = '----LuluB' + Date.now().toString(16);
  const prefix = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="key"\r\n\r\n${apiKey}\r\n` +
    `--${boundary}\r\nContent-Disposition: form-data; name="fld_id"\r\n\r\n${fldId || 0}\r\n` +
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${safeName}"\r\nContent-Type: video/mp4\r\n\r\n`
  );
  const suffix = Buffer.from(`\r\n--${boundary}--\r\n`);

  const serverRes = await httpGet(`https://api.lulustream.com/api/upload/server?key=${apiKey}`, 30000);
  const uploadUrl = (typeof parseJson(serverRes.body)?.result === 'string') ? parseJson(serverRes.body).result : parseJson(serverRes.body)?.result?.url;
  if (!uploadUrl) throw new Error('No upload URL');

  const uploadBody = await new Promise((resolve, reject) => {
    const pUrl = new URL(uploadUrl);
    const mod = pUrl.protocol === 'https:' ? https : http;
    const req = mod.request({
      hostname: pUrl.hostname, port: pUrl.port || (pUrl.protocol === 'https:' ? 443 : 80),
      path: pUrl.pathname + pUrl.search, method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': prefix.length + fileSize + suffix.length,
        'User-Agent': 'Mozilla/5.0', 'Connection': 'keep-alive',
      },
      timeout: 7200000,
    }, res => { let b = ''; res.on('data', d => b += d); res.on('end', () => resolve(b)); });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('upload timeout')); });
    req.write(prefix);
    const fStream = fs.createReadStream(filePath);
    let transferred = 0;
    fStream.on('data', chunk => {
      transferred += chunk.length;
      if (!req.write(chunk)) fStream.pause();
      if (onProgress) onProgress(Math.floor((transferred / fileSize) * 100));
    });
    req.on('drain', () => fStream.resume());
    fStream.on('end', () => { req.write(suffix); req.end(); });
    fStream.on('error', err => { req.destroy(); reject(err); });
  });

  let fc = null;
  const data = parseJson(uploadBody);
  if (data) fc = data?.files?.[0]?.filecode || data?.files?.[0]?.file_code || data?.result?.filecode || data?.result?.file_code || data?.filecode || data?.file_code;
  if (!fc && uploadBody.includes('<textarea')) {
    const m = uploadBody.match(/name=['"]st['"][^>]*>([^<]*)<\/textarea>/i);
    const fn = uploadBody.match(/name=['"]fn['"][^>]*>([^<]*)<\/textarea>/i);
    if (m && m[1].trim() === 'OK' && fn) fc = fn[1].trim();
    else if (m && m[1].trim() !== 'OK') throw new Error(`LuluStream rejected: ${m[1].trim()}`);
  }
  if (!fc) throw new Error(`Upload failed: ${uploadBody.substring(0, 200)}`);
  return fc;
}

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

// ─── SSE Progress ─────────────────────────────────────────────────────────────

const _sseClients = new Set();
function addSSEClient(res) { _sseClients.add(res); res.on('close', () => _sseClients.delete(res)); }
function broadcastProgress(jobId, data) {
  const msg = `data: ${JSON.stringify({ jobId, ...data })}\n\n`;
  for (const c of _sseClients) { try { c.write(msg); } catch {} }
}

// ─── Job Manager ──────────────────────────────────────────────────────────────

let _jobIdCounter = 0;
const _jobs = new Map();
let _workerRunning = false;
let _db = null;

function initDB(dbModule) {
  _db = dbModule;
  _db.prepare("UPDATE lulu_upload_jobs SET status='cancelled' WHERE status='running'")
    .run().catch(() => {});
}

function _emitProgress(job, status, pct) {
  job.currentItemStatus = status;
  job.itemProgress = pct;
  broadcastProgress(job.id, { status: job.status, done: job.done, failed: job.failed, total: job.total, current: job.current, currentItemStatus: status, itemProgress: pct });
}

function createJob(params) {
  _jobIdCounter++;
  const job = {
    id: _jobIdCounter, items: [...params.items], account: params.account,
    apiKey: params.apiKey, mainFolderId: params.mainFolderId || 0,
    type: params.type, luluAccountId: params.luluAccountId || 0,
    iptvAccountId: params.iptvAccountId || 0,
    status: 'queued', total: params.items.length, done: 0, failed: 0,
    current: null, currentItemStatus: '', itemProgress: 0, results: [],
    startedAt: null, finishedAt: null, _cancelled: false, _dbJobId: null,
  };
  _jobs.set(job.id, job);
  _runWorkerLoop();
  return job;
}

function getJobsSummary() {
  return [..._jobs.values()].map(j => ({ id: j.id, status: j.status, total: j.total, done: j.done, failed: j.failed, current: j.current, currentItemStatus: j.currentItemStatus, itemProgress: j.itemProgress, startedAt: j.startedAt, finishedAt: j.finishedAt, type: j.type }));
}

function getJobDetail(id) {
  const j = _jobs.get(Number(id));
  if (!j) return null;
  return { id: j.id, status: j.status, total: j.total, done: j.done, failed: j.failed, current: j.current, currentItemStatus: j.currentItemStatus, itemProgress: j.itemProgress, results: j.results, startedAt: j.startedAt, finishedAt: j.finishedAt, type: j.type };
}

function cancelJob(id) {
  const j = _jobs.get(Number(id));
  if (j && j.status !== 'done') { j._cancelled = true; if (j.status === 'queued') j.status = 'cancelled'; }
}

function getSSEClients() { return _sseClients; }

async function _runWorkerLoop() {
  if (_workerRunning) return;
  _workerRunning = true;
  try {
    while (true) {
      const job = [..._jobs.values()].find(j => j.status === 'queued');
      if (!job) break;
      // تحقق أنه لا يوجد job آخر يعمل الآن (غير هذا الـ job)
      const alreadyRunning = [..._jobs.values()].find(j => j.status === 'running' && j.id !== job.id);
      if (alreadyRunning) {
        console.log(`[LuluJob] ⏳ Job #${job.id} waiting — job #${alreadyRunning.id} still running...`);
        await sleep(10000);
        continue;
      }
      await _processJob(job);
    }
  }
  finally { _workerRunning = false; }
}

function _updateDBJob(job) {
  if (!_db || !job._dbJobId) return;
  _db.prepare("UPDATE lulu_upload_jobs SET status = ?, done = ?, failed = ?, finished_at = ? WHERE id = ?")
    .run(job.status, job.done, job.failed, job.finishedAt || 0, job._dbJobId)
    .catch(() => {});
}

// ═══════════════════════════════════════════════════════════════════════════════
// PIPELINE: تحميل ← رفع ← حفظ — تسلسلي (اتصال واحد IPTV فقط)
// ═══════════════════════════════════════════════════════════════════════════════

async function _processJob(job) {
  job.status = 'running';
  job.startedAt = Date.now();
  console.log(`[LuluJob] Starting job #${job.id}: ${job.total} items`);

  if (_db) {
    try {
      const row = await _db.prepare(
        "INSERT INTO lulu_upload_jobs (job_uuid, status, type, total, done, failed, cat_name, lulu_account_id, iptv_account_id, started_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id"
      ).get(String(job.id), 'running', job.type, job.total, 0, 0, job.items[0]?.catName || '', job.luluAccountId, job.iptvAccountId, job.startedAt, job.startedAt);
      if (row) job._dbJobId = row.id;
    } catch (e) { console.error('[LuluJob] DB error:', e.message); }
  }

  let mainFolderId = job.mainFolderId;
  if (!mainFolderId) mainFolderId = await luluEnsureFolder(job.apiKey, 'محتوى عربي');
  const catFolders = {};

  async function _ensureFolders(item) {
    let catId = catFolders[item.catName];
    if (catId === undefined) { catId = await luluEnsureFolder(job.apiKey, item.catName, mainFolderId); catFolders[item.catName] = catId; }
    let target = catId;
    if (item.type === 'episode' && item.showName) {
      let showId = catFolders[`s:${item.showName}`];
      if (showId === undefined) { showId = await luluEnsureFolder(job.apiKey, cleanTitle(item.showName), catId); catFolders[`s:${item.showName}`] = showId; }
      let seasonId = catFolders[`se:${item.showName}:${item.season}`];
      if (seasonId === undefined) { seasonId = await luluEnsureFolder(job.apiKey, `الموسم ${item.season || 1}`, showId); catFolders[`se:${item.showName}:${item.season}`] = seasonId; }
      target = seasonId;
    }
    return target;
  }

  async function _saveToDB(item, fileCode, folderId, tmdb, meta, langLabel, displayTitle, canplay, hlsUrl) {
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
    if (!_db) return;

    try {
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
          const row = await _db.prepare("INSERT INTO lulu_catalog (id,title,vod_type,poster,backdrop,plot,year,rating,genres,cast_list,director,country,runtime,imdb_id,tmdb_id,lang,canplay,episode_count,uploaded_at,updated_at) VALUES (?,?,'series',?,?,?,?,?,?,?,?,?,?,?,?,?,false,0,?,?) RETURNING id")
            .get(newId, seriesTitle, poster, backdrop, plot, year, rating, genres, castList, director, country, runtime, imdbId, tmdb?.tmdbId || null, langLabel, now, now);
          catalogId = row?.id || newId;
        }
        await _db.prepare("INSERT INTO lulu_episodes (id,catalog_id,season,episode,title,file_code,hls_url,embed_url,canplay) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT (id) DO UPDATE SET file_code=EXCLUDED.file_code,hls_url=EXCLUDED.hls_url,embed_url=EXCLUDED.embed_url,canplay=EXCLUDED.canplay")
          .run('ep-' + fileCode, catalogId, item.season || 1, item.ep || item.episode_num || 0, displayTitle, fileCode, hlsUrl || '', embedUrl, canplay);
        const totalC = await _db.prepare("SELECT COUNT(*) as c FROM lulu_episodes WHERE catalog_id=?").get(catalogId);
        const playC = await _db.prepare("SELECT COUNT(*) as c FROM lulu_episodes WHERE catalog_id=? AND canplay=true").get(catalogId);
        await _db.prepare("UPDATE lulu_catalog SET episode_count=?,canplay=?,hls_url=COALESCE(NULLIF(hls_url,''),?),embed_url=?,updated_at=? WHERE id=?")
          .run(totalC?.c || 0, (playC?.c || 0) > 0, hlsUrl || '', embedUrl, now, catalogId);
      } else {
        const catId = 'mov-' + fileCode;
        await _db.prepare("INSERT INTO lulu_catalog (id,title,vod_type,poster,backdrop,plot,year,rating,genres,cast_list,director,country,runtime,imdb_id,tmdb_id,lang,file_code,hls_url,embed_url,canplay,episode_count,lulu_fld_id,uploaded_at,updated_at) VALUES (?,?,'movie',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,?,?) ON CONFLICT (id) DO UPDATE SET file_code=EXCLUDED.file_code,embed_url=EXCLUDED.embed_url,hls_url=COALESCE(NULLIF(lulu_catalog.hls_url,''),EXCLUDED.hls_url),canplay=CASE WHEN lulu_catalog.canplay=true THEN true ELSE EXCLUDED.canplay END,poster=COALESCE(NULLIF(lulu_catalog.poster,''),EXCLUDED.poster),plot=COALESCE(NULLIF(lulu_catalog.plot,''),EXCLUDED.plot),year=COALESCE(NULLIF(lulu_catalog.year,''),EXCLUDED.year),updated_at=EXCLUDED.updated_at")
          .run(catId, finalTitle, poster, backdrop, plot, year, rating, genres, castList, director, country, runtime, imdbId, tmdb?.tmdbId || null, langLabel, fileCode, hlsUrl || '', embedUrl, canplay, folderId, now, now);
      }
    } catch (e) { console.error(`[LuluJob] DB save error: ${e.message}`); }
  }

  // تجهيز المجلدات
  _emitProgress(job, 'preparing_folders', 2);
  const itemFolders = [];
  for (const item of job.items) { try { itemFolders.push(await _ensureFolders(item)); } catch { itemFolders.push(0); } }

  for (let i = 0; i < job.items.length; i++) {
    if (job._cancelled) break;
    const item = job.items[i];
    const title = cleanTitle(item.name) || item.name;
    job.current = item.name;
    console.log(`\n[LuluJob] ═══ [${i + 1}/${job.total}] ${title} ═══`);

    // 1) بناء رابط IPTV المباشر من بيانات الـ DB
    _emitProgress(job, 'downloading', 10);
    const ext = item.ext || 'mp4';
    const streamType = item.type === 'episode' ? 'series' : 'movie';
    const tmpPath = path.join(os.tmpdir(), `lulu_${Date.now()}_${Math.random().toString(36).slice(2)}.mp4`);

    // جلب credentials من DB
    let iptvUrl = null;
    try {
      if (_db) {
        const iptvId = job.iptvAccountId || 0;
        let row = iptvId > 0 ? await _db.prepare("SELECT server_url,username,password FROM iptv_accounts WHERE id=? AND status='active'").get(iptvId) : null;
        if (!row) row = await _db.prepare("SELECT server_url,username,password FROM iptv_accounts WHERE status='active' ORDER BY id ASC LIMIT 1").get();
        if (row) {
          const u = new URL(row.server_url);
          const base = `${u.protocol}//${u.hostname}:${u.port || 8080}`;
          iptvUrl = `${base}/${streamType}/${row.username}/${row.password}/${item.streamId}.${ext}`;
          console.log(`[Download] URL: ${base}/${streamType}/***/${item.streamId}.${ext}`);
        }
      }
    } catch (e) { console.log(`[Download] credentials error: ${e.message}`); }

    if (!iptvUrl) {
      console.log(`[LuluJob] ✗ No IPTV credentials for: ${title}`);
      job.failed++;
      job.results.push({ name: item.name, status: 'error', error: 'no iptv credentials' });
      _updateDBJob(job);
      await sleep(3000);
      continue;
    }

    let fileCode = null;
    try {
      await _downloadFile(iptvUrl, tmpPath, title);

      // 2) رفع إلى LuluStream
      _emitProgress(job, 'uploading', 30);
      fileCode = await _uploadToLulu(job.apiKey, tmpPath, title, itemFolders[i], pct => _emitProgress(job, 'uploading', 30 + Math.floor(pct * 0.4)));
      try { fs.unlinkSync(tmpPath); } catch {}
      console.log(`[LuluJob] ✓ Uploaded: ${title} → ${fileCode}`);
      job.done++;
      job.results.push({ name: item.name, status: 'ok', fileCode, canplay: false });
      _updateDBJob(job);
    } catch (e) {
      try { fs.unlinkSync(tmpPath); } catch {}
      console.log(`[LuluJob] ✗ Failed: ${title}: ${e.message}`);
      job.failed++;
      job.results.push({ name: item.name, status: 'error', error: e.message });
      _emitProgress(job, 'error', 0);
      _updateDBJob(job);
      await sleep(5000);
      continue;
    }

    // 3) finalize في الخلفية (metadata + canplay)
    _emitProgress(job, 'processing', 80);
    (async () => {
      try {
        let meta = {};
        try {
          if (item.type === 'episode') meta = (await getSeriesInfo(job.account, item.seriesId || item.streamId))?.info || {};
          else meta = (await getVodInfo(job.account, item.streamId))?.info || {};
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
            if (url) await luluUploadSubtitle(job.apiKey, fileCode, url.startsWith('http') ? url : `https://dl.subdl.com${url}`, lang);
          }
        } catch {}

        // canplay
        const canplayResult = await luluCheckCanplay(job.apiKey, fileCode, 1800000, 30000);
        if (canplayResult.canplay) {
          const bestTitle = (tmdb?.title_ar || tmdb?.title_en || displayTitle).slice(0, 200);
          const descr = [langLabel ? `اللغة: ${langLabel}` : '', tmdb?.genres ? `النوع: ${tmdb.genres}` : '', tmdb?.year ? `السنة: ${tmdb.year}` : '', tmdb?.plot ? `\n${tmdb.plot.slice(0, 500)}` : ''].filter(Boolean).join('\n');
          await luluFileEdit(job.apiKey, fileCode, { title: bestTitle, descr, tags: [langLabel, tmdb?.genres, tmdb?.year].filter(Boolean).join(',').slice(0, 300) });
        }

        await _saveToDB(item, fileCode, itemFolders[i], tmdb, meta, langLabel, displayTitle, canplayResult.canplay, canplayResult.hlsUrl || '');
        const r = job.results.find(r => r.fileCode === fileCode);
        if (r) r.canplay = canplayResult.canplay;
        console.log(`[LuluJob] ✓ Finalized: ${title} canplay=${canplayResult.canplay}`);
      } catch (e) { console.log(`[LuluJob] ⚠ Finalize error for ${title}: ${e.message}`); }
    })();
  }

  // انتظر finalize الجارية
  await sleep(10000);
  job.current = null;
  job.status = job._cancelled ? 'cancelled' : 'done';
  job.finishedAt = Date.now();
  _updateDBJob(job);
  _emitProgress(job, job.status, 100);
  console.log(`[LuluJob] ✅ Job #${job.id}: done=${job.done} failed=${job.failed} total=${job.total}`);
}

module.exports = {
  getVodCategories, getSeriesCategories, getVodStreams, getVodInfo,
  getSeriesList, getSeriesInfo, luluGetAccountInfo: (apiKey) => luluAPI(apiKey, '/account/info'),
  luluListFolders: (apiKey, parentId = 0) => httpGet(`https://api.lulustream.com/api/folder/list?key=${apiKey}&fld_id=${parentId}`, 30000).then(r => parseJson(r.body)?.result || []).catch(() => []),
  luluEnsureFolder, createJob, getJobsSummary, getJobDetail, cancelJob, initDB, addSSEClient, getSSEClients,
};
