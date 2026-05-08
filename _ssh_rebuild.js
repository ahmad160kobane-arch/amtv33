const {Client} = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  console.log('Building webapp...');
  let output = '';
  conn.exec('cd /home/webapp && rm -rf .next/cache && npm run build 2>&1 | tail -40', (err, stream) => {
    if(err) { console.error('Exec error:', err); conn.end(); return; }
    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stdout.write(d));
    stream.on('close', (code) => {
      console.log('\nBuild exit code:', code);
      if(code === 0) {
        console.log('Restarting webapp...');
        let out2 = '';
        conn.exec('pm2 restart webapp && sleep 5 && pm2 status && echo "===" && curl -sf http://localhost:3001 -o /dev/null -w "WEBAPP:%{http_code}"', (err2, s2) => {
          if(err2) { console.error(err2); conn.end(); return; }
          s2.on('data', d => process.stdout.write(d));
          s2.stderr.on('data', d => process.stdout.write(d));
          s2.on('close', () => { console.log('\nDeployment complete!'); conn.end(); });
        });
      } else {
        console.log('Build FAILED - not restarting');
        conn.end();
      }
    });
  });
}).on('error', e => { console.error('SSH Error:', e.message); });
conn.connect({host:'62.171.153.204', port:22, username:'root', password:'Mustafa7', readyTimeout:15000});
