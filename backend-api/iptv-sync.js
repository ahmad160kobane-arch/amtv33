/**
 * IPTV Sync Script
 * Fetches content from Xtream Codes API and stores in local database
 * Usage: node iptv-sync.js
 */

const db = require('./db');
const { v4: uuidv4 } = require('uuid');

let IPTV = {};
let API_BASE = '';

// ─── Helpers ───────────────────────────────────────────────
async function fetchJson(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
  return resp.json();
}

function buildMovieStreamUrl(streamId, ext) {
  return `${IPTV.server}/movie/${IPTV.username}/${IPTV.password}/${streamId}.${ext || 'mkv'}`;
}

function buildSeriesStreamUrl(episodeId, ext) {
  return `${IPTV.server}/series/${IPTV.username}/${IPTV.password}/${episodeId}.${ext || 'mkv'}`;
}

function buildLiveStreamUrl(streamId) {
  return `${IPTV.server}/live/${IPTV.username}/${IPTV.password}/${streamId}.m3u8`;
}

function extractYear(dateStr) {
  if (!dateStr) return '';
  const m = String(dateStr).match(/(\d{4})/);
  return m ? m[1] : '';
}

function safe(val) {
  return val == null ? '' : String(val);
}

// ─── Category name map for Arabic translation ──────────────
const CATEGORY_AR = {
  'Action': 'أكشن', 'Adventure': 'مغامرة', 'Animation': 'رسوم متحركة',
  'Comedy': 'كوميدي', 'Crime': 'جريمة', 'Documentary': 'وثائقي',
  'Drama': 'دراما', 'Family': 'عائلي', 'Fantasy': 'فانتازيا',
  'History': 'تاريخ', 'Horror': 'رعب', 'Music': 'موسيقى',
  'Mystery': 'غموض', 'Romance': 'رومانسي', 'Science Fiction': 'خيال علمي',
  'Thriller': 'إثارة', 'TV Movie': 'فيلم تلفزيوني', 'War': 'حرب',
  'Western': 'غربي', 'Kids': 'أطفال', 'Reality': 'واقعي',
  'News': 'أخبار', 'Soap': 'مسلسل', 'Talk': 'حوار',
  'Action & Adventure': 'أكشن ومغامرة', 'Sci-Fi & Fantasy': 'خيال علمي وفانتازيا',
  'War & Politics': 'حرب وسياسة', 'Anime': 'أنمي',
};

// ─── تصفية: القنوات العربية فقط + أفلام/مسلسلات مترجمة/مدبلجة ──
const ARABIC_LIVE_CATEGORIES = new Set([
  '332', '423', '516', '334', '424', '335', '336', '482', '333', '365',
  '337', '338', '340', '339', '346', '345',
  '342', '343', '344', '355', '356', '347', '348', '349', '364',
  '350', '351', '352', '353', '354', '357', '359', '362', '363', '360', '481',
]);

const ARABIC_VOD_CATEGORIES = new Set([
  '491',  // [AR] Arabic Movies
  '565', '531', '412', '258', // New Movies 2023-2026
  '80', '157', '158', '159', '160', '171', '161', '162', '163', '164',
  '165', '166', '169', '168', '167', '170', '172', '173', '174', // General genres
]);

const ARABIC_SERIES_CATEGORIES = new Set([
  '493',  // [AR] Arabic Series
  '175', '195', '176', '271', '177', '179', '180', '181', '182', '190',
  '194', '185', '191', '184', '189', '192', '178', '188', // General genres
]);

function translateGenre(genre) {
  if (!genre) return '';
  return genre.split(',').map(g => {
    const trimmed = g.trim();
    return CATEGORY_AR[trimmed] || trimmed;
  }).join(', ');
}

// ─── Sync Live Channels ────────────────────────────────────
async function syncLiveChannels() {
  console.log('\n📡 Syncing live channels...');
  const categories = await fetchJson(`${API_BASE}&action=get_live_categories`);
  console.log(`  Found ${categories.length} live categories`);

  const streams = await fetchJson(`${API_BASE}&action=get_live_streams`);
  console.log(`  Found ${streams.length} live streams`);

  // Build category map
  const catMap = {};
  for (const c of categories) {
    catMap[c.category_id] = c.category_name;
  }

  const upsert = await db.prepare(`
    INSERT INTO channels (id, name, group_name, logo_url, stream_url, is_enabled, xtream_id, category)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, group_name=excluded.group_name, logo_url=excluded.logo_url,
      stream_url=excluded.stream_url, is_enabled=1, category=excluded.category
  `);

  // تصفية: القنوات العربية فقط
  const arabicStreams = streams.filter(s => ARABIC_LIVE_CATEGORIES.has(String(s.category_id)));
  console.log(`  🔍 تمت التصفية: ${arabicStreams.length} قناة عربية من أصل ${streams.length}`);

  let count = 0;
    for (const s of arabicStreams) {
      const id = `xtream_live_${s.stream_id}`;
      const groupName = catMap[s.category_id] || 'عام';
      const streamUrl = buildLiveStreamUrl(s.stream_id);
      await upsert.run(id, safe(s.name), groupName, safe(s.stream_icon), streamUrl, String(s.stream_id), groupName);
      count++;
    }
  
  console.log(`  ✅ تم مزامنة ${count} قناة عربية`);
}

