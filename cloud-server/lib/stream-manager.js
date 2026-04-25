/**
 * StreamManager — Clean IPTV → HLS bridge (v2)
 *
 * Design:
 *   • One FFmpeg process per channel (not per viewer).
 *   • Uses Xtream `.ts` endpoint → single long-lived TCP connection = most natural
 *     request pattern (same as VLC). IPTV provider sees 1 connection → no ban risk.
 *   • FFmpeg remuxes MPEG-TS → HLS on disk with `copy` codec (zero CPU overhead).
 *   • All viewers (up to 150/channel) fetch the same HLS files from disk via
 *     Express static — trivial load, no upstream amplification.
 *   • Auto-start on first viewer, auto-stop N seconds after last viewer.
 *   • Auto-reconnect on unexpected FFmpeg exit (bounded retry with backoff).
 *
 * Public API (stable — do not break without updating server.js):
 *   requestStream(streamId, type, sourceUrl, name)  → { success, hlsUrl, ready, waiting }
 *   releaseStream(streamId)
 *   isReady(streamId, type)                         → boolean
 *   getStreamInfo(streamId)                         → object|null
 *   getActiveStreams()                              → array
 *   stopStream(streamId) / stopAll()
 *   probeSubtitles(sourceUrl)                       → array
 *   seekVodStream(streamId, sec)                    → { success, ... }
 */

const { spawn, execFile } = require('child_process');
const path = require('path');
const fs   = require('fs');
const config = require('../config');

// ── Tunables ─────────────────────────────────────────────────
const MAX_CONCURRENT      = 100;   // max simultaneous channels (FFmpeg procs)
const LIVE_HLS_TIME       = 2;     // segment duration (s) — 2s = smaller downloads, vital for 4G
const LIVE_HLS_LIST_SIZE  = 12;    // keep 12 segments in playlist (~24s window)
const LIVE_HLS_DELETE_TH  = 6;     // delete segments 6+ beyond list (extra headroom for slow clients)
const RESTART_MAX         = 5;     // max auto-restarts on unexpected exit
const RESTART_BACKOFF_MS  = 2000;  // base delay between restarts
const UA                  = 'VLC/3.0.20 LibVLC/3.0.20';
const MIN_READY_SEGMENTS  = Math.max(0, config.MIN_SEGMENTS_READY || 0); // تغيير من 1 إلى 0 للبث الفوري

// Convert Xtream `/live/user/pass/ID.m3u8` → `.ts` (long-lived TCP endpoint).
// This is the single most important design choice: one natural connection per
// channel, no manifest polling, no token rotation, cannot trigger rate limits.
function toTsEndpoint(url) {
  if (!url || typeof url !== 'string') return url;
  // Only transform Xtream live URLs; leave query strings / other providers alone.
  if (url.includes('/live/') && /\.m3u8(?:$|\?)/i.test(url)) {
    return url.replace(/\.m3u8(\?|$)/i, '.ts$1');
  }
  return url;
}

class StreamManager {
  constructor() {
    // streamId → {
    //   process, sourceUrl, name, type, startTime, viewers, lastAccess,
    //   idleTimer, restartCount, pending, completed, stderrTail, seekOffset
    // }
    this.streams = new Map();
    this._monitor = null;
  }

  start() {
    this._monitor = setInterval(() => this._healthCheck(), 10_000);
    console.log('[StreamManager] ready — 1 FFmpeg/channel, .ts upstream, disk HLS');
  }

  stop() {
    if (this._monitor) clearInterval(this._monitor);
    for (const [id] of this.streams) this._kill(id, 'server stop');
    console.log('[StreamManager] stopped');
  }

  // ─────────────────────────────────────────────────────────
  // PUBLIC: requestStream
  // Adds a viewer to an existing stream or starts a new one.
  // ─────────────────────────────────────────────────────────
  async requestStream(streamId, type, sourceUrl, name = 'Unknown') {
    type = type === 'vod' ? 'vod' : 'live';
    const info = this.streams.get(streamId);

    // Hot path: stream already running or starting
    if (info) {
      info.viewers++;
      info.lastAccess = Date.now();
      if (info.idleTimer) { clearTimeout(info.idleTimer); info.idleTimer = null; }
      return {
        success: true,
        hlsUrl : this._hlsUrl(streamId, type),
        ready  : this.isReady(streamId, type),
        waiting: !this.isReady(streamId, type),
      };
    }

    if (!sourceUrl) return { success: false, error: 'sourceUrl required' };

    // Enforce concurrency cap — evict least-recently-accessed non-permanent channel.
    if (this.streams.size >= MAX_CONCURRENT) {
      const oldest = [...this.streams.entries()]
        .filter(([, s]) => !s.completed && !s.permanent)
        .sort((a, b) => a[1].lastAccess - b[1].lastAccess)[0];
      if (oldest) {
        console.log(`[Stream] LRU evict: ${oldest[1].name}`);
        this._kill(oldest[0], 'LRU');
        await sleep(300);
      }
    }

    const upstream = type === 'live' ? toTsEndpoint(sourceUrl) : sourceUrl;
    const spawned  = type === 'live'
      ? this._startLive(streamId, upstream, sourceUrl, name)
      : this._startVod(streamId, upstream, name, 0);

    if (!spawned.success) return spawned;

    const s = this.streams.get(streamId);
    if (s) s.viewers = 1;
    return {
      success: true,
      hlsUrl : this._hlsUrl(streamId, type),
      ready  : false,
      waiting: true,
    };
  }

