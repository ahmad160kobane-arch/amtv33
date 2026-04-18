require('dotenv').config({path: '../.env'});
const db = require('./db');
db.init().then(async () => {
  const accounts = await db.prepare('SELECT * FROM iptv_accounts').all();
  console.log('--- IPTV ACCOUNTS IN DB ---');
  console.log(accounts);
  console.log('---------------------------');
  process.exit(0);
}).catch(console.error);
