var USER = '3302196097';
var PASS = '2474044847';

var urls = [
  'http://myhand.org:8080',
  'https://myhand.org:8080',
  'http://myhand.org',
  'https://myhand.org',
];

var done = 0;
var total = urls.length;

urls.forEach(function(base) {
  var url = base + '/player_api.php?username=' + USER + '&password=' + PASS;
  var mod = url.startsWith('https') ? require('https') : require('http');
  
  console.log('Testing: ' + base + ' ...');
  var req = mod.get(url, {
    headers: {'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20'},
    timeout: 8000,
    rejectUnauthorized: false
  }, function(res) {
    var body = '';
    res.on('data', function(c) { body += c; });
    res.on('end', function() {
      console.log('  ' + base + ' => HTTP ' + res.statusCode);
      try {
        var d = JSON.parse(body);
        if (d.user_info) {
          console.log('  AUTH: ' + d.user_info.auth + ' | Status: ' + d.user_info.status + ' | Streams: ' + (d.user_info.active_cons || 0) + '/' + (d.user_info.max_connections || 0));
          console.log('  Expires: ' + (d.user_info.exp_date ? new Date(d.user_info.exp_date * 1000).toISOString() : 'never'));
        }
      } catch(e) { console.log('  Body: ' + body.substring(0, 100)); }
      if (++done >= total) console.log('\nDONE');
    });
  });
  req.on('error', function(e) {
    console.log('  ' + base + ' => ERROR: ' + e.message);
    if (++done >= total) console.log('\nDONE');
  });
  req.on('timeout', function() {
    console.log('  ' + base + ' => TIMEOUT');
    req.destroy();
    if (++done >= total) console.log('\nDONE');
  });
});
