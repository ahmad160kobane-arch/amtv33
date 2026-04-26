const express = require("express");
const https = require("https");
const http = require("http");
const db = require("../db");
const pool = db.pool;

const router = express.Router();

// ─── LuluStream API helper ────────────────────────────────────────────────────
const LULU_KEY = process.env.LULU_KEY || "258176jfw9e96irnxai2fm";

function luluGet(url, ms = 12000) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http;
    const req = mod.get(url, { timeout: ms }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: null });
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("timeout"));
    });
  });
}

// ─── Helper: is content playable? ─────────────────────────────────────────────
function isPlayable(row) {
  if (!row) return false;
  // يُعتبر قابلاً للتشغيل إذا canplay = true أو لديه embed_url صالح
  return (
    row.canplay === true || (row.embed_url && row.embed_url.startsWith("http"))
  );
}

// GET /api/lulu/home — أحدث الأفلام والمسلسلات
router.get("/home", async (req, res) => {
  try {
    const movies = await pool.query(
      `SELECT id, title, poster, year, rating, genres as genre, vod_type, canplay
       FROM lulu_catalog
       WHERE vod_type = 'movie'
         AND (canplay = true OR (embed_url IS NOT NULL AND embed_url != ''))
       ORDER BY uploaded_at DESC NULLS LAST LIMIT 24`,
    );
    const series = await pool.query(
      `SELECT id, title, poster, year, rating, genres as genre, vod_type, episode_count
       FROM lulu_catalog
       WHERE vod_type = 'series'
         AND (canplay = true OR (embed_url IS NOT NULL AND embed_url != ''))
       ORDER BY uploaded_at DESC NULLS LAST LIMIT 24`,
    );
    res.json({
      latestMovies: movies.rows.map((r) => ({
        id: r.id,
        title: r.title,
        poster: r.poster || "",
        year: r.year || "",
        genre: r.genre || "",
        rating: r.rating || "",
        lang: "",
        vod_type: "movie",
      })),
      latestSeries: series.rows.map((r) => ({
        id: r.id,
        title: r.title,
        poster: r.poster || "",
        year: r.year || "",
        genre: r.genre || "",
        rating: r.rating || "",
        lang: "",
        vod_type: "series",
        episodeCount: r.episode_count || 0,
      })),
    });
  } catch (e) {
    console.error("[Lulu] home error:", e.message);
    res.status(500).json({ error: "فشل جلب الكاتالوج" });
  }
});

// GET /api/lulu/list?type=movie|series&page=1&search=&genre=
router.get("/list", async (req, res) => {
  try {
    const { type = "movie", page = "1", search = "", genre = "" } = req.query;
    const pg = Math.max(1, parseInt(page));
    const limit = 24;
    const offset = (pg - 1) * limit;
    const q = String(search).toLowerCase();

    // فلتر أساسي: النوع + (canplay أو embed_url موجود)
    let where = [
      "vod_type = $1",
      "(canplay = true OR (embed_url IS NOT NULL AND embed_url != ''))",
    ];
    let params = [type];
    let pi = 2;

    if (q) {
      where.push(`LOWER(title) LIKE $${pi}`);
      params.push(`%${q}%`);
      pi++;
    }
    if (genre) {
      where.push(`genres ILIKE $${pi}`);
      params.push(`%${genre}%`);
      pi++;
    }

    const whereStr = "WHERE " + where.join(" AND ");

    const totalRes = await pool.query(
      `SELECT COUNT(*) as c FROM lulu_catalog ${whereStr}`,
      params,
    );
    const total = parseInt(totalRes.rows[0]?.c || 0);

    const itemsRes = await pool.query(
      `SELECT id, title, poster, year, rating, genres as genre, vod_type, episode_count
       FROM lulu_catalog ${whereStr}
       ORDER BY uploaded_at DESC NULLS LAST
       LIMIT $${pi} OFFSET $${pi + 1}`,
      [...params, limit, offset],
    );

    const items = itemsRes.rows.map((r) => ({
      id: r.id,
      title: r.title,
      poster: r.poster || "",
      year: r.year || "",
      genre: r.genre || "",
      rating: r.rating || "",
      lang: "",
      vod_type: r.vod_type,
      episodeCount: r.vod_type === "series" ? r.episode_count || 0 : undefined,
    }));

    res.json({ items, page: pg, total, hasMore: offset + limit < total });
  } catch (e) {
    console.error("[Lulu] list error:", e.message);
    res.status(500).json({ error: "فشل جلب القائمة" });
  }
});

