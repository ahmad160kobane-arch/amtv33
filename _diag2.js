const {Client} = require('ssh2');

const c = new Client();
c.on('ready', () => {
  const cmd = `cd /root/ma-streaming/cloud-server && node -e "
(async () => {
  const db = require('./db');
  
  // 1. فحص السجلات
  const rows = await db.prepare('SELECT id, title, vod_type, poster, plot, genres, cast_list, director, rating, year, file_code, canplay, tmdb_id FROM lulu_catalog ORDER BY uploaded_at DESC LIMIT 10').all();
  console.log('=== آخر 10 سجلات في lulu_catalog ===');
  (rows||[]).forEach(r => {
    console.log('---');
    console.log('title:', r.title);
    console.log('file_code:', r.file_code);
    console.log('canplay:', r.canplay);
    console.log('tmdb_id:', r.tmdb_id);
    console.log('poster:', r.poster ? r.poster.slice(0,60) : 'EMPTY ❌');
    console.log('plot:', r.plot ? r.plot.slice(0,60) : 'EMPTY ❌');
    console.log('genres:', r.genres || 'EMPTY ❌');
    console.log('year:', r.year || 'EMPTY ❌');
  });

  // 2. إحصائيات
  const stats = await db.prepare('SELECT COUNT(*) as total, SUM(CASE WHEN poster IS NOT NULL AND poster != \\\"\\\" THEN 1 ELSE 0 END) as with_poster, SUM(CASE WHEN plot IS NOT NULL AND plot != \\\"\\\" THEN 1 ELSE 0 END) as with_plot, SUM(CASE WHEN tmdb_id IS NOT NULL THEN 1 ELSE 0 END) as with_tmdb FROM lulu_catalog').get();
  console.log('=== إحصائيات ===');
  console.log('الإجمالي:', stats.total);
  console.log('مع poster:', stats.with_poster);
  console.log('مع plot:', stats.with_plot);
  console.log('مع tmdb_id:', stats.with_tmdb);

  // 3. اختبار TMDB مباشرة
  const https = require('https');
  function httpGet(url) {
    return new Promise((resolve,reject) => {
      const req = https.get(url, {timeout:15000}, res => {
        let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve({status:res.statusCode,body:d}));
      });
      req.on('error',reject); req.on('timeout',()=>{req.destroy();reject(new Error('timeout'));});
    });
  }
  console.log('=== اختبار TMDB ===');
  const tmdbRes = await httpGet('https://api.themoviedb.org/3/search/movie?api_key=e25ac5a68fba3713e572198a050697ca&query=Gladiator&language=ar');
  const tmdbData = JSON.parse(tmdbRes.body);
  const movie = tmdbData?.results?.[0];
  console.log('TMDB test (Gladiator):', movie ? 'OK - ' + movie.title : 'FAILED ❌');
  console.log('TMDB status:', tmdbRes.status);

  await db.close();
})().catch(e=>console.error('ERROR:', e.message));
"`;

  c.exec(cmd, (err, stream) => {
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => c.end());
  });
}).connect({host:'62.171.153.204',port:22,username:'root',password:'Mustafa7'});
