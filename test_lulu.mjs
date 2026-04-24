const KEY = '268476xsqgnehs76lhfq0q';
const API = 'https://api.lulustream.com/api';

async function test() {
  console.log('Testing LuluStream API...');
  try {
    const url = `${API}/folder/list?key=${KEY}&fld_id=74466&per_page=100`;
    const r = await fetch(url);
    const d = await r.json();
    console.log('Status:', d.status);
    const folders = d.result?.folders || [];
    console.log('Folders count:', folders.length);
    if (folders.length > 0) {
      console.log('First folder:', folders[0].name, 'fld_id:', folders[0].fld_id);
      // Test getting files from first folder
      const url2 = `${API}/file/list?key=${KEY}&fld_id=${folders[0].fld_id}&per_page=5`;
      const r2 = await fetch(url2);
      const d2 = await r2.json();
      const files = d2.result?.files || [];
      console.log('Files in first folder:', files.length);
      if (files.length > 0) console.log('First file:', files[0].file_code, 'canplay:', files[0].canplay);
    }
  } catch(e) {
    console.error('ERROR:', e.message, e.stack);
  }
}

test();
