const { NodeSSH } = require('node-ssh');

const VPS_HOST = '62.171.153.204';
const VPS_USER = 'root';
const VPS_PASS = 'Mustafa7';

async function check() {
  const ssh = new NodeSSH();
  await ssh.connect({ host: VPS_HOST, username: VPS_USER, password: VPS_PASS, readyTimeout: 15000 });
  
  console.log('=== 1. إحصائيات lulu_catalog ===');
  const stats = await ssh.execCommand(`cd /root/ma-streaming && node -e "
    const db = require('./cloud-server/db');
    db.init().then(async () => {
      const total = await db.prepare('SELECT COUNT(*) as c FROM lulu_catalog').get();
      const canplayTrue = await db.prepare('SELECT COUNT(*) as c FROM lulu_catalog WHERE canplay = true').get();
      const canplayFalse = await db.prepare('SELECT COUNT(*) as c FROM lulu_catalog WHERE canplay = false').get();
      const withHls = await db.prepare('SELECT COUNT(*) as c FROM lulu_catalog WHERE hls_url IS NOT NULL AND hls_url != \\'\\' ').get();
      const withEmbed = await db.prepare('SELECT COUNT(*) as c FROM lulu_catalog WHERE embed_url IS NOT NULL AND embed_url != \\'\\' ').get();
      const noPoster = await db.prepare('SELECT COUNT(*) as c FROM lulu_catalog WHERE poster IS NULL OR poster = \\'\\' ').get();
      console.log('Total:', total.c);
      console.log('canplay=true:', canplayTrue.c);
      console.log('canplay=false:', canplayFalse.c);
      console.log('with hls_url:', withHls.c);
      console.log('with embed_url:', withEmbed.c);
      console.log('no poster:', noPoster.c);
      process.exit(0);
    }).catch(e => { console.error(e.message); process.exit(1); });
  " 2>&1`);
  console.log(stats.stdout);
  if (stats.stderr) console.log('ERR:', stats.stderr.slice(-500));
  
  console.log('\n=== 2. عينة من canplay=false ===');
  const sample = await ssh.execCommand(`cd /root/ma-streaming && node -e "
    const db = require('./cloud-server/db');
    db.init().then(async () => {
      const rows = await db.prepare('SELECT id, title, file_code, canplay, hls_url, embed_url, poster, uploaded_at FROM lulu_catalog WHERE canplay = false LIMIT 10').all();
      rows.forEach(r => {
        console.log(JSON.stringify({
          id: r.id,
          title: r.title,
          file_code: r.file_code,
          canplay: r.canplay,
          has_hls: !!(r.hls_url && r.hls_url.length > 0),
          has_embed: !!(r.embed_url && r.embed_url.length > 0),
          has_poster: !!(r.poster && r.poster.length > 0),
          uploaded_at: r.uploaded_at
        }));
      });
      process.exit(0);
    }).catch(e => { console.error(e.message); process.exit(1); });
  " 2>&1`);
  console.log(sample.stdout);
  
  console.log('\n=== 3. إحصائيات lulu_episodes ===');
  const epStats = await ssh.execCommand(`cd /root/ma-streaming && node -e "
    const db = require('./cloud-server/db');
    db.init().then(async () => {
      const total = await db.prepare('SELECT COUNT(*) as c FROM lulu_episodes').get();
      const canplayTrue = await db.prepare('SELECT COUNT(*) as c FROM lulu_episodes WHERE canplay = true').get();
      const canplayFalse = await db.prepare('SELECT COUNT(*) as c FROM lulu_episodes WHERE canplay = false').get();
      console.log('Total episodes:', total.c);
      console.log('canplay=true:', canplayTrue.c);
      console.log('canplay=false:', canplayFalse.c);
      process.exit(0);
    }).catch(e => { console.error(e.message); process.exit(1); });
  " 2>&1`);
  console.log(epStats.stdout);
  
  ssh.dispose();
}

check().catch(e => console.error('Error:', e.message));
