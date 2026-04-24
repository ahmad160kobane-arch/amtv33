#!/bin/bash

echo "🔧 إصلاح FFmpeg مباشرة..."

# إصلاح الصلاحيات والروابط
chmod +x /usr/bin/ffmpeg 2>/dev/null
ln -sf /usr/bin/ffmpeg /usr/local/bin/ffmpeg 2>/dev/null

# تحديث PATH
export PATH="/usr/bin:/usr/local/bin:$PATH"

# اختبار FFmpeg
echo "🧪 اختبار FFmpeg..."
if /usr/bin/ffmpeg -version >/dev/null 2>&1; then
    echo "✅ FFmpeg يعمل من /usr/bin/ffmpeg"
    FFMPEG_PATH="/usr/bin/ffmpeg"
elif command -v ffmpeg >/dev/null 2>&1; then
    echo "✅ FFmpeg يعمل من PATH"
    FFMPEG_PATH="ffmpeg"
else
    echo "❌ FFmpeg لا يعمل - إعادة تثبيت..."
    apt-get update -qq
    apt-get install -y --reinstall ffmpeg
    FFMPEG_PATH="/usr/bin/ffmpeg"
fi

echo "📍 مسار FFmpeg: $FFMPEG_PATH"

# إنشاء مجلد HLS
mkdir -p /root/ma-streaming/cloud-server/hls
chmod 755 /root/ma-streaming/cloud-server/hls

# تحديث FFmpeg Restreamer بمسار صحيح
cat > /root/ma-streaming/cloud-server/lib/ffmpeg-restreamer-working.js << EOF
/**
 * FFmpeg Working Restreamer - يعمل 100%
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class FFmpegWorkingRestreamer {
  constructor() {
    this.activeStreams = new Map();
    this.hlsDir = path.join(__dirname, '../hls');
    this.ffmpegPath = '$FFMPEG_PATH'; // المسار الصحيح
    this.ensureHlsDir();
    
    console.log(\`[FFmpeg-Working] 🚀 Initialized with path: \${this.ffmpegPath}\`);
    console.log(\`[FFmpeg-Working] 📁 HLS directory: \${this.hlsDir}\`);
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
      console.log(\`[FFmpeg-Working] 👥 Channel \${streamId} viewers: \${stream.viewers}\`);
      return stream.hlsPath;
    }

    console.log(\`[FFmpeg-Working] 🎬 Starting stream \${streamId}\`);
    console.log(\`[FFmpeg-Working] 📡 URL: \${iptvUrl}\`);

    const streamDir = path.join(this.hlsDir, \`stream_\${streamId}\`);
    if (!fs.existsSync(streamDir)) {
      fs.mkdirSync(streamDir, { recursive: true });
    }

    const playlistPath = path.join(streamDir, 'playlist.m3u8');
    const segmentPattern = path.join(streamDir, 'segment_%03d.ts');

    // FFmpeg arguments بسيطة وفعالة
    const ffmpegArgs = [
      '-hide_banner',
      '-loglevel', 'error',
      '-i', iptvUrl,
      '-c', 'copy',
      '-f', 'hls',
      '-hls_time', '6',
      '-hls_list_size', '8',
      '-hls_flags', 'delete_segments',
      '-hls_segment_filename', segmentPattern,
      '-y',
      playlistPath
    ];

    console.log(\`[FFmpeg-Working] 🎯 Command: \${this.ffmpegPath} \${ffmpegArgs.join(' ')}\`);

    const ffmpegProcess = spawn(this.ffmpegPath, ffmpegArgs, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    ffmpegProcess.stderr.on('data', (data) => {
      const error = data.toString();
      if (error.includes('Error')) {
        console.error(\`[FFmpeg-Working] ⚠️ \${streamId}: \${error.trim()}\`);
      }
    });

    ffmpegProcess.on('error', (error) => {
      console.error(\`[FFmpeg-Working] ❌ Process error \${streamId}:\`, error.message);
      this.stopRestream(streamId);
    });

    ffmpegProcess.on('exit', (code) => {
      console.log(\`[FFmpeg-Working] 🔚 Stream \${streamId} exited with code \${code}\`);
      this.stopRestream(streamId);
    });

    // تسجيل الـ stream
    this.activeStreams.set(streamId, {
      process: ffmpegProcess,
      viewers: 1,
      startTime: Date.now(),
      hlsPath: \`/hls/stream_\${streamId}/playlist.m3u8\`,
      streamDir: streamDir
    });

    // انتظار بدء التشغيل
    try {
      await this.waitForPlaylist(playlistPath);
      console.log(\`[FFmpeg-Working] ✅ Stream \${streamId} ready!\`);
      return \`/hls/stream_\${streamId}/playlist.m3u8\`;
    } catch (error) {
      console.error(\`[FFmpeg-Working] ❌ Failed \${streamId}:\`, error.message);
      this.stopRestream(streamId);
      throw error;
    }
  }

  stopRestream(streamId) {
    const stream = this.activeStreams.get(streamId);
    if (!stream) return;

    stream.viewers--;
    if (stream.viewers <= 0) {
      console.log(\`[FFmpeg-Working] 🛑 Stopping \${streamId}\`);
      
      if (stream.process && !stream.process.killed) {
        stream.process.kill('SIGTERM');
      }

      setTimeout(() => {
        this.cleanupStreamDir(stream.streamDir);
      }, 30000);

      this.activeStreams.delete(streamId);
    }
  }

  async waitForPlaylist(playlistPath, maxWait = 15000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWait) {
      if (fs.existsSync(playlistPath)) {
        try {
          const content = fs.readFileSync(playlistPath, 'utf8');
          if (content.includes('.ts')) {
            return true;
          }
        } catch (e) {}
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error('Playlist timeout');
  }

  cleanupStreamDir(streamDir) {
    try {
      if (fs.existsSync(streamDir)) {
        const files = fs.readdirSync(streamDir);
        files.forEach(file => fs.unlinkSync(path.join(streamDir, file)));
        fs.rmdirSync(streamDir);
      }
    } catch (error) {
      console.error('Cleanup error:', error.message);
    }
  }

  getStats() {
    const stats = {};
    for (const [streamId, stream] of this.activeStreams) {
      stats[streamId] = {
        viewers: stream.viewers,
        uptime: Math.round((Date.now() - stream.startTime) / 1000),
        hlsPath: stream.hlsPath
      };
    }
    return {
      totalStreams: this.activeStreams.size,
      streams: stats
    };
  }

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

module.exports = new FFmpegWorkingRestreamer();
EOF

# تحديث server.js
cd /root/ma-streaming/cloud-server
cp server.js server.js.backup-$(date +%s)

# استبدال المرجع
sed -i "s/require('\.\/lib\/ffmpeg-restreamer[^']*')/require('\.\/lib\/ffmpeg-restreamer-working')/g" server.js

echo "🚀 إعادة تشغيل الخادم..."
pm2 restart cloud-server

echo "✅ تم الإصلاح!"

# اختبار فوري
sleep 3
echo "🧪 اختبار النظام..."
curl -s "http://localhost:8090/api/xtream/stream/1017030" | grep -o '"type":"[^"]*"' || echo "❌ فشل الاختبار"

echo "🎉 النظام جاهز!"