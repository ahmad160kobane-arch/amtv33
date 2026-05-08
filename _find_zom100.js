const http = require('http');

// البحث عن فيلم Zom 100 في كل الكاتيقوريات
async function searchVod(username, password, host, port) {
  const catsUrl = `http://${host}:${port}/player_api.php?username=${username}&password=${password}&action=get_vod_categories`;
  
  return new Promise(resolve => {
    http.get(catsUrl, { timeout: 15000 }, res => {
      let b = '';
      res.on('data', d => b += d);
      res.on('end', () => {
        try {
          const cats = JSON.parse(b);
          console.log(`Total cats: ${cats.length}`);
          // ابحث في الكاتيقوريات التي تحتوي NETFLIX
          const netflixCats = cats.filter(c => c.category_name.toLowerCase().includes('netflix'));
          console.log('Netflix cats:', netflixCats.map(c => `${c.category_id}: ${c.category_name}`).join('\n'));
          resolve(netflixCats);
        } catch(e) {
          console.log('Error:', e.message, b.substring(0, 100));
          resolve([]);
        }
      });
    }).on('error', e => { console.log('Error:', e.message); resolve([]); });
  });
}

async function searchInCat(username, password, host, port, catId) {
  const url = `http://${host}:${port}/player_api.php?username=${username}&password=${password}&action=get_vod_streams&category_id=${catId}`;
  return new Promise(resolve => {
    http.get(url, { timeout: 30000 }, res => {
      let b = '';
      res.on('data', d => b += d);
      res.on('end', () => {
        try {
          const items = JSON.parse(b);
          const zom = items.filter(i => i.name && i.name.toLowerCase().includes('zom'));
          if (zom.length) console.log('Found Zom:', JSON.stringify(zom[0]));
          resolve(zom);
        } catch(e) { resolve([]); }
      });
    }).on('error', e => { resolve([]); });
  });
}

(async () => {
  const cats = await searchVod('jazera', 'amlive', 'kojplusma.org', 2052);
  for (const cat of cats.slice(0, 3)) {
    console.log(`\nSearching in cat ${cat.category_id}: ${cat.category_name}`);
    const results = await searchInCat('jazera', 'amlive', 'kojplusma.org', 2052, cat.category_id);
    if (results.length) break;
  }
})();