// ─── Sync VOD (Movies) ────────────────────────────────────
async function syncMovies() {
  console.log('\n🎬 Syncing movies...');
  const categories = await fetchJson(`${API_BASE}&action=get_vod_categories`);
  console.log(`  Found ${categories.length} VOD categories`);

  const catMap = {};
  for (const c of categories) {
    catMap[c.category_id] = c.category_name;
  }

  const allStreams = await fetchJson(`${API_BASE}&action=get_vod_streams`);
  console.log(`  Found ${allStreams.length} VOD streams total`);

  // تصفية: أفلام عربية + مترجمة فقط
  const streams = allStreams.filter(s => ARABIC_VOD_CATEGORIES.has(String(s.category_id)));
  console.log(`  🔍 تمت التصفية: ${streams.length} فيلم عربي/مترجم`);

  const upsertVod = await db.prepare(`
    INSERT INTO vod (id, title, vod_type, category, poster_url, year, rating, stream_token, description, plot,
      cast_list, director, genre, country, duration, duration_secs, backdrop_url, tmdb_id, trailer,
      xtream_id, container_ext, source_rating)
    VALUES (?, ?, 'movie', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title=excluded.title, category=excluded.category, poster_url=excluded.poster_url,
      year=excluded.year, rating=excluded.rating, stream_token=excluded.stream_token,
      description=excluded.description, plot=excluded.plot, cast_list=excluded.cast_list,
      director=excluded.director, genre=excluded.genre, country=excluded.country,
      duration=excluded.duration, duration_secs=excluded.duration_secs, backdrop_url=excluded.backdrop_url,
      tmdb_id=excluded.tmdb_id, trailer=excluded.trailer, container_ext=excluded.container_ext,
      source_rating=excluded.source_rating
  `);

  let count = 0;
  let detailCount = 0;

  // First pass: insert basic info from stream list
  for (const s of streams) {
    const id = `xtream_movie_${s.stream_id}`;
    const catName = catMap[s.category_id] || '';
    const ext = s.container_extension || 'mkv';
    const streamUrl = buildMovieStreamUrl(s.stream_id, ext);
    const year = extractYear(s.name);

    await upsertVod.run(
      id, safe(s.name), catName, safe(s.stream_icon), year,
      safe(s.rating || ''), streamUrl,
      '', '', '', '', '', '', '', 0, '',
      safe(s.tmdb), '', String(s.stream_id), ext,
      s.rating_5based || 0
    );
    count++;
  }
  console.log(`  ✅ Inserted ${count} movies (basic info)`);

  // Second pass: fetch detailed info for newest movies only (sorted by 'added' desc)
  const sortedStreams = [...streams].sort((a, b) => (parseInt(b.added) || 0) - (parseInt(a.added) || 0));
  const DETAIL_LIMIT = 500;
  const detailStreams = sortedStreams.slice(0, DETAIL_LIMIT);
  console.log(`  📥 Fetching details for newest ${detailStreams.length} movies...`);
  const BATCH = 5;
  for (let i = 0; i < detailStreams.length; i += BATCH) {
    const batch = detailStreams.slice(i, i + BATCH);
    const promises = batch.map(async (s) => {
      try {
        const detail = await fetchJson(`${API_BASE}&action=get_vod_info&vod_id=${s.stream_id}`);
        const info = detail?.info || {};
        const movieData = detail?.movie_data || {};
        const id = `xtream_movie_${s.stream_id}`;
        const catName = catMap[s.category_id] || '';
        const ext = movieData.container_extension || s.container_extension || 'mkv';
        const streamUrl = buildMovieStreamUrl(s.stream_id, ext);

        const backdrop = Array.isArray(info.backdrop_path) && info.backdrop_path.length > 0
          ? info.backdrop_path[0] : '';
        const year = extractYear(info.releasedate) || extractYear(s.name);

        await upsertVod.run(
          id, safe(info.name || s.name), catName, safe(info.movie_image || s.stream_icon),
          year, safe(info.rating || s.rating || ''), streamUrl,
          safe(info.description || info.plot || ''),
          safe(info.plot || info.description || ''),
          safe(info.cast || info.actors || ''),
          safe(info.director || ''),
          safe(info.genre || ''),
          safe(info.country || ''),
          safe(info.duration || ''),
          info.duration_secs || 0,
          backdrop,
          safe(info.tmdb_id || s.tmdb || ''),
          safe(info.youtube_trailer || ''),
          String(s.stream_id), ext,
          info.rating || s.rating_5based || 0
        );
        detailCount++;
      } catch (e) {
        // Skip failed detail fetches
      }
    });
    await Promise.all(promises);

    if ((i + BATCH) % 50 === 0 || i + BATCH >= detailStreams.length) {
      console.log(`    ${Math.min(i + BATCH, detailStreams.length)}/${detailStreams.length} details fetched...`);
    }
  }
  console.log(`  ✅ Updated ${detailCount} movies with full details`);
}

