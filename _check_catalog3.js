const {Client} = require('ssh2');

const c = new Client();
c.on('ready', () => {
  const cmd = `node -e "
const {Pool} = require('pg');
const pool = new Pool({connectionString: 'postgresql://postgres:ItqaSByVVVKDVlOEPvTNSrqsOVecsIGu@switchback.proxy.rlwy.net:23361/railway', ssl:{rejectUnauthorized:false}});
pool.query('SELECT id, title, vod_type, poster, plot, genres, cast_list, director, rating, year, file_code, canplay, tmdb_id FROM lulu_catalog ORDER BY uploaded_at DESC LIMIT 10').then(r=>{
  console.log('=== آخر 10 سجلات ===');
  r.rows.forEach(row=>{
    console.log('---');
    console.log('title:', row.title);
    console.log('type:', row.vod_type);
    console.log('file_code:', row.file_code);
    console.log('canplay:', row.canplay);
    console.log('tmdb_id:', row.tmdb_id);
    console.log('poster:', row.poster ? row.poster.slice(0,60) : 'EMPTY');
    console.log('plot:', row.plot ? row.plot.slice(0,80) : 'EMPTY');
    console.log('genres:', row.genres || 'EMPTY');
    console.log('cast_list:', row.cast_list ? row.cast_list.slice(0,60) : 'EMPTY');
    console.log('rating:', row.rating || 'EMPTY');
    console.log('year:', row.year || 'EMPTY');
  });
  return pool.query('SELECT COUNT(*) as total, COUNT(CASE WHEN poster IS NOT NULL AND poster!= \\\"\\\" THEN 1 END) as with_poster, COUNT(CASE WHEN plot IS NOT NULL AND plot!=\\\"\\\" THEN 1 END) as with_plot FROM lulu_catalog');
}).then(r2=>{
  console.log('=== إحصائيات ===');
  console.log(r2.rows[0]);
  pool.end();
}).catch(e=>{console.error(e.message); pool.end();});
"`;

  c.exec(cmd, (err, stream) => {
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => c.end());
  });
}).connect({host:'62.171.153.204',port:22,username:'root',password:'Mustafa7'});
