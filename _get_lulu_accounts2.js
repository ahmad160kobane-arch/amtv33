const {Client}=require('ssh2');
const c=new Client();
c.on('ready',()=>{
  c.exec("cd /root/cloud-server && node -e \"const {Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_URL||'postgresql://postgres:ItqaSByVVVKDVlOEPvTNSrqsOVecsIGu@switchback.proxy.rlwy.net:23361/railway'});p.query('SELECT id,name,api_key FROM lulu_accounts LIMIT 5').then(r=>{console.log(JSON.stringify(r.rows,null,2));p.end();}).catch(e=>console.log('err:',e.message));\"",(_,s)=>{
    let o='';
    s.on('data',d=>o+=d);
    s.stderr.on('data',d=>o+=d);
    s.on('close',()=>{console.log(o.substring(0,2000));c.end();});
  });
}).connect({host:'62.171.153.204',port:22,username:'root',password:'Mustafa7'});
