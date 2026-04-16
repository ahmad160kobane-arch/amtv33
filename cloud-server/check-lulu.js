// check-lulu.js — فحص حالة الملفات على LuluStream
const fs = require('fs');
const https = require('https');

const LULU_KEY = '258176jfw9e96irnxai2fm';
const PROGRESS = '/root/lulu_progress.json';

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 15000 }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    }).on('error', reject).on('timeout', function() { this.destroy(); reject(new Error('timeout')); });
  });
}

async function main() {
  const prog = JSON.parse(fs.readFileSync(PROGRESS, 'utf8'));
  const entries = Object.entries(prog.uploaded || {});
  console.log('Total entries:', entries.length);

  let alive = 0, dead = 0, tiny = 0, errors = 0;
  const deadList = [];
  const tinyList = [];

  // Check in batches of 10
  for (let i = 0; i < entries.length; i += 10) {
    const batch = entries.slice(i, i + 10);
    const codes = batch.map(([, v]) => v.fileCode).filter(Boolean);
    if (!codes.length) continue;

    try {
      const url = `https://api.lulustream.com/api/file/info?key=${LULU_KEY}&file_code=${codes.join(',')}`;
      const raw = await httpGet(url);
      const data = JSON.parse(raw);
      if (data.result) {
        for (const r of data.result) {
          if (r.status === 404 || r.status === 403) {
            dead++;
            const entry = batch.find(([, v]) => v.fileCode === r.file_code);
            if (entry) deadList.push({ key: entry[0], title: entry[1].title, code: r.file_code });
          } else if (r.file_length && r.file_length < 50000) {
            tiny++;
            tinyList.push({ code: r.file_code, size: r.file_length });
            alive++;
          } else {
            alive++;
          }
        }
      }
    } catch (e) {
      errors++;
      console.log('  Error batch', i, e.message);
    }
  }

  console.log('\n=== Results ===');
  console.log('Alive:', alive);
  console.log('Dead (404/deleted):', dead);
  console.log('Tiny (<50KB, likely broken):', tiny);
  console.log('Errors:', errors);

  if (deadList.length) {
    console.log('\n--- Dead files ---');
    deadList.forEach(d => console.log(`  ${d.key} | ${d.title} | ${d.code}`));
  }
  if (tinyList.length) {
    console.log('\n--- Tiny files (broken) ---');
    tinyList.forEach(t => console.log(`  ${t.code} | ${t.size} bytes`));
  }
}

main().catch(e => console.error('FATAL:', e.message));
