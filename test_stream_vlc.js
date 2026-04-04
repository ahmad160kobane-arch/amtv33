var http = require('http');

var BASE = 'http://ex2025.cc';
var USER = 'ledyxpro24';
var PASS = '2943689';
var SID = 475197;

function testStream(label, url, ua) {
  return new Promise(function(resolve) {
    var req = http.request(url, { method: 'GET', timeout: 8000, headers: { 'User-Agent': ua } }, function(res) {
      var bytes = 0;
      var timer = setTimeout(function() { res.destroy(); resolve({ label: label, status: res.statusCode, bytes: bytes, headers: res.headers }); }, 5000);
      res.on('data', function(c) { bytes += c.length; });
      res.on('end', function() { clearTimeout(timer); resolve({ label: label, status: res.statusCode, bytes: bytes, headers: res.headers }); });
    });
    req.on('error', function(e) { resolve({ label: label, error: e.message }); });
    req.on('timeout', function() { req.destroy(); resolve({ label: label, error: 'timeout' }); });
    req.end();
  });
}

(async function() {
  var url = BASE + '/live/' + USER + '/' + PASS + '/' + SID;

  var r1 = await testStream('.ts VLC UA', url + '.ts', 'VLC/3.0.20 LibVLC/3.0.20');
  console.log(r1.label + ': HTTP ' + (r1.status || r1.error) + ', bytes=' + (r1.bytes || 0));
  if (r1.headers && r1.headers.location) console.log('  redirect:', r1.headers.location);

  var r2 = await testStream('.m3u8 VLC UA', url + '.m3u8', 'VLC/3.0.20 LibVLC/3.0.20');
  console.log(r2.label + ': HTTP ' + (r2.status || r2.error) + ', bytes=' + (r2.bytes || 0));
  if (r2.headers && r2.headers.location) console.log('  redirect:', r2.headers.location);

  var r3 = await testStream('.ts IPTV-Smarter', url + '.ts', 'IPTVSmartersPro');
  console.log(r3.label + ': HTTP ' + (r3.status || r3.error) + ', bytes=' + (r3.bytes || 0));
  if (r3.headers && r3.headers.location) console.log('  redirect:', r3.headers.location);

  var r4 = await testStream('.ts Kodi', url + '.ts', 'Kodi/20.0 (Linux;)');
  console.log(r4.label + ': HTTP ' + (r4.status || r4.error) + ', bytes=' + (r4.bytes || 0));
  if (r4.headers && r4.headers.location) console.log('  redirect:', r4.headers.location);

  // Follow redirect if VLC got 302
  if (r1.status === 302 && r1.headers && r1.headers.location) {
    console.log('\nFollowing VLC redirect...');
    var r5 = await testStream('redirect .ts VLC', r1.headers.location, 'VLC/3.0.20 LibVLC/3.0.20');
    console.log(r5.label + ': HTTP ' + (r5.status || r5.error) + ', bytes=' + (r5.bytes || 0));
    if (r5.bytes > 0) console.log('*** STREAM HAS DATA! ***');
  }
  if (r2.status === 302 && r2.headers && r2.headers.location) {
    console.log('\nFollowing m3u8 redirect...');
    var r6 = await testStream('redirect .m3u8 VLC', r2.headers.location, 'VLC/3.0.20 LibVLC/3.0.20');
    console.log(r6.label + ': HTTP ' + (r6.status || r6.error) + ', bytes=' + (r6.bytes || 0));
    if (r6.bytes > 0) console.log('*** STREAM HAS DATA! ***');
  }

  console.log('\nDONE');
})();
