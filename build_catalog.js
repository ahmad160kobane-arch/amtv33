const https = require('https');
const fs = require('fs');
const path = require('path');

// PostgreSQL is optional - only save to DB if available
let pool = null;
try {
  const { Pool } = require('pg');
  const config = require('/root/ma-streaming/cloud-server/config');
  pool = new Pool({ connectionString: config.DATABASE_URL, ssl: { rejectUnauthorized: false } });
} catch (e) {
  console.log('[DB] PostgreSQL not available, will only save to file');
}

const KEY = '268476xsqgnehs76lhfq0q';
const ROOT = 74466;
const OUT = '/root/ma-streaming/cloud-server/data/lulu_catalog.json';

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch(e) { reject(new Error('Parse error: ' + d.substring(0,100))); }
      });
    }).on('error', reject);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('Getting folders...');
  let folders = [];
  let page = 1;
  while (true) {
    const r = await get(`https://api.lulustream.com/api/folder/list?key=${KEY}&fld_id=${ROOT}&page=${page}&per_page=100`);
    if (r.status === 403) { console.error('Rate limited:', r.msg); process.exit(1); }
    const list = r.result?.folders || [];
    folders.push(...list);
    console.log(`Page ${page}: got ${list.length} folders (total ${folders.length})`);
    if (list.length < 100) break;
    page++;
    await sleep(1500);
  }
  console.log(`Total folders: ${folders.length}`);

  const items = [];
  for (let i = 0; i < folders.length; i++) {
    const folder = folders[i];
    try {
      const r = await get(`https://api.lulustream.com/api/file/list?key=${KEY}&fld_id=${folder.fld_id}&per_page=20`);
      if (r.status === 403) {
        console.log(`Rate limited at ${i}/${folders.length}, waiting 70s...`);
        await sleep(70000);
        i--; // retry same folder
        continue;
      }
      const files = r.files || [];
      const mainFile = files.find(f => f.canplay === 1) || files[0];
      if (mainFile) {
        items.push({
          id: String(folder.fld_id),
          fld_id: folder.fld_id,
          title: folder.name,
          poster: mainFile.thumbnail || '',
          fileCode: mainFile.file_code,
          embedUrl: `https://luluvdo.com/e/${mainFile.file_code}`,
          hlsUrl: `https://luluvdo.com/hls/${mainFile.file_code}/master.m3u8`,
          vod_type: files.length > 2 ? 'series' : 'movie',
          episodeCount: files.length,
          ts: new Date(mainFile.uploaded || 0).getTime(),
          canplay: mainFile.canplay === 1,
        });
      }
    } catch(e) {
      console.error(`Error at ${folder.name}:`, e.message);
    }

    if ((i + 1) % 20 === 0) {
      console.log(`Progress: ${i+1}/${folders.length}, items: ${items.length}`);
      // Save incremental progress
      fs.mkdirSync(path.dirname(OUT), { recursive: true });
      fs.writeFileSync(OUT, JSON.stringify({ catalog: items, ts: Date.now() }));
    }

    await sleep(1200); // ~50 req/min, stay safely under 60 limit
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ catalog: items, ts: Date.now() }));
  console.log(`Done! Saved ${items.length} items to file`);

  // Save to PostgreSQL DB too (if available)
  if (pool) {
    try {
      await pool.query(
        'INSERT INTO lulu_catalog_cache (id, catalog, updated_at) VALUES (1, $1, $2) ON CONFLICT (id) DO UPDATE SET catalog = EXCLUDED.catalog, updated_at = EXCLUDED.updated_at',
        [JSON.stringify(items), Date.now()]
      );
      console.log(`Done! Saved ${items.length} items to DB`);
    } catch(e) {
      console.error('DB save error:', e.message);
    }
    await pool.end();
  }
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