// GET /api/lulu/detail?type=movie|series&id=xxx
router.get("/detail", async (req, res) => {
  try {
    const { type, id } = req.query;
    if (!id) return res.status(400).json({ error: "id مطلوب" });

    const catRes = await pool.query(
      `SELECT * FROM lulu_catalog WHERE id = $1 AND vod_type = $2`,
      [id, type || "movie"],
    );
    const cat = catRes.rows[0];
    if (!cat) return res.status(404).json({ error: "المحتوى غير موجود" });

    const base = {
      id: cat.id,
      title: cat.title,
      poster: cat.poster || "",
      backdrop: cat.backdrop || cat.poster || "",
      plot: cat.plot || "",
      year: cat.year || "",
      rating: cat.rating || "",
      genre: cat.genres || "",
      genres: cat.genres || "",
      lang: "",
      cast_list: cat.cast_list || "",
      director: cat.director || "",
      country: cat.country || "",
      runtime: cat.runtime || "",
      vod_type: cat.vod_type,
      fileCode: cat.file_code,
      hlsUrl: cat.hls_url,
      embedUrl: cat.embed_url,
      canplay: isPlayable(cat),
      subtitleUrls: null,
    };

    if (cat.vod_type === "series") {
      const epsRes = await pool.query(
        `SELECT * FROM lulu_episodes WHERE catalog_id = $1 ORDER BY season, episode`,
        [cat.id],
      );
      const seasonMap = {};
      for (const ep of epsRes.rows) {
        const s = String(ep.season || 1);
        if (!seasonMap[s]) seasonMap[s] = [];
        seasonMap[s].push({
          id: String(ep.id),
          episode: ep.episode,
          season: ep.season,
          title: ep.title || `الحلقة ${ep.episode}`,
          fileCode: ep.file_code,
          hlsUrl: ep.hls_url,
          embedUrl: ep.embed_url,
          canplay: isPlayable(ep),
          thumbnail: ep.thumbnail || "",
          overview: ep.overview || "",
          air_date: ep.air_date || "",
          ext: "mp4",
        });
      }
      const seasons = Object.entries(seasonMap)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([s, eps]) => ({ season: Number(s), episodes: eps }));

      base.seasons = seasons;
      base.episodes = seasons.flatMap((s) => s.episodes);
    }

    res.json(base);
  } catch (e) {
    console.error("[Lulu] detail error:", e.message);
    res.status(500).json({ error: "فشل جلب التفاصيل" });
  }
});

// GET /api/lulu/stream?type=movie|series&id=xxx&ep_id=xxx
router.get("/stream", async (req, res) => {
  try {
    const { type, id, ep_id } = req.query;

    if (type === "movie" && id) {
      const r = await pool.query(
        `SELECT file_code, hls_url, embed_url, canplay, title FROM lulu_catalog WHERE id = $1`,
        [id],
      );
      const row = r.rows[0];
      if (!row) return res.json({ available: false, reason: "not_found" });
      if (!isPlayable(row))
        return res.json({ available: false, reason: "encoding" });
      return res.json({
        available: true,
        fileCode: row.file_code,
        hlsUrl: row.hls_url,
        embedUrl: row.embed_url,
        title: row.title,
      });
    }

    if (type === "series" && ep_id) {
      const r = await pool.query(
        `SELECT file_code, hls_url, embed_url, canplay, title FROM lulu_episodes WHERE id = $1`,
        [ep_id],
      );
      const row = r.rows[0];
      if (!row) return res.json({ available: false, reason: "not_found" });
      if (!isPlayable(row))
        return res.json({ available: false, reason: "encoding" });
      return res.json({
        available: true,
        fileCode: row.file_code,
        hlsUrl: row.hls_url,
        embedUrl: row.embed_url,
        title: row.title,
      });
    }

    res.status(400).json({ error: "معاملات غير صحيحة" });
  } catch (e) {
    console.error("[Lulu] stream error:", e.message);
    res.status(500).json({ error: "فشل جلب رابط البث" });
  }
});