  // ─────────────────────────────────────────────────────────
  // PUBLIC: releaseStream — viewer disconnected
  // ─────────────────────────────────────────────────────────
  releaseStream(streamId) {
    const info = this.streams.get(streamId);
    if (!info) return;
    info.viewers = Math.max(0, info.viewers - 1);
    info.lastAccess = Date.now();

    if (info.viewers === 0) {
      // VOD that finished processing: clean up immediately.
      if (info.completed) {
        this.streams.delete(streamId);
        this._wipeHlsDir(streamId, info.type);
        return;
      }
      // Permanent (always-on) streams never idle-shutdown.
      if (info.permanent) return;
      // Schedule idle shutdown.
      info.idleTimer = setTimeout(() => {
        const cur = this.streams.get(streamId);
        if (cur && cur.viewers === 0) this._kill(streamId, 'idle');
      }, config.IDLE_TIMEOUT || 60_000);
    }
  }

  // ─────────────────────────────────────────────────────────
  // LIVE: spawn FFmpeg reading Xtream .ts endpoint
  // ─────────────────────────────────────────────────────────
  _startLive(streamId, upstream, originalSource, name) {
    const dir = path.join(config.HLS_DIR, streamId);
    this._prepareDir(dir);

    const cmd = [
      '-y', '-hide_banner', '-loglevel', 'warning',
      // Natural client headers
      '-user_agent', UA,
      // TCP-stream input tuning
      '-fflags', 'nobuffer+genpts+discardcorrupt',
      '-flags', 'low_delay',
      '-analyzeduration', '2000000',
      '-probesize', '2000000',
      // Resilient upstream (FFmpeg follows 3xx on http input by default)
      '-reconnect', '1',
      '-reconnect_streamed', '1',
      '-reconnect_at_eof', '1',
      '-reconnect_on_network_error', '1',
      '-reconnect_delay_max', '5',
      '-rw_timeout', '15000000',   // 15s I/O timeout per read
      '-i', upstream,
      // Zero-CPU remux to HLS
      '-map', '0:v:0?', '-map', '0:a:0?',
      '-c:v', 'copy',
      '-c:a', 'copy',
      '-f', 'hls',
      '-hls_time', String(LIVE_HLS_TIME),
      '-hls_list_size', String(LIVE_HLS_LIST_SIZE),
      '-hls_flags', 'delete_segments+independent_segments+omit_endlist',
      '-hls_delete_threshold', String(LIVE_HLS_DELETE_TH),
      '-hls_segment_type', 'mpegts',
      '-hls_segment_filename', path.join(dir, 'seg_%d.ts'),
      '-hls_allow_cache', '0',
      '-hls_start_number_source', 'epoch',
      path.join(dir, 'stream.m3u8'),
    ];

    return this._spawn(streamId, name, 'live', originalSource, cmd);
  }

  // ─────────────────────────────────────────────────────────
  // VOD: HLS remux from movie/episode source (seekable)
  // ─────────────────────────────────────────────────────────
  _startVod(streamId, upstream, name, seekSec = 0) {
    const dir = path.join(config.HLS_DIR, 'vod', streamId);
    this._prepareDir(dir);

    const cmd = [
      '-y', '-hide_banner', '-loglevel', 'warning',
      '-user_agent', UA,
      '-reconnect', '1',
      '-reconnect_streamed', '1',
      '-reconnect_on_network_error', '1',
      '-reconnect_delay_max', '5',
      '-rw_timeout', '15000000',
      '-analyzeduration', '10000000',
      '-probesize', '10000000',
    ];
    if (seekSec > 0) cmd.push('-ss', String(seekSec));

    cmd.push(
      '-i', upstream,
      '-map', '0:v:0', '-map', '0:a:0?',
      '-c:v', 'copy',
      '-c:a', 'aac', '-b:a', '128k', '-ac', '2',
      '-f', 'hls',
      '-hls_time', '10',
      '-hls_list_size', '0',
      '-hls_playlist_type', 'event',
      '-hls_flags', 'independent_segments+append_list',
      '-hls_segment_type', 'mpegts',
      '-hls_segment_filename', path.join(dir, 'seg_%d.ts'),
      path.join(dir, 'stream.m3u8'),
    );

    const out = this._spawn(streamId, name, 'vod', upstream, cmd);
    if (out.success) {
      const s = this.streams.get(streamId);
      if (s) s.seekOffset = seekSec;
    }
    return out;
  }

