/**
 * تحديث السجلات الموجودة في lulu_catalog التي لا تحتوي على بيانات TMDB
 * يبحث عن كل سجل بدون poster/tmdb_id ويجلب البيانات من TMDB + IPTV
 */
const {Client} = require('ssh2');

const c = new Client();
c.on('ready', () => {
  const cmd = `cd /root/ma-streaming/cloud-server && node -e "
(async () => {
  const db = require('./db');
  const https = require('https');
  const http = require('http');

  const TMDB_KEY = 'e25ac5a68fba3713e572198a050697ca';
  const TMDB_IMG = 'https://image.tmdb.org/t/p/w500';
  const TMDB_IMG_ORG = 'https://image.tmdb.org/t/p/original';
  const LULU_KEY = '258176jfw9e96irnxai2fm';

  function httpGet(url, t=20000) {
    return new Promise((resolve,reject) => {
      const mod = url.startsWith('https') ? https : http;
      const req = mod.get(url, {timeout:t}, res => {
        if ([301,302,307,308].includes(res.statusCode) && res.headers.location)
          return httpGet(res.headers.location,t).then(resolve).catch(reject);
        let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve({status:res.statusCode,body:d}));
      });
      req.on('error',reject); req.on('timeout',()=>{req.destroy();reject(new Error('timeout'));});
    });
  }

  function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
  function parseJson(b){try{return JSON.parse(b);}catch{return null;}}

  function cleanTitle(name=''){
    return name
      .replace(/^(EN|AR|NF|TR|HN|KR|IT|FR|DE|ES|PL|PER|KRD|NL|CH|JP|RU)\\s*[|\\-]/i,'')
      .replace(/^(NETFLIX|DISNEY|HBO|APPLE|AMAZON|PRIME|SHAHID)\\s*[|\\-]/i,'')
      .replace(/VOD\\s*\\d*/i,'').replace(/\\s*[-–]\\s*\\d{4}$/,'')
      .replace(/\\s{2,}/g,' ').trim();
  }

  async function tmdbSearch(title, type) {
    const searchType = type === 'series' ? 'tv' : 'movie';
    const cleanName = cleanTitle(title);
    if (!cleanName || /^\\d+$/.test(cleanName)) return null;
    const ep = searchType === 'tv' ? '/search/tv' : '/search/movie';
    for (const lang of ['ar','en-US']) {
      const p = new URLSearchParams({api_key:TMDB_KEY, query:cleanName, language:lang});
      const r = await httpGet('https://api.themoviedb.org/3'+ep+'?'+p, 12000).catch(()=>null);
      if (!r) continue;
      const data = parseJson(r.body);
      const results = data?.results || [];
      if (!results.length) continue;
      const top = results[0];
      const detailEp = searchType === 'tv' ? '/tv/'+top.id : '/movie/'+top.id;
      const [arD, enD, creds] = await Promise.all([
        httpGet('https://api.themoviedb.org/3'+detailEp+'?'+new URLSearchParams({api_key:TMDB_KEY,language:'ar'}),12000).then(r=>parseJson(r.body)).catch(()=>null),
        httpGet('https://api.themoviedb.org/3'+detailEp+'?'+new URLSearchParams({api_key:TMDB_KEY,language:'en-US'}),12000).then(r=>parseJson(r.body)).catch(()=>null),
        httpGet('https://api.themoviedb.org/3'+detailEp+'/credits?api_key='+TMDB_KEY,12000).then(r=>parseJson(r.body)).catch(()=>null),
      ]);
      const detail = arD || enD || top;
      const fallback = enD || top;
      const crew = creds?.crew || [];
      const director = (crew.find(c=>c.job==='Director') || crew.find(c=>c.department==='Directing'))?.name || '';
      const countries = detail.production_countries || detail.origin_country || [];
      return {
        tmdbId: top.id,
        title_ar: arD?.title||arD?.name||'',
        title_en: enD?.title||enD?.name||'',
        poster: detail.poster_path ? TMDB_IMG+detail.poster_path : '',
        backdrop: detail.backdrop_path ? TMDB_IMG_ORG+detail.backdrop_path : '',
        plot: arD?.overview || enD?.overview || '',
        year: (detail.release_date||detail.first_air_date||'').substring(0,4),
        rating: detail.vote_average ? String(Math.round(detail.vote_average*10)/10) : '',
        genres: (detail.genres||[]).map(g=>g.name).join('، '),
        castList: (creds?.cast||[]).slice(0,8).map(c=>c.name).join('، '),
        director,
        country: Array.isArray(countries) ? countries.map(c=>typeof c==='string'?c:c.name).join('، ') : '',
        runtime: detail.runtime ? detail.runtime+' دقيقة' : (detail.episode_run_time?.[0]?detail.episode_run_time[0]+' دقيقة':''),
        imdbId: detail.imdb_id||'',
      };
    }
    return null;
  }

  // جلب السجلات بدون بيانات TMDB
  const rows = await db.prepare('SELECT id, title, vod_type, file_code FROM lulu_catalog WHERE (tmdb_id IS NULL OR poster IS NULL OR poster = \\\"\\\" ) ORDER BY uploaded_at DESC').all();
  console.log('سجلات تحتاج تحديث:', rows.length);

  let updated = 0, failed = 0;
  for (const row of rows) {
    const title = row.title || '';
    const isNumeric = /^\\d+$/.test(title.trim());
    if (isNumeric) {
      console.log('تخطي (رقم بدون اسم):', title);
      failed++;
      continue;
    }
    console.log('جاري تحديث:', title);
    const tmdb = await tmdbSearch(title, row.vod_type).catch(()=>null);
    if (!tmdb) {
      console.log('  ⚠ لم يُعثر في TMDB:', title);
      failed++;
      await sleep(500);
      continue;
    }
    const now = Date.now();
    const bestTitle = tmdb.title_ar || tmdb.title_en || title;
    try {
      await db.prepare(
        'UPDATE lulu_catalog SET title = COALESCE(NULLIF(?,\\\"\\\"),title), tmdb_id = COALESCE(tmdb_id,?), poster = COALESCE(NULLIF(poster,\\\"\\\"),?), backdrop = COALESCE(NULLIF(backdrop,\\\"\\\"),?), plot = COALESCE(NULLIF(plot,\\\"\\\"),?), year = COALESCE(NULLIF(year,\\\"\\\"),?), rating = COALESCE(NULLIF(rating,\\\"\\\"),?), genres = COALESCE(NULLIF(genres,\\\"\\\"),?), cast_list = COALESCE(NULLIF(cast_list,\\\"\\\"),?), director = COALESCE(NULLIF(director,\\\"\\\"),?), country = COALESCE(NULLIF(country,\\\"\\\"),?), runtime = COALESCE(NULLIF(runtime,\\\"\\\"),?), imdb_id = COALESCE(NULLIF(imdb_id,\\\"\\\"),?), updated_at = ? WHERE id = ?'
      ).run(bestTitle, tmdb.tmdbId, tmdb.poster, tmdb.backdrop, tmdb.plot, tmdb.year, tmdb.rating, tmdb.genres, tmdb.castList, tmdb.director, tmdb.country, tmdb.runtime, tmdb.imdbId, now, row.id);
      
      // تحديث LuluStream file title+descr
      if (row.file_code) {
        const descr = [
          tmdb.plot ? tmdb.plot.slice(0,500) : '',
          tmdb.castList ? 'الممثلون: '+tmdb.castList : '',
          tmdb.director ? 'الإخراج: '+tmdb.director : '',
          tmdb.runtime || '',
        ].filter(Boolean).join('\\n');
        const tags = [tmdb.genres, tmdb.year, tmdb.rating?'تقييم '+tmdb.rating:''].filter(Boolean).join(',').slice(0,300);
        const p = new URLSearchParams({key:LULU_KEY, file_code:row.file_code, file_public:'1', file_title:bestTitle.slice(0,200), file_descr:descr.slice(0,1000), tags});
        await httpGet('https://api.lulustream.com/api/file/edit?'+p, 15000).catch(()=>null);
      }

      console.log('  ✅ تم تحديث:', bestTitle, '| poster:', !!tmdb.poster, '| plot:', !!tmdb.plot);
      updated++;
    } catch(e) {
      console.log('  ❌ خطأ:', e.message);
      failed++;
    }
    await sleep(700); // تجنب rate limit في TMDB
  }

  console.log('\\n=== النتيجة ===');
  console.log('تم تحديث:', updated);
  console.log('فشل:', failed);
  await db.close();
})().catch(e=>{console.error('ERROR:',e.message); process.exit(1);});
"`;

  c.exec(cmd, (err, stream) => {
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => c.end());
  });
}).connect({host:'62.171.153.204',port:22,username:'root',password:'Mustafa7'});
