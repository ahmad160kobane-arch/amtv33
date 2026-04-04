/**
 * Xtream Codes API — Channel Sync
 * Fetches channels from IPTV provider, filters wanted ones, stores in DB
 */

const XTREAM = {
  primary : 'http://myhand.org:8080',
  backup  : 'http://myhand.org:8080',
  user    : '3302196097',
  pass    : '2474044847',
};

// ── Filter: keywords that make a channel "wanted" (channel name OR category name) ──
const WANTED = [
  // beIN Sports (highest priority)
  'bein sport','bein1','bein2','bein3','bein4','bein5','bein6','bein7','bein8',
  'bein premium','bein xtra','bein max','bein hd',
  // Al Kass
  'kass','الكأس','alkass','al kass',
  // Iraqi channels
  'iraq','عراق','عراقية','الشرقية','دجلة','الرافدين','الرشيد','السومرية',
  'البغدادية','بغداد','كردستان','كردسات','kurdsat','rudaw','nrt','dijlah',
  'الفرات','التغيير','العهد','البلادي','الإتجاه','الغدير',
  // Major Arabic
  'mbc','روتانا','rotana','الجزيرة','aljazeera','العربية','alarabiya',
  'أبوظبي','abu dhabi','دبي','dubai','الاخبارية',
  'ssc','رياضية','الحرة','alhurra',
  'cnn arabic','bbc arabic','sky news arabia',
  'osn','قناة on','on sport','on e','on drama',
  'قرآن','quran','القرآن',
];

// ── Category name → display name + sort priority ──
const CAT_MAP = [
  { match: ['bein'],                   name: 'beIN Sports',     priority: 1  },
  { match: ['kass','الكأس','alkass'],  name: 'الكأس',           priority: 2  },
  { match: ['iraq','عراق','عراقية'],  name: 'قنوات عراقية',   priority: 3  },
  { match: ['sport','رياضة','ssc'],    name: 'رياضة',           priority: 4  },
  { match: ['mbc'],                    name: 'MBC',              priority: 5  },
  { match: ['rotana','روتانا'],        name: 'روتانا',           priority: 6  },
  { match: ['news','أخبار','خبار'],   name: 'أخبار',            priority: 7  },
  { match: ['kids','أطفال','طفال'],   name: 'أطفال',            priority: 8  },
  { match: ['quran','قرآن','دينية','religious'], name: 'دينية', priority: 9  },
  { match: ['movie','أفلام','film'],   name: 'أفلام',            priority: 10 },
  { match: ['series','drama','مسلسل'], name: 'مسلسلات',         priority: 11 },
];

function getCatInfo(rawName) {
  const lower = (rawName || '').toLowerCase();
  for (const c of CAT_MAP) {
    if (c.match.some(m => lower.includes(m.toLowerCase()))) {
      return { name: c.name, priority: c.priority };
    }
  }
  return { name: rawName || 'عام', priority: 99 };
}

function isWanted(chName, catName) {
  const hay = `${chName} ${catName}`.toLowerCase();
  return WANTED.some(kw => hay.includes(kw.toLowerCase()));
}

async function apiCall(baseUrl, action) {
  const u = `${baseUrl}/player_api.php?username=${XTREAM.user}&password=${XTREAM.pass}&action=${action}`;
  const res = await fetch(u, {
    headers: { 'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20' },
    signal : AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * syncXtreamChannels — fetch + filter + store in xtream_channels table
 */
async function syncXtreamChannels(db) {
  console.log('[Xtream] Starting sync...');
  let server = null, categories = [], streams = [];

  for (const url of [XTREAM.primary, XTREAM.backup]) {
    try {
      [categories, streams] = await Promise.all([
        apiCall(url, 'get_live_categories'),
        apiCall(url, 'get_live_streams'),
      ]);
      server = url;
      console.log(`[Xtream] ✓ ${url} — ${streams.length} total streams`);
      break;
    } catch (e) {
      console.log(`[Xtream] ✗ ${url}: ${e.message}`);
    }
  }

  if (!server) throw new Error('All Xtream servers unreachable');

  // Build category id → name map
  const catById = {};
  for (const c of (Array.isArray(categories) ? categories : [])) {
    catById[c.category_id] = c.category_name || 'عام';
  }

  // Filter + transform
  const wanted = [];
  for (const ch of (Array.isArray(streams) ? streams : [])) {
    if (!ch.stream_id) continue;
    const rawCat = catById[ch.category_id] || '';
    if (!isWanted(ch.name || '', rawCat)) continue;
    const ci = getCatInfo(rawCat);
    wanted.push({
      id         : String(ch.stream_id),
      name       : (ch.name || '').trim(),
      logo       : ch.stream_icon || '',
      category   : ci.name,
      raw_cat    : rawCat,
      cat_id     : String(ch.category_id || ''),
      stream_id  : Number(ch.stream_id),
      epg_id     : ch.epg_channel_id || '',
      sort_order : ci.priority,
      base_url   : server,
    });
  }

  console.log(`[Xtream] Filtered → ${wanted.length} channels`);

  if (wanted.length === 0) {
    console.log('[Xtream] No channels matched filter — keeping existing DB data');
    return { total: streams.length, saved: 0, server };
  }

  // Persist — only delete after we have replacement data
  await db.prepare('DELETE FROM xtream_channels').run();
  const now = Date.now();
  await db.runTransaction(async (prepare) => {
    const ins = prepare(`
      INSERT INTO xtream_channels
      (id, name, logo, category, raw_cat, cat_id, stream_id, epg_id, sort_order, base_url, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        name=EXCLUDED.name, logo=EXCLUDED.logo, category=EXCLUDED.category,
        raw_cat=EXCLUDED.raw_cat, cat_id=EXCLUDED.cat_id, stream_id=EXCLUDED.stream_id,
        epg_id=EXCLUDED.epg_id, sort_order=EXCLUDED.sort_order, base_url=EXCLUDED.base_url,
        updated_at=EXCLUDED.updated_at
    `);
    for (const r of wanted)
      await ins.run(r.id, r.name, r.logo, r.category, r.raw_cat, r.cat_id,
              r.stream_id, r.epg_id, r.sort_order, r.base_url, now);
  });

  console.log(`[Xtream] \u2713 Saved ${wanted.length} channels (server: ${server})`);
  return { total: streams.length, saved: wanted.length, server };
}

module.exports = { syncXtreamChannels, XTREAM };
