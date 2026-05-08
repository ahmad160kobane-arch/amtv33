const {Client} = require('ssh2');
const c = new Client();
c.on('ready', () => {
  // محاولة الوصول للـ IP الحقيقي وراء Cloudflare
  const cmd = `
# جلب IP من DNS
echo "=== DNS Lookup ==="
host kojplusma.org 2>&1 | head -5
nslookup kojplusma.org 2>&1 | head -10

# محاولة تحميل مع User-Agent مختلف
echo ""
echo "=== Test with browser UA ==="
curl -sI --max-time 10 "http://kojplusma.org:2052/movie/jazera/amlive/698146.mp4" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" \
  -H "Referer: http://kojplusma.org:2052/" \
  2>&1 | grep -E "HTTP|Content|Location|cf-ray|server" | head -10

# اختبار منفذ آخر
echo ""
echo "=== Test port 80 ==="
curl -sI --max-time 10 "http://kojplusma.org:80/movie/jazera/amlive/698146.mp4" 2>&1 | grep "HTTP" | head -3
`;
  c.exec(cmd, (_, s) => {
    let o = '';
    s.on('data', d => o += d);
    s.stderr.on('data', d => o += d);
    s.on('close', () => { console.log(o.substring(0, 2000)); c.end(); });
  });
}).connect({ host: '62.171.153.204', port: 22, username: 'root', password: 'Mustafa7' });
