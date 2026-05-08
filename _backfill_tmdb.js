const { NodeSSH } = require('node-ssh');

const VPS_HOST = '62.171.153.204';
const VPS_USER = 'root';
const VPS_PASS = 'Mustafa7';

async function backfill() {
  const ssh = new NodeSSH();
  await ssh.connect({ host: VPS_HOST, username: VPS_USER, password: VPS_PASS, readyTimeout: 15000 });
  
  // تشغيل سكربت تحديث البيانات على VPS
  console.log('=== تحديث بيانات الكاتالوج الموجودة باستخدام TMDB ===\n');
  
  const result = await ssh.execCommand(`cd /root/ma-streaming && node -e "
    const db = require('./cloud-server/db');
    const http = require('http');
    const https = require('https');

    function httpGet(url, timeoutMs = 15000) {
      return new Promise((resolve, reject) => {
        const mod = url.startsWith('https') ? https : http;
        const req = mod.get(url, { timeout: timeoutMs }, res => {
          let data = '';
          res.on('data', c => data += c);
          res.on('end', () => resolve({ status: res.statusCode, body: data }));
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
      });
    }

    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    const TMDB_KEY = 'e25ac5a68fba3713e572198a050697ca';
    const TMDB_IMG = 'https://image.tmdb.org/t/p/w500';
    const TMDB_IMG_ORG = 'https://image.tmdb.org/t/p/original';

    function cleanTitle(name) {
      return name.replace(/^(EN|AR|NF|TR|HN|KR|IT|FR|DE|ES|PL|PER|KRD|NL|CH|JP|RU)\\s*[|\\-]/i, '')
        .replace(/^(NETFLIX|DISNEY|HBO|APPLE|AMAZON|PRIME|SHAHID)\\s*[|\\-]/i, '')
        .replace(/VOD\\s*\\d*/i, '').replace(/\\s*[-–]\\s*\\d{4}$/, '').replace(/\\s{2,}/g, ' ').trim();
    }

    async function tmdbSearch(title, type) {
      const searchType = type === 'series' ? 'tv' : 'movie';
      const cleanName = cleanTitle(title);
      const p = new URLSearchParams({ api_key: TMDB_KEY, query: cleanName, language: 'ar' });
      const endpoint = searchType === 'tv' ? '/search/tv' : '/search/movie';
      const url = 'https://api.themoviedb.org/3' + endpoint + '?' + p;
      const res = await httpGet(url, 15000);
      const data = JSON.parse(res.body);
      return data?.results?.[0] || null;
    }

    async function tmdbDetails(tmdbId, type) {
      const searchType = type === 'series' ? 'tv' : 'movie';
      const detailUrl = 'https://api.themoviedb.org/3/' + searchType + '/' + tmdbId + '?api_key=' + TMDB_KEY + '&language=ar';
      const creditsUrl = 'https://api.themoviedb.org/3/' + searchType + '/' + tmdbId + '/credits?api_key=' + TMDB_KEY;
      const [detailRes, creditsRes] = await Promise.all([httpGet(detailUrl), httpGet(creditsUrl)]);
      return { detail: JSON.parse(detailRes.body), credits: JSON.parse(creditsRes.body) };
    }

    async function run() {
      await db.init();
      
      // جلب العناصر اللي ما عندها poster
      const rows = await db.prepare(
        \\"SELECT id, title, vod_type FROM lulu_catalog WHERE (poster IS NULL OR poster = '') LIMIT 50\\"
      ).all();
      
      console.log('عناصر بدون صورة:', rows.length);
      
      let updated = 0;
      let failed = 0;
      
      for (const row of rows) {
        try {
          const type = row.vod_type;
          const searchResult = await tmdbSearch(row.title, type);
          if (!searchResult || !searchResult.id) {
            console.log('  ✗ TMDB not found:', row.title);
            failed++;
            await sleep(300);
            continue;
          }
          
          const { detail, credits } = await tmdbDetails(searchResult.id, type);
          
          const poster = detail.poster_path ? TMDB_IMG + detail.poster_path : '';
          const backdrop = detail.backdrop_path ? TMDB_IMG_ORG + detail.backdrop_path : '';
          const plot = detail.overview || '';
          const year = (detail.release_date || detail.first_air_date || '').substring(0, 4);
          const rating = detail.vote_average ? String(Math.round(detail.vote_average * 10) / 10) : '';
          const genres = (detail.genres || []).map(g => g.name).join(' ، ');
          const castList = (credits?.cast || []).slice(0, 8).map(c => c.name).join(' ، ');
          const directorObj = (credits?.crew || []).find(c => c.job === 'Director');
          const director = directorObj?.name || '';
          const runtime = detail.runtime ? detail.runtime + ' دقيقة' : '';
          const imdbId = detail.imdb_id || '';
          const countries = detail.production_countries || [];
          const country = countries.map(c => c.name).join(' ، ');
          const tmdbId = detail.id;
          
          await db.prepare(
            \\"UPDATE lulu_catalog SET poster = COALESCE(NULLIF(poster,''),?), backdrop = COALESCE(NULLIF(backdrop,''),?), plot = COALESCE(NULLIF(plot,''),?), year = COALESCE(NULLIF(year,''),?), rating = COALESCE(NULLIF(rating,''),?), genres = COALESCE(NULLIF(genres,''),?), cast_list = COALESCE(NULLIF(cast_list,''),?), director = COALESCE(NULLIF(director,''),?), country = COALESCE(NULLIF(country,''),?), runtime = COALESCE(NULLIF(runtime,''),?), imdb_id = COALESCE(NULLIF(imdb_id,''),?), tmdb_id = COALESCE(tmdb_id,?), updated_at = ? WHERE id = ?\\"
          ).run(poster, backdrop, plot, year, rating, genres, castList, director, country, runtime, imdbId, tmdbId, Date.now(), row.id);
          
          updated++;
          console.log('  ✓', row.title, '→ poster:', !!poster, 'plot:', !!plot, 'cast:', castList ? castList.split(' ، ').length : 0);
          
          await sleep(350); // تجنب rate limiting من TMDB
        } catch (e) {
          console.log('  ✗ Error:', row.title, e.message);
          failed++;
          await sleep(500);
        }
      }
      
      console.log('\\n=== النتيجة ===');
      console.log('تم تحديث:', updated);
      console.log('فشل:', failed);
      
      // إحصائيات بعد التحديث
      const noPoster = await db.prepare('SELECT COUNT(*) as c FROM lulu_catalog WHERE poster IS NULL OR poster = \\'\\' ').get();
      const withPlot = await db.prepare('SELECT COUNT(*) as c FROM lulu_catalog WHERE plot IS NOT NULL AND plot != \\'\\' ').get();
      const total = await db.prepare('SELECT COUNT(*) as c FROM lulu_catalog').get();
      console.log('المتبقي بدون صورة:', noPoster.c);
      console.log('لديه قصة:', withPlot.c);
      console.log('الإجمالي:', total.c);
      
      process.exit(0);
    }
    
    run().catch(e => { console.error(e.message); process.exit(1); });
  " 2>&1`, { execTimeout: 120000 });
  
  console.log(result.stdout.slice(-3000));
  if (result.stderr && !result.stderr.includes('Migration')) console.log('ERR:', result.stderr.slice(-500));
  
  ssh.dispose();
}

backfill().catch(e => console.error('Error:', e.message));
