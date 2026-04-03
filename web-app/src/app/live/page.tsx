'use client';
import React, { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { fetchFreeChannels, requestFreeStream, FreeChannel } from '@/constants/api';
import { SkeletonChannelCard } from '@/components/Skeleton';

function HlsPlayer({ streamUrl, title }: { streamUrl: string; title: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!videoRef.current || !streamUrl) return;
    const video = videoRef.current;

    const isHls = streamUrl.includes('.m3u8') || streamUrl.includes('m3u');
    const isTs  = streamUrl.includes('/xtream-pipe/') || streamUrl.includes('.ts');

    if (isTs) {
      // Raw MPEG-TS pipe — use mpegts.js via MSE
      const loadMpegts = () => {
        const Mpegts = (window as any).mpegts;
        if (Mpegts && Mpegts.isSupported()) {
          const player = Mpegts.createPlayer({ type: 'mse', isLive: true, url: streamUrl });
          player.attachMediaElement(video);
          player.load();
          player.play().catch(() => {});
          (video as any)._mpegts = player;
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
      return () => {
        const p = (video as any)._mpegts;
        if (p) { try { p.destroy(); } catch {} delete (video as any)._mpegts; }
      };
    }

    if (isHls) {
      // HLS — try native (Safari) then hls.js
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamUrl;
        video.play().catch(() => {});
        return;
      }
      const loadHls = () => {
        const Hls = (window as any).Hls;
        if (Hls && Hls.isSupported()) {
          const hls = new Hls({ enableWorker: false });
          hls.loadSource(streamUrl);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
          (video as any)._hls = hls;
        }
      };
      if ((window as any).Hls) {
        loadHls();
      } else {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest/dist/hls.min.js';
        script.onload = loadHls;
        document.head.appendChild(script);
      }
      return () => { const h = (video as any)._hls; if (h) { h.destroy(); delete (video as any)._hls; } };
    }

    video.src = streamUrl;
    video.play().catch(() => {});
  }, [streamUrl]);

  return (
    <video
      ref={videoRef}
      className="absolute inset-0 w-full h-full bg-black"
      controls
      autoPlay
      playsInline
      title={title}
    />
  );
}

