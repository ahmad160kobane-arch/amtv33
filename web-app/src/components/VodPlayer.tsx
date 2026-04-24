'use client';
import React, { useEffect, useRef, useState, useCallback } from 'react';

interface SubtitleTrack {
  language: string;
  label: string;
  url: string;
  format: string;
}

interface VodPlayerProps {
  streamUrl: string;
  title: string;
  poster?: string;
  subtitle?: string;
  subtitles?: SubtitleTrack[];
  onClose?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
}

function srtTimeToSec(t: string): number {
  const clean = t.trim().replace(',', '.');
  const dotIdx = clean.lastIndexOf('.');
  const hms = dotIdx >= 0 ? clean.slice(0, dotIdx) : clean;
  const ms = dotIdx >= 0 ? clean.slice(dotIdx + 1) : '0';
  const parts = hms.split(':').map(Number);
  const [h, m, s] = parts.length === 3 ? parts : [0, parts[0] ?? 0, parts[1] ?? 0];
  return h * 3600 + m * 60 + s + parseInt(ms.padEnd(3, '0').slice(0, 3)) / 1000;
}

function parseSrt(raw: string): { start: number; end: number; text: string }[] {
  const cues: { start: number; end: number; text: string }[] = [];
  const blocks = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split(/\n\s*\n/);
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    const ti = lines.findIndex(l => l.includes('-->'));
    if (ti < 0) continue;
    const arrow = lines[ti].split('-->');
    if (arrow.length < 2) continue;
    const text = lines.slice(ti + 1).join('\n').replace(/<[^>]+>/g, '').trim();
    if (text) cues.push({ start: srtTimeToSec(arrow[0]), end: srtTimeToSec(arrow[1]), text });
  }
  return cues;
}

