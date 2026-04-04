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
  const [viewerCount] = useState(Math.floor(Math.random() * 50) + 5);

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
    let mpegtsPlayer: any = null;
    let hlsInstance: any = null;

    const isTs = streamUrl.includes('/xtream-pipe/') || streamUrl.includes('.ts') || streamUrl.includes('/live-pipe/');
    const isHls = streamUrl.includes('.m3u8');

    const onPlay = () => { setPlaying(true); setBuffering(false); };
    const onPause = () => setPlaying(false);
    const onWaiting = () => setBuffering(true);
    const onPlaying = () => { setBuffering(false); setPlaying(true); };
    const onError = () => setError('فشل تحميل البث المباشر');

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('error', onError);

    if (isTs) {
      const loadMpegts = () => {
        const Mpegts = (window as any).mpegts;
        if (Mpegts && Mpegts.isSupported()) {
          mpegtsPlayer = Mpegts.createPlayer({
            type: 'mse', isLive: true, url: streamUrl,
            enableWorker: true,
            liveBufferLatencyChasing: true,
            liveBufferLatencyMaxLatency: 3,
            liveBufferLatencyMinRemain: 0.5,
          });
          mpegtsPlayer.attachMediaElement(video);
          mpegtsPlayer.load();
          mpegtsPlayer.play().catch(() => {});
          mpegtsPlayer.on('error', () => setError('فشل تحميل البث'));
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
        video.src = streamUrl;
        video.play().catch(() => {});
      } else {
        const loadHls = () => {
          const Hls = (window as any).Hls;
          if (Hls && Hls.isSupported()) {
            hlsInstance = new Hls({ enableWorker: true, lowLatencyMode: true });
            hlsInstance.loadSource(streamUrl);
            hlsInstance.attachMedia(video);
            hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
            hlsInstance.on(Hls.Events.ERROR, (_: any, data: any) => {
              if (data.fatal) setError('فشل تحميل البث');
            });
          }
        };
        if ((window as any).Hls) { loadHls(); }
        else {
          const s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest/dist/hls.min.js';
          s.onload = loadHls;
          document.head.appendChild(s);
        }
      }
    } else {
      video.src = streamUrl;
      video.play().catch(() => {});
    }

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('error', onError);
      if (mpegtsPlayer) { try { mpegtsPlayer.destroy(); } catch {} }
      if (hlsInstance) { try { hlsInstance.destroy(); } catch {} }
    };
  }, [streamUrl]);

  useEffect(() => { scheduleHide(); return () => { if (hideTimer.current) clearTimeout(hideTimer.current); }; }, [scheduleHide]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) videoRef.current.play().catch(() => {});
    else videoRef.current.pause();
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
      className="relative w-full bg-black rounded-2xl overflow-hidden shadow-2xl shadow-black/40 group select-none"
      style={{ paddingTop: isFullscreen ? '0' : '56.25%', height: isFullscreen ? '100vh' : undefined }}
      onMouseMove={scheduleHide}
      onClick={(e) => { if ((e.target as HTMLElement).closest('button, input')) return; togglePlay(); scheduleHide(); }}
    >
      <video
        ref={videoRef}
        className={`${isFullscreen ? 'w-full h-full' : 'absolute inset-0 w-full h-full'} object-contain bg-black`}
        playsInline
        autoPlay
      />

      {/* Buffering */}
      {buffering && !error && (
        <div className={`${isFullscreen ? 'fixed' : 'absolute'} inset-0 flex items-center justify-center bg-black/40 z-20 pointer-events-none`}>
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 border-[3px] border-brand-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-white/70 text-xs font-medium">جارٍ التحميل...</span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className={`${isFullscreen ? 'fixed' : 'absolute'} inset-0 flex flex-col items-center justify-center bg-black/80 z-20 gap-3`}>
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
      <div className={`${isFullscreen ? 'fixed' : 'absolute'} top-0 left-0 right-0 z-10 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="bg-gradient-to-b from-black/80 via-black/40 to-transparent px-4 pt-3 pb-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {logo && (
                <div className="w-8 h-8 rounded-lg bg-white/10 overflow-hidden flex-shrink-0">
                  <img src={logo} alt="" className="w-full h-full object-contain" onError={e => (e.target as HTMLImageElement).style.display = 'none'} />
                </div>
              )}
              <div>
                <h3 className="text-white font-bold text-sm leading-tight">{title}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  {group && <span className="text-white/50 text-[10px]">{group}</span>}
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-red-400 text-[10px] font-bold">LIVE</span>
                  </div>
                </div>
              </div>
            </div>
            {onClose && (
              <button onClick={(e) => { e.stopPropagation(); onClose(); }}
                className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bottom controls */}
      <div className={`${isFullscreen ? 'fixed' : 'absolute'} bottom-0 left-0 right-0 z-10 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 pb-3 pt-10">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {/* Play/Pause */}
              <button onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition">
                {playing ? (
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6zm8 0h4v16h-4z" /></svg>
                ) : (
                  <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                )}
              </button>

              {/* Volume */}
              <button onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition">
                {muted || volume === 0 ? (
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
                ) : (
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                )}
              </button>
              <input
                type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume}
                onChange={e => { e.stopPropagation(); changeVolume(parseFloat(e.target.value)); }}
                onClick={e => e.stopPropagation()}
                className="w-16 h-1 appearance-none bg-white/20 rounded-full cursor-pointer accent-brand-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand-primary"
              />
            </div>

            <div className="flex items-center gap-2">
              {/* Viewer count badge */}
              <div className="flex items-center gap-1 bg-white/10 backdrop-blur-sm rounded-full px-2.5 py-1">
                <svg className="w-3 h-3 text-white/70" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                  <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                </svg>
                <span className="text-white/70 text-[10px] font-bold">{viewerCount}</span>
              </div>

              {/* Fullscreen */}
              <button onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition">
                {isFullscreen ? (
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" /></svg>
                ) : (
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
