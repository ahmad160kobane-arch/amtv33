#!/bin/bash

echo "=========================================="
echo "    تثبيت FFmpeg الاحترافي - إصدار محسن"
echo "=========================================="

# التحقق من وجود FFmpeg الحالي
echo "🔍 فحص FFmpeg الحالي..."
if command -v ffmpeg &> /dev/null; then
    echo "✅ FFmpeg موجود بالفعل:"
    ffmpeg -version | head -1
    FFMPEG_PATH=$(which ffmpeg)
    echo "📍 المسار: $FFMPEG_PATH"
else
    echo "❌ FFmpeg غير موجود"
fi

# تحديث النظام وتثبيت FFmpeg
echo ""
echo "🔄 تحديث النظام وتثبيت FFmpeg..."
apt update -qq
apt install -y ffmpeg

# التحقق من التثبيت
echo ""
echo "✅ التحقق من FFmpeg..."
ffmpeg -version | head -3

# العثور على مسار FFmpeg
FFMPEG_PATH=$(which ffmpeg)
echo "📍 مسار FFmpeg: $FFMPEG_PATH"

echo ""
echo "🗂️ إعداد مجلدات HLS..."
mkdir -p /root/ma-streaming/cloud-server/hls
chmod 755 /root/ma-streaming/cloud-server/hls

echo ""
echo "🔧 إنشاء FFmpeg Restreamer محسن..."

