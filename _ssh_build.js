const {Client} = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  console.log('SSH Connected! Building webapp...');
  conn.exec('cd /home/webapp && npm run build 2>&1', (err, stream) => {
    if(err) { console.error('Exec error:', err); conn.end(); return; }
    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stdout.write(d));
    stream.on('close', (code) => {
      console.log('\nBuild exit code:', code);
      if(code === 0) {
        console.log('Build succeeded! Restarting webapp...');
        let out2 = '';
        conn.exec('pm2 restart webapp && sleep 3 && pm2 status webapp', (err2, s2) => {
          if(err2) { console.error(err2); conn.end(); return; }
          s2.on('data', d => process.stdout.write(d));
          s2.stderr.on('data', d => process.stdout.write(d));
          s2.on('close', () => { console.log('\nDone.'); conn.end(); });
        });
      } else {
        console.log('Build FAILED!');
        conn.end();
      }
    });
  });
}).on('error', e => { console.error('SSH Error:', e.message); });
conn.connect({host:'62.171.153.204', port:22, username:'root', password:'Mustafa7', readyTimeout:15000});
