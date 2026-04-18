/**
 * FFmpeg Re-streaming Server
 * 
 * الحل الجذري للتقطيع:
 * - اتصال واحد بـ IPTV
 * - إعادة تغليف محلية
 * - بث HLS من السيرفر
 * - لا ضغط على IPTV
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class FFmpegRestreamer {
  constructor() {
    // streamId → { process, viewers, startTime, hlsPath }
    this.activeStreams = new Map();
    this.hlsDir = path.join(__dirname, '../hls');
    this.ensureHlsDir();
  }

  ensureHlsDir() {
    if (!fs.existsSync(this.hlsDir)) {
      fs.mkdirSync(this.hlsDir, { recursive: true });
    }
  }

  // بدء إعادة البث لقناة
  async startRestream(streamId, iptvUrl, credentials) {
    if (this.activeStreams.has(streamId)) {
      // القناة تعمل بالفعل - زيادة عدد المشاهدين
      const stream = this.activeStreams.get(streamId);
      stream.viewers++;
      return stream.hlsPath;
    }

    console.log(`[FFmpeg] Starting restream for channel ${streamId}`);

    const streamDir = path.join(this.hlsDir, `stream_${streamId}`);
    if (!fs.existsSync(streamDir)) {
      fs.mkdirSync(streamDir, { recursive: true });
    }

    const playlistPath = path.join(streamDir, 'playlist.m3u8');
    const segmentPattern = path.join(streamDir, 'segment_%03d.ts');

    // بناء URL مع credentials
    const { user, pass, baseUrl } = credentials;
    const fullUrl = `${baseUrl}/live/${user}/${pass}/${streamId}.m3u8`;

    // FFmpeg command للتحويل
    const ffmpegArgs = [
      '-i', fullUrl,
      '-c', 'copy',                    // نسخ بدون إعادة ترميز (سريع)
      '-f', 'hls',                     // تنسيق HLS
      '-hls_time', '6',                // مدة كل segment (6 ثواني)
      '-hls_list_size', '10',          // عدد segments في playlist
      '-hls_flags', 'delete_segments', // حذف segments القديمة
      '-hls_segment_filename', segmentPattern,
      '-y',                            // استبدال الملفات الموجودة
      playlistPath
    ];

    const ffmpegProcess = spawn('ffmpeg', ffmpegArgs, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // معالجة الأخطاء
    ffmpegProcess.on('error', (error) => {
      console.error(`[FFmpeg] Error for stream ${streamId}:`, error.message);
      this.stopRestream(streamId);
    });

    ffmpegProcess.on('exit', (code) => {
      console.log(`[FFmpeg] Stream ${streamId} exited with code ${code}`);
      this.stopRestream(streamId);
    });

    // تسجيل الـ stream
    this.activeStreams.set(streamId, {
      process: ffmpegProcess,
      viewers: 1,
      startTime: Date.now(),
      hlsPath: `/hls/stream_${streamId}/playlist.m3u8`,
      streamDir: streamDir
    });

    // انتظار بدء التشغيل (3 ثواني)
    await this.waitForPlaylist(playlistPath);

    return `/hls/stream_${streamId}/playlist.m3u8`;
  }

  // إيقاف إعادة البث
  stopRestream(streamId) {
    const stream = this.activeStreams.get(streamId);
    if (!stream) return;

    stream.viewers--;

    // إذا لا يوجد مشاهدين، أوقف FFmpeg
    if (stream.viewers <= 0) {
      console.log(`[FFmpeg] Stopping restream for channel ${streamId}`);
      
      if (stream.process && !stream.process.killed) {
        stream.process.kill('SIGTERM');
      }

      // حذف ملفات HLS
      setTimeout(() => {
        this.cleanupStreamDir(stream.streamDir);
      }, 30000); // انتظار 30 ثانية قبل الحذف

      this.activeStreams.delete(streamId);
    }
  }

  // انتظار إنشاء playlist
  async waitForPlaylist(playlistPath, maxWait = 10000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWait) {
      if (fs.existsSync(playlistPath)) {
        // تحقق من وجود segments
        const content = fs.readFileSync(playlistPath, 'utf8');
        if (content.includes('.ts')) {
          return true;
        }
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    throw new Error('Playlist not ready within timeout');
  }

  // تنظيف مجلد الـ stream
  cleanupStreamDir(streamDir) {
    try {
      if (fs.existsSync(streamDir)) {
        const files = fs.readdirSync(streamDir);
        for (const file of files) {
          fs.unlinkSync(path.join(streamDir, file));
        }
        fs.rmdirSync(streamDir);
      }
    } catch (error) {
      console.error(`[FFmpeg] Cleanup error:`, error.message);
    }
  }

  // إحصائيات
  getStats() {
    const stats = {};
    for (const [streamId, stream] of this.activeStreams) {
      stats[streamId] = {
        viewers: stream.viewers,
        uptime: Date.now() - stream.startTime,
        hlsPath: stream.hlsPath
      };
    }
    return stats;
  }

  // إيقاف كل الـ streams
  stopAll() {
    for (const [streamId] of this.activeStreams) {
      const stream = this.activeStreams.get(streamId);
      if (stream.process && !stream.process.killed) {
        stream.process.kill('SIGTERM');
      }
    }
    this.activeStreams.clear();
  }
}

module.exports = new FFmpegRestreamer();