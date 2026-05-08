const {Client}=require('ssh2');
const c=new Client();
c.on('ready',()=>{
  c.exec("curl -s -o /dev/null -w '%{http_code}' --max-time 10 'http://myhand.org:8080/get.php?username=test&password=test&type=m3u_plus'",(err,s)=>{
    if(err){console.error(err);c.end();return;}
    let out='';
    s.on('data',d=>out+=d.toString());
    s.stderr.on('data',d=>process.stderr.write(d.toString()));
    s.on('close',()=>{console.log('VPS → myhand.org response code:',out.trim());c.end();});
  });
}).connect({host:'62.171.153.204',port:22,username:'root',password:'Mustafa7'});