function formatTime(sec: number): string {
  if (!sec || isNaN(sec)) return '0:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function VodPlayer({ streamUrl, title, poster, subtitle, subtitles, onClose, onNext, onPrev, hasNext, hasPrev }: VodPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<any>(null);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState('');
  const [buffering, setBuffering] = useState(true);
  const [showPoster, setShowPoster] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [seekPreview, setSeekPreview] = useState<number | null>(null);
  const [skipIndicator, setSkipIndicator] = useState<{ dir: 'fwd' | 'bwd'; key: number } | null>(null);
  const [activeSubtitle, setActiveSubtitle] = useState<SubtitleTrack | null>(null);
  const [subCues, setSubCues] = useState<{ start: number; end: number; text: string }[]>([]);
  const [currentSubText, setCurrentSubText] = useState('');
  const [showSubMenu, setShowSubMenu] = useState(false);
  const [subLoading, setSubLoading] = useState(false);
  const [isPiP, setIsPiP] = useState(false);
  const lastTapRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });

  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setShowControls(true);
    hideTimer.current = setTimeout(() => {
      if (playing && !showSpeedMenu) setShowControls(false);
    }, 3500);
  }, [playing, showSpeedMenu]);

  useEffect(() => {
    if (!videoRef.current || !streamUrl) return;
    const video = videoRef.current;
    setError('');
    setBuffering(true);
    setShowPoster(true);
    let hlsInstance: any = null;

    const isHls = streamUrl.includes('.m3u8');

    const onPlay = () => { setPlaying(true); setShowPoster(false); };
    const onPause = () => setPlaying(false);
    const onWaiting = () => setBuffering(true);
    const onPlaying = () => { setBuffering(false); setPlaying(true); setShowPoster(false); };
    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (video.buffered.length > 0) {
        setBuffered(video.buffered.end(video.buffered.length - 1));
      }
    };
    const onDurationChange = () => setDuration(video.duration || 0);
    const onError = () => setError('فشل تحميل الفيديو');
    const onEnded = () => { setPlaying(false); setShowControls(true); };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('durationchange', onDurationChange);
    video.addEventListener('error', onError);
    video.addEventListener('ended', onEnded);

    if (isHls) {
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamUrl;
      } else {
        const loadHls = () => {
          const Hls = (window as any).Hls;
          if (Hls && Hls.isSupported()) {
            hlsInstance = new Hls({
              enableWorker: true,
              lowLatencyMode: false,
              startLevel: -1,
              debug: false,
              startFragPrefetch: true,
              maxStarvationDelay: 6,
              maxLoadingDelay: 6,
              highBufferWatchdogPeriod: 3,
              maxBufferLength: 60,
              maxMaxBufferLength: 120,
              maxBufferSize: 80 * 1024 * 1024,
              maxBufferHole: 0.8,
              manifestLoadingTimeOut: 15000,
              manifestLoadingMaxRetry: 6,
              manifestLoadingRetryDelay: 500,
              levelLoadingTimeOut: 15000,
              levelLoadingMaxRetry: 6,
              levelLoadingRetryDelay: 500,
              fragLoadingTimeOut: 25000,
              fragLoadingMaxRetry: 6,
              fragLoadingRetryDelay: 500,
              fragLoadingMaxRetryTimeout: 12000,
            });
            hlsInstance.loadSource(streamUrl);
            hlsInstance.attachMedia(video);
            hlsInstance.on(Hls.Events.ERROR, (_: any, data: any) => {
              if (data.fatal) {
                switch (data.type) {
                  case Hls.ErrorTypes.NETWORK_ERROR:
                    hlsInstance.startLoad();
                    break;
                  case Hls.ErrorTypes.MEDIA_ERROR:
                    hlsInstance.recoverMediaError();
                    break;
                  default:
                    setError('فشل تحميل الفيديو');
                    break;
                }
              }
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
    }

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('durationchange', onDurationChange);
      video.removeEventListener('error', onError);
      video.removeEventListener('ended', onEnded);
      if (hlsInstance) { try { hlsInstance.destroy(); } catch {} }
      
      try {
        video.pause();
        video.removeAttribute('src');
        video.load();
      } catch {}
    };
  }, [streamUrl]);

  useEffect(() => { scheduleHide(); return () => { if (hideTimer.current) clearTimeout(hideTimer.current); }; }, [scheduleHide]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!videoRef.current) return;
      const v = videoRef.current;
      switch (e.key) {
        case ' ': case 'k': e.preventDefault(); v.paused ? v.play() : v.pause(); break;
        case 'ArrowRight': e.preventDefault(); v.currentTime = Math.min(v.duration, v.currentTime + 10); showSkip('fwd'); break;
        case 'ArrowLeft': e.preventDefault(); v.currentTime = Math.max(0, v.currentTime - 10); showSkip('bwd'); break;
        case 'ArrowUp': e.preventDefault(); v.volume = Math.min(1, v.volume + 0.1); setVolume(v.volume); break;
        case 'ArrowDown': e.preventDefault(); v.volume = Math.max(0, v.volume - 0.1); setVolume(v.volume); break;
        case 'f': e.preventDefault(); toggleFullscreen(); break;
        case 'm': e.preventDefault(); v.muted = !v.muted; setMuted(v.muted); break;
      }
      scheduleHide();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [scheduleHide]);

  const showSkip = (dir: 'fwd' | 'bwd') => {
    setSkipIndicator({ dir, key: Date.now() });
    setTimeout(() => setSkipIndicator(null), 700);
  };

  const selectSubtitle = useCallback(async (sub: SubtitleTrack | null) => {
    setShowSubMenu(false);
    if (!sub) { setActiveSubtitle(null); setSubCues([]); setCurrentSubText(''); return; }
    setActiveSubtitle(sub);
    setSubLoading(true);
    try {
      const r = await fetch(`/api/subtitle-proxy?url=${encodeURIComponent(sub.url)}`);
      const text = await r.text();
      setSubCues(parseSrt(text));
    } catch { setSubCues([]); }
    finally { setSubLoading(false); }
  }, []);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) videoRef.current.play().catch(() => {});
    else videoRef.current.pause();
  };

  const handlePlayStart = () => {
    if (!videoRef.current) return;
    setShowPoster(false);
    videoRef.current.play().catch(() => {});
  };

  const seek = (fraction: number) => {
    if (!videoRef.current || !duration) return;
    videoRef.current.currentTime = fraction * duration;
  };

  const handleProgressClick = (e: React.MouseEvent) => {
    if (!progressRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seek(fraction);
  };

  const handleProgressHover = (e: React.MouseEvent) => {
    if (!progressRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setSeekPreview(fraction * duration);
  };

  const skip = (seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds));
    showSkip(seconds > 0 ? 'fwd' : 'bwd');
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

  const changeSpeed = (rate: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSpeedMenu(false);
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

  useEffect(() => {
    if (!subCues.length) { setCurrentSubText(''); return; }
    const cue = subCues.find(c => currentTime >= c.start && currentTime <= c.end);
    setCurrentSubText(cue ? cue.text : '');
  }, [currentTime, subCues]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className="relative w-full bg-black rounded-2xl overflow-hidden shadow-2xl shadow-black/40 group select-none"
      style={{ paddingTop: isFullscreen ? '0' : '56.25%', height: isFullscreen ? '100vh' : undefined }}
      onMouseMove={scheduleHide}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button, input, [data-menu]')) return;
        togglePlay(); scheduleHide();
      }}
    >
      <video
        ref={videoRef}
        className={`${isFullscreen ? 'w-full h-full' : 'absolute inset-0 w-full h-full'} object-contain bg-black`}
        playsInline
        poster={poster}
      />

      {/* Poster overlay with play button */}
      {showPoster && poster && !error && (
        <div className={`${isFullscreen ? 'fixed' : 'absolute'} inset-0 z-20 flex items-center justify-center`}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          {poster && <img src={poster} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />}
          <button onClick={(e) => { e.stopPropagation(); handlePlayStart(); }}
            className="relative z-10 w-20 h-20 rounded-full bg-brand-primary/90 flex items-center justify-center hover:bg-brand-primary hover:scale-110 transition-all duration-200 shadow-2xl shadow-brand-primary/30">
            <svg className="w-8 h-8 text-black ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
          </button>
          <div className="absolute bottom-6 left-0 right-0 text-center z-10">
            <h3 className="text-white font-bold text-lg drop-shadow-lg">{title}</h3>
            {subtitle && <p className="text-white/60 text-sm mt-0.5">{subtitle}</p>}
          </div>
        </div>
      )}

      {/* Buffering */}
      {buffering && !error && !showPoster && (
        <div className={`${isFullscreen ? 'fixed' : 'absolute'} inset-0 flex items-center justify-center bg-black/30 z-20 pointer-events-none`}>
          <div className="w-12 h-12 border-[3px] border-brand-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Skip indicator */}
      {skipIndicator && (
        <div className={`${isFullscreen ? 'fixed' : 'absolute'} inset-0 flex items-center z-20 pointer-events-none ${skipIndicator.dir === 'fwd' ? 'justify-end pr-20' : 'justify-start pl-20'}`}>
          <div className="flex flex-col items-center animate-ping">
            {skipIndicator.dir === 'fwd' ? (
              <svg className="w-10 h-10 text-white/80" fill="currentColor" viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" /></svg>
            ) : (
              <svg className="w-10 h-10 text-white/80" fill="currentColor" viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z" /></svg>
            )}
            <span className="text-white/80 text-xs font-bold mt-1">10 ثانية</span>
          </div>
        </div>
      )}

      {/* Error with retry */}
      {error && (
        <div className={`${isFullscreen ? 'fixed' : 'absolute'} inset-0 flex flex-col items-center justify-center bg-black/80 z-20 gap-3`}>
          <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-white/80 text-sm font-medium">{error}</p>
          <button onClick={(e) => { e.stopPropagation(); setError(''); setBuffering(true); if (videoRef.current) { videoRef.current.load(); videoRef.current.play().catch(() => {}); } }}
            className="px-5 py-2 rounded-xl bg-brand-primary text-black font-bold text-sm hover:bg-brand-dark transition">
            إعادة المحاولة
          </button>
        </div>
      )}

      {/* Subtitle overlay */}
      {currentSubText && (
        <div className={`${isFullscreen ? 'fixed' : 'absolute'} bottom-24 left-0 right-0 flex justify-center z-10 pointer-events-none px-4`}>
          <div className="bg-black/80 text-white text-sm sm:text-base px-4 py-2 rounded-lg text-center leading-loose max-w-[90%] whitespace-pre-line font-medium shadow-lg" style={{ textShadow: '1px 1px 3px rgba(0,0,0,1)' }} dir="rtl">
            {currentSubText}
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className={`${isFullscreen ? 'fixed' : 'absolute'} top-0 left-0 right-0 z-10 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="bg-gradient-to-b from-black/70 via-black/30 to-transparent px-4 pt-3 pb-8">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-bold text-sm leading-tight truncate">{title}</h3>
              {subtitle && <p className="text-white/50 text-xs truncate mt-0.5">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-1.5 ml-3">
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
      </div>

      {/* Bottom controls */}
      <div className={`${isFullscreen ? 'fixed' : 'absolute'} bottom-0 left-0 right-0 z-10 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 pb-3 pt-8">

          {/* Progress bar */}
          <div className="mb-2.5 group/progress">
            <div
              ref={progressRef}
              className="relative h-1.5 group-hover/progress:h-2.5 bg-white/20 rounded-full cursor-pointer transition-all duration-150"
              onClick={(e) => { e.stopPropagation(); handleProgressClick(e); }}
              onMouseMove={handleProgressHover}
              onMouseLeave={() => setSeekPreview(null)}
            >
              {/* Buffered */}
              <div className="absolute top-0 left-0 h-full bg-white/15 rounded-full transition-all" style={{ width: `${bufferedPct}%` }} />
              {/* Progress */}
              <div className="absolute top-0 left-0 h-full bg-brand-primary rounded-full transition-all" style={{ width: `${progress}%` }}>
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-brand-primary shadow-lg opacity-0 group-hover/progress:opacity-100 transition-opacity" style={{ transform: 'translate(50%, -50%)' }} />
              </div>
              {/* Seek preview */}
              {seekPreview !== null && (
                <div className="absolute -top-8 bg-black/80 text-white text-[10px] font-bold px-2 py-1 rounded-lg pointer-events-none"
                  style={{ left: `${(seekPreview / (duration || 1)) * 100}%`, transform: 'translateX(-50%)' }}>
                  {formatTime(seekPreview)}
                </div>
              )}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-white/50 text-[10px] font-mono">{formatTime(currentTime)}</span>
              <span className="text-white/50 text-[10px] font-mono">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Control buttons */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {/* Play/Pause */}
              <button onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition">
                {playing ? (
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6zm8 0h4v16h-4z" /></svg>
                ) : (
                  <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                )}
              </button>

              {/* Skip backward */}
              <button onClick={(e) => { e.stopPropagation(); skip(-10); }}
                className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z" /></svg>
              </button>

              {/* Skip forward */}
              <button onClick={(e) => { e.stopPropagation(); skip(10); }}
                className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" /></svg>
              </button>

              {/* Prev/Next episode */}
              {hasPrev && onPrev && (
                <button onClick={(e) => { e.stopPropagation(); onPrev(); }}
                  className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg>
                </button>
              )}
              {hasNext && onNext && (
                <button onClick={(e) => { e.stopPropagation(); onNext(); }}
                  className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M16 18h2V6h-2zM6 18l8.5-6L6 6z" /></svg>
                </button>
              )}

              {/* Volume */}
              <button onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition hidden sm:flex">
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
                className="w-16 h-1 appearance-none bg-white/20 rounded-full cursor-pointer accent-brand-primary hidden sm:block [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand-primary"
              />
            </div>

            <div className="flex items-center gap-1.5">
              {/* Speed */}
              <div className="relative" data-menu>
                <button onClick={(e) => { e.stopPropagation(); setShowSpeedMenu(!showSpeedMenu); setShowSubMenu(false); }}
                  className="h-7 px-2 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition">
                  <span className="text-white text-[10px] font-bold">{playbackRate}x</span>
                </button>
                {showSpeedMenu && (
                  <div className="absolute bottom-full mb-2 right-0 bg-black/90 backdrop-blur-xl rounded-xl border border-white/10 py-1.5 min-w-[80px] shadow-2xl" data-menu>
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map(rate => (
                      <button key={rate} onClick={(e) => { e.stopPropagation(); changeSpeed(rate); }}
                        className={`block w-full text-center px-3 py-1.5 text-xs font-medium transition ${playbackRate === rate ? 'text-brand-primary bg-brand-primary/10' : 'text-white/70 hover:text-white hover:bg-white/5'}`}>
                        {rate}x
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Subtitle selector */}
              {subtitles !== undefined && (
                <div className="relative" data-menu>
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowSubMenu(v => !v); setShowSpeedMenu(false); }}
                    className={`h-7 px-2 rounded-lg backdrop-blur-sm flex items-center gap-1 justify-center hover:bg-white/20 transition ${activeSubtitle ? 'bg-brand-primary/30 border border-brand-primary/50' : 'bg-white/10'}`}
                    title="الترجمة"
                  >
                    <svg className={`w-4 h-4 ${activeSubtitle ? 'text-brand-primary' : 'text-white'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h6m-3 4h2M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />
                    </svg>
                    {subLoading && <div className="w-2.5 h-2.5 border border-brand-primary border-t-transparent rounded-full animate-spin" />}
                  </button>
                  {showSubMenu && (
                    <div className="absolute bottom-full mb-2 right-0 bg-black/90 backdrop-blur-xl rounded-xl border border-white/10 py-1.5 min-w-[140px] shadow-2xl max-h-52 overflow-y-auto" data-menu>
                      {subtitles.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-white/40 text-right">
                          {subLoading ? 'جارٍ البحث...' : 'لا توجد ترجمات'}
                        </div>
                      ) : (
                        <>
                          <button onClick={(e) => { e.stopPropagation(); selectSubtitle(null); }}
                            className={`block w-full text-right px-3 py-1.5 text-xs font-medium transition ${!activeSubtitle ? 'text-brand-primary bg-brand-primary/10' : 'text-white/70 hover:text-white hover:bg-white/5'}`}>
                            إيقاف الترجمة
                          </button>
                          {subtitles.map((sub, i) => (
                            <button key={i} onClick={(e) => { e.stopPropagation(); selectSubtitle(sub); }}
                              className={`block w-full text-right px-3 py-1.5 text-xs font-medium transition ${activeSubtitle?.url === sub.url ? 'text-brand-primary bg-brand-primary/10' : 'text-white/70 hover:text-white hover:bg-white/5'}`}>
                              {sub.label}
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

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
