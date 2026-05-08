const {Client}=require('ssh2');
const c=new Client();
c.on('ready',()=>{
  // جلب حسابات lulu من قاعدة البيانات
  c.exec("cd /root/cloud-server && node -e \"const db=require('./db');(async()=>{try{const rows=await db.prepare('SELECT * FROM lulu_accounts LIMIT 5').all();console.log(JSON.stringify(rows,null,2));}catch(e){console.log('err:',e.message);}})()\"",(_,s)=>{
    let o='';
    s.on('data',d=>o+=d);
    s.stderr.on('data',d=>o+=d);
    s.on('close',()=>{console.log(o.substring(0,2000));c.end();});
  });
}).connect({host:'62.171.153.204',port:22,username:'root',password:'Mustafa7'});
