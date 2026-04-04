/**
 * تحديث روابط البث تلقائياً عند تشغيل السيرفر
 * يقرأ إعدادات IPTV من قاعدة البيانات ويحدّث stream_url لكل القنوات
 * ويحدّث stream_token لكل الأفلام والحلقات
 */

class IptvUpdater {
  constructor(db) {
    this.db = db;
  }

  async update() {
    const cfg = await this.db.prepare('SELECT server_url, username, password FROM iptv_config WHERE id = 1').get();
    if (!cfg || !cfg.server_url) {
      console.log('[IPTV] لا يوجد إعدادات IPTV — تخطي التحيث');
      return;
    }

    this.server = cfg.server_url;
    this.username = cfg.username;
    this.password = cfg.password;
    this.apiBase = `${this.server}/player_api.php?username=${this.username}&password=${this.password}`;

    console.log(`[IPTV] تحديث الروابط من ${this.server}...`);

    // التحقق من الحساب
    try {
      const account = await this._fetch(this.apiBase);
      if (account?.user_info?.auth !== 1) {
        console.error('[IPTV] فشل التحقق من حساب IPTV!');
        return;
      }
      console.log(`[IPTV] حساب فعّال — ينتهي: ${new Date(account.user_info.exp_date * 1000).toLocaleDateString()}`);
    } catch (e) {
      console.error('[IPTV] خطأ اتصال:', e.message);
      return;
    }

    const start = Date.now();

    // تحديث القنوات المباشرة
    await this._updateLiveChannels();

    // تحديث أفلام
    await this._updateMovies();

    // تحديث حلقات المسلسلات
    await this._updateEpisodes();

    // تسجيل وقت المزامنة
    await this.db.prepare("UPDATE iptv_config SET last_sync = NOW() WHERE id = 1").run();

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`[IPTV] تحديث الروابط اكتمل في ${elapsed}s`);
  }

  async _updateLiveChannels() {
    try {
      const streams = await this._fetch(`${this.apiBase}&action=get_live_streams`);
      if (!Array.isArray(streams)) return;

      let count = 0;
      await this.db.runTransaction(async (prepare) => {
        const update = prepare('UPDATE channels SET stream_url = ? WHERE xtream_id = ?');
        for (const s of streams) {
          const url = `${this.server}/live/${this.username}/${this.password}/${s.stream_id}.m3u8`;
          const r = await update.run(url, String(s.stream_id));
          count += r.changes;
        }
      });
      console.log(`[IPTV] تحديث ${count} قناة مباشرة`);
    } catch (e) {
      console.error('[IPTV] خطأ تحديث القنوات:', e.message);
    }
  }

  async _updateMovies() {
    try {
      const streams = await this._fetch(`${this.apiBase}&action=get_vod_streams`);
      if (!Array.isArray(streams)) return;

      let count = 0;
      await this.db.runTransaction(async (prepare) => {
        const update = prepare('UPDATE vod SET stream_token = ? WHERE xtream_id = ? AND vod_type = ?');
        for (const s of streams) {
          const ext = s.container_extension || 'mkv';
          const url = `${this.server}/movie/${this.username}/${this.password}/${s.stream_id}.${ext}`;
          const r = await update.run(url, String(s.stream_id), 'movie');
          count += r.changes;
        }
      });
      console.log(`[IPTV] تحديث ${count} فيلم`);
    } catch (e) {
      console.error('[IPTV] خطأ تحديث الأفلام:', e.message);
    }
  }

  async _updateEpisodes() {
    try {
      // نحدّث الحلقات الموجودة فقط — نبني الرابط من xtream_id
      const episodes = await this.db.prepare("SELECT id, xtream_id, container_ext FROM episodes WHERE xtream_id IS NOT NULL AND xtream_id != ''").all();
      let count = 0;
      await this.db.runTransaction(async (prepare) => {
        const update = prepare('UPDATE episodes SET stream_token = ? WHERE id = ?');
        for (const ep of episodes) {
          const ext = ep.container_ext || 'mkv';
          const url = `${this.server}/series/${this.username}/${this.password}/${ep.xtream_id}.${ext}`;
          const r = await update.run(url, ep.id);
          count += r.changes;
        }
      });
      console.log(`[IPTV] تحديث ${count} حلقة`);
    } catch (e) {
      console.error('[IPTV] خطأ تحديث الحلقات:', e.message);
    }
  }

  async _fetch(url) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp.json();
  }
}

module.exports = IptvUpdater;
