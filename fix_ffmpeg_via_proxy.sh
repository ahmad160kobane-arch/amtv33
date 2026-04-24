#!/bin/bash

echo "🔧 الحل النهائي: FFmpeg + XtreamProxy"
echo "========================================"
echo ""
echo "الفكرة:"
echo "IPTV → XtreamProxy (يعمل ✅) → FFmpeg → HLS محلي"
echo ""

cat > /root/ma-streaming/cloud-server/lib/ffmpeg-restreamer-working.js << 'ENDOFFILE'
/**
 * FFmpeg Restreamer - الحل النهائي
 * يستخدم XtreamProxy كوسيط للاتصال بـ IPTV
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class FFmpegWorkingRestreamer {
  constructor() {
    this.activeStreams = new Map();
    this.hlsDir = path.join(__dirname, '../hls');
    this.ffmpegPath = '/usr/bin/ffmpeg';
    this.localProxyUrl = 'http://localhost:8090'; // XtreamProxy المحلي
    this.ensureHlsDir();
    
    console.log(`[FFmpeg-Final] 🚀 Initialized - Using XtreamProxy as bridge`);
    console.log(`[FFmpeg-Final] 🌉 Bridge: IPTV → XtreamProxy → FFmpeg → HLS`);
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
      console.log(`[FFmpeg-Final] 👥 Channel ${streamId} viewers: ${stream.viewers}`);
      return stream.hlsPath;
    }

    console.log(`[FFmpeg-Final] 🎬 Starting stream ${streamId}`);
    
    // استخدام XtreamProxy المحلي بدلاً من IPTV مباشرة
    const proxyUrl = `${this.localProxyUrl}/proxy/live/${streamId}/index.m3u8?sid=ffmpeg_${Date.now()}`;
    console.log(`[FFmpeg-Final] 🌉 Using proxy: ${proxyUrl}`);

    const streamDir = path.join(this.hlsDir, `stream_${streamId}`);
    if (!fs.existsSync(streamDir)) {
      fs.mkdirSync(streamDir, { recursive: true });
    }

    const playlistPath = path.join(streamDir, 'playlist.m3u8');
    const segmentPattern = path.join(streamDir, 'segment_%03d.ts');

    // FFmpeg arguments - بسيطة لأن المصدر محلي الآن
    const ffmpegArgs = [
      '-hide_banner',
      '-loglevel', 'warning',
      
      // المصدر محلي - لا حاجة لإعدادات شبكة معقدة
      '-i', proxyUrl,
      
      // نسخ مباشر
      '-c', 'copy',
      
      // HLS
      '-f', 'hls',
      '-hls_time', '6',
      '-hls_list_size', '10',
      '-hls_flags', 'delete_segments+append_list+omit_endlist',
      '-hls_segment_filename', segmentPattern,
      
      '-y',
      playlistPath
    ];

    console.log(`[FFmpeg-Final] 🎯 Starting FFmpeg with local proxy source...`);

    const ffmpegProcess = spawn(this.ffmpegPath, ffmpegArgs, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let errorOutput = '';

    ffmpegProcess.stderr.on('data', (data) => {
      const msg = data.toString();
      errorOutput += msg;
      
      if (msg.includes('frame=')) {
        console.log(`[FFmpeg-Final] 📊 ${streamId}: Processing frames...`);
      }
      
      if (msg.includes('Error') || msg.includes('Failed')) {
        console.error(`[FFmpeg-Final] ⚠️ ${streamId}: ${msg.trim()}`);
      }
    });

    ffmpegProcess.on('error', (error) => {
      console.error(`[FFmpeg-Final] ❌ Process error ${streamId}:`, error.message);
      this.stopRestream(streamId);
    });

    ffmpegProcess.on('exit', (code, signal) => {
      if (code !== 0 && code !== null) {
        console.error(`[FFmpeg-Final] ❌ Stream ${streamId} failed with code ${code}`);
        if (errorOutput) {
          console.error(`[FFmpeg-Final] Last error: ${errorOutput.slice(-200)}`);
        }
      } else {
        console.log(`[FFmpeg-Final] 🔚 Stream ${streamId} ended`);
      }
      this.stopRestream(streamId);
    });

    // تسجيل الـ stream
    this.activeStreams.set(streamId, {
      process: ffmpegProcess,
      viewers: 1,
      startTime: Date.now(),
      hlsPath: `/hls/stream_${streamId}/playlist.m3u8`,
      streamDir: streamDir,
      proxyUrl: proxyUrl
    });

    // انتظار بدء التشغيل
    try {
      await this.waitForPlaylist(playlistPath, 30000);
      console.log(`[FFmpeg-Final] ✅ Stream ${streamId} ready and streaming!`);
      return `/hls/stream_${streamId}/playlist.m3u8`;
    } catch (error) {
      console.error(`[FFmpeg-Final] ❌ Failed ${streamId}:`, error.message);
      this.stopRestream(streamId);
      throw new Error(`FFmpeg failed: ${error.message}`);
    }
  }

  stopRestream(streamId) {
    const stream = this.activeStreams.get(streamId);
    if (!stream) return;

    stream.viewers--;
    if (stream.viewers <= 0) {
      console.log(`[FFmpeg-Final] 🛑 Stopping ${streamId}`);
      
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
    } else {
      console.log(`[FFmpeg-Final] 👥 Stream ${streamId} still has ${stream.viewers} viewers`);
    }
  }

  async waitForPlaylist(playlistPath, maxWait = 30000) {
    const startTime = Date.now();
    let segmentCount = 0;
    
    console.log(`[FFmpeg-Final] ⏳ Waiting for playlist...`);
    
    while (Date.now() - startTime < maxWait) {
      if (fs.existsSync(playlistPath)) {
        try {
          const content = fs.readFileSync(playlistPath, 'utf8');
          const segments = (content.match(/\.ts/g) || []).length;
          
          if (segments > segmentCount) {
            segmentCount = segments;
            console.log(`[FFmpeg-Final] 📺 Generated ${segments} segments`);
          }
          
          if (segments >= 2 && content.includes('#EXTINF')) {
            console.log(`[FFmpeg-Final] ✅ Playlist ready!`);
            return true;
          }
        } catch (e) {}
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error('Playlist timeout - no segments generated');
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
        console.log(`[FFmpeg-Final] 🧹 Cleaned ${streamDir}`);
      }
    } catch (error) {}
  }

  getStats() {
    const stats = {};
    for (const [streamId, stream] of this.activeStreams) {
      stats[streamId] = {
        viewers: stream.viewers,
        uptime: Math.round((Date.now() - stream.startTime) / 1000),
        hlsPath: stream.hlsPath,
        proxyUrl: stream.proxyUrl,
        status: stream.process && !stream.process.killed ? 'running' : 'stopped'
      };
    }
    return {
      totalStreams: this.activeStreams.size,
      ffmpegPath: this.ffmpegPath,
      proxyBridge: this.localProxyUrl,
      streams: stats
    };
  }

  stopAll() {
    console.log(`[FFmpeg-Final] 🛑 Stopping all ${this.activeStreams.size} streams`);
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

echo "✅ تم إنشاء FFmpeg Restreamer مع XtreamProxy Bridge"

# إعادة تشغيل
cd /root/ma-streaming/cloud-server
pm2 restart cloud-server

echo ""
echo "🎉 تم التحديث!"
echo ""
echo "📊 الآن النظام يعمل كالتالي:"
echo "1. XtreamProxy يتصل بـ IPTV (يعمل ✅)"
echo "2. FFmpeg يأخذ البث من XtreamProxy المحلي"
echo "3. FFmpeg ينتج HLS segments محلية"
echo "4. المستخدمون يشاهدون من HLS المحلي"
echo ""
echo "✅ لا ضغط على IPTV"
echo "✅ بث سلس بدون تقطيع"
echo ""

# اختبار
sleep 5
echo "🧪 اختبار النظام..."
curl -s "http://localhost:8090/api/xtream/stream/1017030" | grep -o '"type":"[^"]*"'

sleep 15
echo ""
echo "📁 فحص ملفات HLS..."
ls -lh /root/ma-streaming/cloud-server/hls/stream_1017030/ 2>/dev/null | tail -5 || echo "⏳ انتظر قليلاً..."

echo ""
echo "🔍 عمليات FFmpeg النشطة:"
ps aux | grep ffmpeg | grep -v grep | wc -l