// ─── Sync Series ───────────────────────────────────────────
async function syncSeries() {
  console.log('\n📺 Syncing series...');
  const categories = await fetchJson(`${API_BASE}&action=get_series_categories`);
  console.log(`  Found ${categories.length} series categories`);

  const catMap = {};
  for (const c of categories) {
    catMap[c.category_id] = c.category_name;
  }

  const allSeries = await fetchJson(`${API_BASE}&action=get_series`);
  console.log(`  Found ${allSeries.length} series total`);

  // تصفية: مسلسلات عربية + مترجمة فقط
  const seriesList = allSeries.filter(s => ARABIC_SERIES_CATEGORIES.has(String(s.category_id)));
  console.log(`  🔍 تمت التصفية: ${seriesList.length} مسلسل عربي/مترجم`);

  const upsertVod = await db.prepare(`
    INSERT INTO vod (id, title, vod_type, category, poster_url, year, rating, stream_token, description, plot,
      cast_list, director, genre, country, duration, duration_secs, backdrop_url, tmdb_id, trailer,
      xtream_id, container_ext, source_rating)
    VALUES (?, ?, 'series', ?, ?, ?, ?, '', ?, ?, ?, ?, ?, '', '', 0, ?, ?, ?, ?, '', ?)
    ON CONFLICT(id) DO UPDATE SET
      title=excluded.title, category=excluded.category, poster_url=excluded.poster_url,
      year=excluded.year, rating=excluded.rating, description=excluded.description, plot=excluded.plot,
      cast_list=excluded.cast_list, director=excluded.director, genre=excluded.genre,
      backdrop_url=excluded.backdrop_url, tmdb_id=excluded.tmdb_id, trailer=excluded.trailer,
      source_rating=excluded.source_rating
  `);

  const upsertEp = await db.prepare(`
    INSERT INTO episodes (id, vod_id, title, season, episode_num, stream_token, duration, duration_secs, air_date, container_ext, xtream_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title=excluded.title, season=excluded.season, episode_num=excluded.episode_num,
      stream_token=excluded.stream_token, duration=excluded.duration, duration_secs=excluded.duration_secs,
      air_date=excluded.air_date, container_ext=excluded.container_ext
  `);

  // Insert basic info
  let count = 0;
    for (const s of seriesList) {
      const id = `xtream_series_${s.series_id}`;
      const catName = catMap[s.category_id] || '';
      const backdrop = Array.isArray(s.backdrop_path) && s.backdrop_path.length > 0
        ? s.backdrop_path[0] : '';
      const year = extractYear(s.releaseDate || s.release_date);

      await upsertVod.run(
        id, safe(s.name), catName, safe(s.cover), year,
        safe(s.rating || ''),
        safe(s.plot || ''), safe(s.plot || ''),
        safe(s.cast || ''), safe(s.director || ''), safe(s.genre || ''),
        backdrop, safe(s.tmdb || ''), safe(s.youtube_trailer || ''),
        String(s.series_id), s.rating_5based || 0
      );
      count++;
    }
  
  console.log(`  ✅ Inserted ${count} series (basic info)`);

  // Fetch detailed info + episodes (newest 300)
  const sortedSeries = [...seriesList].sort((a, b) => {
    const da = parseInt(a.last_modified) || 0;
    const db2 = parseInt(b.last_modified) || 0;
    return db2 - da;
  });
  const SERIES_DETAIL_LIMIT = 300;
  const detailSeries = sortedSeries.slice(0, SERIES_DETAIL_LIMIT);
  console.log(`  📥 Fetching details for newest ${detailSeries.length} series...`);
  let detailCount = 0;
  const BATCH = 3;

  for (let i = 0; i < detailSeries.length; i += BATCH) {
    const batch = detailSeries.slice(i, i + BATCH);
    const promises = batch.map(async (s) => {
      try {
        const detail = await fetchJson(`${API_BASE}&action=get_series_info&series_id=${s.series_id}`);
        const info = detail?.info || {};
        const episodes = detail?.episodes || {};
        const vodId = `xtream_series_${s.series_id}`;

        // Update series info
        const catName = catMap[s.category_id] || '';
        const backdrop = Array.isArray(info.backdrop_path) && info.backdrop_path.length > 0
          ? info.backdrop_path[0]
          : (Array.isArray(s.backdrop_path) && s.backdrop_path.length > 0 ? s.backdrop_path[0] : '');
        const year = extractYear(info.releaseDate || info.release_date || s.releaseDate);

        await upsertVod.run(
          vodId, safe(info.name || s.name), catName, safe(info.cover || s.cover), year,
          safe(info.rating || s.rating || ''),
          safe(info.plot || s.plot || ''), safe(info.plot || s.plot || ''),
          safe(info.cast || s.cast || ''), safe(info.director || s.director || ''),
          safe(info.genre || s.genre || ''),
          backdrop, safe(info.tmdb || s.tmdb || ''),
          safe(info.youtube_trailer || s.youtube_trailer || ''),
          String(s.series_id), info.rating_5based || s.rating_5based || 0
        );

        // Insert episodes
        for (const [seasonNum, epList] of Object.entries(episodes)) {
          if (!Array.isArray(epList)) continue;
          for (const ep of epList) {
            const epId = `xtream_ep_${ep.id}`;
            const ext = ep.container_extension || 'mkv';
            const streamUrl = buildSeriesStreamUrl(ep.id, ext);
            const epInfo = ep.info || {};

            await upsertEp.run(
              epId, vodId,
              safe(ep.title || `S${seasonNum}E${ep.episode_num}`),
              parseInt(seasonNum) || 1,
              ep.episode_num || 1,
              streamUrl,
              safe(epInfo.duration || ''),
              epInfo.duration_secs || 0,
              safe(epInfo.air_date || ''),
              ext,
              String(ep.id)
            );
          }
        }
        detailCount++;
      } catch (e) {
        // Skip failed
      }
    });
    await Promise.all(promises);

    if ((i + BATCH) % 30 === 0 || i + BATCH >= detailSeries.length) {
      console.log(`    ${Math.min(i + BATCH, detailSeries.length)}/${detailSeries.length} series detailed...`);
    }
  }
  console.log(`  ✅ Updated ${detailCount} series with episodes`);
}

