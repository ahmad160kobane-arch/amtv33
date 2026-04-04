var fs = require('fs');
var path = '/home/cloud-server/lib/xtream.js';
var c = fs.readFileSync(path, 'utf8');

// Fix: https -> http
c = c.replace(/https:\/\/myhand\.org:8080/g, 'http://myhand.org:8080');

// Also ensure user/pass are correct
if (!c.includes("'3302196097'")) {
  c = c.replace(/user\s*:\s*'[^']*'/, "user    : '3302196097'");
  c = c.replace(/pass\s*:\s*'[^']*'/, "pass    : '2474044847'");
}

fs.writeFileSync(path, c);

// Verify
var v = fs.readFileSync(path, 'utf8');
var idx = v.indexOf('XTREAM');
console.log(v.substring(idx, idx + 200));
