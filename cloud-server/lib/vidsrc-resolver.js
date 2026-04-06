/**
 * Stream Resolver — مصدر واحد عربي
 * vidlink.pro — يدعم اختيار اللغة العربية تلقائياً (ترجمة أو دبلجة)
 */

// ═══════════════════════════════════════════════════════
// vidlink.pro — مصدر عربي مجاني + TMDB
// ═══════════════════════════════════════════════════════

function buildEmbedUrls(tmdbId, imdbId, type, season, episode) {
  const isTv = type === 'tv' && season && episode;

  const vidlinkUrl = isTv
    ? `https://vidlink.pro/tv/${tmdbId}/${season}/${episode}?primaryLang=ar&player=jw&multiSubs=true`
    : `https://vidlink.pro/movie/${tmdbId}?primaryLang=ar&player=jw&multiSubs=true`;

  const sources = [
    {
      name: '',
      url: `/proxy/embed-clean?url=${encodeURIComponent(vidlinkUrl)}`,
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
  console.log(`[Resolver] tmdb=${tmdbId} type=${type}${tv ? ` s${season}e${episode}` : ''} → vidlink.pro (ar)`);

  return {
    embedUrl: sources[0].url,
    provider: sources[0].name,
    sources: sources.map(s => ({ url: s.url, name: s.name })),
    allEmbedUrls: sources.map(s => s.url),
  };
}

module.exports = { resolveStream };
