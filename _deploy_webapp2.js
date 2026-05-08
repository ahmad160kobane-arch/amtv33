const ssh2 = require('ssh2');
const conn = new ssh2.Client();
const fs = require('fs');
const path = require('path');

function walkDir(dir, base) {
  let results = [];
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(walkDir(fullPath, base));
    } else {
      results.push({ local: fullPath, remote: '/home/webapp/' + path.relative(base, fullPath).replace(/\\/g, '/') });
    }
  }
  return results;
}

conn.on('ready', () => {
  console.log('Connected to VPS');
  
  const baseDir = 'C:/Users/princ/Desktop/ma/web-app';
  const files = walkDir(path.join(baseDir, '.next'), baseDir);
  console.log(`Found ${files.length} files to upload`);
  
  let uploaded = 0;
  let failed = 0;
  const dirsCreated = new Set();
  
  conn.sftp((err, sftp) => {
    if (err) { console.error('SFTP error:', err); conn.end(); return; }
    
    function ensureDir(remotePath, cb) {
      const dir = path.dirname(remotePath);
      if (dirsCreated.has(dir) || dir === '/') { cb(); return; }
      dirsCreated.add(dir);
      sftp.mkdir(dir, (err) => {
        // Ignore error - dir may already exist
        ensureDir(dir, cb); // Ensure parent exists too
      });
    }
    
    function uploadNext() {
      if (files.length === 0) {
        console.log(`Done: ${uploaded} uploaded, ${failed} failed`);
        conn.exec('pm2 restart webapp --update-env', (err, stream) => {
          stream.on('close', () => { console.log('Webapp restarted'); conn.end(); });
        });
        return;
      }
      
      const file = files.shift();
      const dir = path.dirname(file.remote);
      
      // Create directory if needed
      const createDirs = (d, cb) => {
        if (dirsCreated.has(d)) { cb(); return; }
        const parent = d.substring(0, d.lastIndexOf('/'));
        if (!parent || parent === '/') { cb(); return; }
        createDirs(parent, () => {
          sftp.mkdir(d, () => {
            dirsCreated.add(d);
            cb();
          });
        });
      };
      
      createDirs(dir, () => {
        const readStream = fs.createReadStream(file.local);
        const writeStream = sftp.createWriteStream(file.remote);
        writeStream.on('close', () => {
          uploaded++;
          if (uploaded % 100 === 0) console.log(`  ${uploaded}/${uploaded + files.length} files...`);
          uploadNext();
        });
        writeStream.on('error', (e) => {
          console.error(`Failed: ${file.remote}: ${e.message}`);
          failed++;
          uploadNext();
        });
        readStream.on('error', (e) => {
          console.error(`Read failed: ${file.local}: ${e.message}`);
          failed++;
          uploadNext();
        });
        readStream.pipe(writeStream);
      });
    }
    
    uploadNext();
  });
}).connect({
  host: '62.171.153.204',
  port: 22,
  username: 'root',
  password: 'Mustafa7',
  readyTimeout: 30000,
});
