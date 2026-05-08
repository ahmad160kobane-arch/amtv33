const {Client}=require('ssh2');
const c=new Client();
c.on('ready',()=>{
  const cmd = 'curl -s "https://luluvdo.com/api/file/info?key=saed4iag0hajqldq&file_code=11z7er4enfvu"';
  c.exec(cmd,(_,s)=>{
    let o='';
    s.on('data',d=>o+=d);
    s.on('close',()=>{
      try { console.log(JSON.stringify(JSON.parse(o), null, 2)); } catch { console.log(o); }
      c.end();
    });
  });
}).connect({host:'62.171.153.204',port:22,username:'root',password:'Mustafa7'});
