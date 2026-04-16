'use client';
import React, { useEffect, useRef, useState, useCallback } from 'react';

interface LivePlayerProps {
  streamUrl: string;
  title: string;
  logo?: string;
  group?: string;
  onClose?: () => void;
  onRetry?: () => void;
}

export default function LivePlayer({ streamUrl, title, logo, group, onClose, onRetry }: LivePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<any>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState('');
  const [buffering, setBuffering] = useState(true);
  const [isAtLive, setIsAtLive] = useState(true);

  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setShowControls(true);
    hideTimer.current = setTimeout(() => {
      if (playing) setShowControls(false);
    }, 3500);
  }, [playing]);

  useEffect(() => {
    if (!videoRef.current || !streamUrl) return;
    const video = videoRef.current;
    setError('');
    setBuffering(true);
    let hlsInstance: any = null;
    let retryCount = 0;
    const MAX_AUTO_RETRY = 3;
    let retryTimer: any = null;

    const isTs = streamUrl.includes('/xtream-pipe/') || streamUrl.includes('.ts') || streamUrl.includes('/live-pipe/');
    const isHls = streamUrl.includes('.m3u8') || streamUrl.includes('/proxy/live/');

    const onPlay = () => { setPlaying(true); setBuffering(false); retryCount = 0; };
    const onPause = () => setPlaying(false);
    const onWaiting = () => setBuffering(true);
    const onPlaying = () => { setBuffering(false); setPlaying(true); retryCount = 0; };
    const onError = () => {
      if (retryCount < MAX_AUTO_RETRY) {
        retryCount++;
        console.log(`[LivePlayer] Auto-retry ${retryCount}/${MAX_AUTO_RETRY}`);
        retryTimer = setTimeout(() => {
          if (hlsInstance) {
            hlsInstance.startLoad();
          } else if (video.src) {
            video.load();
            video.play().catch(() => {});
          }
        }, 2000 * retryCount);
      } else {
        setError('فشل تحميل البث المباشر');
      }
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('error', onError);

    // Seek to live edge helper
    const seekToLive = () => {
      try {
        if (video.seekable && video.seekable.length > 0) {
          const edge = video.seekable.end(0);
          if (edge > 5 && video.currentTime < edge - 5) {
            video.currentTime = Math.max(0, edge - 2);
          }
        }
      } catch {}
    };

    if (isTs) {
      const loadMpegts = () => {
        const Mpegts = (window as any).mpegts;
        if (Mpegts && Mpegts.isSupported()) {
          const mpegtsPlayer = Mpegts.createPlayer({
            type: 'mse', isLive: true, url: streamUrl,
            enableWorker: true,
            liveBufferLatencyChasing: true,
            liveBufferLatencyMaxLatency: 3,
            liveBufferLatencyMinRemain: 0.5,
          });
          mpegtsPlayer.attachMediaElement(video);
          mpegtsPlayer.load();
          mpegtsPlayer.play().catch(() => {});
          mpegtsPlayer.on('error', () => onError());
          (video as any)._mpegtsPlayer = mpegtsPlayer;
        } else {
          video.src = streamUrl;
          video.play().catch(() => {});
        }
      };
      if ((window as any).mpegts) {
        loadMpegts();
      } else {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/mpegts.js@latest/dist/mpegts.min.js';
        script.onload = loadMpegts;
        document.head.appendChild(script);
      }
    } else if (isHls) {
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari native HLS
        video.src = streamUrl;
        video.play().catch(() => {});
      } else {
        const loadHls = () => {
          const Hls = (window as any).Hls;
          if (Hls && Hls.isSupported()) {
            hlsInstance = new Hls({
              enableWorker: true,
              lowLatencyMode: false,
              startLevel: -1,
              // ═══ Fast startup — start playing with minimal buffered data ═══
              startFragPrefetch: true,             // prefetch first frag while parsing manifest
              maxStarvationDelay: 2,               // start playback after 2s of buffer (faster)
              maxLoadingDelay: 2,
              highBufferWatchdogPeriod: 1,
              // ═══ Live edge sync ═══
              liveSyncDurationCount: 2,            // more tolerant for first load
              liveMaxLatencyDurationCount: 4,
              liveDurationInfinity: true,
              // ═══ Buffer ═══
              maxBufferLength: 10,
              maxMaxBufferLength: 20,
              maxBufferSize: 30 * 1024 * 1024,
              maxBufferHole: 1.0,
              backBufferLength: 10,
              // ═══ Aggressive timeouts for faster first-play ═══
              manifestLoadingTimeOut: 6000,
              manifestLoadingMaxRetry: 4,
              manifestLoadingRetryDelay: 200,
              levelLoadingTimeOut: 6000,
              levelLoadingMaxRetry: 4,
              levelLoadingRetryDelay: 200,
              fragLoadingTimeOut: 10000,
              fragLoadingMaxRetry: 3,
              fragLoadingRetryDelay: 200,
              fragLoadingMaxRetryTimeout: 3000,
            });
            hlsInstance.loadSource(streamUrl);
            hlsInstance.attachMedia(video);

            hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
              video.play().catch(() => {});
            });

                    // Auto seek-to-live: if player falls >15s behind, jump to live edge
            // This prevents the 120s+ accumulated delay from stale manifest cache
            hlsInstance.on(Hls.Events.FRAG_CHANGED, () => {
              try {
                if (video.seekable.length > 0) {
                  const edge = video.seekable.end(0);
                  const latency = edge - video.currentTime;
                  setIsAtLive(latency <= 12);
                  if (!video.paused && latency > 15) {
                    video.currentTime = Math.max(0, edge - 2);
                    setIsAtLive(true);
                  }
                }
              } catch {}
            });

            hlsInstance.on(Hls.Events.ERROR, (_: any, data: any) => {
              if (data.fatal) {
                switch (data.type) {
                  case Hls.ErrorTypes.NETWORK_ERROR:
                    if (retryCount < MAX_AUTO_RETRY) {
                      retryCount++;
                      hlsInstance.startLoad();
                    } else {
                      setError('فشل الاتصال بالبث — تحقق من الشبكة');
                    }
                    break;
                  case Hls.ErrorTypes.MEDIA_ERROR:
                    hlsInstance.recoverMediaError();
                    break;
                  default:
                    setError('فشل تحميل البث المباشر');
                }
              }
            });
          }
        };
        if ((window as any).Hls) { loadHls(); }
        else {
          const s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.13/dist/hls.min.js';
          s.onload = loadHls;
          document.head.appendChild(s);
        }
      }
    } else {
      video.src = streamUrl;
      video.play().catch(() => {});
    }

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('error', onError);
      const mp = (video as any)._mpegtsPlayer;
      if (mp) { try { mp.destroy(); } catch {} (video as any)._mpegtsPlayer = null; }
      if (hlsInstance) { try { hlsInstance.destroy(); } catch {} }
    };
  }, [streamUrl]);

  useEffect(() => { scheduleHide(); return () => { if (hideTimer.current) clearTimeout(hideTimer.current); }; }, [scheduleHide]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) videoRef.current.play().catch(() => {});
    else videoRef.current.pause();
  };

  const handleSeekLive = () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (video.seekable && video.seekable.length > 0) {
        video.currentTime = Math.max(0, video.seekable.end(0) - 1);
      }
      video.play().catch(() => {});
      setIsAtLive(true);
    } catch {}
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setMuted(!muted);
  };

  const changeVolume = (v: number) => {
    if (!videoRef.current) return;
    videoRef.current.volume = v;
    setVolume(v);
    if (v === 0) { videoRef.current.muted = true; setMuted(true); }
    else if (muted) { videoRef.current.muted = false; setMuted(false); }
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      setIsFullscreen(false);
    } else {
      await containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    }
  };

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative w-full bg-black ${isFullscreen ? '' : 'rounded-xl sm:rounded-2xl aspect-video'} overflow-hidden shadow-2xl shadow-black/40 group select-none`}
      style={isFullscreen ? { height: '100vh' } : undefined}
      onMouseMove={scheduleHide}
      onTouchStart={scheduleHide}
      onClick={(e) => { if ((e.target as HTMLElement).closest('button, input')) return; scheduleHide(); }}
    >
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-contain bg-black"
        playsInline
        autoPlay
      />

      {/* Buffering */}
      {buffering && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-20 pointer-events-none">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 border-[3px] border-brand-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-white/70 text-xs font-medium">جارٍ التحميل...</span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20 gap-3">
          <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-white/80 text-sm font-medium">{error}</p>
          {onRetry && (
            <button onClick={(e) => { e.stopPropagation(); onRetry(); }}
              className="px-5 py-2 rounded-xl bg-brand-primary text-black font-bold text-sm hover:bg-brand-dark transition">
              إعادة المحاولة
            </button>
          )}
        </div>
      )}

      {/* Top gradient + channel info */}
      <div className={`absolute top-0 left-0 right-0 z-10 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="bg-gradient-to-b from-black/80 via-black/40 to-transparent px-3 sm:px-4 pt-2 sm:pt-3 pb-8 sm:pb-10">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              {logo && (
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-white/10 overflow-hidden flex-shrink-0">
                  <img src={logo} alt="" className="w-full h-full object-contain" onError={e => (e.target as HTMLImageElement).style.display = 'none'} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="text-white font-bold text-xs sm:text-sm leading-tight truncate">{title}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  {group && <span className="text-white/50 text-[10px] truncate">{group}</span>}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-red-400 text-[10px] font-bold">LIVE</span>
                  </div>
                </div>
              </div>
            </div>
            {onClose && (
              <button onClick={(e) => { e.stopPropagation(); onClose(); }}
                aria-label="إغلاق"
                className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 active:bg-white/30 transition flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bottom controls */}
      <div className={`absolute bottom-0 left-0 right-0 z-10 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 sm:px-4 pb-2 sm:pb-3 pt-8 sm:pt-10">
          <div className="flex items-center justify-between gap-2">
            {/* Left: play + volume */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                aria-label={playing ? 'إيقاف مؤقت' : 'تشغيل'}
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 active:bg-white/30 transition">
                {playing ? (
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6zm8 0h4v16h-4z" /></svg>
                ) : (
                  <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                )}
              </button>

              <button onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                aria-label={muted ? 'إلغاء الكتم' : 'كتم'}
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 active:bg-white/30 transition">
                {muted || volume === 0 ? (
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
                ) : (
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                )}
              </button>

              {/* Volume slider — hidden on mobile (tap mute button instead) */}
              <input
                type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume}
                onChange={e => { e.stopPropagation(); changeVolume(parseFloat(e.target.value)); }}
                onClick={e => e.stopPropagation()}
                aria-label="مستوى الصوت"
                className="hidden sm:block w-20 h-1 appearance-none bg-white/20 rounded-full cursor-pointer accent-brand-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand-primary"
              />
            </div>

            {/* Right: live + fullscreen */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {!isAtLive && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleSeekLive(); }}
                  className="flex items-center gap-1 bg-red-600 hover:bg-red-500 active:bg-red-700 rounded-full px-3 py-1.5 transition animate-pulse"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  <span className="text-white text-[11px] font-bold">مباشر</span>
                </button>
              )}

              <button onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                aria-label={isFullscreen ? 'خروج من ملء الشاشة' : 'ملء الشاشة'}
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 active:bg-white/30 transition">
                {isFullscreen ? (
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" /></svg>
                ) : (
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
