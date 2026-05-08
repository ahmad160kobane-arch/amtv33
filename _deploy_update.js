/**
 * نشر الملفات المعدلة فقط + بناء على VPS
 * يشمل: ملفات web-app + backend-api
 */
const {Client} = require('ssh2');
const fs = require('fs');
const path = require('path');

const VPS = { host: '62.171.153.204', port: 22, username: 'root', password: 'Mustafa7' };

// ─── الملفات المعدلة في web-app ───
const WEBAPP_FILES = [
  { local: 'C:/Users/princ/Desktop/ma/web-app/src/constants/api.ts',           remote: '/home/webapp/src/constants/api.ts' },
  { local: 'C:/Users/princ/Desktop/ma/web-app/src/app/detail/page.tsx',         remote: '/home/webapp/src/app/detail/page.tsx' },
  { local: 'C:/Users/princ/Desktop/ma/web-app/src/app/favorites/page.tsx',      remote: '/home/webapp/src/app/favorites/page.tsx' },
  { local: 'C:/Users/princ/Desktop/ma/web-app/src/app/history/page.tsx',        remote: '/home/webapp/src/app/history/page.tsx' },
  { local: 'C:/Users/princ/Desktop/ma/web-app/src/app/mylist/page.tsx',         remote: '/home/webapp/src/app/mylist/page.tsx' },
  { local: 'C:/Users/princ/Desktop/ma/web-app/src/components/HeroSlider.tsx',   remote: '/home/webapp/src/components/HeroSlider.tsx' },
  { local: 'C:/Users/princ/Desktop/ma/web-app/next.config.js',                  remote: '/home/webapp/next.config.js' },
];

// ─── ملفات للحذف من VPS (لم تعد موجودة) ───
const DELETE_FILES = [
  '/home/webapp/src/app/api/proxy/embed/route.ts',
];

const ALL_FILES = [...WEBAPP_FILES];

const conn = new Client();

function uploadFile(sftp, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    // تأكد من وجود المجلد على VPS
    const dir = path.dirname(remotePath);
    sftp.mkdir(dir, (err) => { /* ignore if exists */ });

    const readStream = fs.createReadStream(localPath);
    const writeStream = sftp.createWriteStream(remotePath);

    writeStream.on('close', () => {
      const size = fs.statSync(localPath).size;
      console.log(`  ✅ ${path.basename(localPath)} → ${remotePath} (${(size/1024).toFixed(1)}KB)`);
      resolve();
    });

    writeStream.on('error', reject);
    readStream.on('error', reject);
    readStream.pipe(writeStream);
  });
}

function deleteFile(sftp, remotePath) {
  return new Promise((resolve) => {
    sftp.unlink(remotePath, (err) => {
      if (err && err.code !== 2) {
        console.log(`  ⚠️  لم يحذف ${remotePath} (ربما غير موجود)`);
      } else {
        console.log(`  🗑️  حذف ${remotePath}`);
      }
      resolve();
    });
  });
}

function runCommand(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let output = '';
      stream.on('data', d => { output += d.toString(); process.stdout.write(d); });
      stream.stderr.on('data', d => { output += d.toString(); process.stderr.write(d); });
      stream.on('close', (code) => {
        if (code === 0) resolve(output);
        else reject(new Error(`Exit code ${code}`));
      });
    });
  });
}

async function deploy() {
  console.log('🚀 بدء نشر التحديثات على VPS...\n');

  // التحقق من وجود الملفات محلياً
  for (const f of ALL_FILES) {
    if (!fs.existsSync(f.local)) {
      console.error(`❌ ملف غير موجود: ${f.local}`);
      process.exit(1);
    }
  }

  conn.on('ready', async () => {
    console.log('✅ متصل بالـ VPS\n');

    try {
      // ─── رفع ملفات webapp + backend ───
      console.log('📁 رفع الملفات المعدلة...');

      const sftp = await new Promise((resolve, reject) => {
        conn.sftp((err, sftp) => err ? reject(err) : resolve(sftp));
      });

      for (const f of ALL_FILES) {
        await uploadFile(sftp, f.local, f.remote);
      }

      // ─── حذف ملفات لم تعد موجودة ───
      console.log('\n🗑️  حذف الملفات الملغاة...');
      for (const f of DELETE_FILES) {
        await deleteFile(sftp, f);
      }

      // ─── حذف مجلد proxy الفارغ إن وجد ───
      console.log('\n🧹 تنظيف مجلدات فارغة...');
      await runCommand(conn, 'rmdir /home/webapp/src/app/api/proxy/embed 2>/dev/null; rmdir /home/webapp/src/app/api/proxy 2>/dev/null; echo "done"');

      sftp.end();

      // ─── إعادة تشغيل backend-api ───
      console.log('\n🔄 إعادة تشغيل backend-api...');
      await runCommand(conn, 'cd /home/backend-api && pm2 restart backend-api --update-env 2>&1 || echo "backend-api not in pm2"');

      // ─── بناء webapp على VPS ───
      console.log('\n🔨 بناء التطبيق على VPS (这可能需要1-2分钟)...');
      const buildCmd = 'cd /home/webapp && rm -rf .next && npm run build 2>&1';
      await runCommand(conn, buildCmd);

      // ─── إعادة تشغيل webapp ───
      console.log('\n🔄 إعادة تشغيل webapp...');
      await runCommand(conn, 'pm2 restart webapp --update-env && sleep 2 && pm2 status webapp');

      console.log('\n✅ تم النشر بنجاح! 🎉');
      console.log('🌐 https://amlive.shop');

    } catch (err) {
      console.error('\n❌ خطأ:', err.message);
    } finally {
      conn.end();
    }
  });

  conn.on('error', (e) => {
    console.error('❌ خطأ اتصال SSH:', e.message);
    process.exit(1);
  });

  conn.connect({ ...VPS, readyTimeout: 30000 });
}

deploy();
