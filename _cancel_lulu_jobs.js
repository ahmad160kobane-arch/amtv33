// Cancel lulu jobs #32 and #33 (duplicate Arabic Movies) via SSH → local API call on VPS
const { Client } = require('ssh2');
const conn = new Client();

const JOBS_TO_CANCEL = [32, 33]; // keep #35 (War)

conn.on('ready', () => {
  console.log('Connected to VPS');

  // Generate admin token directly on VPS and cancel jobs via local curl
  const script = `
cd /root/ma-streaming/cloud-server
node -e "
const config = require('./config');
const jwt = require('jsonwebtoken');
      const token = jwt.sign({ userId: '0cef8a1e-3b3e-494f-9736-c4085ab5eb14', lv: 85 }, config.JWT_SECRET, { expiresIn: '1h' });
process.stdout.write(token);
"
`.trim();

  conn.exec(script, (err, stream) => {
    if (err) { console.error('Token error:', err); conn.end(); return; }

    let token = '';
    stream.on('data', d => token += d.toString().trim());
    stream.stderr.on('data', d => console.error('err:', d.toString()));
    stream.on('close', () => {
      if (!token) { console.error('Failed to get token'); conn.end(); return; }
      console.log('Got token, cancelling jobs...');

      const cancelCmds = JOBS_TO_CANCEL.map(id =>
        `curl -s -X DELETE "http://localhost:8090/api/lulu-upload/jobs/${id}" -H "Authorization: Bearer ${token}" && echo "Cancelled job #${id}"`
      ).join(' && ');

      conn.exec(cancelCmds, (err2, stream2) => {
        if (err2) { console.error('Cancel error:', err2); conn.end(); return; }
        stream2.on('data', d => process.stdout.write(d.toString()));
        stream2.stderr.on('data', d => process.stderr.write(d.toString()));
        stream2.on('close', () => {
          console.log('\nDone. Jobs #32 and #33 cancelled.');
          conn.end();
        });
      });
    });
  });
}).connect({
  host: '62.171.153.204',
  port: 22,
  username: 'root',
  password: 'Mustafa7',
  readyTimeout: 15000,
});
