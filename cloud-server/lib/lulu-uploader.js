/**
 * Lulu Uploader — IPTV → LuluStream Upload Manager
 * يتحكم في رفع المحتوى من IPTV إلى LuluStream عبر واجهة الداشبورد
 */
'use strict';

const http  = require('http');
const https = require('https');

// ─── HTTP helper ───────────────────────────────────────────────────────────────
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

// ─── Name helpers ──────────────────────────────────────────────────────────────
function cleanTitle(name = '') {
  return name
    .replace(/^(EN|AR|NF|TR|HN|KR|IT|FR|DE|ES|PL|PER|KRD|NL|CH|JP|RU)\s*[|\-]/i, '')
    .replace(/^(NETFLIX|DISNEY|HBO|APPLE|AMAZON|PRIME|SHAHID)\s*[|\-]/i, '')
    .replace(/VOD\s*\d*/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
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
    const p = new URLSearchParams({ key: apiKey, name, parent_id: parentId });
    const res = await httpGet(`https://api.lulustream.com/api/folder/create?${p}`, 30000);
    const data = parseJson(res.body);
    return data?.result?.fld_id || data?.fld_id || 0;
  } catch { return 0; }
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

// ─── Job Manager ──────────────────────────────────────────────────────────────
let _jobIdCounter = 0;
const _jobs        = new Map(); // id → job object
let _workerRunning = false;
let _db = null; // set by initDB()

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

async function _processJob(job) {
  job.status    = 'running';
  job.startedAt = Date.now();

  // Create DB job record
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

  // Ensure root Arabic folder
  let mainFolderId = job.mainFolderId;
  if (!mainFolderId) {
    mainFolderId = await luluEnsureFolder(job.apiKey, 'محتوى عربي');
  }

  // Category folder cache (name → folderId)
  const catFolders = {};

  for (const item of job.items) {
    if (job._cancelled) break;
    job.current = item.name;

    try {
      // Get or create category sub-folder
      let catFolderId = catFolders[item.catName];
      if (catFolderId === undefined) {
        catFolderId = await luluEnsureFolder(job.apiKey, item.catName, mainFolderId);
        catFolders[item.catName] = catFolderId;
      }

      // Build VPS proxy URL
      const ext       = item.ext || 'mp4';
      const proxyType = item.type === 'episode' ? 'series' : 'movie';
      const srcUrl    = `${job.vpsUrl}/iptv-proxy/${job.proxySecret}/${proxyType}/${item.streamId}.${ext}`;

      const title    = cleanTitle(item.name) || item.name;

      // Series episode: nest inside show/season folders
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

      // Upload
      const fileCode = await luluRemoteUpload(job.apiKey, srcUrl, title, targetFolderId);

      // Subtitles via SubDL
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
      } catch { /* subtitle errors are non-fatal */ }

      job.done++;
      job.results.push({ name: item.name, status: 'ok', fileCode });

      // ─── Save file_code to PostgreSQL ───
      if (_db) {
        try {
          await _db.prepare(
            "INSERT INTO lulu_uploaded_files (file_code, title, original_name, type, cat_name, show_name, season, episode_num, iptv_stream_id, lulu_account_id, iptv_account_id, folder_id, job_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
          ).run(
            fileCode, title, item.name, item.type || 'movie',
            item.catName || '', item.showName || '', item.season || 0, item.ep || item.episode_num || 0,
            String(item.streamId), job.luluAccountId, job.iptvAccountId,
            targetFolderId, job._dbJobId || 0, 'ok', Date.now()
          );
        } catch (e) { console.error('[LuluJob] DB file insert error:', e.message); }
      }

    } catch (e) {
      job.failed++;
      job.results.push({ name: item.name, status: 'error', error: e.message });

      // Save error to DB
      if (_db) {
        try {
          await _db.prepare(
            "INSERT INTO lulu_uploaded_files (file_code, title, original_name, type, cat_name, show_name, season, episode_num, iptv_stream_id, lulu_account_id, iptv_account_id, job_id, status, error_msg, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
          ).run(
            '', item.name || '', item.name || '', item.type || 'movie',
            item.catName || '', item.showName || '', item.season || 0, item.ep || 0,
            String(item.streamId), job.luluAccountId, job.iptvAccountId,
            job._dbJobId || 0, 'error', e.message, Date.now()
          );
        } catch (dbErr) { console.error('[LuluJob] DB error insert:', dbErr.message); }
      }

      if (e.message === 'daily_limit') {
        job.current = null;
        job.status  = 'daily_limit';
        job.finishedAt = Date.now();
        _updateDBJob(job);
        return;
      }
    }

    // Update DB job progress
    _updateDBJob(job);

    await sleep(3500);
  }

  job.current    = null;
  job.status     = job._cancelled ? 'cancelled' : 'done';
  job.finishedAt = Date.now();
  _updateDBJob(job);
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
  // IPTV
  getVodCategories,
  getSeriesCategories,
  getVodStreams,
  getSeriesList,
  getSeriesInfo,
  // Lulu
  luluGetAccountInfo,
  luluListFolders,
  luluEnsureFolder,
  // Jobs
  createJob,
  getJobsSummary,
  getJobDetail,
  cancelJob,
  // DB
  initDB,
};
