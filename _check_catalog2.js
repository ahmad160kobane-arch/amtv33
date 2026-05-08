const {Client} = require('ssh2');

const c = new Client();
c.on('ready', () => {
  // فحص آخر 10 سجلات في lulu_catalog
  const cmd = `cd /root/ma-streaming && node -e "
const db = require('./cloud-server/db');
const rows = db.prepare('SELECT id, title, vod_type, poster, plot, genres, cast_list, director, rating, year, file_code, canplay, tmdb_id, imdb_id FROM lulu_catalog ORDER BY uploaded_at DESC LIMIT 10').all();
console.log('=== آخر 10 سجلات في lulu_catalog ===');
rows.forEach((r,i) => {
  console.log('---');
  console.log('title:', r.title);
  console.log('type:', r.vod_type);
  console.log('file_code:', r.file_code);
  console.log('canplay:', r.canplay);
  console.log('tmdb_id:', r.tmdb_id);
  console.log('poster:', r.poster ? r.poster.slice(0,60) : '❌ EMPTY');
  console.log('plot:', r.plot ? r.plot.slice(0,80) : '❌ EMPTY');
  console.log('genres:', r.genres || '❌ EMPTY');
  console.log('cast_list:', r.cast_list ? r.cast_list.slice(0,60) : '❌ EMPTY');
  console.log('director:', r.director || '❌ EMPTY');
  console.log('rating:', r.rating || '❌ EMPTY');
  console.log('year:', r.year || '❌ EMPTY');
});
console.log('=== الإجمالي ===');
const total = db.prepare('SELECT COUNT(*) as c FROM lulu_catalog').get();
const withPoster = db.prepare('SELECT COUNT(*) as c FROM lulu_catalog WHERE poster IS NOT NULL AND poster != \\\"\\\"').get();
const withPlot = db.prepare('SELECT COUNT(*) as c FROM lulu_catalog WHERE plot IS NOT NULL AND plot != \\\"\\\"').get();
console.log('Total:', total.c);
console.log('With poster:', withPoster.c);
console.log('With plot:', withPlot.c);
"`;

  c.exec(cmd, (err, stream) => {
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => c.end());
  });
}).connect({host:'62.171.153.204',port:22,username:'root',password:'Mustafa7'});
