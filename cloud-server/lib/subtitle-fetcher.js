/**
 * جلب ترجمات عربية وكردية — Subdl (مجاني + ضخم) + OpenSubtitles (احتياط)
 */

const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
const FETCH_TIMEOUT = 8000;

const LANG_LABELS = {
  ar: 'العربية', ara: 'العربية',
  ku: 'الكردية', kur: 'الكردية', ckb: 'الكردية (سورانی)', kmr: 'الكردية (كرمانجي)',
};

function langLabel(code) {
  return LANG_LABELS[code] || code || 'غير محدد';
}

function isKurdish(code) {
  const c = (code || '').toLowerCase();
  return c === 'ku' || c === 'kur' || c === 'ckb' || c === 'kmr' || c.includes('kurd');
}

/**
 * جلب ترجمات من OpenSubtitles (legacy REST) — عربي + كردي
 */
async function fetchFromOpenSubtitles(imdbId) {
  if (!imdbId || !imdbId.startsWith('tt')) return [];

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT);

  try {
    const url = `https://rest.opensubtitles.org/search/sublanguageid-ara,kur/imdbid-${imdbId}`;
    const res = await fetch(url, {
      signal: ac.signal,
      headers: { 'User-Agent': UA, 'Accept': 'application/json' },
    });

    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return [];

    const sorted = data
      .filter(s => s.SubDownloadLink || s.SubtitlesLink)
      .sort((a, b) => parseFloat(b.SubRating || 0) - parseFloat(a.SubRating || 0))
      .slice(0, 8);

    return sorted.map(s => {
      const code = (s.ISO639 || s.SubLanguageID || 'ar').toLowerCase();
      const kurd = isKurdish(code);
      const rating = s.SubRating && parseFloat(s.SubRating) > 0 ? ` (${s.SubRating}★)` : '';
      return {
        language: kurd ? 'ku' : 'ar',
        label: `${kurd ? 'الكردية' : 'العربية'}${rating}`,
        url: s.SubDownloadLink || s.SubtitlesLink || '',
        filename: s.SubFileName || (kurd ? 'kurdish.srt' : 'arabic.srt'),
        format: (s.SubFormat || 'srt').toLowerCase(),
      };
    });
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * جلب ترجمات من Subdl (عربي + كردي، يدعم TMDB ID مباشرةً)
 */
async function fetchFromSubdl(tmdbId, type, season, episode) {
  if (!tmdbId) return [];

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT);

  try {
    let url = `https://api.subdl.com/api/v1/subtitles?tmdb_id=${tmdbId}&languages=ar,ku&type=${type === 'tv' ? 'tv' : 'movie'}&subs_per_page=12`;
    if (type === 'tv' && season && episode) {
      url += `&season_number=${season}&episode_number=${episode}`;
    }

    const res = await fetch(url, { signal: ac.signal, headers: { 'User-Agent': UA } });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.subtitles || !Array.isArray(data.subtitles)) return [];

    return data.subtitles.map(s => {
      const code = (s.language || 'ar').toLowerCase();
      const kurd = isKurdish(code);
      return {
        language: kurd ? 'ku' : 'ar',
        label: `${kurd ? 'الكردية' : 'العربية'}${s.author ? ` — ${s.author}` : ''}`,
        url: s.url ? `https://dl.subdl.com${s.url}` : '',
        filename: s.release_name || (kurd ? 'kurdish.srt' : 'arabic.srt'),
        format: 'srt',
      };
    }).filter(s => s.url);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * الدالة الرئيسية — جلب ترجمات عربية وكردية
 */
async function fetchArabicSubtitles({ tmdbId, imdbId, type = 'movie', season, episode }) {
  console.log(`[Subtitles] جلب: tmdb=${tmdbId} imdb=${imdbId} type=${type}${type === 'tv' ? ` s${season}e${episode}` : ''}`);

  const [opensubRes, subdlRes] = await Promise.allSettled([
    imdbId ? fetchFromOpenSubtitles(imdbId) : Promise.resolve([]),
    fetchFromSubdl(tmdbId, type, season, episode),
  ]);

  const opensub = opensubRes.status === 'fulfilled' ? opensubRes.value : [];
  const subdl = subdlRes.status === 'fulfilled' ? subdlRes.value : [];

  // أولوية Subdl — أحدث وأضخم
  const all = [...subdl, ...opensub];

  // إزالة التكرارات
  const seen = new Set();
  const unique = [];
  for (const sub of all) {
    const key = sub.filename.toLowerCase();
    if (!seen.has(key)) { seen.add(key); unique.push(sub); }
  }

  const final = unique.slice(0, 10);
  console.log(`[Subtitles] ${final.length} ترجمة (Subdl: ${subdl.length}, OpenSub: ${opensub.length})`);
  return final;
}

module.exports = { fetchArabicSubtitles };
