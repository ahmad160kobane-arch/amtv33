/**
 * Stream Resolver — vidsrcme.vidsrc.icu (الـ player الفعلي بدون wrapper)
 * يدعم TMDB + IMDB + ترجمات متعددة اللغات
 */

// ═══════════════════════════════════════════════════════
// vidsrcme.vidsrc.icu — المشغل الفعلي (تأكد بـ curl)
// ═══════════════════════════════════════════════════════

function buildEmbedUrls(tmdbId, imdbId, type, season, episode) {
  const isTv = type === 'tv' && season && episode;
  const id = tmdbId || imdbId;

  let url;
  if (isTv) {
    url = `https://vidsrcme.vidsrc.icu/embed/tv?tmdb=${id}&season=${season}&episode=${episode}&autoplay=1&ds_lang=ar`;
  } else {
    url = `https://vidsrcme.vidsrc.icu/embed/movie?tmdb=${id}&autoplay=1&ds_lang=ar`;
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
