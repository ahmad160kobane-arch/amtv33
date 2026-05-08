const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

// اختبار رفع ملف صغير جداً لفهم شكل الرد
const apiKey = '268974pf854aqdw63ui5sw';

async function getUploadUrl() {
  return new Promise((resolve, reject) => {
    https.get(`https://api.lulustream.com/api/upload/server?key=${apiKey}`, { timeout: 15000 }, res => {
      let b = '';
      res.on('data', d => b += d);
      res.on('end', () => {
        const d = JSON.parse(b);
        const url = typeof d.result === 'string' ? d.result : d.result?.url;
        resolve(url);
      });
    }).on('error', reject);
  });
}

(async () => {
  // إنشاء ملف فيديو وهمي صغير جداً (1KB)
  const tmpFile = path.join(os.tmpdir(), 'test_lulu_upload.mp4');
  fs.writeFileSync(tmpFile, Buffer.alloc(1024, 0));

  const uploadUrl = await getUploadUrl();
  console.log('Upload URL:', uploadUrl);

  const boundary = '----LuluBoundary' + Date.now().toString(16);
  const fileSize = fs.statSync(tmpFile).size;
  const prefix = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="api_key"\r\n\r\n${apiKey}\r\n` +
    `--${boundary}\r\nContent-Disposition: form-data; name="fld_id"\r\n\r\n0\r\n` +
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test_video.mp4"\r\nContent-Type: video/mp4\r\n\r\n`
  );
  const suffix = Buffer.from(`\r\n--${boundary}--\r\n`);
  const totalSize = prefix.length + fileSize + suffix.length;

  const parsedUrl = new URL(uploadUrl);
  const body = await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': totalSize,
        'User-Agent': 'Mozilla/5.0',
      },
      timeout: 30000,
    }, res => {
      let b = '';
      res.on('data', d => b += d);
      res.on('end', () => resolve(b));
    });
    req.on('error', reject);
    req.write(prefix);
    req.write(fs.readFileSync(tmpFile));
    req.write(suffix);
    req.end();
  });

  fs.unlinkSync(tmpFile);
  console.log('\n=== FULL UPLOAD RESPONSE ===');
  console.log(body);
})().catch(e => console.log('Error:', e.message));
