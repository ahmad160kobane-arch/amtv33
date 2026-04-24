const fs = require('fs');
const raw = JSON.parse(fs.readFileSync('/root/lulu-uploader/iptv-state.json', 'utf8'));
const normalized = { uploaded: {}, failed: raw.failed || {} };
for (const [k, v] of Object.entries(raw.uploaded || {})) {
  if (k.startsWith('vod:') && typeof v === 'string') {
    normalized.uploaded['movie_' + k.slice(4)] = { fileCode: v };
  }
}
console.log('Count:', Object.keys(normalized.uploaded).length);
console.log('Sample:', Object.keys(normalized.uploaded)[0]);
const prog = normalized;
const movies = Object.entries(prog.uploaded)
  .filter(([k]) => k.startsWith('movie_'))
  .map(([k, v]) => ({ id: k.replace('movie_', ''), fileCode: v.fileCode }));
console.log('Movies after filter:', movies.length, movies[0]);