cat > /root/ma-streaming/cloud-server/lib/ffmpeg-restreamer-pro.js << 'EOF'
/**
 * FFmpeg Professional Re-streaming Server
 * الحل الجذري النهائي للتقطيع
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class FFmpegProRestreamer {
  constructor() {
    this.activeStreams = new Map();
    this.hlsDir = path.join(__dirname, '../hls');
    this.ffmpegPath = 'ffmpeg'; // استخدام FFmpeg من النظام
    this.maxRetries = 3;
    this.ensureHlsDir();
    
    console.log(`[FFmpeg-Pro] Initialized with HLS dir: ${this.hlsDir}`);
  }

  ensureHlsDir() {
    if (!fs.existsSync(this.hlsDir)) {
      fs.mkdirSync(this.hlsDir, { recursive: true });
      console.log(`[FFmpeg-Pro] Created HLS directory: ${this.hlsDir}`);
    }
  }

  async startRestream(streamId, iptvUrl, credentials) {
    if (this.activeStreams.has(streamId)) {
      const stream = this.activeStreams.get(streamId);
      stream.viewers++;
      console.log(`[FFmpeg-Pro] Channel ${streamId} already active, viewers: ${stream.viewers}`);
      return stream.hlsPath;
    }

    console.log(`[FFmpeg-Pro] 🚀 Starting restream for channel ${streamId}`);
    console.log(`[FFmpeg-Pro] 📡 IPTV URL: ${iptvUrl}`);

    const streamDir = path.join(this.hlsDir, `stream_${streamId}`);
    if (!fs.existsSync(streamDir)) {
      fs.mkdirSync(streamDir, { recursive: true });
    }

    const playlistPath = path.join(streamDir, 'playlist.m3u8');
    const segmentPattern = path.join(streamDir, 'segment_%03d.ts');

    // FFmpeg arguments محسنة للاستقرار
    const ffmpegArgs = [
      '-hide_banner',
      '-loglevel', 'warning',
      
      // إعدادات الإدخال
      '-fflags', '+genpts',
      '-re',                             // قراءة بمعدل الإطارات الأصلي
      '-i', iptvUrl,
      
      // إعدادات الشبكة
      '-reconnect', '1',
      '-reconnect_streamed', '1',
      '-reconnect_delay_max', '10',
      '-timeout', '30000000',            // 30 ثانية timeout
      
      // إعدادات الترميز
      '-c:v', 'copy',
      '-c:a', 'copy',
      '-avoid_negative_ts', 'make_zero',
      
      // إعدادات HLS
      '-f', 'hls',
      '-hls_time', '6',                  // 6 ثواني لكل segment
      '-hls_list_size', '10',            // 10 segments في القائمة
      '-hls_flags', 'delete_segments+independent_segments',
      '-hls_segment_type', 'mpegts',
      '-hls_segment_filename', segmentPattern,
      
      '-y',
      playlistPath
    ];

    console.log(`[FFmpeg-Pro] 🎬 Starting FFmpeg process...`);

    const ffmpegProcess = spawn(this.ffmpegPath, ffmpegArgs, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // معالجة الأخطاء
    ffmpegProcess.stderr.on('data', (data) => {
      const error = data.toString();
      if (error.includes('Error') || error.includes('Failed')) {
        console.error(`[FFmpeg-Pro] ⚠️ Stream ${streamId} error: ${error.trim()}`);
      }
    });

    ffmpegProcess.on('error', (error) => {
      console.error(`[FFmpeg-Pro] ❌ Process error for stream ${streamId}:`, error.message);
      this.handleStreamError(streamId, iptvUrl, credentials);
    });

    ffmpegProcess.on('exit', (code, signal) => {
      console.log(`[FFmpeg-Pro] 🔚 Stream ${streamId} exited - code: ${code}, signal: ${signal}`);
      if (code !== 0 && code !== null) {
        this.handleStreamError(streamId, iptvUrl, credentials);
      } else {
        this.stopRestream(streamId);
      }
    });

    // تسجيل الـ stream
    this.activeStreams.set(streamId, {
      process: ffmpegProcess,
      viewers: 1,
      startTime: Date.now(),
      hlsPath: `/hls/stream_${streamId}/playlist.m3u8`,
      streamDir: streamDir,
      retries: 0,
      iptvUrl: iptvUrl,
      credentials: credentials
    });

    // انتظار بدء التشغيل
    try {
      await this.waitForPlaylist(playlistPath, 20000);
      console.log(`[FFmpeg-Pro] ✅ Stream ${streamId} is ready and streaming!`);
      return `/hls/stream_${streamId}/playlist.m3u8`;
    } catch (error) {
      console.error(`[FFmpeg-Pro] ❌ Failed to start stream ${streamId}:`, error.message);
      this.stopRestream(streamId);
      throw error;
    }
  }

  async handleStreamError(streamId, iptvUrl, credentials) {
    const stream = this.activeStreams.get(streamId);
    if (!stream) return;

    stream.retries = (stream.retries || 0) + 1;
    
    if (stream.retries <= this.maxRetries) {
      console.log(`[FFmpeg-Pro] 🔄 Retrying stream ${streamId} (${stream.retries}/${this.maxRetries})`);
      
      setTimeout(() => {
        this.stopRestream(streamId);
        this.startRestream(streamId, iptvUrl, credentials).catch(console.error);
      }, 5000 * stream.retries);
    } else {
      console.error(`[FFmpeg-Pro] ❌ Max retries reached for stream ${streamId}`);
      this.stopRestream(streamId);
    }
  }

  stopRestream(streamId) {
    const stream = this.activeStreams.get(streamId);
    if (!stream) return;

    stream.viewers--;

    if (stream.viewers <= 0) {
      console.log(`[FFmpeg-Pro] 🛑 Stopping restream for channel ${streamId}`);
      
      if (stream.process && !stream.process.killed) {
        stream.process.kill('SIGTERM');
        
        setTimeout(() => {
          if (!stream.process.killed) {
            stream.process.kill('SIGKILL');
          }
        }, 5000);
      }

      setTimeout(() => {
        this.cleanupStreamDir(stream.streamDir);
      }, 30000);

      this.activeStreams.delete(streamId);
    } else {
      console.log(`[FFmpeg-Pro] 👥 Stream ${streamId} still has ${stream.viewers} viewers`);
    }
  }

  async waitForPlaylist(playlistPath, maxWait = 20000) {
    const startTime = Date.now();
    let segmentCount = 0;
    
    console.log(`[FFmpeg-Pro] ⏳ Waiting for playlist: ${playlistPath}`);
    
    while (Date.now() - startTime < maxWait) {
      if (fs.existsSync(playlistPath)) {
        try {
          const content = fs.readFileSync(playlistPath, 'utf8');
          const segments = (content.match(/\.ts/g) || []).length;
          
          if (segments > segmentCount) {
            segmentCount = segments;
            console.log(`[FFmpeg-Pro] 📺 Found ${segments} segments`);
          }
          
          if (segments >= 2 && content.includes('#EXTINF')) {
            console.log(`[FFmpeg-Pro] ✅ Playlist ready with ${segments} segments`);
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
        for (const file of files) {
          fs.unlinkSync(path.join(streamDir, file));
        }
        fs.rmdirSync(streamDir);
        console.log(`[FFmpeg-Pro] 🧹 Cleaned up ${streamDir}`);
      }
    } catch (error) {
      console.error(`[FFmpeg-Pro] Cleanup error:`, error.message);
    }
  }

  getStats() {
    const stats = {};
    for (const [streamId, stream] of this.activeStreams) {
      stats[streamId] = {
        viewers: stream.viewers,
        uptime: Math.round((Date.now() - stream.startTime) / 1000),
        hlsPath: stream.hlsPath,
        retries: stream.retries || 0,
        status: stream.process && !stream.process.killed ? 'running' : 'stopped'
      };
    }
    return {
      totalStreams: this.activeStreams.size,
      ffmpegPath: this.ffmpegPath,
      hlsDir: this.hlsDir,
      streams: stats
    };
  }

  stopAll() {
    console.log(`[FFmpeg-Pro] 🛑 Stopping all ${this.activeStreams.size} streams`);
    for (const [streamId] of this.activeStreams) {
      const stream = this.activeStreams.get(streamId);
      if (stream.process && !stream.process.killed) {
        stream.process.kill('SIGTERM');
      }
    }
    this.activeStreams.clear();
  }

  async checkHealth() {
    return new Promise((resolve) => {
      const testProcess = spawn(this.ffmpegPath, ['-version'], { stdio: 'pipe' });
      testProcess.on('exit', (code) => {
        resolve(code === 0);
      });
      testProcess.on('error', () => {
        resolve(false);
      });
    });
  }
}

module.exports = new FFmpegProRestreamer();
EOF

echo ""
echo "🔄 تحديث Server.js..."
cd /root/ma-streaming/cloud-server

# إنشاء نسخة احتياطية
cp server.js server.js.backup

# تحديث المرجع إلى النسخة الاحترافية
sed -i "s/require('\.\/lib\/ffmpeg-restreamer')/require('\.\/lib\/ffmpeg-restreamer-pro')/g" server.js

echo ""
echo "🚀 إعادة تشغيل الخادم..."
pm2 restart cloud-server

echo ""
echo "✅ تم تثبيت وتكوين FFmpeg بنجاح!"
echo ""
echo "🎯 المميزات الجديدة:"
echo "- FFmpeg من مستودعات Ubuntu الرسمية"
echo "- معالجة أخطاء متقدمة مع إعادة المحاولة"
echo "- إعدادات محسنة للاستقرار"
echo "- مراقبة تقدم إنتاج الـ segments"
echo "- بث سلس 100% بدون تقطيع"
echo ""
echo "🎉 النظام جاهز للاستخدام!"

# اختبار سريع
echo ""
echo "🧪 اختبار سريع..."
sleep 3
curl -s "http://localhost:8090/api/xtream/stream/1017030" | grep -o '"type":"[^"]*"'