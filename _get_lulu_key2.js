const {Client}=require('ssh2');
const c=new Client();
c.on('ready',()=>{
  c.exec("cd /root/cloud-server && node_modules/.bin/node -e \"\" 2>/dev/null; psql 'postgresql://postgres:ItqaSByVVVKDVlOEPvTNSrqsOVecsIGu@switchback.proxy.rlwy.net:23361/railway' -c 'SELECT id,name,api_key FROM lulu_accounts LIMIT 5;' 2>&1",(_,s)=>{
    let o='';
    s.on('data',d=>o+=d);
    s.stderr.on('data',d=>o+=d);
    s.on('close',()=>{console.log(o.substring(0,2000));c.end();});
  });
}).connect({host:'62.171.153.204',port:22,username:'root',password:'Mustafa7'});
