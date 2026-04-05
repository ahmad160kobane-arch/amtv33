/**
 * Stream Resolver — إرجاع فوري لروابط Embed
 * يستخدم مصادر متعددة مع احتياطي تلقائي
 */

// ═══════════════════════════════════════════════════════
// بناء روابط Embed — مصادر متعددة مع احتياطي
// ═══════════════════════════════════════════════════════

function buildEmbedUrls(tmdbId, imdbId, type, season, episode) {
  const isTv = type === 'tv' && season && episode;
  const sources = [];

  // المصدر الوحيد: 2embed.cc
  sources.push({
    name: '2embed.cc',
    url: isTv
      ? `https://www.2embed.cc/embedtv/${tmdbId}&s=${season}&e=${episode}`
      : `https://www.2embed.cc/embed/${tmdbId}`,
  });

  return sources;
}

// ═══════════════════════════════════════════════════════
// الدالة الرئيسية — إرجاع كل المصادر المتاحة
// ═══════════════════════════════════════════════════════

async function resolveStream(tmdbId, type = 'movie', season, episode, imdbId) {
  const sources = buildEmbedUrls(tmdbId, imdbId, type, season, episode);
  const tv = type === 'tv' && season && episode;
  console.log(`[Resolver] tmdb=${tmdbId} type=${type}${tv ? ` s${season}e${episode}` : ''} — ${sources.length} مصادر`);

  return {
    embedUrl: sources[0].url,
    provider: sources[0].name,
    sources: sources.map(s => ({ url: s.url, name: s.name })),
    // إرجاع كل الروابط للاستخدام الاحتياطي
    allEmbedUrls: sources.map(s => s.url),
  };
}

module.exports = { resolveStream };
