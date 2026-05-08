const {Client}=require('ssh2');
const c=new Client();
c.on('ready',()=>{
  c.exec("grep -ri 'lulu\\|apikey\\|api_key' /root/cloud-server/.env 2>/dev/null; grep -ri 'lulu_api\\|luluApi\\|apiKey' /root/cloud-server/config.js 2>/dev/null | head -10",(_,s)=>{
    let o='';
    s.on('data',d=>o+=d);
    s.stderr.on('data',d=>o+=d);
    s.on('close',()=>{console.log(o);c.end();});
  });
}).connect({host:'62.171.153.204',port:22,username:'root',password:'Mustafa7'});
