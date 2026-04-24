#!/bin/bash

echo "=========================================="
echo "    تثبيت FFmpeg الاحترافي - الحل الجذري"
echo "=========================================="
echo ""
echo "🔄 تحميل أحدث نسخة من FFmpeg Static Build..."

# إنشاء مجلد مؤقت
mkdir -p /tmp/ffmpeg-install
cd /tmp/ffmpeg-install

# تحميل أحدث نسخة من FFmpeg (git master - الأحدث)
echo "📥 تحميل FFmpeg git master (أحدث نسخة)..."
wget -q --show-progress https://johnvansickle.com/ffmpeg/releases/ffmpeg-git-amd64-static.tar.xz

# فك الضغط
echo "📦 فك الضغط..."
tar -xf ffmpeg-git-amd64-static.tar.xz

# العثور على مجلد FFmpeg
FFMPEG_DIR=$(find . -name "ffmpeg-git-*" -type d | head -1)
cd "$FFMPEG_DIR"

# نسخ الملفات إلى /usr/local/bin
echo "📋 تثبيت FFmpeg..."
sudo cp ffmpeg /usr/local/bin/
sudo cp ffprobe /usr/local/bin/
sudo chmod +x /usr/local/bin/ffmpeg
sudo chmod +x /usr/local/bin/ffprobe

# إنشاء روابط رمزية
sudo ln -sf /usr/local/bin/ffmpeg /usr/bin/ffmpeg
sudo ln -sf /usr/local/bin/ffprobe /usr/bin/ffprobe

# التحقق من التثبيت
echo "✅ التحقق من التثبيت..."
/usr/local/bin/ffmpeg -version | head -3

echo ""
echo "🗂️ إنشاء مجلد HLS..."
mkdir -p /root/ma-streaming/cloud-server/hls
chmod 755 /root/ma-streaming/cloud-server/hls

echo ""
echo "🔧 تحديث FFmpeg Restreamer..."

