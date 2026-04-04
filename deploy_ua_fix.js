var fs = require('fs');
var path = '/home/cloud-server/lib/';

// Fix 1: live-proxy.js - Change UA from Chrome to VLC
var lp = fs.readFileSync(path + 'live-proxy.js', 'utf8');
var oldUA1 = "const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';";
var newUA = "const UA = 'VLC/3.0.20 LibVLC/3.0.20';";
if (lp.includes(oldUA1)) {
  lp = lp.replace(oldUA1, newUA);
  fs.writeFileSync(path + 'live-proxy.js', lp);
  console.log('live-proxy.js: FIXED');
} else if (lp.includes(newUA)) {
  console.log('live-proxy.js: already fixed');
} else {
  console.log('live-proxy.js: UA pattern not found, current:', lp.substring(lp.indexOf('const UA'), lp.indexOf('const UA') + 100));
}

// Fix 2: xtream-proxy.js - Change UA from Chrome to VLC
var xp = fs.readFileSync(path + 'xtream-proxy.js', 'utf8');
var oldUA2 = "const UA            = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';";
if (xp.includes(oldUA2)) {
  xp = xp.replace(oldUA2, "const UA            = 'VLC/3.0.20 LibVLC/3.0.20';");
  fs.writeFileSync(path + 'xtream-proxy.js', xp);
  console.log('xtream-proxy.js: FIXED');
} else if (xp.includes('VLC/3.0.20')) {
  console.log('xtream-proxy.js: already fixed');
} else {
  console.log('xtream-proxy.js: UA pattern not found');
}

// Fix 3: xtream.js - Change UA in API calls
var xt = fs.readFileSync(path + 'xtream.js', 'utf8');
if (xt.includes("'User-Agent': 'Mozilla/5.0'")) {
  xt = xt.replace("'User-Agent': 'Mozilla/5.0'", "'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20'");
  fs.writeFileSync(path + 'xtream.js', xt);
  console.log('xtream.js: FIXED');
} else if (xt.includes('VLC/3.0.20')) {
  console.log('xtream.js: already fixed');
} else {
  console.log('xtream.js: UA pattern not found');
}

console.log('\nAll done. Verifying...');
var check1 = fs.readFileSync(path + 'live-proxy.js', 'utf8');
console.log('live-proxy UA:', check1.includes('VLC/3.0.20') ? 'OK (VLC)' : 'FAIL');
var check2 = fs.readFileSync(path + 'xtream-proxy.js', 'utf8');
console.log('xtream-proxy UA:', check2.includes('VLC/3.0.20') ? 'OK (VLC)' : 'FAIL');
var check3 = fs.readFileSync(path + 'xtream.js', 'utf8');
console.log('xtream.js UA:', check3.includes('VLC/3.0.20') ? 'OK (VLC)' : 'FAIL');
