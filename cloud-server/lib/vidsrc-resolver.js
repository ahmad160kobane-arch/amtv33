/**
 * Stream Resolver — vidsrc.icu
 * يدعم TMDB + IMDB + ترجمات متعددة اللغات
 */

// ═══════════════════════════════════════════════════════
// vidsrc.icu — مصدر سريع متوافق مع TMDB/IMDB
// ═══════════════════════════════════════════════════════

function buildEmbedUrls(tmdbId, imdbId, type, season, episode) {
  const isTv = type === 'tv' && season && episode;
  const id = tmdbId || imdbId;

  let url;
  if (isTv) {
    url = `https://vidsrc.icu/embed/tv/${id}/${season}/${episode}`;
  } else {
    url = `https://vidsrc.icu/embed/movie/${id}`;
  }

  const sources = [{ name: 'vidsrc', url }];
  return sources;
}

// ═══════════════════════════════════════════════════════
// الدالة الرئيسية
// ═══════════════════════════════════════════════════════

async function resolveStream(tmdbId, type = 'movie', season, episode, imdbId) {
  const sources = buildEmbedUrls(tmdbId, imdbId, type, season, episode);
  const tv = type === 'tv' && season && episode;
  console.log(`[Resolver] tmdb=${tmdbId} type=${type}${tv ? ` s${season}e${episode}` : ''} → vidsrc.icu`);

  return {
    embedUrl: sources[0].url,
    provider: sources[0].name,
    sources: sources.map(s => ({ url: s.url, name: s.name })),
    allEmbedUrls: sources.map(s => s.url),
  };
}

module.exports = { resolveStream };
