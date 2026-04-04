var fs = require('fs');
var path = '/home/cloud-server/lib/live-proxy.js';
var c = fs.readFileSync(path, 'utf8');

var oldCode = `  async streamToClient(channelId, sourceUrl, req, res) {
    // حل redirects
    const resolvedUrl = await this._resolveUrl(sourceUrl);

    // تحويل m3u8 → ts لمصادر IPTV الحية
    let streamUrl = resolvedUrl;
    if (streamUrl.includes('/live/') && streamUrl.endsWith('.m3u8')) {
      streamUrl = streamUrl.slice(0, -5) + '.ts';
    }`;

var newCode = `  async streamToClient(channelId, sourceUrl, req, res) {
    // تحويل m3u8 → ts لمصادر IPTV الحية (قبل resolve لأن التوكن يختلف حسب الصيغة)
    let streamUrl = sourceUrl;
    if (streamUrl.includes('/live/') && streamUrl.endsWith('.m3u8')) {
      streamUrl = streamUrl.slice(0, -5) + '.ts';
    }

    // حل redirects بعد تحويل الصيغة
    streamUrl = await this._resolveUrl(streamUrl);`;

if (c.includes(oldCode)) {
  c = c.replace(oldCode, newCode);
  fs.writeFileSync(path, c);
  console.log('live-proxy.js: order fix APPLIED');
} else if (c.includes('تحويل m3u8 → ts لمصادر IPTV الحية (قبل resolve')) {
  console.log('live-proxy.js: already fixed');
} else {
  console.log('live-proxy.js: pattern not found - checking content...');
  var idx = c.indexOf('streamToClient');
  if (idx > -1) console.log(c.substring(idx, idx + 400));
}