function LiveContent() {
  const params = useSearchParams();
  const [channels, setChannels] = useState<FreeChannel[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [filtered, setFiltered] = useState<FreeChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeGroup, setActiveGroup] = useState('');
  const [logoErrors, setLogoErrors] = useState<Set<string>>(new Set());
  const [activeChannel, setActiveChannel] = useState<FreeChannel | null>(null);
  const [streamUrl, setStreamUrl] = useState('');
  const [streamLoading, setStreamLoading] = useState(false);
  const [streamError, setStreamError] = useState('');

  const selectChannel = useCallback(async (ch: FreeChannel) => {
    setActiveChannel(ch);
    setStreamUrl('');
    setStreamError('');
    setStreamLoading(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    try {
      const result = await requestFreeStream(ch.id);
      if (result.success && result.streamUrl) {
        setStreamUrl(result.streamUrl);
      } else {
        setStreamError(result.error || 'فشل تحميل القناة');
      }
    } catch {
      setStreamError('خطأ في الاتصال');
    } finally {
      setStreamLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await fetchFreeChannels({ limit: 200 });
      const chs = data.channels || [];
      setChannels(chs);
      setFiltered(chs);
      const grps = Array.from(new Set(chs.map((c: FreeChannel) => c.group).filter(Boolean))) as string[];
      setGroups(grps);
      const id = params.get('channelId');
      if (id) { const found = chs.find((c: FreeChannel) => c.id === id); if (found) selectChannel(found); }
    } catch (e) {
      console.error('Live channels load error:', e);
    } finally {
      setLoading(false);
    }
  }, [params, selectChannel]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let list = channels;
    if (activeGroup) list = list.filter(c => c.group === activeGroup);
    if (search.trim()) list = list.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
    setFiltered(list);
  }, [search, activeGroup, channels]);

  const ChannelGrid = () => (
    <>
      {/* Search */}
      <div className="relative mb-3">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث عن قناة..."
          className="w-full bg-light-input dark:bg-dark-input text-light-text dark:text-dark-text rounded-xl px-4 py-3 pr-10 text-sm font-medium placeholder:text-light-muted dark:placeholder:text-dark-muted focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
        <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-light-muted dark:text-dark-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      {/* Group filter */}
      {groups.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-3">
          <button onClick={() => setActiveGroup('')} className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition ${activeGroup === '' ? 'bg-brand-primary text-black' : 'bg-light-input dark:bg-dark-input text-light-muted dark:text-dark-muted'}`}>الكل</button>
          {groups.map(g => (
            <button key={g} onClick={() => setActiveGroup(g === activeGroup ? '' : g)} className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition ${activeGroup === g ? 'bg-brand-primary text-black' : 'bg-light-input dark:bg-dark-input text-light-muted dark:text-dark-muted'}`}>{g}</button>
          ))}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
          {Array.from({ length: 12 }).map((_, i) => <SkeletonChannelCard key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <svg className="w-10 h-10 text-dark-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" /></svg>
          <p className="text-dark-muted text-sm">لا توجد قنوات</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-light-muted dark:text-dark-muted mb-3">{filtered.length} قناة</p>
          <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
            {filtered.map(ch => (
              <button key={ch.id} onClick={() => selectChannel(ch)}
                className={`flex flex-col items-center p-3 rounded-xl transition relative ${activeChannel?.id === ch.id ? 'bg-brand-primary/15 border border-brand-primary/40' : 'bg-light-card dark:bg-dark-card hover:bg-light-input dark:hover:bg-dark-input'}`}>
                <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-brand-success live-dot" />
                <div className="w-14 h-10 rounded-lg bg-light-input dark:bg-dark-input flex items-center justify-center mb-2 overflow-hidden">
                  {ch.logo && !logoErrors.has(ch.id) ? (
                    <img src={ch.logo} alt={ch.name} className="w-full h-full object-contain" onError={() => setLogoErrors(p => new Set(p).add(ch.id))} />
                  ) : (
                    <svg className="w-5 h-5 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" /></svg>
                  )}
                </div>
                <span className="text-[10px] font-bold text-light-text dark:text-dark-text text-center line-clamp-1 w-full">{ch.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-light-bg dark:bg-dark-bg pb-24 md:pb-6">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <div className="flex items-center gap-2 py-4">
          <h1 className="text-xl font-black text-light-text dark:text-dark-text">البث المباشر</h1>
          <div className="w-2 h-2 rounded-full bg-brand-success live-dot" />
        </div>

        {/* ── Desktop: player left + channels right | Mobile: stacked ── */}
        <div className="lg:flex lg:gap-6 lg:items-start">

          {/* LEFT — Player (desktop: 2/3, mobile: full width above) */}
          <div className="lg:flex-1 min-w-0">
            {/* Mobile: channels ABOVE player */}
            <div className="lg:hidden mb-4"><ChannelGrid /></div>

            {/* Player */}
            {activeChannel ? (
              <div className="rounded-xl overflow-hidden bg-black shadow-2xl mb-4">
                <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
                  {streamLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black">
                      <div className="w-10 h-10 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  {streamError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black gap-2">
                      <svg className="w-8 h-8 text-brand-error" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <p className="text-white/70 text-sm">{streamError}</p>
                    </div>
                  )}
                  {streamUrl && !streamLoading && <HlsPlayer streamUrl={streamUrl} title={activeChannel.name} />}
                </div>
                <div className="px-4 py-3 flex items-center justify-between bg-black/80">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-brand-success live-dot" />
                    <span className="text-white font-bold text-sm">{activeChannel.name}</span>
                    {activeChannel.group && <span className="text-xs text-white/40 bg-white/10 px-2 py-0.5 rounded">{activeChannel.group}</span>}
                  </div>
                  <button onClick={() => { setActiveChannel(null); setStreamUrl(''); }} className="text-white/60 hover:text-white text-xs transition">إغلاق</button>
                </div>
              </div>
            ) : (
              /* Desktop placeholder when no channel selected */
              <div className="hidden lg:flex rounded-xl bg-dark-card border border-dark-border items-center justify-center mb-4" style={{ paddingTop: '56.25%', position: 'relative' }}>
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <svg className="w-14 h-14 text-dark-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                  </svg>
                  <p className="text-dark-muted text-sm">اختر قناة من القائمة</p>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT — Channel list (desktop sidebar, sticky) */}
          <div className="hidden lg:block lg:w-80 xl:w-96 flex-shrink-0">
            <div className="sticky top-4 max-h-[calc(100vh-5rem)] overflow-y-auto no-scrollbar">
              <ChannelGrid />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default function LivePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-dark-bg flex items-center justify-center"><div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" /></div>}>
      <LiveContent />
    </Suspense>
  );
}
