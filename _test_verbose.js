const {Client} = require('ssh2');
const c = new Client();
c.on('ready', () => {
  // Test the manifest fetch with full headers
  const cmd = `curl -v -m 15 "http://myhand.org:8080/live/07740338663/11223344/1017030.m3u8" 2>&1`;
  c.exec(cmd, (e, s) => {
    let o = '';
    s.on('data', d => o += d);
    s.stderr.on('data', d => o += d);
    s.on('close', () => {
      console.log(o.substring(0, 3000));
      c.end();
    });
  });
}).connect({host:'62.171.153.204', port:22, username:'root', password:'Mustafa7'});
