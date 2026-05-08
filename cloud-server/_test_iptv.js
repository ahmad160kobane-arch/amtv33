// Test IPTV connection with new account
const http = require('http');
const https = require('https');

function httpGetRaw(url, timeout = 15000, headers = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout, agent: false, headers }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function main() {
  const base = 'http://myhand.org:8080';
  const user = '95283542873';
  const pass = '34648347188';
  const UA = { 'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20' };

  // 1. Auth check
  console.log('=== Auth ===');
  const auth = await httpGetRaw(`${base}/player_api.php?username=${user}&password=${pass}`, 15000, UA);
  const authData = JSON.parse(auth.body);
  console.log('auth:', authData.user_info.auth, 'active_cons:', authData.user_info.active_cons, 'max_conn:', authData.user_info.max_connections, 'formats:', authData.user_info.allowed_output_formats);

  // 2. Test with VLC User-Agent + mp4
  console.log('\n=== GET .mp4 with VLC UA ===');
  const mp4 = await httpGetRaw(`${base}/movie/${user}/${pass}/1026145.mp4`, 15000, UA);
  console.log('Status:', mp4.status, 'Content-Type:', mp4.headers['content-type']);
  console.log('Body (first 300):', mp4.body.slice(0, 300));

  // 3. Test with VLC User-Agent + m3u8 (allowed format)
  console.log('\n=== GET .m3u8 with VLC UA ===');
  const m3u8 = await httpGetRaw(`${base}/movie/${user}/${pass}/1026145.m3u8`, 15000, UA);
  console.log('Status:', m3u8.status, 'Content-Type:', m3u8.headers['content-type']);
  console.log('Body (first 300):', m3u8.body.slice(0, 300));

  // 4. Test with VLC User-Agent + ts (allowed format)
  console.log('\n=== GET .ts with VLC UA ===');
  const ts = await httpGetRaw(`${base}/movie/${user}/${pass}/1026145.ts`, 15000, UA);
  console.log('Status:', ts.status, 'Content-Type:', ts.headers['content-type']);
  console.log('Body (first 300):', ts.body.slice(0, 300));

  // 5. If any got a redirect, follow it
  for (const [label, res] of [['mp4', mp4], ['m3u8', m3u8], ['ts', ts]]) {
    if ([301, 302, 307, 308].includes(res.status) && res.headers.location) {
      console.log(`\n=== Follow redirect for ${label} ===`);
      console.log('Location:', res.headers.location);
      const redir = await httpGetRaw(res.headers.location, 15000, UA);
      console.log('Status:', redir.status, 'Type:', redir.headers['content-type'], 'Size:', redir.headers['content-length']);
    }
  }
}

main().catch(e => console.error('Error:', e.message));
