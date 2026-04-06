/**
 * Stream Resolver — 2embed.cc (TMDB متوافق 100%)
 * يعمل عبر embed-proxy على سيرفرنا الذي يحجب الإعلانات
 */

// ═══════════════════════════════════════════════════════
// 2embed.cc — متوافق TMDB ID + يدعم العربية
// ═══════════════════════════════════════════════════════

function buildEmbedUrls(tmdbId, imdbId, type, season, episode) {
  const isTv = type === 'tv' && season && episode;

  const sources = [
    {
      name: '2embed',
      url: isTv
        ? `https://www.2embed.cc/embedtv/${tmdbId}&s=${season}&e=${episode}`
        : `https://www.2embed.cc/embed/${tmdbId}`,
    },
  ];

  return sources;
}

// ═══════════════════════════════════════════════════════
// الدالة الرئيسية
// ═══════════════════════════════════════════════════════

async function resolveStream(tmdbId, type = 'movie', season, episode, imdbId) {
  const sources = buildEmbedUrls(tmdbId, imdbId, type, season, episode);
  const tv = type === 'tv' && season && episode;
  console.log(`[Resolver] tmdb=${tmdbId} type=${type}${tv ? ` s${season}e${episode}` : ''} → 2embed.cc`);

  return {
    embedUrl: sources[0].url,
    provider: sources[0].name,
    sources: sources.map(s => ({ url: s.url, name: s.name })),
    allEmbedUrls: sources.map(s => s.url),
  };
}

module.exports = { resolveStream };
