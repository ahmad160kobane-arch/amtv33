const {Client} = require('ssh2');
const c = new Client();
c.on('ready', () => {
  c.exec(`psql "${process.env.DATABASE_URL_PLACEHOLDER}" -c "SELECT id, server_url, username, password FROM iptv_accounts WHERE id=16" 2>&1 | head -5`, (_, s) => {
    let o = '';
    s.on('data', d => o += d);
    s.stderr.on('data', d => o += d);
    s.on('close', () => { console.log('result:', o.substring(0, 500)); c.end(); });
  });
}).connect({ host: '62.171.153.204', port: 22, username: 'root', password: 'Mustafa7' });
