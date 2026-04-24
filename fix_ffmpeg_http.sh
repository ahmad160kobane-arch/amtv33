#!/bin/bash

echo "🔧 إصلاح مشكلة HTTP 511..."

cat > /root/ma-streaming/cloud-server/lib/ffmpeg-restreamer-working.js << 'ENDOFFILE'
/**
 * FFmpeg Restreamer - حل مشكلة HTTP 511
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
    
    console.log(`[FFmpeg-Working] 🚀 Initialized with HTTP 511 fix`);
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

    // FFmpeg arguments مع إعدادات HTTP محسنة لحل مشكلة 511
    const ffmpegArgs = [
      '-hide_banner',
      '-loglevel', 'warning',
      
      // إعدادات HTTP المحسنة - حل مشكلة 511
      '-user_agent', 'VLC/3.0.16 LibVLC/3.0.16',
      '-headers', 'Accept: */*\\r\\nConnection: keep-alive\\r\\n',
      '-multiple_requests', '1',
      '-seekable', '0',
      
      // إعدادات الشبكة
      '-reconnect', '1',
      '-reconnect_streamed', '1',
      '-reconnect_delay_max', '5',
      '-timeout', '15000000',
      
      // إعدادات الإدخال
      '-fflags', '+genpts+discardcorrupt+igndts',
      '-analyzeduration', '5000000',
      '-probesize', '10000000',
      '-i', iptvUrl,
      
      // إعدادات الترميز
      '-c:v', 'copy',
      '-c:a', 'copy',
      '-bsf:a', 'aac_adtstoasc',
      '-avoid_negative_ts', 'make_zero',
      '-max_muxing_queue_size', '1024',
      
      // إعدادات HLS
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

    console.log(`[FFmpeg-Working] 🎯 Starting with HTTP 511 fix...`);

    const ffmpegProcess = spawn(this.ffmpegPath, ffmpegArgs, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let errorOutput = '';
    let hasOutput = false;

    ffmpegProcess.stderr.on('data', (data) => {
      const msg = data.toString();
      errorOutput += msg;
      hasOutput = true;
      
      // عرض التقدم
      if (msg.includes('frame=') || msg.includes('time=')) {
        console.log(`[FFmpeg-Working] 📊 ${streamId}: Processing...`);
      }
      
      // عرض الأخطاء المهمة
      if (msg.includes('Error') || msg.includes('Failed') || msg.includes('511')) {
        console.error(`[FFmpeg-Working] ⚠️ ${streamId}: ${msg.trim()}`);
      }
    });

    ffmpegProcess.on('error', (error) => {
      console.error(`[FFmpeg-Working] ❌ Process error ${streamId}:`, error.message);
      this.stopRestream(streamId);
    });

    ffmpegProcess.on('exit', (code, signal) => {
      if (code !== 0 && code !== null) {
        console.error(`[FFmpeg-Working] ❌ Stream ${streamId} failed with code ${code}`);
        if (errorOutput) {
          console.error(`[FFmpeg-Working] Error: ${errorOutput.slice(-300)}`);
        }
      } else {
        console.log(`[FFmpeg-Working] 🔚 Stream ${streamId} ended`);
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

    // انتظار بدء التشغيل
    try {
      await this.waitForPlaylist(playlistPath, 30000);
      console.log(`[FFmpeg-Working] ✅ Stream ${streamId} ready!`);
      return `/hls/stream_${streamId}/playlist.m3u8`;
    } catch (error) {
      console.error(`[FFmpeg-Working] ❌ Failed ${streamId}:`, error.message);
      if (errorOutput.includes('511')) {
        console.error(`[FFmpeg-Working] HTTP 511 error - IPTV server requires authentication or has network restrictions`);
      }
      this.stopRestream(streamId);
      throw new Error(`FFmpeg failed: ${error.message}`);
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
    let lastCheck = 0;
    
    console.log(`[FFmpeg-Working] ⏳ Waiting for playlist...`);
    
    while (Date.now() - startTime < maxWait) {
      if (fs.existsSync(playlistPath)) {
        try {
          const content = fs.readFileSync(playlistPath, 'utf8');
          const segments = (content.match(/\.ts/g) || []).length;
          
          if (segments > lastCheck) {
            lastCheck = segments;
            console.log(`[FFmpeg-Working] 📺 Segments: ${segments}`);
          }
          
          if (segments >= 1 && content.includes('#EXTINF')) {
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
        files.forEach(file => {
          try {
            fs.unlinkSync(path.join(streamDir, file));
          } catch (e) {}
        });
        fs.rmdirSync(streamDir);
      }
    } catch (error) {}
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
ENDOFFILE

echo "✅ تم تحديث FFmpeg مع حل HTTP 511"

# إعادة تشغيل
cd /root/ma-streaming/cloud-server
pm2 restart cloud-server

echo "🎉 تم الإصلاح!"

# اختبار FFmpeg مباشرة
sleep 3
echo ""
echo "🧪 اختبار FFmpeg مع الإعدادات الجديدة..."
/usr/bin/ffmpeg -user_agent "VLC/3.0.16 LibVLC/3.0.16" -headers "Accept: */*\r\nConnection: keep-alive\r\n" -i "http://myhand.org:8080/live/3061530197/1780036754/1017030.m3u8" -t 5 -c copy /tmp/test_http511.ts 2>&1 | grep -E "Input|Duration|Stream|error|Error" | head -10

echo ""
echo "📊 نتيجة الاختبار أعلاه"