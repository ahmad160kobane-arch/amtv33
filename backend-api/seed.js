const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');

async function seed() {
  await db.init();
  console.log('Seeding database...\n');

  const adminId = uuidv4();
  const adminPass = bcrypt.hashSync('admin123', 10);
  await db.prepare(`
    INSERT INTO users (id, username, email, password_hash, display_name, plan, is_admin)
    VALUES (?, 'admin', 'admin@ma-streaming.com', ?, 'المشرف', 'premium', 1)
    ON CONFLICT(username) DO NOTHING
  `).run(adminId, adminPass);

  const userId = uuidv4();
  const userPass = bcrypt.hashSync('123456', 10);
  await db.prepare(`
    INSERT INTO users (id, username, email, password_hash, display_name, plan)
    VALUES (?, 'user1', 'user@test.com', ?, 'محمد', 'free')
    ON CONFLICT(username) DO NOTHING
  `).run(userId, userPass);

  console.log('✓ Users created');
  console.log('  Admin: admin / admin123');
  console.log('  User:  user1 / 123456\n');

  const channels = [
    { name: 'beIN Sports 1', group: 'رياضة', logo: '', url: 'http://example.com/live/bein1.m3u8' },
    { name: 'beIN Sports 2', group: 'رياضة', logo: '', url: 'http://example.com/live/bein2.m3u8' },
    { name: 'MBC 1', group: 'ترفيه', logo: '', url: 'http://example.com/live/mbc1.m3u8' },
    { name: 'Al Jazeera', group: 'أخبار', logo: '', url: 'http://example.com/live/aljazeera.m3u8' },
    { name: 'Spacetoon', group: 'أطفال', logo: '', url: 'http://example.com/live/spacetoon.m3u8' },
  ];
  for (const [i, ch] of channels.entries()) {
    await db.prepare('INSERT INTO channels (id, name, group_name, logo_url, stream_url, sort_order) VALUES (?, ?, ?, ?, ?, ?)').run(uuidv4(), ch.name, ch.group, ch.logo, ch.url, i);
  }
  console.log(`✓ ${channels.length} channels added`);

  const movies = [
    { title: 'فيلم الممر', category: 'أكشن', year: '2019', rating: '7.5', poster: '' },
    { title: 'ولاد رزق', category: 'أكشن', year: '2019', rating: '7.0', poster: '' },
  ];
  for (const m of movies) {
    const token = 'mov_' + uuidv4().slice(0, 8);
    await db.prepare('INSERT INTO vod (id, title, vod_type, category, poster_url, year, rating, stream_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(uuidv4(), m.title, 'movie', m.category, m.poster, m.year, m.rating, token);
  }
  console.log(`✓ ${movies.length} movies added`);

  const series = [
    { title: 'لعبة نيوتن', category: 'درامي', year: '2021', rating: '8.0' },
    { title: 'الاختيار', category: 'أكشن', year: '2020', rating: '8.5' },
  ];
  for (const s of series) {
    const id = uuidv4();
    await db.prepare('INSERT INTO vod (id, title, vod_type, category, poster_url, year, rating, stream_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id, s.title, 'series', s.category, '', s.year, s.rating, '');
    for (let ep = 1; ep <= 5; ep++) {
      const epToken = 'ep_' + uuidv4().slice(0, 8);
      await db.prepare('INSERT INTO episodes (id, vod_id, title, season, episode_num, stream_token) VALUES (?, ?, ?, ?, ?, ?)').run(uuidv4(), id, `الحلقة ${ep}`, 1, ep, epToken);
    }
  }
  console.log(`✓ ${series.length} series added (5 episodes each)`);
  console.log('\n✅ Seed complete!\n');
  await db.close();
}

seed().catch(e => { console.error(e); process.exit(1); });
