const {Client} = require('ssh2');
const c = new Client();
c.on('ready', () => {
  // اختبار الرابط مباشرة من VPS
  const cmd = `
DB_URL="postgresql://postgres:ItqaSByVVVKDVlOEPvTNSrqsOVecsIGu@switchback.proxy.rlwy.net:23361/railway"

# جلب بيانات IPTV account 16
IPTV_DATA=$(PGPASSWORD=ItqaSByVVVKDVlOEPvTNSrqsOVecsIGu psql "postgresql://postgres:ItqaSByVVVKDVlOEPvTNSrqsOVecsIGu@switchback.proxy.rlwy.net:23361/railway" -t -c "SELECT server_url||' '||username||' '||password FROM iptv_accounts WHERE id=16" 2>/dev/null)
echo "IPTV data: $IPTV_DATA"

# جلب stream_id و ext من vod
VOD_DATA=$(PGPASSWORD=ItqaSByVVVKDVlOEPvTNSrqsOVecsIGu psql "postgresql://postgres:ItqaSByVVVKDVlOEPvTNSrqsOVecsIGu@switchback.proxy.rlwy.net:23361/railway" -t -c "SELECT xtream_id||' '||COALESCE(container_ext,'mp4')||' '||title FROM vod LIMIT 1" 2>/dev/null)
echo "VOD data: $VOD_DATA"
`;
  c.exec(cmd, (_, s) => {
    let o = '';
    s.on('data', d => o += d);
    s.stderr.on('data', d => o += d);
    s.on('close', () => { console.log(o.substring(0, 1000)); c.end(); });
  });
}).connect({ host: '62.171.153.204', port: 22, username: 'root', password: 'Mustafa7' });
