/**
 * clean-progress.js — تنظيف progress.json من الملفات المحذوفة والفارغة
 * يحذف entries بملفات ميتة (404) أو صغيرة جداً (<50KB)
 * حتى يتم إعادة رفعها بالطريقة الجديدة (download→upload)
 */
'use strict';
const fs    = require('fs');
const https = require('https');

const LULU_KEY  = '258176jfw9e96irnxai2fm';
const PROGRESS  = '/root/lulu_progress.json';
const BACKUP    = '/root/lulu_progress_backup.json';

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 15000 }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    }).on('error', reject).on('timeout', function() { this.destroy(); reject(new Error('timeout')); });
  });
}

async function main() {
  const raw  = fs.readFileSync(PROGRESS, 'utf8');
  const prog = JSON.parse(raw);

  // نسخة احتياطية
  fs.writeFileSync(BACKUP, raw);
  console.log('✓ نسخة احتياطية:', BACKUP);

  const entries = Object.entries(prog.uploaded || {});
  console.log('Total entries:', entries.length);

  const toRemove = [];
  
  // فحص بدفعات من 10
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
          const isDead = r.status === 404 || r.status === 403;
          const isTiny = r.file_length && r.file_length < 100000; // < 100KB
          if (isDead || isTiny) {
            const entry = batch.find(([, v]) => v.fileCode === r.file_code);
            if (entry) toRemove.push(entry[0]);
          }
        }
      }
    } catch (e) {
      console.log('  Error batch', i, e.message);
    }
  }

  console.log(`\nTo remove: ${toRemove.length} entries`);

  for (const key of toRemove) {
    delete prog.uploaded[key];
    // أيضاً أزل من failed حتى يُعاد المحاولة
    delete prog.failed[key];
  }

  fs.writeFileSync(PROGRESS, JSON.stringify(prog, null, 2));
  const remaining = Object.keys(prog.uploaded).length;
  console.log(`✓ تم التنظيف. متبقي: ${remaining} entries`);
  console.log(`✓ محذوف: ${toRemove.length} entries`);
}

main().catch(e => console.error('FATAL:', e.message));
