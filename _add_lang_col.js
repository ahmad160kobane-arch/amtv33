const {Client} = require('ssh2');

const c = new Client();
c.on('ready', () => {
  const cmd = `cd /root/ma-streaming/cloud-server && node -e "
(async () => {
  const db = require('./db');
  try {
    await db.exec('ALTER TABLE lulu_catalog ADD COLUMN IF NOT EXISTS lang TEXT');
    console.log('✅ عمود lang أُضيف بنجاح');
  } catch(e) {
    console.log('❌ خطأ:', e.message);
  }
  // تحقق
  const check = await db.prepare('SELECT lang FROM lulu_catalog LIMIT 1').get();
  console.log('فحص:', check !== undefined ? 'العمود موجود ✅' : 'غير موجود ❌');
  await db.close();
})().catch(e=>{console.error(e.message);process.exit(1);});
"`;

  c.exec(cmd, (err, stream) => {
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => c.end());
  });
}).connect({host:'62.171.153.204',port:22,username:'root',password:'Mustafa7'});
