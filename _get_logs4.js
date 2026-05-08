const {Client} = require('ssh2');
const c = new Client();
c.on('ready', () => {
  c.exec("tail -60 /root/.pm2/logs/cloud-server-out.log", (err, stream) => {
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => c.end());
  });
}).connect({host:'62.171.153.204',port:22,username:'root',password:'Mustafa7'});
