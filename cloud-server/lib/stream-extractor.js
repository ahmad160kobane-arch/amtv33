/**
 * Stream Extractor v1 — استخراج روابط مباشرة (m3u8/mp4) + ترجمات + جودات
 * يستخدم @movie-web/providers لاستخراج البث المباشر من المصادر
 * بدون WebView — كل شيء على السيرفر
 */

const { makeProviders, makeStandardFetcher, targets } = require('@movie-web/providers');

// ─── إنشاء مثيل واحد من المزودات ───────────────────
const providers = makeProviders({
  fetcher: makeStandardFetcher(fetch),
  target: targets.NATIVE,
});

/**
 * استخراج بث مباشر لفيلم
 * @param {object} opts
 * @param {string} opts.tmdbId
 * @param {string} opts.title
 * @param {number} opts.releaseYear
 * @param {string} [opts.imdbId]
 * @returns {Promise<object|null>}
 */
async function extractMovieStream({ tmdbId, title, releaseYear, imdbId }) {
  try {
    const media = {
      type: 'movie',
      title: title || 'Unknown',
      releaseYear: releaseYear || 2024,
      tmdbId: String(tmdbId),
      ...(imdbId ? { imdbId } : {}),
    };

    console.log(`[Extractor] Movie: "${title}" tmdb=${tmdbId}`);
    const output = await providers.runAll({ media });
    return parseOutput(output);
  } catch (e) {
    console.error(`[Extractor] Movie error:`, e.message);
    return null;
  }
}

/**
 * استخراج بث مباشر لحلقة مسلسل
 * @param {object} opts
 * @param {string} opts.tmdbId
 * @param {string} opts.title
 * @param {number} opts.releaseYear
 * @param {number} opts.season
 * @param {number} opts.episode
 * @param {string} [opts.imdbId]
 * @param {string} [opts.seasonTmdbId]
 * @param {string} [opts.episodeTmdbId]
 * @returns {Promise<object|null>}
 */
async function extractShowStream({ tmdbId, title, releaseYear, season, episode, imdbId, seasonTmdbId, episodeTmdbId }) {
  try {
    const media = {
      type: 'show',
      title: title || 'Unknown',
      releaseYear: releaseYear || 2024,
      tmdbId: String(tmdbId),
      ...(imdbId ? { imdbId } : {}),
      season: {
        number: season || 1,
        tmdbId: seasonTmdbId || String(tmdbId),
      },
      episode: {
        number: episode || 1,
        tmdbId: episodeTmdbId || String(tmdbId),
      },
    };

    console.log(`[Extractor] Show: "${title}" tmdb=${tmdbId} S${season}E${episode}`);
    const output = await providers.runAll({ media });
    return parseOutput(output);
  } catch (e) {
    console.error(`[Extractor] Show error:`, e.message);
    return null;
  }
}

/**
 * تحليل مخرجات @movie-web/providers إلى شكل موحد
 */
function parseOutput(output) {
  if (!output || !output.stream) return null;

  const stream = output.stream;
  const result = {
    sourceId: output.sourceId || 'unknown',
    embedId: output.embedId || null,
    type: stream.type, // 'hls' أو 'file'
    url: null,
    qualities: {},
    headers: stream.headers || {},
    preferredHeaders: stream.preferredHeaders || {},
    captions: [],
  };

  // ═══ HLS — رابط m3u8 واحد ═══
  if (stream.type === 'hls' && stream.playlist) {
    result.url = stream.playlist;
    result.qualities = { auto: { url: stream.playlist, type: 'hls' } };
    console.log(`[Extractor] ✓ HLS: ${stream.playlist.substring(0, 80)}...`);
  }

  // ═══ File — جودات متعددة (mp4) ═══
  if (stream.type === 'file' && stream.qualities) {
    const qualityOrder = ['4k', '1080', '720', '480', '360', 'unknown'];
    let bestUrl = null;
    for (const q of qualityOrder) {
      if (stream.qualities[q]) {
        const sf = stream.qualities[q];
        result.qualities[q] = { url: sf.url, type: sf.type || 'mp4' };
        if (!bestUrl) bestUrl = sf.url;
      }
    }
    result.url = bestUrl;
    console.log(`[Extractor] ✓ File: ${Object.keys(result.qualities).join(', ')} — ${bestUrl?.substring(0, 80)}...`);
  }

  // ═══ ترجمات ═══
  if (stream.captions && stream.captions.length > 0) {
    result.captions = stream.captions.map(c => ({
      id: c.id,
      language: c.language || 'und',
      type: c.type || 'srt',
      url: c.url,
      hasCorsRestrictions: c.hasCorsRestrictions || false,
    }));
    console.log(`[Extractor] ✓ ${result.captions.length} ترجمة متاحة`);
  }

  if (!result.url) return null;
  return result;
}

/**
 * الدالة الرئيسية — استخراج بث مباشر
 */
async function extractStream({ tmdbId, title, releaseYear, type, season, episode, imdbId }) {
  if (type === 'tv' || type === 'show') {
    return extractShowStream({ tmdbId, title, releaseYear, season, episode, imdbId });
  }
  return extractMovieStream({ tmdbId, title, releaseYear, imdbId });
}

/**
 * قائمة المصادر المتاحة
 */
function listProviders() {
  const sources = providers.listSources();
  const embeds = providers.listEmbeds();
  return { sources, embeds };
}

module.exports = { extractStream, listProviders };
