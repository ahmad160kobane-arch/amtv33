const {Client} = require('ssh2');
const c = new Client();
c.on('ready', () => {
  // إنشاء JWT token مؤقت ثم إيقاف الـ job
  const cmd = `cd /root/cloud-server && node -e "
const jwt = require('jsonwebtoken');
const config = require('./config');
const token = jwt.sign({userId:1,role:'admin'}, config.JWT_SECRET, {expiresIn:'1h'});
const http = require('http');
// جلب قائمة jobs أولاً
const req = http.request({host:'localhost',port:8090,path:'/api/lulu-upload/jobs',method:'GET',headers:{'Authorization':'Bearer '+token}},res=>{
  let b='';res.on('data',d=>b+=d);res.on('end',()=>{
    console.log('Jobs:',b.substring(0,300));
    try {
      const jobs = JSON.parse(b);
      const running = Array.isArray(jobs) ? jobs.find(j=>j.status==='running') : null;
      if (!running) { console.log('No running job found'); return; }
      console.log('Cancelling job:', running.id);
      const r2 = http.request({host:'localhost',port:8090,path:'/api/lulu-upload/jobs/'+running.id+'/cancel',method:'POST',headers:{'Authorization':'Bearer '+token}},res2=>{
        let b2='';res2.on('data',d=>b2+=d);res2.on('end',()=>console.log('Cancel:',b2));
      });
      r2.end();
    } catch(e){console.log('parse err:',e.message);}
  });
});
req.end();
" 2>&1`;

  c.exec(cmd, (_, s) => {
    let o = '';
    s.on('data', d => o += d);
    s.stderr.on('data', d => o += d);
    s.on('close', () => { console.log(o.substring(0, 1000)); c.end(); });
  });
}).connect({ host: '62.171.153.204', port: 22, username: 'root', password: 'Mustafa7' });
