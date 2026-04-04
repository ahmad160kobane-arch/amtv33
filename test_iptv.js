var http = require('http');
var BASE = 'http://33p7o.qwerlo.com:80';
var USER = 'julie104yx';
var PASS = '4854863';

// Test 1: Account info
var url = BASE + '/player_api.php?username=' + USER + '&password=' + PASS;
console.log('Testing: ' + BASE);
console.log('User: ' + USER);
console.log('\n1. Account info...');

http.get(url, {headers: {'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20'}, timeout: 10000}, function(res) {
  var body = '';
  res.on('data', function(c) { body += c; });
  res.on('end', function() {
    console.log('   HTTP ' + res.statusCode);
    try {
      var d = JSON.parse(body);
      console.log('   Auth: ' + d.user_info.auth);
      console.log('   Status: ' + d.user_info.status);
      console.log('   Active: ' + d.user_info.active_cons + '/' + d.user_info.max_connections);
      console.log('   Expires: ' + (d.user_info.exp_date ? new Date(d.user_info.exp_date * 1000).toISOString() : 'never'));
    } catch(e) { console.log('   Body: ' + body.substring(0, 200)); }

    // Test 2: Live streams count
    console.log('\n2. Live streams...');
    var url2 = BASE + '/player_api.php?username=' + USER + '&password=' + PASS + '&action=get_live_streams';
    http.get(url2, {headers: {'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20'}, timeout: 15000}, function(res2) {
      var body2 = '';
      res2.on('data', function(c) { body2 += c; });
      res2.on('end', function() {
        console.log('   HTTP ' + res2.statusCode);
        try {
          var streams = JSON.parse(body2);
          console.log('   Total streams: ' + (Array.isArray(streams) ? streams.length : 'not array'));
          if (Array.isArray(streams) && streams.length > 0) {
            var sid = streams[0].stream_id;
            console.log('   First: ' + streams[0].name + ' (id=' + sid + ')');

            // Test 3: Stream fetch
            console.log('\n3. Stream test (id=' + sid + ')...');
            var surl = BASE + '/live/' + USER + '/' + PASS + '/' + sid + '.ts';
            http.get(surl, {headers: {'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20'}, timeout: 10000}, function(res3) {
              console.log('   HTTP ' + res3.statusCode);
              var bytes = 0;
              res3.on('data', function(c) { bytes += c.length; if (bytes > 5000) res3.destroy(); });
              res3.on('end', function() { console.log('   Bytes: ' + bytes); console.log('\nDONE'); });
              res3.on('close', function() { if(bytes > 0) console.log('   Bytes: ' + bytes + ' (stream OK)'); console.log('\nDONE'); });
            }).on('error', function(e) { console.log('   Error: ' + e.message); });
          }
        } catch(e) { console.log('   Parse error: ' + e.message); }
      });
    }).on('error', function(e) { console.log('   Error: ' + e.message); });
  });
}).on('error', function(e) { console.log('   Error: ' + e.message); });
