/**
 * vidlink.pro HLS Resolver — يستخرج رابط البث المباشر (HLS) من vidlink.pro
 * بدون iframe = بدون إعلانات
 */
const { randomBytes, createDecipheriv, createCipheriv } = require('crypto');

const API_URL = 'https://vidlink.pro/api/b';
const KEY_HEX = '2de6e6ea13a9df9503b11a6117fd7e51941e04a0c223dfeacfe8a1dbb6c52783';
const ALGO = 'aes-256-cbc';

function encrypt(data) {
  const iv = randomBytes(16);
  const key = Buffer.from(KEY_HEX, 'hex').slice(0, 32);
  const cipher = createCipheriv(ALGO, key, iv);
  let encrypted = cipher.update(data);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

function decrypt(data) {
  const [ivHex, encryptedHex] = data.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const key = Buffer.from(KEY_HEX, 'hex').slice(0, 32);
  const decipher = createDecipheriv(ALGO, key, iv);
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

/**
 * Resolve direct HLS stream from vidlink.pro
 * @param {string} tmdbId
 * @param {'movie'|'tv'} type
 * @param {number} [season]
 * @param {number} [episode]
 * @returns {Promise<{hlsUrl:string, subtitles:Array}|null>}
 */
async function resolveVidlinkStream(tmdbId, type, season, episode) {
  try {
    const encodedId = Buffer.from(encrypt(String(tmdbId))).toString('base64');
    let url;
    if (type === 'tv' && season && episode) {
      url = `${API_URL}/tv/${encodedId}/${season}/${episode}`;
    } else {
      url = `${API_URL}/movie/${encodedId}`;
    }

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://vidlink.pro/',
        'Origin': 'https://vidlink.pro',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      console.log(`[VidlinkResolver] API returned ${res.status} for tmdb=${tmdbId}`);
      return null;
    }

    const raw = await res.text();
    if (!raw || !raw.includes(':')) {
      console.log('[VidlinkResolver] Empty or invalid response');
      return null;
    }

    const decrypted = decrypt(raw);
    const video = JSON.parse(decrypted);

    if (!video?.stream?.playlist) {
      console.log('[VidlinkResolver] No playlist in response');
      return null;
    }

    // Extract subtitles (captions)
    const subtitles = (video.stream.captions || []).map(c => ({
      url: c.url,
      lang: c.language || 'unknown',
      label: c.language || 'Unknown',
    }));

    console.log(`[VidlinkResolver] ✓ HLS found for tmdb=${tmdbId} — ${subtitles.length} subs`);

    return {
      hlsUrl: video.stream.playlist,
      subtitles,
    };
  } catch (err) {
    console.error('[VidlinkResolver] Error:', err.message);
    return null;
  }
}

module.exports = { resolveVidlinkStream };
