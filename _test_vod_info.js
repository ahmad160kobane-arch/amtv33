const http = require('http');

// جلب تفاصيل فيلم للبحث عن direct_source
const url = 'http://kojplusma.org:2052/player_api.php?username=jazera&password=amlive&action=get_vod_info&vod_id=698146';

http.get(url, { timeout: 15000 }, res => {
  console.log('Status:', res.statusCode);
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    try {
      const data = JSON.parse(body);
      console.log('movie_data keys:', Object.keys(data.movie_data || {}));
      const md = data.movie_data || {};
      console.log('direct_source:', md.direct_source || 'N/A');
      console.log('stream_url:', md.stream_url || 'N/A');
      console.log('movie_image:', (md.movie_image || '').substring(0, 80));
      console.log('container_extension:', md.container_extension || 'N/A');
    } catch(e) {
      console.log('Body:', body.substring(0, 300));
    }
  });
}).on('error', e => console.log('Error:', e.message));
