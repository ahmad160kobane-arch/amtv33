const https = require('https');
const http = require('http');

function fetch(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { timeout: 10000, rejectUnauthorized: false }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch { resolve(body); }
      });
    }).on('error', reject);
  });
}

async function testUrl(label, url) {
  try {
    const data = await fetch(url);
    if (data.latestMovies) {
      console.log(label, '- movies:', (data.latestMovies || []).length, 'series:', (data.latestSeries || []).length);
      if (data.latestMovies[0]) console.log('  First movie:', data.latestMovies[0].title);
      if (data.latestSeries[0]) console.log('  First series:', data.latestSeries[0].title);
    } else if (data.genres) {
      console.log(label, '- genres count:', (data.genres || []).length);
      console.log('  Genres:', JSON.stringify(data.genres));
    } else if (data.items) {
      console.log(label, '- items:', (data.items || []).length, 'total:', data.total, 'hasMore:', data.hasMore);
    } else {
      console.log(label, '- response:', JSON.stringify(data).slice(0, 200));
    }
  } catch (e) {
    console.error(label, 'error:', e.message);
  }
}

async function main() {
  // Test internal (localhost)
  await testUrl('INTERNAL HOME', 'http://localhost:3002/api/lulu/home');
  await testUrl('INTERNAL GENRES', 'http://localhost:3002/api/lulu/genres');
  await testUrl('INTERNAL LIST MOVIES', 'http://localhost:3002/api/lulu/list?type=movie&page=1');
  await testUrl('INTERNAL LIST SERIES', 'http://localhost:3002/api/lulu/list?type=series&page=1');

  // Test external (via nginx)
  await testUrl('EXTERNAL HOME', 'https://amlive.shop/api/lulu/home');
  await testUrl('EXTERNAL GENRES', 'https://amlive.shop/api/lulu/genres');
  await testUrl('EXTERNAL LIST MOVIES', 'https://amlive.shop/api/lulu/list?type=movie&page=1');
}

main();