// ─── Main ──────────────────────────────────────────────────
async function main() {
  await db.init();

  const cfg = await db.prepare('SELECT server_url, username, password FROM iptv_config WHERE id = 1').get();
  if (!cfg || !cfg.server_url) {
    console.error('❌ لا يوجد إعدادات IPTV في قاعدة البيانات! أضفها من لوحة التحكم أولاً.');
    process.exit(1);
  }
  IPTV = { server: cfg.server_url, username: cfg.username, password: cfg.password };
  API_BASE = `${IPTV.server}/player_api.php?username=${IPTV.username}&password=${IPTV.password}`;

  console.log('╔══════════════════════════════════════════╗');
  console.log('║   IPTV Live Channels Sync ONLY           ║');
  console.log(`║   Server: ${IPTV.server}       ║`);
  console.log('║   VOD: vidsrc.me (TMDB)                  ║');
  console.log('╚══════════════════════════════════════════╝');

  // Verify account
  const account = await fetchJson(`${API_BASE}`);
  if (account?.user_info?.auth !== 1) {
    console.error('❌ Authentication failed!');
    process.exit(1);
  }
  console.log(`✅ Authenticated as: ${account.user_info.username}`);
  console.log(`   Status: ${account.user_info.status}, Expires: ${new Date(account.user_info.exp_date * 1000).toLocaleDateString()}`);

  // Save config
  await db.prepare(`INSERT INTO iptv_config (id, server_url, username, password, last_sync) VALUES (1, ?, ?, ?, NOW()) ON CONFLICT(id) DO UPDATE SET server_url=EXCLUDED.server_url, username=EXCLUDED.username, password=EXCLUDED.password, last_sync=NOW()`)
    .run(IPTV.server, IPTV.username, IPTV.password);

  const startTime = Date.now();

  // فقط القنوات المباشرة - الأفلام والمسلسلات من vidsrc.me
  try {
    await syncLiveChannels();
  } catch (e) {
    console.error('❌ Live channels sync error:', e.message);
  }

  // Update last sync
  await db.prepare(`UPDATE iptv_config SET last_sync = NOW() WHERE id = 1`).run();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const chRow = await db.prepare('SELECT COUNT(*) as c FROM channels').get();
  const chCount = chRow.c;

  console.log('\n╔══════════════════════════════════════════╗');
  console.log(`║   Sync Complete! (${elapsed}s)              ║`);
  console.log(`║   Live Channels: ${chCount}                  ║`);
  console.log(`║   VOD: vidsrc.me + TMDB API              ║`);
  console.log('╚══════════════════════════════════════════╝');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
