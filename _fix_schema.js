const {Client} = require('ssh2');

const c = new Client();
c.on('ready', () => {
  const cmd = `cd /root/ma-streaming/cloud-server && node -e "
(async () => {
  const db = require('./db');
  
  // فحص أعمدة الجدول الحالية
  const cols = await db.prepare('SELECT column_name, data_type FROM information_schema.columns WHERE table_name = \\'lulu_catalog\\' ORDER BY ordinal_position').all();
  console.log('=== أعمدة lulu_catalog ===');
  cols.forEach(c => console.log(c.column_name, ':', c.data_type));
  
  // إضافة الأعمدة الناقصة
  const needed = [
    ['lang', 'TEXT DEFAULT \\\"\\\"'],
    ['tmdb_type', 'TEXT DEFAULT \\\"\\\"'],
    ['lulu_fld_id', 'INTEGER DEFAULT 0'],
  ];
  for (const [col, def] of needed) {
    const exists = cols.find(c => c.column_name === col);
    if (!exists) {
      try {
        await db.exec('ALTER TABLE lulu_catalog ADD COLUMN ' + col + ' ' + def);
        console.log('✅ أضيف عمود:', col);
      } catch(e) {
        console.log('❌ خطأ في إضافة', col, ':', e.message);
      }
    } else {
      console.log('✓ موجود:', col);
    }
  }
  await db.close();
})().catch(e=>{console.error(e.message);process.exit(1);});
"`;

  c.exec(cmd, (err, stream) => {
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => c.end());
  });
}).connect({host:'62.171.153.204',port:22,username:'root',password:'Mustafa7'});
