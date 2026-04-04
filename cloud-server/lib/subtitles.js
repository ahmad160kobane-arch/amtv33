// ─── OpenSubtitles REST API v1 ────────────────────────────────────────────────
// Free API key: register at https://www.opensubtitles.com/en/consumers
// Free plan: 5 downloads/day · Upgrade for more

const https = require('https');
const zlib  = require('zlib');

const OS_API  = 'api.opensubtitles.com';
const API_KEY = process.env.OPENSUBTITLES_KEY || 'njFVFI5hLqUFORqeK2xeVH1g8eCrpH9m';
const UA      = 'AMTV v1.0';

// ─── Simple HTTP helper ───────────────────────────────────────────────────────
function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const text = buf.toString('utf8');
        try { resolve({ status: res.statusCode, data: JSON.parse(text) }); }
        catch { resolve({ status: res.statusCode, data: text }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// ─── Simple in-memory cache ───────────────────────────────────────────────────
const _cache = new Map();
function getCached(k) {
  const e = _cache.get(k);
  if (!e) return null;
  if (Date.now() - e.ts > 30 * 60 * 1000) { _cache.delete(k); return null; }
  return e.data;
}
function setCache(k, data) { _cache.set(k, { data, ts: Date.now() }); }

// ─── Search subtitles ─────────────────────────────────────────────────────────
async function searchSubtitles(query, year = '') {
  const cKey = `sub_search_${query}_${year}`;
  const cached = getCached(cKey);
  if (cached) return cached;

  const q = encodeURIComponent(query.trim());
  const yearParam = year ? `&year=${year}` : '';
  const path = `/api/v1/subtitles?query=${q}&languages=ar${yearParam}&order_by=download_count&order_direction=desc`;

  const res = await request({
    hostname: OS_API, path, method: 'GET',
    headers: { 'Api-Key': API_KEY, 'User-Agent': UA, 'Content-Type': 'application/json' },
  });

  if (res.status !== 200 || !res.data?.data) {
    console.error('[Subtitles] search failed:', res.status, JSON.stringify(res.data).substring(0, 200));
    return [];
  }

  const results = (res.data.data || []).slice(0, 8).map(item => ({
    id:        item.id,
    file_id:   item.attributes?.files?.[0]?.file_id,
    name:      item.attributes?.release || item.attributes?.feature_details?.movie_name || query,
    language:  item.attributes?.language || 'ar',
    downloads: item.attributes?.download_count || 0,
    rating:    item.attributes?.ratings || 0,
    fps:       item.attributes?.fps || 25,
    url:       item.attributes?.url,
  })).filter(r => r.file_id);

  setCache(cKey, results);
  return results;
}

// ─── Get download link ────────────────────────────────────────────────────────
async function getDownloadLink(file_id) {
  const body = JSON.stringify({ file_id });
  const res = await request({
    hostname: OS_API, path: '/api/v1/download', method: 'POST',
    headers: {
      'Api-Key': API_KEY, 'User-Agent': UA,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  }, body);

  if (res.status !== 200) {
    throw new Error(`Download link failed: ${res.status} ${JSON.stringify(res.data).substring(0, 100)}`);
  }
  return res.data?.link || null;
}

// ─── Fetch subtitle file ──────────────────────────────────────────────────────
function fetchFile(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, method: 'GET',
      headers: { 'User-Agent': UA } }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.end();
  });
}

// ─── SRT parser ──────────────────────────────────────────────────────────────
function parseSrt(text) {
  // Normalise line endings
  const content = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = content.split(/\n\n+/).filter(b => b.trim());
  const cues = [];

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 2) continue;

    // Skip index line if present
    let i = 0;
    if (/^\d+$/.test(lines[0].trim())) i = 1;

    const timeLine = lines[i];
    if (!timeLine) continue;

    const m = timeLine.match(
      /(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})/
    );
    if (!m) continue;

    const toMs = (h, min, s, ms) =>
      parseInt(h)*3600000 + parseInt(min)*60000 + parseInt(s)*1000 + parseInt(ms);

    const start = toMs(m[1], m[2], m[3], m[4]);
    const end   = toMs(m[5], m[6], m[7], m[8]);

    const text = lines.slice(i + 1).join('\n')
      .replace(/<[^>]+>/g, '')   // strip HTML tags
      .replace(/\{[^}]+\}/g, '') // strip SSA tags
      .trim();

    if (text) cues.push({ start, end, text });
  }

  return cues;
}

// ─── Main: search + download + parse ─────────────────────────────────────────
async function getSubtitleCues(query, year = '') {
  const cKey = `sub_cues_${query}_${year}`;
  const cached = getCached(cKey);
  if (cached) return cached;

  const results = await searchSubtitles(query, year);
  if (!results.length) return null;

  // Try first result
  for (const r of results.slice(0, 3)) {
    try {
      const link = await getDownloadLink(r.file_id);
      if (!link) continue;

      const buf = await fetchFile(link);

      let text;
      try {
        // Try UTF-8 first
        text = buf.toString('utf8');
        // If garbled, try latin1
        if (text.includes('ï¿½') || text.includes('â€')) {
          text = buf.toString('latin1');
        }
      } catch { text = buf.toString('latin1'); }

      const cues = parseSrt(text);
      if (cues.length === 0) continue;

      const result = { cues, name: r.name, file_id: r.file_id };
      setCache(cKey, result);
      return result;
    } catch (e) {
      console.warn('[Subtitles] Failed to get cues from result:', e.message);
    }
  }
  return null;
}

module.exports = { searchSubtitles, getSubtitleCues };
