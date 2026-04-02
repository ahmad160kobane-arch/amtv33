const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');

console.log('Seeding database...\n');

// ─── Create Admin User ───────────────────────────────────
const adminId = uuidv4();
const adminPass = bcrypt.hashSync('admin123', 10);

db.prepare(`
  INSERT OR IGNORE INTO users (id, username, email, password_hash, display_name, plan, is_admin)
  VALUES (?, 'admin', 'admin@ma-streaming.com', ?, 'المشرف', 'premium', 1)
`).run(adminId, adminPass);

// Create test user
const userId = uuidv4();
const userPass = bcrypt.hashSync('123456', 10);

db.prepare(`
  INSERT OR IGNORE INTO users (id, username, email, password_hash, display_name, plan)
  VALUES (?, 'user1', 'user@test.com', ?, 'محمد', 'free')
`).run(userId, userPass);

console.log('✓ Users created');
console.log('  Admin: admin / admin123');
console.log('  User:  user1 / 123456\n');

// ─── Sample Channels ────────────────────────────────────
const channels = [
  { name: 'beIN Sports 1', group: 'رياضة', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/BeIN_Sports_logo_%282017%29.svg/200px-BeIN_Sports_logo_%282017%29.svg.png', url: 'http://example.com/live/bein1.m3u8' },
  { name: 'beIN Sports 2', group: 'رياضة', logo: '', url: 'http://example.com/live/bein2.m3u8' },
  { name: 'MBC 1', group: 'ترفيه', logo: '', url: 'http://example.com/live/mbc1.m3u8' },
  { name: 'MBC Drama', group: 'ترفيه', logo: '', url: 'http://example.com/live/mbcdrama.m3u8' },
  { name: 'Al Jazeera', group: 'أخبار', logo: '', url: 'http://example.com/live/aljazeera.m3u8' },
  { name: 'Spacetoon', group: 'أطفال', logo: '', url: 'http://example.com/live/spacetoon.m3u8' },
  { name: 'CN Arabia', group: 'أطفال', logo: '', url: 'http://example.com/live/cn.m3u8' },
];

const insertCh = db.prepare('INSERT INTO channels (id, name, group_name, logo_url, stream_url, sort_order) VALUES (?, ?, ?, ?, ?, ?)');
const insertChannels = db.transaction(() => {
  channels.forEach((ch, i) => insertCh.run(uuidv4(), ch.name, ch.group, ch.logo, ch.url, i));
});
insertChannels();
console.log(`✓ ${channels.length} channels added`);

// ─── Sample VOD ──────────────────────────────────────────
const movies = [
  { title: 'فيلم الممر', category: 'أكشن', year: '2019', rating: '7.5', poster: 'https://m.media-amazon.com/images/M/MV5BNjdjMjU4MDYtNGE0YS00YzQ0LWJiNDAtMjA4MjA4OWYzMTM4XkEyXkFqcGc@._V1_.jpg' },
  { title: 'ولاد رزق', category: 'أكشن', year: '2019', rating: '7.0', poster: 'https://m.media-amazon.com/images/M/MV5BNzQ1NTkxMTctMjE0NC00YmRjLWJhMTktOTZjZjczZmNlYmYxXkEyXkFqcGc@._V1_.jpg' },
  { title: 'الفيل الأزرق', category: 'رعب', year: '2014', rating: '7.8', poster: 'https://m.media-amazon.com/images/M/MV5BOGRjNTg0OWYtMTljYi00NzJmLWI0MTMtYzRhZjk3MzNjZmE0XkEyXkFqcGc@._V1_.jpg' },
  { title: 'كازابلانكا', category: 'درامي', year: '2019', rating: '6.5', poster: '' },
];

const series = [
  { title: 'لعبة نيوتن', category: 'درامي', year: '2021', rating: '8.0', poster: '' },
  { title: 'الاختيار', category: 'أكشن', year: '2020', rating: '8.5', poster: '' },
  { title: 'سوبر ميرو', category: 'أطفال', year: '2023', rating: '7.0', poster: '' },
];

const insertVod = db.prepare('INSERT INTO vod (id, title, vod_type, category, poster_url, year, rating, stream_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
const insertEp = db.prepare('INSERT INTO episodes (id, vod_id, title, season, episode_num, stream_token) VALUES (?, ?, ?, ?, ?, ?)');

const insertContent = db.transaction(() => {
  // Movies
  for (const m of movies) {
    const id = uuidv4();
    const token = 'mov_' + uuidv4().slice(0, 8);
    insertVod.run(id, m.title, 'movie', m.category, m.poster, m.year, m.rating, token);
  }

  // Series with episodes
  for (const s of series) {
    const id = uuidv4();
    insertVod.run(id, s.title, 'series', s.category, s.poster, s.year, s.rating, '');

    // Add 10 episodes per series
    for (let ep = 1; ep <= 10; ep++) {
      const epToken = 'ep_' + uuidv4().slice(0, 8);
      insertEp.run(uuidv4(), id, `الحلقة ${ep}`, 1, ep, epToken);
    }
  }
});
insertContent();
console.log(`✓ ${movies.length} movies added`);
console.log(`✓ ${series.length} series added (10 episodes each)`);

console.log('\n✅ Seed complete!\n');
