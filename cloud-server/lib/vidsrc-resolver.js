/**
 * VidSrc Stream Resolver - محسّن ومطوّر
 * يدعم: vidsrc.to, vidsrc.xyz, vidsrc.net, vidsrc.pro
 * يستخرج روابط مباشرة + embed URLs
 * 
 * التحديث: 2026-04-20
 * - إضافة Advanced Resolver لاستخراج روابط مباشرة
 * - دعم multiple sources مع fallback
 * - تحسين الأداء والاستقرار
 */

const advancedResolver = require('./vidsrc-advanced-resolver');

// ═══════════════════════════════════════════════════════
// Legacy Embed URLs (Fallback)
// ═══════════════════════════════════════════════════════

function buildLegacyEmbedUrls(tmdbId, imdbId, type, season, episode) {
  const isTv = type === 'tv' && season && episode;
  const sources = [];

  // vidsrc.xyz (يدعم TMDB)
  if (tmdbId) {
    if (isTv) {
      sources.push({
        name: 'vidsrc.xyz',
        url: `https://vidsrc.xyz/embed/tv/${tmdbId}/${season}/${episode}`
      });
    } else {
      sources.push({
        name: 'vidsrc.xyz',
        url: `https://vidsrc.xyz/embed/movie/${tmdbId}`
      });
    }
  }

  // vidsrc.to (يدعم IMDb)
  if (imdbId) {
    if (isTv) {
      sources.push({
        name: 'vidsrc.to',
        url: `https://vidsrc.to/embed/tv/${imdbId}/${season}/${episode}`
      });
    } else {
      sources.push({
        name: 'vidsrc.to',
        url: `https://vidsrc.to/embed/movie/${imdbId}`
      });
    }
  }

  // vidsrc.net (بديل)
  if (imdbId) {
    if (isTv) {
      sources.push({
        name: 'vidsrc.net',
        url: `https://vidsrc.net/embed/tv?imdb=${imdbId}&season=${season}&episode=${episode}`
      });
    } else {
      sources.push({
        name: 'vidsrc.net',
        url: `https://vidsrc.net/embed/movie?imdb=${imdbId}`
      });
    }
  }

  // vidsrc.icu (القديم - مع ترجمات عربية)
  if (tmdbId) {
    if (isTv) {
      sources.push({
        name: 'vidsrc.icu',
        url: `https://vidsrcme.vidsrc.icu/embed/tv?tmdb=${tmdbId}&season=${season}&episode=${episode}&autoplay=1&ds_lang=ar`
      });
    } else {
      sources.push({
        name: 'vidsrc.icu',
        url: `https://vidsrcme.vidsrc.icu/embed/movie?tmdb=${tmdbId}&autoplay=1&ds_lang=ar`
      });
    }
  }

  return sources;
}

// ═══════════════════════════════════════════════════════
// الدالة الرئيسية - محسّنة
// ═══════════════════════════════════════════════════════

async function resolveStream(tmdbId, type = 'movie', season, episode, imdbId) {
  const tv = type === 'tv' && season && episode;
  console.log(`[VidSrc Resolver] tmdb=${tmdbId} imdb=${imdbId} type=${type}${tv ? ` s${season}e${episode}` : ''}`);

  try {
    // محاولة استخدام Advanced Resolver (يستخرج روابط مباشرة)
    const advancedResult = await advancedResolver.resolveStream(tmdbId, type, season, episode, imdbId);
    
    if (advancedResult && advancedResult.embedUrl) {
      console.log(`[VidSrc Resolver] ✓ Resolved via ${advancedResult.provider}`);
      return advancedResult;
    }
  } catch (error) {
    console.error('[VidSrc Resolver] Advanced resolver failed:', error.message);
  }

  // Fallback: استخدام Legacy Embed URLs
  console.log('[VidSrc Resolver] Using legacy embed URLs');
  const sources = buildLegacyEmbedUrls(tmdbId, imdbId, type, season, episode);
  
  if (sources.length === 0) {
    throw new Error('No VidSrc sources available');
  }

  return {
    embedUrl: sources[0].url,
    provider: sources[0].name,
    sources: sources.map(s => ({ url: s.url, name: s.name })),
    allEmbedUrls: sources.map(s => s.url),
  };
}

module.exports = { resolveStream };
