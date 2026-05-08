const {Client} = require('ssh2');

const c = new Client();
c.on('ready', () => {
  const cmd = `cd /root/ma-streaming/cloud-server && node -e "
const db = require('./db');

// فحص نوع الـ db object
console.log('DB type:', typeof db);
console.log('DB keys:', Object.keys(db).slice(0,10).join(', '));

// جرب الاستعلام
try {
  const row = db.prepare ? 
    db.prepare('SELECT COUNT(*) as c FROM lulu_catalog').get() :
    null;
  console.log('Count (prepare):', JSON.stringify(row));
} catch(e) { console.log('prepare error:', e.message); }

// جرب طريقة أخرى
try {
  const rows = db.all ? db.all('SELECT id, title, poster FROM lulu_catalog LIMIT 3') : 'no .all()';
  console.log('rows:', JSON.stringify(rows));
} catch(e) { console.log('all error:', e.message); }
"`;

  c.exec(cmd, (err, stream) => {
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => c.end());
  });
}).connect({host:'62.171.153.204',port:22,username:'root',password:'Mustafa7'});
