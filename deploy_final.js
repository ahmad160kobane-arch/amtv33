var fs = require('fs');
var path = '/home/cloud-server/lib/';

// Fix 1: xtream-proxy.js — KEEP_WARM 5min → 15s
var xp = fs.readFileSync(path + 'xtream-proxy.js', 'utf8');
if (xp.includes('KEEP_WARM     = 300000')) {
  xp = xp.replace('KEEP_WARM     = 300000; // 5min', 'KEEP_WARM     = 15000;  // 15s');
  fs.writeFileSync(path + 'xtream-proxy.js', xp);
  console.log('xtream-proxy.js: KEEP_WARM 5min -> 15s FIXED');
} else if (xp.includes('KEEP_WARM     = 15000')) {
  console.log('xtream-proxy.js: KEEP_WARM already 15s');
} else {
  console.log('xtream-proxy.js: KEEP_WARM pattern not found');
}

// Fix 2: stream-manager.js — all UA to VLC
var sm = fs.readFileSync(path + 'stream-manager.js', 'utf8');
var count = 0;
while (sm.includes("'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'")) {
  sm = sm.replace("'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'", "'VLC/3.0.20 LibVLC/3.0.20'");
  count++;
}
if (sm.includes("'Mozilla/5.0'")) {
  sm = sm.replace("'Mozilla/5.0'", "'VLC/3.0.20 LibVLC/3.0.20'");
  count++;
}
if (count > 0) {
  fs.writeFileSync(path + 'stream-manager.js', sm);
  console.log('stream-manager.js: fixed ' + count + ' UA entries');
} else {
  console.log('stream-manager.js: UA already VLC');
}

// Verify
console.log('\n=== Verification ===');
var files = ['live-proxy.js', 'xtream-proxy.js', 'xtream.js', 'stream-manager.js'];
files.forEach(function(f) {
  var c = fs.readFileSync(path + f, 'utf8');
  var hasMozilla = c.includes('Mozilla/5.0');
  var hasVLC = c.includes('VLC/3.0.20');
  console.log(f + ': ' + (hasVLC ? 'VLC OK' : 'NO VLC') + (hasMozilla ? ' ⚠️ STILL HAS MOZILLA' : ''));
});

var xp2 = fs.readFileSync(path + 'xtream-proxy.js', 'utf8');
var warmMatch = xp2.match(/KEEP_WARM\s*=\s*(\d+)/);
console.log('KEEP_WARM: ' + (warmMatch ? warmMatch[1] + 'ms' : 'not found'));