  async seekVodStream(streamId, positionSec) {
    const info = this.streams.get(streamId);
    if (!info || info.type !== 'vod') return { success: false, error: 'no active VOD' };
    const { sourceUrl, name, viewers } = info;
    try { info.process && info.process.kill('SIGTERM'); } catch {}
    if (info.idleTimer) clearTimeout(info.idleTimer);
    this.streams.delete(streamId);
    this._wipeHlsDir(streamId, 'vod');
    await sleep(400);
    const res = this._startVod(streamId, sourceUrl, name, positionSec);
    if (res.success) {
      const s = this.streams.get(streamId);
      if (s) s.viewers = viewers;
    }
    return res;
  }

  // ─────────────────────────────────────────────────────────
  // Core spawn — shared by live + VOD
  // ─────────────────────────────────────────────────────────
  _spawn(streamId, name, type, sourceUrl, cmd) {
    let proc;
    try {
      proc = spawn(config.FFMPEG_PATH, cmd, { stdio: ['ignore', 'ignore', 'pipe'] });
    } catch (e) {
      console.error(`[Stream] spawn failed ${name}: ${e.message}`);
      return { success: false, error: e.message };
    }

    let stderrTail = '';
    proc.stderr.on('data', (d) => {
      const s = d.toString();
      stderrTail = (stderrTail + s).slice(-4000);
      // Surface first-chance errors promptly (helps diagnosing upstream issues).
      const low = s.toLowerCase();
      if (low.includes('error') || low.includes('failed') || low.includes('403') ||
          low.includes('401') || low.includes('502') || low.includes('511')) {
        console.error(`[FFmpeg:${name}] ${s.trim().slice(0, 240)}`);
      }
    });

    proc.on('exit', (code) => {
      const info = this.streams.get(streamId);
      console.log(`[Stream] ${name} exit code=${code}`);
      if (info && info.idleTimer) clearTimeout(info.idleTimer);

      // VOD successful completion: preserve HLS for viewers.
      if (type === 'vod' && code === 0 && info) {
        info.completed = true;
        info.process = null;
        return;
      }

      // Unexpected exit with active viewers OR permanent streams → bounded auto-restart.
      const shouldRestart =
        type === 'live' &&
        info &&
        (info.viewers > 0 || info.permanent) &&
        !info._shutdown &&
        (info.restartCount || 0) < RESTART_MAX;

      // Clear state either way (restart will re-add).
      this.streams.delete(streamId);
      this._wipeHlsDir(streamId, type);

      if (shouldRestart) {
        const attempt = (info.restartCount || 0) + 1;
        const delay = RESTART_BACKOFF_MS * attempt;
        console.log(`[Stream] restart ${name} in ${delay}ms (${attempt}/${RESTART_MAX})`);
        setTimeout(() => {
          // Always rebuild upstream from ORIGINAL sourceUrl so any new IPTV
          // session token is reissued by the provider on the fresh request.
          const upstream = toTsEndpoint(info.sourceUrl);
          const res = this._startLive(streamId, upstream, info.sourceUrl, name);
          if (res.success) {
            const ns = this.streams.get(streamId);
            if (ns) {
              ns.viewers = info.viewers;
              ns.restartCount = attempt;
              if (info.permanent) ns.permanent = true;
            }
          }
        }, delay);
      } else if (code !== 0) {
        console.error(`[Stream] ${name} failed — last stderr:\n${stderrTail.slice(-500)}`);
      }
    });

    proc.on('error', (e) => console.error(`[Stream] ${name} proc err: ${e.message}`));

    this.streams.set(streamId, {
      process: proc,
      sourceUrl,          // ORIGINAL (pre-`.ts`) — used for restart rebuild
      name,
      type,
      startTime: Date.now(),
      viewers: 0,
      lastAccess: Date.now(),
      idleTimer: null,
      restartCount: 0,
      completed: false,
      _shutdown: false,
      stderrTail: () => stderrTail,
    });

    console.log(`[Stream] ▶ ${type} ${name}`);
    return { success: true };
  }

