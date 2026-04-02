/**
 * جلب ترجمات عربية — يستخدم OpenSubtitles REST API (مجاني بدون مفتاح)
 * + احتياط من Subdl API
 */

const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
const FETCH_TIMEOUT = 6000;

/**
 * جلب ترجمات عربية من OpenSubtitles (legacy REST)
 * @param {string} imdbId - مثل tt1234567
 * @returns {Promise<Array<{language: string, url: string, filename: string}>>}
 */
async function fetchFromOpenSubtitles(imdbId) {
  if (!imdbId || !imdbId.startsWith('tt')) return [];

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT);

  try {
    // OpenSubtitles legacy REST — بحث بـ IMDB ID + لغة عربية
    const url = `https://rest.opensubtitles.org/search/sublanguageid-ara/imdbid-${imdbId}`;
    const res = await fetch(url, {
      signal: ac.signal,
      headers: {
        'User-Agent': UA,
        'Accept': 'application/json',
      },
    });

    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return [];

    // أخذ أفضل 5 نتائج مرتبة بالتقييم
    const sorted = data
      .filter(s => s.SubDownloadLink || s.SubtitlesLink)
      .sort((a, b) => parseFloat(b.SubRating || 0) - parseFloat(a.SubRating || 0))
      .slice(0, 5);

    return sorted.map(s => ({
      language: s.LanguageName || 'Arabic',
      label: `العربية${s.SubRating && parseFloat(s.SubRating) > 0 ? ` (${s.SubRating}★)` : ''}`,
      url: s.SubDownloadLink || s.SubtitlesLink || '',
      filename: s.SubFileName || 'arabic.srt',
      format: (s.SubFormat || 'srt').toLowerCase(),
    }));
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * جلب ترجمات عربية من Subdl (يدعم TMDB ID)
 * @param {string} tmdbId
 * @param {string} type - movie أو tv
 * @param {number} season
 * @param {number} episode
 * @returns {Promise<Array<{language: string, url: string, filename: string}>>}
 */
async function fetchFromSubdl(tmdbId, type, season, episode) {
  if (!tmdbId) return [];

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT);

  try {
    let url = `https://api.subdl.com/api/v1/subtitles?tmdb_id=${tmdbId}&languages=ar&type=${type === 'tv' ? 'tv' : 'movie'}&subs_per_page=5`;
    if (type === 'tv' && season && episode) {
      url += `&season_number=${season}&episode_number=${episode}`;
    }

    const res = await fetch(url, {
      signal: ac.signal,
      headers: { 'User-Agent': UA },
    });

    if (!res.ok) return [];
    const data = await res.json();

    if (!data.subtitles || !Array.isArray(data.subtitles)) return [];

    return data.subtitles.slice(0, 5).map(s => ({
      language: s.language || 'Arabic',
      label: `العربية${s.author ? ` — ${s.author}` : ''}`,
      url: s.url ? `https://dl.subdl.com${s.url}` : '',
      filename: s.release_name || 'arabic.srt',
      format: 'srt',
    })).filter(s => s.url);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * الدالة الرئيسية — جلب ترجمات عربية من عدة مصادر
 */
async function fetchArabicSubtitles({ tmdbId, imdbId, type = 'movie', season, episode }) {
  console.log(`[Subtitles] جلب ترجمات عربية: tmdb=${tmdbId} imdb=${imdbId} type=${type}${type === 'tv' ? ` s${season}e${episode}` : ''}`);

  // فحص المصدرين بالتوازي
  const [opensubResults, subdlResults] = await Promise.allSettled([
    imdbId ? fetchFromOpenSubtitles(imdbId) : Promise.resolve([]),
    fetchFromSubdl(tmdbId, type, season, episode),
  ]);

  const opensub = opensubResults.status === 'fulfilled' ? opensubResults.value : [];
  const subdl = subdlResults.status === 'fulfilled' ? subdlResults.value : [];

  // دمج النتائج (أولوية Subdl لأنه أحدث)
  const all = [...subdl, ...opensub];

  // إزالة التكرارات بناءً على اسم الملف
  const seen = new Set();
  const unique = [];
  for (const sub of all) {
    const key = sub.filename.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(sub);
    }
  }

  const final = unique.slice(0, 5);
  console.log(`[Subtitles] ${final.length} ترجمة عربية متاحة (OpenSub: ${opensub.length}, Subdl: ${subdl.length})`);
  return final;
}

module.exports = { fetchArabicSubtitles };
