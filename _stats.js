const { NodeSSH } = require('node-ssh');
const VPS_HOST = '62.171.153.204';
const VPS_USER = 'root';
const VPS_PASS = 'Mustafa7';

async function stats() {
  const ssh = new NodeSSH();
  await ssh.connect({ host: VPS_HOST, username: VPS_USER, password: VPS_PASS, readyTimeout: 15000 });
  
  const result = await ssh.execCommand(`cd /root/ma-streaming && node -e "
    const db = require('./cloud-server/db');
    db.init().then(async () => {
      const total = await db.prepare('SELECT COUNT(*) as c FROM lulu_catalog').get();
      const poster = await db.prepare('SELECT COUNT(*) as c FROM lulu_catalog WHERE poster IS NOT NULL AND poster != \\'\\' ').get();
      const backdrop = await db.prepare('SELECT COUNT(*) as c FROM lulu_catalog WHERE backdrop IS NOT NULL AND backdrop != \\'\\' ').get();
      const plot = await db.prepare('SELECT COUNT(*) as c FROM lulu_catalog WHERE plot IS NOT NULL AND plot != \\'\\' ').get();
      const cast = await db.prepare('SELECT COUNT(*) as c FROM lulu_catalog WHERE cast_list IS NOT NULL AND cast_list != \\'\\' ').get();
      const director = await db.prepare('SELECT COUNT(*) as c FROM lulu_catalog WHERE director IS NOT NULL AND director != \\'\\' ').get();
      const rating = await db.prepare('SELECT COUNT(*) as c FROM lulu_catalog WHERE rating IS NOT NULL AND rating != \\'\\' ').get();
      const genres = await db.prepare('SELECT COUNT(*) as c FROM lulu_catalog WHERE genres IS NOT NULL AND genres != \\'\\' ').get();
      const imdb = await db.prepare('SELECT COUNT(*) as c FROM lulu_catalog WHERE imdb_id IS NOT NULL AND imdb_id != \\'\\' ').get();
      const tmdb = await db.prepare('SELECT COUNT(*) as c FROM lulu_catalog WHERE tmdb_id IS NOT NULL').get();
      const year = await db.prepare('SELECT COUNT(*) as c FROM lulu_catalog WHERE year IS NOT NULL AND year != \\'\\' ').get();
      const canplay = await db.prepare('SELECT COUNT(*) as c FROM lulu_catalog WHERE canplay = true').get();
      const hls = await db.prepare('SELECT COUNT(*) as c FROM lulu_catalog WHERE hls_url IS NOT NULL AND hls_url != \\'\\' ').get();
      
      console.log('╔══════════════════════════════════╗');
      console.log('║   إحصائيات lulu_catalog         ║');
      console.log('╠══════════════════════════════════╣');
      console.log('║ الإجمالي:        ' + String(total.c).padEnd(12) + ' ║');
      console.log('║ canplay=true:    ' + String(canplay.c).padEnd(12) + ' ║');
      console.log('║ مع صورة:         ' + String(poster.c).padEnd(12) + ' ║');
      console.log('║ مع خلفية:        ' + String(backdrop.c).padEnd(12) + ' ║');
      console.log('║ مع قصة:          ' + String(plot.c).padEnd(12) + ' ║');
      console.log('║ مع ممثلين:       ' + String(cast.c).padEnd(12) + ' ║');
      console.log('║ مع مخرج:         ' + String(director.c).padEnd(12) + ' ║');
      console.log('║ مع تقييم:        ' + String(rating.c).padEnd(12) + ' ║');
      console.log('║ مع أنواع:        ' + String(genres.c).padEnd(12) + ' ║');
      console.log('║ مع سنة:          ' + String(year.c).padEnd(12) + ' ║');
      console.log('║ مع IMDb ID:      ' + String(imdb.c).padEnd(12) + ' ║');
      console.log('║ مع TMDB ID:      ' + String(tmdb.c).padEnd(12) + ' ║');
      console.log('║ مع HLS URL:      ' + String(hls.c).padEnd(12) + ' ║');
      console.log('╚══════════════════════════════════╝');
      
      process.exit(0);
    }).catch(e => { console.error(e.message); process.exit(1); });
  " 2>&1`, { execTimeout: 30000 });
  
  console.log(result.stdout);
  ssh.dispose();
}

stats().catch(e => console.error('Error:', e.message));
