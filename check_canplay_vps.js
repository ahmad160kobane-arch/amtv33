const https = require('https');
const http = require('http');

function fetch(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { timeout: 15000, rejectUnauthorized: false }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch { resolve(body); }
      });
    }).on('error', reject);
  });
}

async function main() {
  // 1. Check Railway backend directly
  console.log("=== Railway Backend ===");
  try {
    const home = await fetch('https://amtv33-production.up.railway.app/api/lulu/home');
    console.log("HOME movies:", (home.latestMovies || []).length, "series:", (home.latestSeries || []).length);
    if (home.latestMovies && home.latestMovies[0]) {
      console.log("  First movie:", home.latestMovies[0].title, "| genre:", home.latestMovies[0].genre);
    }
    if (home.latestSeries && home.latestSeries[0]) {
      console.log("  First series:", home.latestSeries[0].title, "| genre:", home.latestSeries[0].genre);
    }
  } catch (e) {
    console.error("Railway HOME error:", e.message);
  }

  // 2. Check VPS web-app API route
  console.log("\n=== VPS Web-App API ===");
  try {
    const home = await fetch('http://localhost:3002/api/lulu/home');
    console.log("HOME movies:", (home.latestMovies || []).length, "series:", (home.latestSeries || []).length);
  } catch (e) {
    console.error("VPS HOME error:", e.message);
  }

  // 3. Check external (via nginx)
  console.log("\n=== External (Nginx) ===");
  try {
    const home = await fetch('https://amlive.shop/api/lulu/home');
    console.log("HOME movies:", (home.latestMovies || []).length, "series:", (home.latestSeries || []).length);
  } catch (e) {
    console.error("External HOME error:", e.message);
  }

  // 4. Check list endpoint with genre filter
  console.log("\n=== List with genre filter ===");
  try {
    const list = await fetch('https://amlive.shop/api/lulu/list?type=movie&page=1&genre=%D8%AF%D8%B1%D8%A7%D9%85%D8%A7');
    console.log("Movies with genre=دراما:", (list.items || []).length, "total:", list.total);
  } catch (e) {
    console.error("List genre error:", e.message);
  }

  // 5. Check without canplay filter (Railway raw query)
  console.log("\n=== Check if content exists without canplay filter ===");
  try {
    const listAll = await fetch('https://amtv33-production.up.railway.app/api/lulu/list?type=movie&page=1');
    console.log("All movies (with canplay filter):", (listAll.items || []).length, "total:", listAll.total);
  } catch (e) {
    console.error("List all error:", e.message);
  }

  // 6. Check genres
  console.log("\n=== Genres ===");
  try {
    const genres = await fetch('https://amlive.shop/api/lulu/genres');
    const g = genres.genres || [];
    console.log("Genre count:", g.length);
    console.log("Unique genres:", [...new Set(g)].length);
    console.log("Sample:", g.slice(0, 10).join(', '));
  } catch (e) {
    console.error("Genres error:", e.message);
  }
}

main();
