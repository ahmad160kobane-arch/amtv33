/**
 * جلب روابط HLS من LuluStream لكل ملف مرفوع
 * يحفظ النتيجة في /root/lulu_links.json
 */
'use strict';
const https = require('https');
const http  = require('http');
const fs    = require('fs');

const KEY      = '258176jfw9e96irnxai2fm';
const PROGRESS = '/root/lulu_progress.json';
const OUTPUT   = '/root/lulu_links.json';

function get(url, ms = 15000) {
  return new Promise((res, rej) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { timeout: ms }, r => {
      if (r.statusCode === 301 || r.statusCode === 302)
        return get(r.headers.location, ms).then(res).catch(rej);
      let d = ''; r.on('data', c => d += c); r.on('end', () => res({ s: r.statusCode, b: d }));
    }).on('error', rej).on('timeout', () => rej(new Error('timeout')));
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getHlsForFile(fileCode) {
  // طريقة 1: File Info API
  const infoRes  = await get(`https://api.lulustream.com/api/file/info?key=${KEY}&file_code=${fileCode}`);
  const info     = JSON.parse(infoRes.b);

  // طريقة 2: استخراج m3u8 من صفحة الـ embed
  const embedRes = await get(`https://lulustream.com/e/${fileCode}`);
  const m3u8s    = embedRes.b.match(/https?:\/\/[^"' ]+\.m3u8/g) || [];
  const hlsUrl   = m3u8s[0] || null;

  // طريقة 3: رابط مباشر شائع
  const direct = `https://luluvdo.com/hls/${fileCode}/master.m3u8`;

  return { info: info?.result?.[0] || {}, hlsUrl, direct, embedUrl: `https://lulustream.com/e/${fileCode}` };
}

async function main() {
  const prog  = JSON.parse(fs.readFileSync(PROGRESS, 'utf8'));
  const files = Object.values(prog.uploaded);
  const links = {};

  console.log(`جلب روابط HLS لـ ${files.length} ملف...`);

  // اختبر أول 5 ملفات أولاً
  const sample = files.slice(0, 5);

  for (const f of sample) {
    try {
      const result = await getHlsForFile(f.fileCode);
      links[f.fileCode] = { title: f.title, ...result };
      console.log(`✅ ${f.title}`);
      console.log(`   HLS    : ${result.hlsUrl || 'غير موجود'}`);
      console.log(`   Direct : ${result.direct}`);
      console.log(`   Embed  : ${result.embedUrl}`);
      console.log(`   canplay: ${result.info.canplay}`);
    } catch (e) {
      console.log(`✗ ${f.title} — ${e.message}`);
    }
    await sleep(1000);
  }

  fs.writeFileSync(OUTPUT, JSON.stringify(links, null, 2));
  console.log(`\nمحفوظ: ${OUTPUT}`);
}

main().catch(e => console.error('FATAL:', e.message));
