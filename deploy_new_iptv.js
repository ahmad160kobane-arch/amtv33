var fs = require('fs');
var path = '/home/cloud-server/lib/xtream.js';
var c = fs.readFileSync(path, 'utf8');

var oldP = "primary : 'http://ex2025.cc'";
var oldB = "backup  : 'http://ex2025.cc'";
var oldU = "user    : 'ledyxpro24'";
var oldPass = "pass    : '2943689'";

var changed = 0;
if (c.includes(oldP)) { c = c.replace(oldP, "primary : 'http://33p7o.qwerlo.com:80'"); changed++; }
if (c.includes(oldB)) { c = c.replace(oldB, "backup  : 'http://33p7o.qwerlo.com:80'"); changed++; }
if (c.includes(oldU)) { c = c.replace(oldU, "user    : 'julie104yx'"); changed++; }
if (c.includes(oldPass)) { c = c.replace(oldPass, "pass    : '4854863'"); changed++; }

if (changed > 0) {
  fs.writeFileSync(path, c);
  console.log('xtream.js: Updated ' + changed + ' fields');
} else if (c.includes('33p7o.qwerlo.com')) {
  console.log('xtream.js: Already updated');
} else {
  console.log('xtream.js: Pattern not found');
  var idx = c.indexOf('XTREAM');
  if (idx > -1) console.log(c.substring(idx, idx + 200));
}
