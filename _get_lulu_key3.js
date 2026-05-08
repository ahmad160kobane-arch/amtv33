const {Client}=require('ssh2');
const c=new Client();
c.on('ready',()=>{
  // ابحث عن api_key في لوكو السيرفر
  c.exec("grep -r 'saed\\|api_key\\|apiKey\\|lulu' /root/cloud-server/.env /root/cloud-server/config.js 2>/dev/null; pm2 logs cloud-server --lines 5 --nostream 2>&1 | grep -i 'apikey\\|api_key\\|lulu_account'",(_,s)=>{
    let o='';
    s.on('data',d=>o+=d);
    s.stderr.on('data',d=>o+=d);
    s.on('close',()=>{console.log(o.substring(0,2000));c.end();});
  });
}).connect({host:'62.171.153.204',port:22,username:'root',password:'Mustafa7'});
