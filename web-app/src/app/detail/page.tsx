'use client';
import React, { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { fetchVidsrcDetail, requestVidsrcStream, checkFavorite, toggleFavorite, addWatchHistory, isLoggedIn, VidsrcDetail, VidsrcEpisode } from '@/constants/api';
import VodPlayer from '@/components/VodPlayer';

/* ─── YouTube-style Detail Page ─────────────────────────────────── */

function DetailContent() {
  const params = useSearchParams();
  const router = useRouter();
  const contentId = params.get('id') || '';
  const vodType = params.get('type') || params.get('vodType') || 'movie';
  const paramTitle = params.get('title') || '';
  const paramPoster = params.get('poster') || '';

  const [detail, setDetail] = useState<VidsrcDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFav, setIsFav] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [currentSeason, setCurrentSeason] = useState(1);
  const [currentEpisode, setCurrentEpisode] = useState<VidsrcEpisode | null>(null);
  const [streamUrl, setStreamUrl] = useState('');
  const [embedUrl, setEmbedUrl] = useState('');
  const [embedSources, setEmbedSources] = useState<{url:string,name:string}[]>([]);
  const [embedSourceIdx, setEmbedSourceIdx] = useState(0);
  const [streamLoading, setStreamLoading] = useState(false);
  const [streamError, setStreamError] = useState('');
  const [descExpanded, setDescExpanded] = useState(false);
  const [posterError, setPosterError] = useState(false);
  const [subtitles, setSubtitles] = useState<any[]>([]);
  const [clickShield, setClickShield] = useState(true);
  const historyRecorded = useRef('');
  const playerRef = useRef<HTMLDivElement>(null);
  const episodesRef = useRef<HTMLDivElement>(null);

  const isSeries = vodType === 'series' || vodType === 'tv' || detail?.vod_type === 'series';
  const fetchType = isSeries ? 'tv' : 'movie';
  const title = detail?.title || paramTitle;
  const poster = detail?.poster || paramPoster;
  const backdrop = detail?.backdrop || poster;
  const description = detail?.description || '';
  const hasStream = !!(streamUrl || embedUrl);

  const loadData = useCallback(async () => {
    if (!contentId) return;
    try {
      const data = await fetchVidsrcDetail(fetchType as 'movie' | 'tv', contentId);
      setDetail(data);
      const logged = await isLoggedIn();
      setLoggedIn(logged);
      if (logged) {
        const fav = await checkFavorite(contentId);
        setIsFav(fav);
      }
    } catch (e) {
      console.error('Detail load error:', e);
    } finally {
      setLoading(false);
    }
  }, [contentId, fetchType]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Anti-popup: block ALL popups/new tabs globally ──
  useEffect(() => {
    if (!embedUrl) return;
    setClickShield(true);

    // Override window.open to prevent any popup
    const origOpen = window.open;
    window.open = function () { return null; };

    // Block clicks that try to open new tabs via anchor tags
    const blockAnchors = (e: MouseEvent) => {
      const a = (e.target as HTMLElement)?.closest?.('a[target="_blank"]') as HTMLAnchorElement | null;
      if (a) { e.preventDefault(); e.stopPropagation(); }
    };
    document.addEventListener('click', blockAnchors, true);

    // Re-focus our window if something steals focus
    const refocus = () => { setTimeout(() => window.focus(), 30); };
    window.addEventListener('blur', refocus);

    return () => {
      window.open = origOpen;
      document.removeEventListener('click', blockAnchors, true);
      window.removeEventListener('blur', refocus);
    };
  }, [embedUrl]);

  const handleFav = async () => {
    if (!loggedIn) { router.push('/account'); return; }
    const res = await toggleFavorite({ item_id: contentId, item_type: 'vod', title, poster, content_type: isSeries ? 'series' : 'movie' });
    setIsFav(res.favorited);
  };

  const applyStreamResult = (result: any) => {
    if (result.subtitles?.length) setSubtitles(result.subtitles);
    const hls = result.hlsUrl || result.vodUrl || '';
    if (hls) {
      setStreamUrl(hls);
      setEmbedUrl('');
    } else if (result.embedUrl) {
      const srcs: {url:string,name:string}[] = result.sources?.length
        ? result.sources
        : (result.allEmbedUrls?.length
          ? result.allEmbedUrls.map((u:string,i:number)=>({url:u,name:`مصدر ${i+1}`}))
          : [{url:result.embedUrl,name:'مصدر 1'}]);
      setEmbedSources(srcs);
      setEmbedSourceIdx(0);
      setEmbedUrl(srcs[0].url);
      setStreamUrl('');
    } else {
      setStreamError(result.error || 'فشل تحميل المحتوى');
    }
  };

  const fetchSubtitles = useCallback(async (tmdbId: string, type: string, season?: number, episode?: number) => {
    try {
      let url = `/api/subtitles?tmdbId=${tmdbId}&type=${type}`;
      if (type === 'tv' && season && episode) url += `&season=${season}&episode=${episode}`;
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';
      const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const data = await res.json();
      if (data.subtitles?.length) setSubtitles(data.subtitles);
    } catch {}
  }, []);

  const startStream = useCallback(async (ep?: VidsrcEpisode) => {
    setStreamLoading(true);
    setStreamError('');
    setStreamUrl('');
    setEmbedUrl('');
    setSubtitles([]);
    setTimeout(() => playerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    try {
      const type = ep ? 'tv' : 'movie';
      const result = await requestVidsrcStream({
        tmdbId: detail?.tmdb_id || contentId,
        type,
        ...(ep ? { season: ep.season, episode: ep.episode } : {}),
        title,
      });
      if (result.success) {
        applyStreamResult(result);
        const key = ep ? `${contentId}_${ep.season}_${ep.episode}` : contentId;
        if (key !== historyRecorded.current && loggedIn) {
          historyRecorded.current = key;
          addWatchHistory({ item_id: contentId, item_type: 'vod', title, poster, content_type: isSeries ? 'series' : 'movie' });
        }
        if (!result.subtitles?.length) fetchSubtitles(detail?.tmdb_id || contentId, type, ep?.season, ep?.episode);
      } else {
        setStreamError(result.error || 'فشل تحميل المحتوى');
      }
    } catch {
      setStreamError('خطأ في الاتصال');
    } finally {
      setStreamLoading(false);
    }
  }, [detail, contentId, title, poster, isSeries, loggedIn, fetchSubtitles]);

  const handleEpisodePlay = useCallback((ep: VidsrcEpisode) => {
    setCurrentEpisode(ep);
    startStream(ep);
  }, [startStream]);

  const seasons: number[] = detail?.seasons || [];
  const episodes: VidsrcEpisode[] = (detail?.episodes || []).filter(e => e.season === currentSeason);

  const getNextEpisode = useCallback((): VidsrcEpisode | null => {
    if (!currentEpisode) return episodes[0] || null;
    const idx = episodes.findIndex(e => e.episode === currentEpisode.episode);
    if (idx >= 0 && idx < episodes.length - 1) return episodes[idx + 1];
    return (detail?.episodes || []).filter(e => e.season === currentSeason + 1)[0] || null;
  }, [currentEpisode, episodes, detail, currentSeason]);

  const getPrevEpisode = useCallback((): VidsrcEpisode | null => {
    if (!currentEpisode) return null;
    const idx = episodes.findIndex(e => e.episode === currentEpisode.episode);
    if (idx > 0) return episodes[idx - 1];
    const prev = (detail?.episodes || []).filter(e => e.season === currentSeason - 1);
    return prev[prev.length - 1] || null;
  }, [currentEpisode, episodes, detail, currentSeason]);

  /* ── Player area (always rendered) ── */
  const PlayerArea = () => {
    const isActive = hasStream || streamLoading || !!streamError;
    return (
      <div ref={playerRef} className="relative w-full bg-black" style={{ aspectRatio: '16/9' }}>
        {/* Poster/Backdrop behind player */}
        {!isActive && backdrop && !posterError && (
          <img src={backdrop} alt={title}
            className="absolute inset-0 w-full h-full object-cover opacity-60"
            onError={() => setPosterError(true)} />
        )}
        {!isActive && <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />}

        {/* Loading state */}
        {streamLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 z-10">
            <div className="w-14 h-14 border-[3px] border-brand-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-white/70 text-sm">جارٍ تحميل المحتوى...</span>
          </div>
        )}

        {/* Error state */}
        {streamError && !streamLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/90 z-10 px-6 text-center">
            <svg className="w-12 h-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-white/80 text-sm">{streamError}</p>
            <button onClick={() => startStream(currentEpisode || undefined)}
              className="px-6 py-2.5 rounded-xl bg-brand-primary text-black font-bold text-sm hover:bg-brand-dark transition">
              إعادة المحاولة
            </button>
          </div>
        )}

        {/* HLS Player */}
        {streamUrl && !streamLoading && !streamError && (
          <div className="absolute inset-0">
            <VodPlayer
              streamUrl={streamUrl}
              title={title}
              poster={poster}
              subtitle={isSeries && currentEpisode ? `${currentEpisode.title || 'الحلقة ' + currentEpisode.episode} — الموسم ${currentSeason}` : undefined}
              subtitles={subtitles}
              onClose={() => { setStreamUrl(''); setStreamError(''); setSubtitles([]); }}
              hasNext={isSeries && !!getNextEpisode()}
              hasPrev={isSeries && !!getPrevEpisode()}
              onNext={isSeries ? () => { const n = getNextEpisode(); if (n) handleEpisodePlay(n); } : undefined}
              onPrev={isSeries ? () => { const p = getPrevEpisode(); if (p) handleEpisodePlay(p); } : undefined}
            />
          </div>
        )}

        {/* Embed iframe player */}
        {embedUrl && !streamUrl && !streamLoading && !streamError && (
          <div className="absolute inset-0 flex flex-col bg-black">
            {/* Close button only */}
            <button onClick={() => { setEmbedUrl(''); setStreamError(''); }}
              className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-black/80 transition text-white/50 hover:text-white text-lg leading-none">✕</button>
            {/* Click shield — absorbs first click (ad trigger) then disappears */}
            {clickShield && (
              <div className="absolute inset-0 z-[15] flex items-center justify-center cursor-pointer bg-transparent"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setClickShield(false); }}>
                <div className="bg-black/70 backdrop-blur-sm rounded-2xl px-6 py-3 flex items-center gap-2 pointer-events-none">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                  <span className="text-white text-sm font-semibold">اضغط لتشغيل</span>
                </div>
              </div>
            )}
            <iframe
              key={embedUrl}
              src={embedUrl}
              className="flex-1 w-full border-0"
              allowFullScreen
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
              referrerPolicy="no-referrer-when-downgrade"
            />
            {/* Arabic subtitle download links */}
            {subtitles.length > 0 && (
              <div className="flex-shrink-0 px-3 py-1.5 bg-black/95 border-t border-white/10 flex items-center gap-2 overflow-x-auto no-scrollbar">
                <svg className="w-3.5 h-3.5 text-brand-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h6m-3 4h2M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />
                </svg>
                <span className="text-white/40 text-[10px] font-semibold flex-shrink-0">ترجمة:</span>
                {subtitles.map((sub: any, i: number) => (
                  <a key={i} href={sub.url} target="_blank" rel="noopener noreferrer" download
                    className="text-[10px] px-2.5 py-1 rounded-full bg-brand-primary/20 text-brand-primary hover:bg-brand-primary/40 transition whitespace-nowrap flex-shrink-0 font-semibold">
                    ⬇ {sub.label || sub.language || 'العربية'}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Big Play Button overlay (not active) */}
        {!isActive && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <button
              onClick={() => isSeries ? handleEpisodePlay(episodes[0] || { season: 1, episode: 1 } as VidsrcEpisode) : startStream()}
              className="group flex items-center gap-3 bg-brand-primary hover:bg-brand-dark text-black font-black px-8 py-4 rounded-2xl text-lg shadow-2xl shadow-brand-primary/40 transition-all hover:scale-105 active:scale-95">
              <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              {isSeries ? (loading ? 'تحميل...' : `الحلقة ${currentEpisode?.episode || 1}`) : 'مشاهدة الآن'}
            </button>
          </div>
        )}

        {/* Back button */}
        <button onClick={() => router.back()}
          className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-black/80 transition">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    );
  };

  /* ── Info section below player ── */
  const InfoSection = () => (
    <div className="px-4 pt-3 pb-2">
      {/* Title */}
      {loading ? (
        <div className="h-6 w-3/4 rounded-lg bg-light-input dark:bg-dark-input skeleton mb-2" />
      ) : (
        <h1 className="text-xl md:text-2xl font-black text-light-text dark:text-white leading-tight mb-1">{title}</h1>
      )}

      {/* Meta badges row */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        {loading ? (
          <div className="h-5 w-32 rounded bg-light-input dark:bg-dark-input skeleton" />
        ) : (
          <>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${isSeries ? 'bg-indigo-500/20 text-indigo-400' : 'bg-brand-primary/20 text-brand-primary'}`}>
              {isSeries ? 'مسلسل' : 'فيلم'}
            </span>
            {detail?.year && <span className="text-xs text-light-muted dark:text-dark-muted">{detail.year}</span>}
            {detail?.rating && (
              <div className="flex items-center gap-1 bg-amber-500/15 px-1.5 py-0.5 rounded-full">
                <svg className="w-3 h-3 text-amber-400 fill-amber-400" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="text-xs text-amber-400 font-bold">{detail.rating}</span>
              </div>
            )}
            {detail?.runtime && <span className="text-xs text-light-muted dark:text-dark-muted">{detail.runtime}</span>}
            {isSeries && seasons.length > 0 && (
              <span className="text-xs text-light-muted dark:text-dark-muted">{seasons.length} موسم</span>
            )}
          </>
        )}
      </div>

      {/* Action buttons row — YouTube style */}
      <div className="flex items-center gap-2 pb-3 mb-3 border-b border-light-border dark:border-dark-border overflow-x-auto no-scrollbar">
        <button onClick={handleFav}
          className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition flex-shrink-0 ${isFav ? 'bg-red-500/15 text-red-400' : 'bg-light-card dark:bg-dark-card text-light-muted dark:text-dark-muted hover:bg-light-input dark:hover:bg-dark-input'}`}>
          <svg className={`w-5 h-5 ${isFav ? 'fill-red-400' : ''}`} fill={isFav ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          <span className="text-[10px] font-semibold">{isFav ? 'مفضل' : 'أضف للمفضلة'}</span>
        </button>

        {detail?.trailer && (
          <a href={`https://www.youtube.com/watch?v=${detail.trailer}`} target="_blank" rel="noopener noreferrer"
            className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl bg-light-card dark:bg-dark-card text-light-muted dark:text-dark-muted hover:bg-light-input dark:hover:bg-dark-input transition flex-shrink-0">
            <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
            <span className="text-[10px] font-semibold">الإعلان</span>
          </a>
        )}

        {detail?.genres && detail.genres.slice(0, 3).map((g: string) => (
          <span key={g} className="px-3 py-1.5 rounded-full bg-light-card dark:bg-dark-card text-light-muted dark:text-dark-muted text-xs font-medium flex-shrink-0">{g}</span>
        ))}
      </div>

      {/* Description — collapsed by default like YouTube */}
      {description && (
        <div className="mb-3 bg-light-card dark:bg-dark-card rounded-xl p-3 cursor-pointer" onClick={() => setDescExpanded(v => !v)}>
          <p className={`text-sm text-light-text dark:text-dark-text leading-relaxed ${descExpanded ? '' : 'line-clamp-2'}`}>{description}</p>
          <span className="text-xs font-bold text-light-text dark:text-dark-text mt-1 block">
            {descExpanded ? 'عرض أقل ▲' : 'المزيد ▼'}
          </span>
        </div>
      )}

      {/* Cast/Director/Meta grid */}
      {(detail?.cast || detail?.director || detail?.runtime || detail?.country) && (
        <div className="grid grid-cols-2 gap-2 mb-4">
          {detail?.director && (
            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-light-card dark:bg-dark-card">
              <svg className="w-3.5 h-3.5 text-brand-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <div><p className="text-[10px] text-light-muted dark:text-dark-muted">المخرج</p><p className="text-xs text-light-text dark:text-dark-text font-medium line-clamp-1">{detail.director}</p></div>
            </div>
          )}
          {detail?.cast && (
            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-light-card dark:bg-dark-card">
              <svg className="w-3.5 h-3.5 text-brand-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <div><p className="text-[10px] text-light-muted dark:text-dark-muted">الممثلون</p><p className="text-xs text-light-text dark:text-dark-text font-medium line-clamp-1">{detail.cast}</p></div>
            </div>
          )}
          {detail?.runtime && (
            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-light-card dark:bg-dark-card">
              <svg className="w-3.5 h-3.5 text-brand-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div><p className="text-[10px] text-light-muted dark:text-dark-muted">المدة</p><p className="text-xs text-light-text dark:text-dark-text font-medium">{detail.runtime}</p></div>
            </div>
          )}
          {detail?.country && (
            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-light-card dark:bg-dark-card">
              <svg className="w-3.5 h-3.5 text-brand-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div><p className="text-[10px] text-light-muted dark:text-dark-muted">البلد</p><p className="text-xs text-light-text dark:text-dark-text font-medium">{detail.country}</p></div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  /* ── Episodes sidebar / list ── */
  const EpisodesPanel = ({ compact = false }: { compact?: boolean }) => {
    if (!isSeries) return null;
    return (
      <div ref={episodesRef}>
        {/* Season tabs */}
        {loading ? (
          <div className="flex gap-2 px-4 pb-3">
            {[1,2,3].map(i => <div key={i} className="h-8 w-20 rounded-lg bg-light-input dark:bg-dark-input skeleton flex-shrink-0" />)}
          </div>
        ) : seasons.length > 0 && (
          <div className="px-4 mb-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-light-text dark:text-dark-text">الحلقات</h3>
              <span className="text-xs text-light-muted dark:text-dark-muted">{episodes.length} حلقة</span>
            </div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {seasons.map(s => (
                <button key={s} onClick={() => { setCurrentSeason(s); setCurrentEpisode(null); }}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition ${currentSeason === s ? 'bg-brand-primary text-black' : 'bg-light-card dark:bg-dark-card text-light-muted dark:text-dark-muted hover:bg-light-input dark:hover:bg-dark-input'}`}>
                  الموسم {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Episode cards */}
        {loading ? (
          <div className="flex flex-col gap-2 px-4">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-xl bg-light-card dark:bg-dark-card">
                <div className="w-28 h-16 rounded-lg bg-light-input dark:bg-dark-input skeleton flex-shrink-0" />
                <div className="flex-1">
                  <div className="h-3 w-3/4 rounded bg-light-input dark:bg-dark-input skeleton mb-2" />
                  <div className="h-2.5 w-1/2 rounded bg-light-input dark:bg-dark-input skeleton" />
                </div>
              </div>
            ))}
          </div>
        ) : episodes.length > 0 ? (
          <div className={`flex flex-col gap-1.5 px-4 ${compact ? '' : ''}`}>
            {episodes.map(ep => {
              const isActive = currentEpisode?.episode === ep.episode && currentEpisode?.season === ep.season;
              return (
                <button key={`${ep.season}_${ep.episode}`} onClick={() => handleEpisodePlay(ep)}
                  className={`flex items-center gap-3 p-2 rounded-xl text-right transition w-full ${isActive ? 'bg-brand-primary/15 border border-brand-primary/30' : 'hover:bg-light-card dark:hover:bg-dark-card'}`}>
                  {/* Thumbnail */}
                  <div className={`w-28 h-16 rounded-lg flex-shrink-0 overflow-hidden relative flex items-center justify-center ${isActive ? 'ring-2 ring-brand-primary' : 'bg-light-input dark:bg-dark-input'}`}>
                    {ep.thumbnail ? (
                      <img src={ep.thumbnail} alt={ep.title || ''} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-dark-card to-dark-input flex items-center justify-center">
                        <span className={`text-lg font-black ${isActive ? 'text-brand-primary' : 'text-white/30'}`}>{ep.episode}</span>
                      </div>
                    )}
                    {isActive && (
                      <div className="absolute inset-0 bg-brand-primary/20 flex items-center justify-center">
                        <svg className="w-6 h-6 text-brand-primary" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div className="flex-1 text-right min-w-0">
                    <p className={`text-sm font-semibold line-clamp-1 ${isActive ? 'text-brand-primary' : 'text-light-text dark:text-dark-text'}`}>
                      {ep.title || `الحلقة ${ep.episode}`}
                    </p>
                    <p className="text-xs text-light-muted dark:text-dark-muted mt-0.5">الحلقة {ep.episode}</p>
                    {ep.released && <span className="text-[10px] text-light-muted dark:text-dark-muted">{ep.released}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  };

  /* ── Main render ── */
  return (
    <div className="min-h-screen bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text pb-24 md:pb-6">
      <div className="max-w-7xl mx-auto">
        {/* YouTube-style 2-column layout on desktop */}
        <div className="lg:flex lg:gap-6 lg:px-6 lg:pt-4">

          {/* LEFT: Player + Info (full width mobile, 70% desktop) */}
          <div className="flex-1 min-w-0">
            {/* Player — always at top, no margin on mobile */}
            <div className="lg:rounded-2xl overflow-hidden shadow-2xl">
              <PlayerArea />
            </div>

            {/* Info below player */}
            <InfoSection />

            {/* Episodes on mobile (below info) */}
            <div className="lg:hidden pb-4">
              <EpisodesPanel />
            </div>
          </div>

          {/* RIGHT: Episodes sidebar (desktop only, sticky) */}
          {isSeries && (
            <div className="hidden lg:block w-[380px] xl:w-[420px] flex-shrink-0">
              <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto no-scrollbar rounded-2xl bg-light-bg dark:bg-dark-bg pb-4">
                <div className="px-2 py-3 border-b border-light-border dark:border-dark-border mb-2">
                  <h2 className="text-sm font-black text-light-text dark:text-dark-text px-2">
                    {loading ? '...' : detail?.title || title}
                  </h2>
                </div>
                <EpisodesPanel compact />
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default function DetailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="w-10 h-10 border-[3px] border-brand-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <DetailContent />
    </Suspense>
  );
}
