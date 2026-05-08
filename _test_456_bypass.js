const {Client} = require('ssh2');
const c = new Client();
c.on('ready', () => {
  // اختبارات متعددة للتجاوز
  const cmd = `
echo "=== Test 1: No headers ==="
curl -sI --max-time 8 "http://kojplusma.org:2052/movie/jazera/amlive/465300.mp4" 2>/dev/null | grep "HTTP/" | head -2

echo "=== Test 2: Browser headers ==="
curl -sI --max-time 8 "http://kojplusma.org:2052/movie/jazera/amlive/465300.mp4" -H "User-Agent: Mozilla/5.0" -H "Referer: http://kojplusma.org:2052/" 2>/dev/null | grep "HTTP/" | head -2

echo "=== Test 3: API info for this stream ==="
curl -s --max-time 10 "http://kojplusma.org:2052/player_api.php?username=jazera&password=amlive&action=get_vod_info&vod_id=465300" 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); md=d.get('movie_data',{}); print('direct_source:',md.get('direct_source','N/A')); print('custom_sid:',md.get('custom_sid','N/A'))" 2>/dev/null

echo "=== Test 4: Range request ==="
curl -sI --max-time 8 -A "VLC/3.0.20" -H "Range: bytes=0-1023" "http://kojplusma.org:2052/movie/jazera/amlive/465300.mp4" 2>/dev/null | grep "HTTP/" | head -2

echo "=== Test 5: Check account connections info ==="
curl -s --max-time 10 "http://kojplusma.org:2052/player_api.php?username=jazera&password=amlive" 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); ui=d.get('user_info',{}); print('max_conn:',ui.get('max_connections')); print('active_conn:',ui.get('active_cons')); print('status:',ui.get('status')); print('exp_date:',ui.get('exp_date'))" 2>/dev/null
`;
  c.exec(cmd, (_, s) => {
    let o = '';
    s.on('data', d => o += d);
    s.stderr.on('data', d => o += d);
    s.on('close', () => { console.log(o.substring(0, 2000)); c.end(); });
  });
}).connect({ host: '62.171.153.204', port: 22, username: 'root', password: 'Mustafa7' });
