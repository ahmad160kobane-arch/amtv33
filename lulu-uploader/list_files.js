'use strict';
const axios = require('axios');
const KEY = '258176jfw9e96irnxai2fm';

async function main() {
  // List files
  const r = await axios.get('https://lulustream.com/api/file/list', {
    params: { key: KEY, per_page: 20, page: 1 },
    timeout: 10000,
  });

  const result = r.data.result || {};
  const files  = result.files || [];
  console.log(`\nإجمالي الملفات على LuluStream: ${result.results_total || 0}`);
  console.log('─'.repeat(70));
  files.forEach(f => {
    const pub    = f.public == 1 ? 'عام' : 'خاص';
    const folder = f.fld_id && f.fld_id != '0' ? `مجلد:${f.fld_id}` : 'جذر';
    console.log(`[${f.file_code}] ${f.title || '—'} | ${pub} | ${folder}`);
    console.log(`  https://lulustream.com/${f.file_code}.html`);
  });

  // List folders
  const fr = await axios.get('https://lulustream.com/api/folder/list', {
    params: { key: KEY, fld_id: 0 },
    timeout: 10000,
  });
  const folders = (fr.data.result && fr.data.result.folders) || [];
  console.log(`\nالمجلدات (${folders.length}):`);
  folders.forEach(f => console.log(` [${f.fld_id}] ${f.name}`));
}

main().catch(e => console.error('خطأ:', e.message));
