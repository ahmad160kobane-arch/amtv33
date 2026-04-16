/**
 * Xtream Codes API — Multi-Account Channel System
 * Each channel is linked to its own IPTV account
 * No hardcoded credentials — everything from DB
 */

// Legacy fallback XTREAM object — will be populated from DB at runtime
const XTREAM = {
  primary : '',
  backup  : '',
  user    : '',
  pass    : '',
};

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

/**
 * API call to an Xtream server with specific credentials
 */
async function apiCall(baseUrl, username, password, action) {
  const u = `${baseUrl}/player_api.php?username=${username}&password=${password}&action=${action}`;
  const res = await fetch(u, {
    headers: { 'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20' },
    signal : AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * Search channels in a specific IPTV account by keyword
 * Returns raw channel list (no DB storage)
 */
async function searchAccountChannels(account, query) {
  const { server_url, username, password } = account;
  const [categories, streams] = await Promise.all([
    apiCall(server_url, username, password, 'get_live_categories'),
    apiCall(server_url, username, password, 'get_live_streams'),
  ]);

  const catById = {};
  for (const c of (Array.isArray(categories) ? categories : [])) {
    catById[c.category_id] = c.category_name || 'عام';
  }

  const q = (query || '').toLowerCase();
  const results = [];
  for (const ch of (Array.isArray(streams) ? streams : [])) {
    if (!ch.stream_id) continue;
    const name = (ch.name || '').trim();
    const rawCat = catById[ch.category_id] || '';
    const hay = `${name} ${rawCat}`.toLowerCase();
    if (q && !hay.includes(q)) continue;
    const ci = getCatInfo(rawCat);
    results.push({
      stream_id  : Number(ch.stream_id),
      name,
      logo       : ch.stream_icon || '',
      category   : ci.name,
      raw_cat    : rawCat,
      cat_id     : String(ch.category_id || ''),
      epg_id     : ch.epg_channel_id || '',
      sort_order : ci.priority,
    });
  }
  return { channels: results, total: streams.length, server: server_url };
}

/**
 * Add selected channels to DB, linked to a specific account
 */
async function addChannelsToDB(db, account, channels) {
  const now = Date.now();
  let added = 0;
  await db.runTransaction(async (prepare) => {
    const ins = prepare(`
      INSERT INTO xtream_channels
      (id, name, logo, category, raw_cat, cat_id, stream_id, epg_id, sort_order, base_url, updated_at, account_id)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        name=EXCLUDED.name, logo=EXCLUDED.logo, category=EXCLUDED.category,
        raw_cat=EXCLUDED.raw_cat, cat_id=EXCLUDED.cat_id, stream_id=EXCLUDED.stream_id,
        epg_id=EXCLUDED.epg_id, sort_order=EXCLUDED.sort_order, base_url=EXCLUDED.base_url,
        updated_at=EXCLUDED.updated_at, account_id=EXCLUDED.account_id
    `);
    for (const ch of channels) {
      // Use account_id + stream_id as unique ID to allow same channel from different accounts
      const id = `${account.id}_${ch.stream_id}`;
      await ins.run(
        id, ch.name, ch.logo || '', ch.category || 'عام',
        ch.raw_cat || '', ch.cat_id || '', ch.stream_id,
        ch.epg_id || '', ch.sort_order || 99,
        account.server_url, now, account.id
      );
      added++;
    }
  });
  console.log(`[Xtream] ✓ Added ${added} channels for account #${account.id} (${account.name})`);
  return { added };
}

/**
 * Get account credentials for a specific channel from DB
 */
async function getChannelAccount(db, channelId) {
  const ch = await db.prepare(
    'SELECT c.*, a.server_url AS acc_server, a.username AS acc_user, a.password AS acc_pass, a.id AS acc_id FROM xtream_channels c LEFT JOIN iptv_accounts a ON c.account_id = a.id WHERE c.id = ? OR c.stream_id = ?'
  ).get(channelId, isNaN(channelId) ? -1 : Number(channelId));
  if (!ch) return null;
  return {
    channel: ch,
    account: ch.acc_server ? {
      id: ch.acc_id,
      server_url: ch.acc_server,
      username: ch.acc_user,
      password: ch.acc_pass,
    } : null,
  };
}

/**
 * Refresh stream URL for a channel — re-verify with its IPTV account
 */
async function refreshChannelStream(db, channelId) {
  const info = await getChannelAccount(db, channelId);
  if (!info || !info.account) throw new Error('القناة أو الحساب غير موجود');
  const { channel, account } = info;
  // Verify the stream is still available
  const testUrl = `${account.server_url}/live/${account.username}/${account.password}/${channel.stream_id}.m3u8`;
  const res = await fetch(testUrl, {
    headers: { 'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20' },
    signal: AbortSignal.timeout(10000),
    redirect: 'follow',
  });
  const ok = res.ok || res.status === 302;
  if (!ok) throw new Error(`البث غير متاح — HTTP ${res.status}`);
  // Update base_url in DB
  await db.prepare('UPDATE xtream_channels SET base_url = ?, updated_at = ? WHERE id = ?')
    .run(account.server_url, Date.now(), channel.id);
  return { success: true, streamId: channel.stream_id, server: account.server_url };
}

/**
 * Initialize XTREAM object from first active account (legacy compat)
 */
async function initXtreamFromDB(db) {
  try {
    const acc = await db.prepare("SELECT * FROM iptv_accounts WHERE status = 'active' ORDER BY id LIMIT 1").get();
    if (acc) {
      XTREAM.primary = acc.server_url;
      XTREAM.backup = acc.server_url;
      XTREAM.user = acc.username;
      XTREAM.pass = acc.password;
      console.log(`[Xtream] Loaded default account: ${acc.name || acc.server_url}`);
    }
  } catch (e) {
    console.log(`[Xtream] No accounts in DB yet`);
  }
}

module.exports = {
  XTREAM,
  CAT_MAP,
  getCatInfo,
  apiCall,
  searchAccountChannels,
  addChannelsToDB,
  getChannelAccount,
  refreshChannelStream,
  initXtreamFromDB,
};
