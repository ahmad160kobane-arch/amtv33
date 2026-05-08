const {Client} = require('ssh2');
const c = new Client();
c.on('ready', () => {
  c.exec("pm2 logs cloud-server --lines 50 --nostream 2>&1 | tail -60", (err, stream) => {
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => c.end());
  });
}).connect({host:'62.171.153.204',port:22,username:'root',password:'Mustafa7'});
