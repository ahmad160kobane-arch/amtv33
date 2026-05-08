const {Client} = require('ssh2');
const c = new Client();
c.on('ready', () => {
  const cmd = `
# فحص active connections الحالية
echo "=== Account status ==="
curl -s --max-time 10 -A "VLC/3.0.20" "http://kojplusma.org:2052/player_api.php?username=jazera&password=amlive" 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); ui=d.get('user_info',{}); print(json.dumps({k:ui[k] for k in ['max_connections','active_cons','status','exp_date'] if k in ui},indent=2))" 2>/dev/null

# الآن اختبار التحميل مباشرة
echo ""
echo "=== Direct download test ==="
curl -sI --max-time 15 -A "VLC/3.0.20 LibVLC/3.0.20" "http://kojplusma.org:2052/movie/jazera/amlive/465300.mp4" 2>/dev/null | head -5
`;
  c.exec(cmd, (_, s) => {
    let o = '';
    s.on('data', d => o += d);
    s.stderr.on('data', d => o += d);
    s.on('close', () => { console.log(o.substring(0, 1000)); c.end(); });
  });
}).connect({ host: '62.171.153.204', port: 22, username: 'root', password: 'Mustafa7' });
