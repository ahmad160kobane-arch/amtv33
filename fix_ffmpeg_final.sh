#!/bin/bash

echo "🔧 إصلاح FFmpeg النهائي..."

cat > /root/ma-streaming/cloud-server/lib/ffmpeg-restreamer-working.js << 'ENDOFFILE'
/**
 * FFmpeg Working Restreamer - النسخة النهائية المحسنة
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class FFmpegWorkingRestreamer {
  constructor() {
    this.activeStreams = new Map();
    this.hlsDir = path.join(__dirname, '../hls');
    this.ffmpegPath = '/usr/bin/ffmpeg';
    this.ensureHlsDir();
    
    console.log(`[FFmpeg-Working] 🚀 Initialized`);
    console.log(`[FFmpeg-Working] 📁 HLS: ${this.hlsDir}`);
  }

  ensureHlsDir() {
    if (!fs.existsSync(this.hlsDir)) {
      fs.mkdirSync(this.hlsDir, { recursive: true });
    }
  }

  async startRestream(streamId, iptvUrl, credentials) {
    if (this.activeStreams.has(streamId)) {
      const stream = this.activeStreams.get(streamId);
      stream.viewers++;
      console.log(`[FFmpeg-Working] 👥 Channel ${streamId} viewers: ${stream.viewers}`);
      return stream.hlsPath;
    }

    console.log(`[FFmpeg-Working] 🎬 Starting stream ${streamId}`);
    console.log(`[FFmpeg-Working] 📡 URL: ${iptvUrl}`);

    const streamDir = path.join(this.hlsDir, `stream_${streamId}`);
    if (!fs.existsSync(streamDir)) {
      fs.mkdirSync(streamDir, { recursive: true });
    }

    const playlistPath = path.join(streamDir, 'playlist.m3u8');
    const segmentPattern = path.join(streamDir, 'segment_%03d.ts');

    // FFmpeg arguments محسنة مع معالجة أخطاء الشبكة
    const ffmpegArgs = [
      '-hide_banner',
      '-loglevel', 'warning',
      
      // إعدادات الشبكة المحسنة
      '-reconnect', '1',
      '-reconnect_streamed', '1',
      '-reconnect_delay_max', '5',
      '-timeout', '10000000',        // 10 ثواني timeout
      '-user_agent', 'Mozilla/5.0',
      
      // إعدادات الإدخال
      '-fflags', '+genpts+discardcorrupt',
      '-i', iptvUrl,
      
      // إعدادات الترميز
      '-c:v', 'copy',
      '-c:a', 'copy',
      '-bsf:a', 'aac_adtstoasc',
      '-avoid_negative_ts', 'make_zero',
      '-copyts',
      
      // إعدادات HLS محسنة
      '-f', 'hls',
      '-hls_time', '6',
      '-hls_list_size', '10',
      '-hls_flags', 'delete_segments+append_list+omit_endlist',
      '-hls_segment_type', 'mpegts',
      '-hls_segment_filename', segmentPattern,
      '-start_number', '0',
      
      '-y',
      playlistPath
    ];

    console.log(`[FFmpeg-Working] 🎯 Starting FFmpeg...`);

    const ffmpegProcess = spawn(this.ffmpegPath, ffmpegArgs, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let errorOutput = '';

    ffmpegProcess.stderr.on('data', (data) => {
      const msg = data.toString();
      errorOutput += msg;
      
      // عرض الأخطاء المهمة فقط
      if (msg.includes('Error') || msg.includes('Failed') || msg.includes('Invalid')) {
        console.error(`[FFmpeg-Working] ⚠️ ${streamId}: ${msg.trim()}`);
      }
    });

    ffmpegProcess.stdout.on('data', (data) => {
      // معلومات إضافية إذا لزم الأمر
    });

    ffmpegProcess.on('error', (error) => {
      console.error(`[FFmpeg-Working] ❌ Process error ${streamId}:`, error.message);
      console.error(`[FFmpeg-Working] Error output: ${errorOutput}`);
      this.stopRestream(streamId);
    });

    ffmpegProcess.on('exit', (code, signal) => {
      if (code !== 0 && code !== null) {
        console.error(`[FFmpeg-Working] ❌ Stream ${streamId} failed with code ${code}`);
        console.error(`[FFmpeg-Working] Last error: ${errorOutput.slice(-500)}`);
      } else {
        console.log(`[FFmpeg-Working] 🔚 Stream ${streamId} ended normally`);
      }
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

    // انتظار بدء التشغيل مع timeout أطول
    try {
      await this.waitForPlaylist(playlistPath, 30000);
      console.log(`[FFmpeg-Working] ✅ Stream ${streamId} ready!`);
      return `/hls/stream_${streamId}/playlist.m3u8`;
    } catch (error) {
      console.error(`[FFmpeg-Working] ❌ Failed ${streamId}:`, error.message);
      console.error(`[FFmpeg-Working] FFmpeg output: ${errorOutput}`);
      this.stopRestream(streamId);
      throw new Error(`FFmpeg failed: ${error.message}. Check IPTV URL and credentials.`);
    }
  }

  stopRestream(streamId) {
    const stream = this.activeStreams.get(streamId);
    if (!stream) return;

    stream.viewers--;
    if (stream.viewers <= 0) {
      console.log(`[FFmpeg-Working] 🛑 Stopping ${streamId}`);
      
      if (stream.process && !stream.process.killed) {
        stream.process.kill('SIGTERM');
        
        setTimeout(() => {
          if (stream.process && !stream.process.killed) {
            stream.process.kill('SIGKILL');
          }
        }, 5000);
      }

      setTimeout(() => {
        this.cleanupStreamDir(stream.streamDir);
      }, 30000);

      this.activeStreams.delete(streamId);
    }
  }

  async waitForPlaylist(playlistPath, maxWait = 30000) {
    const startTime = Date.now();
    let lastSegmentCount = 0;
    
    console.log(`[FFmpeg-Working] ⏳ Waiting for playlist...`);
    
    while (Date.now() - startTime < maxWait) {
      if (fs.existsSync(playlistPath)) {
        try {
          const content = fs.readFileSync(playlistPath, 'utf8');
          const segments = (content.match(/\.ts/g) || []).length;
          
          if (segments > lastSegmentCount) {
            lastSegmentCount = segments;
            console.log(`[FFmpeg-Working] 📺 Segments: ${segments}`);
          }
          
          // نحتاج segment واحد على الأقل
          if (segments >= 1 && content.includes('#EXTINF')) {
            console.log(`[FFmpeg-Working] ✅ Playlist ready with ${segments} segments`);
            return true;
          }
        } catch (e) {
          // ملف قيد الكتابة
        }
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error(`Playlist not ready within ${maxWait}ms`);
  }

  cleanupStreamDir(streamDir) {
    try {
      if (fs.existsSync(streamDir)) {
        const files = fs.readdirSync(streamDir);
        files.forEach(file => {
          try {
            fs.unlinkSync(path.join(streamDir, file));
          } catch (e) {}
        });
        fs.rmdirSync(streamDir);
        console.log(`[FFmpeg-Working] 🧹 Cleaned ${streamDir}`);
      }
    } catch (error) {
      console.error(`[FFmpeg-Working] Cleanup error:`, error.message);
    }
  }

  getStats() {
    const stats = {};
    for (const [streamId, stream] of this.activeStreams) {
      stats[streamId] = {
        viewers: stream.viewers,
        uptime: Math.round((Date.now() - stream.startTime) / 1000),
        hlsPath: stream.hlsPath,
        status: stream.process && !stream.process.killed ? 'running' : 'stopped'
      };
    }
    return {
      totalStreams: this.activeStreams.size,
      ffmpegPath: this.ffmpegPath,
      streams: stats
    };
  }

  stopAll() {
    console.log(`[FFmpeg-Working] 🛑 Stopping all ${this.activeStreams.size} streams`);
    for (const [streamId] of this.activeStreams) {
      const stream = this.activeStreams.get(streamId);
      if (stream.process && !stream.process.killed) {
        stream.process.kill('SIGTERM');
      }
    }
    this.activeStreams.clear();
  }
}

module.exports = new FFmpegWorkingRestreamer();
ENDOFFILE

echo "✅ تم تحديث FFmpeg Restreamer"

# إعادة تشغيل الخادم
cd /root/ma-streaming/cloud-server
pm2 restart cloud-server

echo "🎉 تم الإصلاح!"

# اختبار بعد 5 ثواني
sleep 5
echo ""
echo "🧪 اختبار النظام..."
curl -s "http://localhost:8090/api/xtream/stream/1017030" | grep -o '"type":"[^"]*"'

# فحص العمليات
sleep 10
echo ""
echo "🔍 فحص عمليات FFmpeg..."
ps aux | grep ffmpeg | grep -v grep | wc -l
echo "عدد عمليات FFmpeg النشطة"

# فحص الملفات
echo ""
echo "📁 فحص ملفات HLS..."
ls -lh /root/ma-streaming/cloud-server/hls/stream_1017030/ 2>/dev/null | tail -5 || echo "لا توجد ملفات بعد"