  // ─────────────────────────────────────────────────────────
  // Teardown
  // ─────────────────────────────────────────────────────────
  _kill(streamId, reason = '') {
    const info = this.streams.get(streamId);
    if (!info) return;
    info._shutdown = true;
    if (info.idleTimer) clearTimeout(info.idleTimer);
    if (info.process) { try { info.process.kill('SIGTERM'); } catch {} }
    this.streams.delete(streamId);
    this._wipeHlsDir(streamId, info.type);
    console.log(`[Stream] ⏹ ${info.name}${reason ? ` (${reason})` : ''}`);
  }

  stopStream(streamId) {
    if (!this.streams.has(streamId)) return { success: false, error: 'not running' };
    this._kill(streamId, 'manual');
    return { success: true };
  }

  stopAll() {
    let n = 0;
    for (const [id] of this.streams) { this._kill(id, 'stopAll'); n++; }
    return { stopped: n };
  }

  // ─────────────────────────────────────────────────────────
  // Status helpers
  // ─────────────────────────────────────────────────────────
  isReady(streamId, type) {
    const info = this.streams.get(streamId);
    const t = type || (info ? info.type : 'live');
    const dir = t === 'vod'
      ? path.join(config.HLS_DIR, 'vod', streamId)
      : path.join(config.HLS_DIR, streamId);
    const m3u8 = path.join(dir, 'stream.m3u8');
    if (!fs.existsSync(m3u8)) return false;
    try {
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts'));
      return files.length >= MIN_READY_SEGMENTS;
    } catch { return false; }
  }

  getStreamInfo(streamId) {
    const info = this.streams.get(streamId);
    if (!info) return null;
    return {
      name: info.name,
      type: info.type,
      viewers: info.viewers,
      uptime: Math.floor((Date.now() - info.startTime) / 1000),
      ready: this.isReady(streamId, info.type),
      completed: !!info.completed,
      restartCount: info.restartCount || 0,
    };
  }

  getActiveStreams() {
    const out = [];
    for (const [id, info] of this.streams) {
      out.push({
        id,
        name: info.name,
        type: info.type,
        viewers: info.viewers,
        uptime: Math.floor((Date.now() - info.startTime) / 1000),
        ready: this.isReady(id, info.type),
      });
    }
    return out;
  }

  _hlsUrl(streamId, type) {
    return type === 'vod'
      ? `/hls/vod/${streamId}/stream.m3u8`
      : `/hls/${streamId}/stream.m3u8`;
  }

  _prepareDir(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    fs.mkdirSync(dir, { recursive: true });
  }

  _wipeHlsDir(streamId, type) {
    const dir = type === 'vod'
      ? path.join(config.HLS_DIR, 'vod', streamId)
      : path.join(config.HLS_DIR, streamId);
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  }

  _healthCheck() {
    for (const [id, info] of this.streams) {
      if (info.completed || !info.process) continue;
      try { process.kill(info.process.pid, 0); }
      catch {
        console.log(`[Stream] ${info.name} process gone — cleaning`);
        if (info.idleTimer) clearTimeout(info.idleTimer);
        this.streams.delete(id);
        this._wipeHlsDir(id, info.type); // Remove stale segments so isReady() won't return true
      }
    }
  }

  // ─────────────────────────────────────────────────────────
  // Always-on: mark a running stream as permanent (never idle-killed)
  // ─────────────────────────────────────────────────────────
  markPermanent(streamId) {
    const info = this.streams.get(streamId);
    if (!info) return false;
    info.permanent = true;
    if (info.idleTimer) { clearTimeout(info.idleTimer); info.idleTimer = null; }
    return true;
  }

  // ─────────────────────────────────────────────────────────
  // ffprobe helper — list embedded subtitle tracks
  // ─────────────────────────────────────────────────────────
  probeSubtitles(sourceUrl) {
    return new Promise((resolve) => {
      const ffprobe = (config.FFPROBE_PATH) ||
                      (config.FFMPEG_PATH || 'ffmpeg').replace(/ffmpeg(\.exe)?$/i, 'ffprobe$1');
      execFile(ffprobe, [
        '-v', 'quiet', '-print_format', 'json',
        '-show_streams', '-select_streams', 's',
        '-user_agent', UA,
        sourceUrl,
      ], { timeout: 15_000 }, (err, stdout) => {
        if (err) return resolve([]);
        try {
          const data = JSON.parse(stdout);
          resolve((data.streams || []).map(s => ({
            index   : s.index,
            language: (s.tags && s.tags.language) || 'und',
            title   : (s.tags && s.tags.title) || '',
            codec   : s.codec_name,
          })));
        } catch { resolve([]); }
      });
    });
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = StreamManager;
