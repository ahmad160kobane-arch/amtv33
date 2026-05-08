const ssh2 = require('ssh2');
const conn = new ssh2.Client();

conn.on('ready', () => {
  // Just test the manifest by hitting the proxy directly with a fake auth
  // We'll use the VPS's own cloud-server since it bypasses auth in testing
  
  // Actually, let's just check the proxy's rewritten manifest from the logs
  conn.exec('pm2 logs cloud-server --lines 30 --nostream 2>&1 | grep -i "manifest\\|cached\\|chseg\\|seg_0\\|live_"', (err, stream) => {
    let out = '';
    stream.on('data', d => out += d);
    stream.stderr.on('data', d => out += d);
    stream.on('close', () => {
      console.log(out);
      
      // Now test the segment cache directly
      conn.exec('node -e "const xp = require(process.cwd() + \\"/lib/xtream-proxy\\"); console.log(JSON.stringify({chSegs: [...xp._channelSegments.keys()], cacheSize: [...xp._channelSegments.values()].map(v => (v.buf?.length/1024/1024).toFixed(1) + \\"MB\\")}))"', (err, stream2) => {
        let out2 = '';
        stream2.on('data', d => out2 += d);
        stream2.stderr.on('data', d => out2 += d);
        stream2.on('close', () => {
          console.log('Segment cache:', out2);
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
  readyTimeout: 30000,
});
