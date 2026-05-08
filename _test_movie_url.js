const http = require('http');

// جلب أول فيلم من الكاتالوج
const apiUrl = 'http://kojplusma.org:2052/player_api.php?username=jazera&password=amlive&action=get_vod_streams&category_id=403';

http.get(apiUrl, { timeout: 15000 }, res => {
  console.log('Streams Status:', res.statusCode);
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    try {
      const items = JSON.parse(body);
      if (Array.isArray(items) && items.length) {
        const m = items[0];
        console.log('First movie:', JSON.stringify({
          name: m.name,
          stream_id: m.stream_id,
          container_extension: m.container_extension
        }));
        
        // اختبار رابط التحميل
        const ext = m.container_extension || 'mp4';
        const url = `http://kojplusma.org:2052/movie/jazera/amlive/${m.stream_id}.${ext}`;
        console.log('\nTest download URL:', url);
        
        // اختبار HEAD request للرابط
        const req = http.request(url, { method: 'HEAD', timeout: 10000 }, r2 => {
          console.log('\nDownload URL HTTP Status:', r2.statusCode);
          console.log('Content-Length:', r2.headers['content-length'] || 'N/A');
          console.log('Content-Type:', r2.headers['content-type'] || 'N/A');
          r2.resume();
        });
        req.on('error', e => console.log('Download error:', e.message));
        req.end();
      } else {
        console.log('No items found');
      }
    } catch(e) {
      console.log('Parse error:', e.message, body.substring(0, 100));
    }
  });
}).on('error', e => console.log('Error:', e.message));
