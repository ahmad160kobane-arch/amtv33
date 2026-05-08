const {Client}=require('ssh2');
const c=new Client();
c.on('ready',()=>{
  const cmd = "grep -a 'LiveProxy\\|HlsProxy\\|Restreamer\\|XtreamProxy\\|StreamManager\\|VodProxy\\|bein\\|channel\\|live\\|m3u8\\|segment\\|ERROR\\|Error' /root/.pm2/logs/cloud-server-out.log | tail -100; echo '---STDERR---'; tail -30 /root/.pm2/logs/cloud-server-error.log";
  c.exec(cmd,(err,stream)=>{
    if(err){console.error(err);c.end();return;}
    stream.on('data',d=>process.stdout.write(d.toString()));
    stream.stderr.on('data',d=>process.stderr.write(d.toString()));
    stream.on('close',()=>c.end());
  });
}).connect({host:'62.171.153.204',port:22,username:'root',password:'Mustafa7'});
