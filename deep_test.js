const http = require('http');
const https = require('https');

const BASE = 'http://ex2025.cc';
const USER = 'ledyxpro24';
const PASS = '2943689';

async function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, { timeout: 10000 }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve(d); } });
    }).on('error', reject).on('timeout', function() { this.destroy(); reject(new Error('timeout')); });
  });
}

async function fetchHead(url) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: 'GET', timeout: 8000 }, res => {
      let bytes = 0;
      const timer = setTimeout(() => { res.destroy(); resolve({ status: res.statusCode, headers: res.headers, bytes }); }, 4000);
      res.on('data', c => bytes += c.length);
      res.on('end', () => { clearTimeout(timer); resolve({ status: res.statusCode, headers: res.headers, bytes }); });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

(async () => {
  // 1. Full account info
  console.log('=== ACCOUNT INFO ===');
  try {
    const info = await fetchJson(`${BASE}/player_api.php?username=${USER}&password=${PASS}`);
    if (info.user_info) {
      const u = info.user_info;
      console.log('status:', u.status);
      console.log('is_trial:', u.is_trial);
      console.log('max_connections:', u.max_connections);
      console.log('active_cons:', u.active_cons);
      console.log('exp_date:', u.exp_date, '→', new Date(u.exp_date * 1000).toISOString());
      console.log('allowed_output_formats:', u.allowed_output_formats);
      console.log('created_at:', u.created_at);
    }
    if (info.server_info) {
      const s = info.server_info;
      console.log('server_url:', s.url);
      console.log('server_port:', s.port);
      console.log('https_port:', s.https_port);
      console.log('rtmp_port:', s.rtmp_port);
      console.log('server_protocol:', s.server_protocol);
    }
  } catch(e) { console.log('ERROR:', e.message); }

  // 2. Get first few live streams to find active ones
  console.log('\n=== FIRST 5 LIVE STREAMS ===');
  try {
    const streams = await fetchJson(`${BASE}/player_api.php?username=${USER}&password=${PASS}&action=get_live_streams`);
    const first5 = (Array.isArray(streams) ? streams : []).slice(0, 5);
    for (const s of first5) {
      console.log(`  id:${s.stream_id} name:${s.name} type:${s.stream_type} icon:${s.stream_icon ? 'yes' : 'no'}`);
    }
  } catch(e) { console.log('ERROR:', e.message); }

  // 3. Test different URL formats with a popular channel
  console.log('\n=== STREAM FORMAT TESTS (stream 475197) ===');
  const streamId = 475197;
  const formats = [
    { label: '.m3u8', url: `${BASE}/live/${USER}/${PASS}/${streamId}.m3u8` },
    { label: '.ts', url: `${BASE}/live/${USER}/${PASS}/${streamId}.ts` },
    { label: 'no ext', url: `${BASE}/live/${USER}/${PASS}/${streamId}` },
    { label: 'port 80 .m3u8', url: `${BASE}:80/live/${USER}/${PASS}/${streamId}.m3u8` },
    { label: 'output=ts', url: `${BASE}/live/${USER}/${PASS}/${streamId}.ts?output=ts` },
  ];

  for (const f of formats) {
    try {
      const r = await fetchHead(f.url);
      console.log(`  ${f.label}: HTTP ${r.status}, bytes=${r.bytes}, type=${r.headers['content-type'] || 'none'}, cl=${r.headers['content-length'] || 'none'}`);
    } catch(e) {
      console.log(`  ${f.label}: ERROR ${e.message}`);
    }
  }

  // 4. Test with first stream from API
  console.log('\n=== TEST FIRST STREAM FROM API ===');
  try {
    const streams = await fetchJson(`${BASE}/player_api.php?username=${USER}&password=${PASS}&action=get_live_streams`);
    if (Array.isArray(streams) && streams.length > 0) {
      const sid = streams[0].stream_id;
      console.log(`Testing stream_id: ${sid} (${streams[0].name})`);
      const r = await fetchHead(`${BASE}/live/${USER}/${PASS}/${sid}.ts`);
      console.log(`  .ts: HTTP ${r.status}, bytes=${r.bytes}, type=${r.headers['content-type'] || 'none'}`);
      const r2 = await fetchHead(`${BASE}/live/${USER}/${PASS}/${sid}.m3u8`);
      console.log(`  .m3u8: HTTP ${r2.status}, bytes=${r2.bytes}, type=${r2.headers['content-type'] || 'none'}`);
    }
  } catch(e) { console.log('ERROR:', e.message); }

  // 5. Test with different User-Agent
  console.log('\n=== USER-AGENT TEST ===');
  try {
    const r = await new Promise((resolve, reject) => {
      const req = http.request(`${BASE}/live/${USER}/${PASS}/${streamId}.ts`, {
        method: 'GET', timeout: 8000,
        headers: { 'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20' }
      }, res => {
        let bytes = 0;
        const timer = setTimeout(() => { res.destroy(); resolve({ status: res.statusCode, bytes }); }, 4000);
        res.on('data', c => bytes += c.length);
        res.on('end', () => { clearTimeout(timer); resolve({ status: res.statusCode, bytes }); });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
      req.end();
    });
    console.log(`  VLC UA: HTTP ${r.status}, bytes=${r.bytes}`);
  } catch(e) { console.log('ERROR:', e.message); }

  console.log('\n=== DONE ===');
})();
