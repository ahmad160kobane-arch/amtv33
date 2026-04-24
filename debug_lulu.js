const LULU_PROGRESS_PATH = '/root/lulu-uploader/iptv-state.json';
const fs = require('fs');
let p;
try {
  const raw = JSON.parse(fs.readFileSync(LULU_PROGRESS_PATH, 'utf8'));
  console.log('File read OK, keys:', Object.keys(raw.uploaded).length);
  const n = { uploaded: {}, failed: raw.failed || {} };
  for (const [k, v] of Object.entries(raw.uploaded || {})) {
    if (k.startsWith('movie_') || k.startsWith('series_')) {
      n.uploaded[k] = v;
    } else if (k.startsWith('vod:') && typeof v === 'string') {
      n.uploaded['movie_' + k.replace('vod:', '')] = { fileCode: v, title: '', poster: '', year: '', genre: '', lang: 'ar', cat: '', ts: 0 };
    } else if (k.startsWith('ep:') && typeof v === 'string') {
      n.uploaded['series_' + k.replace('ep:', '')] = { fileCode: v, title: '', show: '', season: 1, ep: 1, poster: '', genre: '', lang: 'ar', ts: 0 };
    }
  }
  p = n;
  console.log('Normalized, movie keys:', Object.keys(p.uploaded).filter(k => k.startsWith('movie_')).length);
} catch(e) {
  console.log('CATCH ERROR:', e.message, e.stack);
  p = { uploaded: {}, failed: {} };
}
const movies = Object.entries(p.uploaded)
  .filter(([k]) => k.startsWith('movie_'))
  .map(([k, v]) => ({ id: k.replace('movie_', ''), title: v.title || '', fileCode: v.fileCode }));
console.log('Final movies:', movies.length);
if (movies[0]) console.log('First movie:', JSON.stringify(movies[0]));