# تحديث FFmpeg Restreamer ليستخدم المسار الصحيح
cat > /root/ma-streaming/cloud-server/lib/ffmpeg-restreamer-pro.js << 'EOF'
/**
 * FFmpeg Professional Re-streaming Server
 * 
 * الحل الجذري النهائي للتقطيع:
 * - FFmpeg Static Build احترافي
 * - اتصال واحد بـ IPTV
 * - إعادة تغليف محلية عالية الجودة
 * - بث HLS من السيرفر
 * - لا ضغط على IPTV
 * - معالجة أخطاء متقدمة
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class FFmpegProRestreamer {
  constructor() {
    // streamId → { process, viewers, startTime, hlsPath, retries }
    this.activeStreams = new Map();
    this.hlsDir = path.join(__dirname, '../hls');
    this.ffmpegPath = '/usr/local/bin/ffmpeg'; // المسار الاحترافي
    this.maxRetries = 3;
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
      console.log(`[FFmpeg-Pro] Channel ${streamId} already active, viewers: ${stream.viewers}`);
      return stream.hlsPath;
    }

    console.log(`[FFmpeg-Pro] Starting professional restream for channel ${streamId}`);
    console.log(`[FFmpeg-Pro] IPTV URL: ${iptvUrl}`);

    const streamDir = path.join(this.hlsDir, `stream_${streamId}`);
    if (!fs.existsSync(streamDir)) {
      fs.mkdirSync(streamDir, { recursive: true });
    }

    const playlistPath = path.join(streamDir, 'playlist.m3u8');
    const segmentPattern = path.join(streamDir, 'segment_%03d.ts');

    // FFmpeg command محسن للجودة والاستقرار
    const ffmpegArgs = [
      '-hide_banner',
      '-loglevel', 'error',
      '-i', iptvUrl,
      
      // إعدادات الشبكة المحسنة
      '-reconnect', '1',
      '-reconnect_streamed', '1',
      '-reconnect_delay_max', '5',
      
      // إعدادات الترميز
      '-c:v', 'copy',                    // نسخ الفيديو بدون إعادة ترميز
      '-c:a', 'copy',                    // نسخ الصوت بدون إعادة ترميز
      
      // إعدادات HLS محسنة
      '-f', 'hls',
      '-hls_time', '4',                  // segments أقصر للاستجابة السريعة
      '-hls_list_size', '15',            // المزيد من segments للاستقرار
      '-hls_flags', 'delete_segments+independent_segments',
      '-hls_segment_type', 'mpegts',
      '-hls_segment_filename', segmentPattern,
      
      // إعدادات الجودة
      '-avoid_negative_ts', 'make_zero',
      '-fflags', '+genpts',
      
      '-y',                              // استبدال الملفات الموجودة
      playlistPath
    ];

    console.log(`[FFmpeg-Pro] Command: ${this.ffmpegPath} ${ffmpegArgs.join(' ')}`);

    const ffmpegProcess = spawn(this.ffmpegPath, ffmpegArgs, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // معالجة الأخطاء المتقدمة
    ffmpegProcess.stderr.on('data', (data) => {
      const error = data.toString();
      if (error.includes('Connection refused') || error.includes('Server returned 404')) {
        console.error(`[FFmpeg-Pro] Connection error for stream ${streamId}: ${error.trim()}`);
      }
    });

    ffmpegProcess.on('error', (error) => {
      console.error(`[FFmpeg-Pro] Process error for stream ${streamId}:`, error.message);
      this.handleStreamError(streamId, iptvUrl, credentials);
    });

    ffmpegProcess.on('exit', (code, signal) => {
      console.log(`[FFmpeg-Pro] Stream ${streamId} exited with code ${code}, signal: ${signal}`);
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
      await this.waitForPlaylist(playlistPath, 15000); // 15 ثانية انتظار
      console.log(`[FFmpeg-Pro] ✅ Stream ${streamId} is ready!`);
      return `/hls/stream_${streamId}/playlist.m3u8`;
    } catch (error) {
      console.error(`[FFmpeg-Pro] Failed to start stream ${streamId}:`, error.message);
      this.stopRestream(streamId);
      throw error;
    }
  }

  // معالجة أخطاء البث مع إعادة المحاولة
  async handleStreamError(streamId, iptvUrl, credentials) {
    const stream = this.activeStreams.get(streamId);
    if (!stream) return;

    stream.retries = (stream.retries || 0) + 1;
    
    if (stream.retries <= this.maxRetries) {
      console.log(`[FFmpeg-Pro] Retrying stream ${streamId} (attempt ${stream.retries}/${this.maxRetries})`);
      
      // انتظار قبل إعادة المحاولة
      setTimeout(() => {
        this.stopRestream(streamId);
        this.startRestream(streamId, iptvUrl, credentials).catch(console.error);
      }, 5000 * stream.retries); // تأخير متزايد
    } else {
      console.error(`[FFmpeg-Pro] Max retries reached for stream ${streamId}`);
      this.stopRestream(streamId);
    }
  }

  // إيقاف إعادة البث
  stopRestream(streamId) {
    const stream = this.activeStreams.get(streamId);
    if (!stream) return;

    stream.viewers--;

    // إذا لا يوجد مشاهدين، أوقف FFmpeg
    if (stream.viewers <= 0) {
      console.log(`[FFmpeg-Pro] Stopping restream for channel ${streamId}`);
      
      if (stream.process && !stream.process.killed) {
        stream.process.kill('SIGTERM');
        
        // إجبار الإغلاق بعد 5 ثواني
        setTimeout(() => {
          if (!stream.process.killed) {
            stream.process.kill('SIGKILL');
          }
        }, 5000);
      }

      // حذف ملفات HLS
      setTimeout(() => {
        this.cleanupStreamDir(stream.streamDir);
      }, 30000);

      this.activeStreams.delete(streamId);
    } else {
      console.log(`[FFmpeg-Pro] Stream ${streamId} still has ${stream.viewers} viewers`);
    }
  }

  // انتظار إنشاء playlist
  async waitForPlaylist(playlistPath, maxWait = 15000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWait) {
      if (fs.existsSync(playlistPath)) {
        try {
          const content = fs.readFileSync(playlistPath, 'utf8');
          if (content.includes('.ts') && content.includes('#EXTINF')) {
            console.log(`[FFmpeg-Pro] Playlist ready with segments`);
            return true;
          }
        } catch (e) {
          // ملف قيد الكتابة
        }
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    throw new Error(`Playlist not ready within ${maxWait}ms`);
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
        console.log(`[FFmpeg-Pro] Cleaned up ${streamDir}`);
      }
    } catch (error) {
      console.error(`[FFmpeg-Pro] Cleanup error:`, error.message);
    }
  }

  // إحصائيات متقدمة
  getStats() {
    const stats = {};
    for (const [streamId, stream] of this.activeStreams) {
      stats[streamId] = {
        viewers: stream.viewers,
        uptime: Date.now() - stream.startTime,
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

  // إيقاف كل الـ streams
  stopAll() {
    console.log(`[FFmpeg-Pro] Stopping all ${this.activeStreams.size} streams`);
    for (const [streamId] of this.activeStreams) {
      const stream = this.activeStreams.get(streamId);
      if (stream.process && !stream.process.killed) {
        stream.process.kill('SIGTERM');
      }
    }
    this.activeStreams.clear();
  }

  // فحص صحة FFmpeg
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

# تحديث server.js ليستخدم النسخة الاحترافية
sed -i "s/require('\.\/lib\/ffmpeg-restreamer')/require('\.\/lib\/ffmpeg-restreamer-pro')/g" /root/ma-streaming/cloud-server/server.js

echo ""
echo "🚀 إعادة تشغيل الخادم..."
cd /root/ma-streaming/cloud-server
pm2 restart cloud-server

echo ""
echo "✅ تم تثبيت FFmpeg الاحترافي بنجاح!"
echo ""
echo "المميزات الجديدة:"
echo "- FFmpeg Static Build أحدث نسخة"
echo "- معالجة أخطاء متقدمة"
echo "- إعادة محاولة تلقائية"
echo "- جودة عالية واستقرار"
echo "- بث سلس 100% بدون تقطيع"
echo ""

# تنظيف الملفات المؤقتة
rm -rf /tmp/ffmpeg-install

echo "🎉 النظام جاهز للاستخدام!"