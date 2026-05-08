const http = require('http');

// فحص proxpanel.cc - هل يدعم VOD
const url = 'http://proxpanel.cc:80/player_api.php?username=8675010955&password=2739827310&action=get_vod_categories';

http.get(url, { timeout: 15000 }, res => {
  console.log('proxpanel VOD Status:', res.statusCode);
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    try {
      const data = JSON.parse(body);
      if (Array.isArray(data) && data.length) {
        console.log('Total categories:', data.length);
        console.log('First 5:', data.slice(0, 5).map(c => c.category_name).join(', '));
      } else {
        console.log('No categories:', body.substring(0, 100));
      }
    } catch(e) {
      console.log('Response:', body.substring(0, 200));
    }
  });
}).on('error', e => console.log('Error:', e.message));
