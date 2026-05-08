const {Client} = require('ssh2');
const fs = require('fs');
const path = require('path');

const localFile = path.join(__dirname, 'cloud-server/server.js');
const remoteFile = '/root/ma-streaming/cloud-server/server.js';
const localUploader = path.join(__dirname, 'cloud-server/lib/lulu-uploader.js');
const remoteUploader = '/root/ma-streaming/cloud-server/lib/lulu-uploader.js';
const localRestreamer = path.join(__dirname, 'cloud-server/lib/ffmpeg-restreamer.js');
const remoteRestreamer = '/root/ma-streaming/cloud-server/lib/ffmpeg-restreamer.js';

const c = new Client();
c.on('ready', () => {
  const content = fs.readFileSync(localFile);
  const contentUploader = fs.readFileSync(localUploader);
  const contentRestreamer = fs.existsSync(localRestreamer) ? fs.readFileSync(localRestreamer) : null;
  console.log(`Uploading ${content.length} bytes to ${remoteFile}...`);
  c.sftp((err, sftp) => {
    if (err) { console.error('SFTP error:', err); c.end(); return; }

    // Upload server.js
    const stream = sftp.createWriteStream(remoteFile);
    stream.write(content);
    stream.end();
    stream.on('close', () => {
      console.log('server.js uploaded. Uploading lulu-uploader.js...');
      // Upload lulu-uploader.js
      const stream2 = sftp.createWriteStream(remoteUploader);
      stream2.write(contentUploader);
      stream2.end();
      stream2.on('close', () => {
        console.log('Upload complete. Uploading ffmpeg-restreamer.js...');
        const uploadRestreamer = (cb) => {
          if (!contentRestreamer) { console.log('ffmpeg-restreamer.js not found locally, skipping.'); return cb(); }
          const stream3 = sftp.createWriteStream(remoteRestreamer);
          stream3.write(contentRestreamer);
          stream3.end();
          stream3.on('close', () => { console.log('ffmpeg-restreamer.js uploaded.'); cb(); });
          stream3.on('error', (err) => { console.error('Write error (restreamer):', err); cb(); });
        };
        uploadRestreamer(() => {
        console.log('All uploads done. Restarting cloud-server...');
        c.exec('pm2 restart cloud-server', (e, s) => {
          let o = '';
          s.on('data', d => o += d);
          s.stderr.on('data', d => o += d);
          s.on('close', () => { console.log(o); c.end(); });
        });
        });
      });
      stream2.on('error', (err) => { console.error('Write error (uploader):', err); c.end(); });
    });
    stream.on('error', (err) => { console.error('Write error:', err); c.end(); });
  });
}).connect({host:'62.171.153.204', port:22, username:'root', password:'Mustafa7'});