// GET /api/lulu/genres — قائمة التصنيفات المتاحة
router.get("/genres", async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT DISTINCT unnest(string_to_array(genres, '،')) as genre
       FROM lulu_catalog
       WHERE genres IS NOT NULL AND genres != ''
       ORDER BY genre`,
    );
    res.json({ genres: r.rows.map((row) => row.genre.trim()).filter(Boolean) });
  } catch (e) {
    console.error("[Lulu] genres error:", e.message);
    res.status(500).json({ error: "فشل جلب التصنيفات" });
  }
});

// POST /api/lulu/refresh-canplay — تحديث حالة canplay من LuluStream API
// يمكن تشغيله يدوياً أو من cron job
router.post("/refresh-canplay", async (req, res) => {
  try {
    // جلب كل العناصر التي لديها file_code
    const catalogRes = await pool.query(
      `SELECT id, file_code, title FROM lulu_catalog WHERE file_code IS NOT NULL AND file_code != '' AND canplay = false LIMIT 200`,
    );
    const episodesRes = await pool.query(
      `SELECT id, file_code, title FROM lulu_episodes WHERE file_code IS NOT NULL AND file_code != '' AND canplay = false LIMIT 500`,
    );

    let updatedCatalog = 0;
    let updatedEpisodes = 0;
    let errors = 0;

    // تحديث lulu_catalog
    for (const row of catalogRes.rows) {
      try {
        const r = await luluGet(
          `https://api.lulustream.com/api/file/info?key=${LULU_KEY}&file_code=${row.file_code}`,
        );
        const info = r.data?.result?.[0];
        if (info && info.canplay === 1) {
          await pool.query(
            `UPDATE lulu_catalog SET canplay = true WHERE id = $1`,
            [row.id],
          );
          updatedCatalog++;
        }
      } catch {
        errors++;
      }
      // تأخير بسيط لتجنب rate limiting
      await new Promise((r) => setTimeout(r, 150));
    }

    // تحديث lulu_episodes
    for (const row of episodesRes.rows) {
      try {
        const r = await luluGet(
          `https://api.lulustream.com/api/file/info?key=${LULU_KEY}&file_code=${row.file_code}`,
        );
        const info = r.data?.result?.[0];
        if (info && info.canplay === 1) {
          await pool.query(
            `UPDATE lulu_episodes SET canplay = true WHERE id = $1`,
            [row.id],
          );
          updatedEpisodes++;
        }
      } catch {
        errors++;
      }
      await new Promise((r) => setTimeout(r, 150));
    }

    // أيضاً: تحديث فوري لكل ما لديه embed_url حتى لو file_code غير موجود
    const quickUpdate = await pool.query(
      `UPDATE lulu_catalog SET canplay = true
       WHERE canplay = false AND embed_url IS NOT NULL AND embed_url != ''`,
    );
    const quickUpdateEp = await pool.query(
      `UPDATE lulu_episodes SET canplay = true
       WHERE canplay = false AND embed_url IS NOT NULL AND embed_url != ''`,
    );

    res.json({
      success: true,
      updatedCatalog: updatedCatalog + quickUpdate.rowCount,
      updatedEpisodes: updatedEpisodes + quickUpdateEp.rowCount,
      errors,
      message: "تم تحديث حالة canplay بنجاح",
    });
  } catch (e) {
    console.error("[Lulu] refresh-canplay error:", e.message);
    res.status(500).json({ error: "فشل تحديث canplay", details: e.message });
  }
});

// GET /api/lulu/stats — إحصائيات سريعة (للمراقبة)
router.get("/stats", async (req, res) => {
  try {
    const r1 = await pool.query(
      `SELECT vod_type, canplay, COUNT(*) as cnt FROM lulu_catalog GROUP BY vod_type, canplay ORDER BY vod_type, canplay`,
    );
    const r2 = await pool.query(
      `SELECT canplay, COUNT(*) as cnt FROM lulu_episodes GROUP BY canplay`,
    );
    const r3 = await pool.query(
      `SELECT COUNT(*) as total FROM lulu_catalog WHERE embed_url IS NOT NULL AND embed_url != ''`,
    );
    res.json({
      catalog: r1.rows,
      episodes: r2.rows,
      withEmbed: parseInt(r3.rows[0]?.total || 0),
    });
  } catch (e) {
    console.error("[Lulu] stats error:", e.message);
    res.status(500).json({ error: "فشل جلب الإحصائيات" });
  }
});

module.exports = router;
