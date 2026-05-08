const {Client} = require('ssh2');
const c = new Client();
c.on('ready', () => {
  const cmd = `
# اختبار عدة stream IDs من VPS
echo "=== Test from VPS ==="
for sid in 698146 697356 696884 695000 694000; do
  CODE=$(curl -sI --max-time 8 -A "VLC/3.0.20 LibVLC/3.0.20" "http://kojplusma.org:2052/movie/jazera/amlive/${sid}.mp4" 2>/dev/null | grep "HTTP/" | awk '{print $2}')
  echo "Stream $sid → HTTP $CODE"
done

# اختبار رابط API - هل يمكن جلب معلومات الفيلم؟
echo ""
echo "=== API Test ==="
curl -s --max-time 10 "http://kojplusma.org:2052/player_api.php?username=jazera&password=amlive&action=get_vod_streams&category_id=403&limit=3" 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); [print(x['stream_id'], x['name'][:40]) for x in d[:3]]" 2>/dev/null || echo "API parse failed"
`;
  c.exec(cmd, (_, s) => {
    let o = '';
    s.on('data', d => o += d);
    s.stderr.on('data', d => o += d);
    s.on('close', () => { console.log(o.substring(0, 1500)); c.end(); });
  });
}).connect({ host: '62.171.153.204', port: 22, username: 'root', password: 'Mustafa7' });
