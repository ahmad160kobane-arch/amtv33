const http = require('http');

async function testStream(streamId, ext = 'mp4') {
  return new Promise(resolve => {
    const url = `http://kojplusma.org:2052/movie/jazera/amlive/${streamId}.${ext}`;
    const req = http.request(url, {
      method: 'HEAD',
      timeout: 8000,
      headers: { 'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20' }
    }, res => {
      resolve({ streamId, status: res.statusCode, location: res.headers.location });
      res.resume();
    });
    req.on('error', e => resolve({ streamId, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ streamId, error: 'timeout' }); });
    req.end();
  });
}

// جلب stream IDs من API أولاً
const apiUrl = 'http://kojplusma.org:2052/player_api.php?username=jazera&password=amlive&action=get_vod_streams&category_id=403';
http.get(apiUrl, { timeout: 15000 }, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', async () => {
    const items = JSON.parse(body);
    console.log('Testing first 10 streams:');
    for (const m of items.slice(0, 10)) {
      const result = await testStream(m.stream_id, m.container_extension || 'mp4');
      console.log(`  ${m.name} (${m.stream_id}) → HTTP ${result.status || result.error}`);
    }
  });
}).on('error', e => console.log('Error:', e.message));
