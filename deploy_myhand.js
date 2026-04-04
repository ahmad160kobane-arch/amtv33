var fs = require('fs');
var path = '/home/cloud-server/lib/xtream.js';
var c = fs.readFileSync(path, 'utf8');

// Replace old provider with new one
var replacements = [
  [/primary\s*:\s*'[^']*'/, "primary : 'https://myhand.org:8080'"],
  [/backup\s*:\s*'[^']*'/, "backup  : 'https://myhand.org:8080'"],
  [/user\s*:\s*'[^']*'/, "user    : '3302196097'"],
  [/pass\s*:\s*'[^']*'/, "pass    : '2474044847'"],
];

var changed = 0;
for (var r of replacements) {
  if (r[0].test(c)) {
    c = c.replace(r[0], r[1]);
    changed++;
  }
}

if (changed > 0) {
  fs.writeFileSync(path, c);
  console.log('xtream.js: Updated ' + changed + ' fields');
} else {
  console.log('xtream.js: No changes needed (already up to date or pattern mismatch)');
}

// Verify
var verify = fs.readFileSync(path, 'utf8');
var idx = verify.indexOf('XTREAM');
console.log(verify.substring(idx, idx + 180));
