'use client';
import React, { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { fetchVidsrcDetail, requestVidsrcStream, checkFavorite, toggleFavorite, addWatchHistory, isLoggedIn, VidsrcDetail, VidsrcEpisode } from '@/constants/api';
import VodPlayer from '@/components/VodPlayer';

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
  const [allEmbedUrls, setAllEmbedUrls] = useState<string[]>([]);
  const [embedSources, setEmbedSources] = useState<{url:string,name:string}[]>([]);
  const [embedSourceIdx, setEmbedSourceIdx] = useState(0);
  const [streamLoading, setStreamLoading] = useState(false);
  const [streamError, setStreamError] = useState('');
  const [descExpanded, setDescExpanded] = useState(false);
  const [posterError, setPosterError] = useState(false);
  const historyRecorded = useRef('');
  const playerRef = useRef<HTMLDivElement>(null);

  const isSeries = vodType === 'series' || vodType === 'tv' || detail?.vod_type === 'series';
  const fetchType = isSeries ? 'tv' : 'movie';
  const title = detail?.title || paramTitle;
  const poster = detail?.poster || paramPoster;
  const description = detail?.description || '';

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

  const handleFav = async () => {
    if (!loggedIn) { router.push('/account'); return; }
    const res = await toggleFavorite({ item_id: contentId, item_type: 'vod', title, poster, content_type: isSeries ? 'series' : 'movie' });
    setIsFav(res.favorited);
  };

  const scrollToPlayer = useCallback(() => {
    setTimeout(() => playerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }, []);

  const applyStreamResult = (result: any) => {
    const hls = result.hlsUrl || result.vodUrl || '';
    if (hls) {
      setStreamUrl(hls);
      setEmbedUrl('');
      setAllEmbedUrls([]);
    } else if (result.embedUrl) {
      const srcs: {url:string,name:string}[] = result.sources?.length
        ? result.sources
        : (result.allEmbedUrls?.length ? result.allEmbedUrls.map((u:string,i:number)=>({url:u,name:`مصدر ${i+1}`})) : [{url:result.embedUrl,name:'مصدر 1'}]);
      setEmbedSources(srcs);
      setAllEmbedUrls(srcs.map(s=>s.url));
      setEmbedSourceIdx(0);
      setEmbedUrl(srcs[0].url);
      setStreamUrl('');
    } else {
      setStreamError(result.error || 'فشل تحميل المحتوى');
    }
  };

  const handleWatch = async () => {
    setStreamLoading(true);
    setStreamError('');
    setStreamUrl('');
    setEmbedUrl('');
    scrollToPlayer();
    try {
      const result = await requestVidsrcStream({ tmdbId: detail?.tmdb_id || contentId, type: 'movie', title });
      if (result.success) { applyStreamResult(result); recordHistory(); }
      else setStreamError(result.error || 'فشل تحميل الفيلم');
    } catch {
      setStreamError('خطأ في الاتصال');
    } finally {
      setStreamLoading(false);
    }
  };

  const handleEpisodePlay = async (ep: VidsrcEpisode) => {
    setCurrentEpisode(ep);
    setStreamLoading(true);
    setStreamError('');
    setStreamUrl('');
    setEmbedUrl('');
    scrollToPlayer();
    try {
      const result = await requestVidsrcStream({ tmdbId: detail?.tmdb_id || contentId, type: 'tv', season: ep.season, episode: ep.episode, title });
      if (result.success) { applyStreamResult(result); recordHistory(); }
      else setStreamError(result.error || 'فشل تحميل الحلقة');
    } catch {
      setStreamError('خطأ في الاتصال');
    } finally {
      setStreamLoading(false);
    }
  };

  const recordHistory = useCallback(() => {
    const key = `${contentId}_${currentSeason}_${currentEpisode?.episode}`;
    if (key === historyRecorded.current || !loggedIn) return;
    historyRecorded.current = key;
    addWatchHistory({ item_id: contentId, item_type: 'vod', title, poster, content_type: isSeries ? 'series' : 'movie' });
  }, [contentId, currentSeason, currentEpisode, loggedIn, title, poster, isSeries]);

  const seasons: number[] = detail?.seasons || [];
  const episodes: VidsrcEpisode[] = (detail?.episodes || []).filter(e => e.season === currentSeason);

  const getNextEpisode = useCallback((): VidsrcEpisode | null => {
    if (!currentEpisode) return episodes[0] || null;
    const idx = episodes.findIndex(e => e.episode === currentEpisode.episode);
    if (idx >= 0 && idx < episodes.length - 1) return episodes[idx + 1];
    const nextSeasonEps = (detail?.episodes || []).filter(e => e.season === currentSeason + 1);
    return nextSeasonEps[0] || null;
  }, [currentEpisode, episodes, detail, currentSeason]);

  const getPrevEpisode = useCallback((): VidsrcEpisode | null => {
    if (!currentEpisode) return null;
    const idx = episodes.findIndex(e => e.episode === currentEpisode.episode);
    if (idx > 0) return episodes[idx - 1];
    const prevSeasonEps = (detail?.episodes || []).filter(e => e.season === currentSeason - 1);
    return prevSeasonEps[prevSeasonEps.length - 1] || null;
  }, [currentEpisode, episodes, detail, currentSeason]);

  const MetaBadges = () => (
    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
      <span className={`px-2 py-0.5 rounded text-xs font-bold ${isSeries ? 'bg-indigo-500 text-white' : 'bg-brand-primary text-black'}`}>
        {isSeries ? 'مسلسل' : 'فيلم'}
      </span>
      {detail?.year && <span className="text-xs text-light-muted dark:text-dark-muted">{detail.year}</span>}
      {detail?.rating && (
        <div className="flex items-center gap-1 bg-amber-500/15 px-1.5 py-0.5 rounded">
          <svg className="w-2.5 h-2.5 text-amber-400 fill-amber-400" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          <span className="text-xs text-amber-400 font-bold">{detail.rating}</span>
        </div>
      )}
      {detail?.runtime && <span className="text-xs text-light-muted dark:text-dark-muted">{detail.runtime}</span>}
    </div>
  );

  const EpisodesList = () => (
    <>
      {isSeries && (
        loading ? (
          <div className="mb-4">
            <div className="h-3.5 w-16 rounded bg-dark-input skeleton mb-2" />
            <div className="flex gap-2">
              {[1, 2, 3].map(i => <div key={i} className="h-8 w-20 rounded-lg bg-light-input dark:bg-dark-input skeleton flex-shrink-0" />)}
            </div>
          </div>
        ) : seasons.length > 0 ? (
          <div className="mb-4">
            <h3 className="text-sm font-bold text-light-text dark:text-dark-text mb-2">المواسم</h3>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {seasons.map(s => (
                <button
                  key={s}
                  onClick={() => { setCurrentSeason(s); setCurrentEpisode(null); }}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition ${currentSeason === s ? 'bg-brand-primary text-black' : 'bg-light-card dark:bg-dark-card text-light-muted dark:text-dark-muted hover:bg-light-input dark:hover:bg-dark-input'}`}
                >
                  الموسم {s}
                </button>
              ))}
            </div>
          </div>
        ) : null
      )}

      {isSeries && loading && (
        <div className="mb-6 flex flex-col gap-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-light-card dark:bg-dark-card">
              <div className="w-16 h-10 rounded-lg bg-light-input dark:bg-dark-input skeleton flex-shrink-0" />
              <div className="flex-1">
                <div className="h-3 w-3/5 rounded bg-light-input dark:bg-dark-input skeleton mb-1.5" />
                <div className="h-2.5 w-2/5 rounded bg-light-input dark:bg-dark-input skeleton" />
              </div>
            </div>
          ))}
        </div>
      )}
      {isSeries && !loading && episodes.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-bold text-light-text dark:text-dark-text mb-2">الحلقات ({episodes.length})</h3>
          <div className="flex flex-col gap-2">
            {episodes.map(ep => (
              <button
                key={`${ep.season}_${ep.episode}`}
                onClick={() => handleEpisodePlay(ep)}
                className={`flex items-center gap-3 p-3 rounded-xl text-right transition ${currentEpisode?.episode === ep.episode && currentEpisode?.season === ep.season ? 'bg-brand-primary/15 border border-brand-primary/40' : 'bg-light-card dark:bg-dark-card hover:bg-light-input dark:hover:bg-dark-input'}`}
              >
                <div className={`w-16 h-10 rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center font-bold text-sm ${currentEpisode?.episode === ep.episode ? 'bg-brand-primary/20' : 'bg-light-input dark:bg-dark-input'}`}>
                  {ep.thumbnail ? (
                    <img src={ep.thumbnail} alt={ep.title || ''} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <span className={currentEpisode?.episode === ep.episode ? 'text-brand-primary' : 'text-light-muted dark:text-dark-muted'}>{ep.episode}</span>
                  )}
                </div>
                <div className="flex-1 text-right">
                  <p className="text-sm font-medium text-light-text dark:text-dark-text line-clamp-1">{ep.title || `الحلقة ${ep.episode}`}</p>
                  {ep.released && <span className="text-xs text-light-muted dark:text-dark-muted mt-0.5 block">{ep.released}</span>}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text pb-24 md:pb-10">
      <div className="relative w-full" style={{ height: 'clamp(200px, 35vw, 420px)' }}>
        {(detail?.backdrop || poster) && !posterError ? (
          <img src={detail?.backdrop || poster} alt={title} className="w-full h-full object-cover"
            onError={() => setPosterError(true)} />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-light-card dark:from-dark-card to-light-bg dark:to-dark-bg" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-light-bg dark:from-dark-bg via-light-bg/60 dark:via-dark-bg/60 to-transparent" />
        <button onClick={() => router.back()}
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-4 lg:px-8 -mt-16 relative z-10">
        <div className={`lg:flex lg:gap-8 ${isSeries ? '' : 'lg:justify-center'}`}>

          <div className={`flex-1 min-w-0 ${isSeries ? '' : 'lg:max-w-4xl'}`}>

            <div className="flex gap-4 items-end mb-4">
              <div className="w-24 h-36 md:w-32 md:h-48 rounded-xl overflow-hidden flex-shrink-0 shadow-2xl border border-white/10">
                {poster && !posterError ? (
                  <img src={poster} alt={title} className="w-full h-full object-cover" onError={() => setPosterError(true)} />
                ) : (
                  <div className="w-full h-full bg-dark-card flex items-center justify-center">
                    <svg className="w-8 h-8 text-dark-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="flex-1 pb-2">
                <MetaBadges />
                <h1 className="text-lg md:text-2xl lg:text-3xl font-black text-light-text dark:text-white leading-tight">{title}</h1>
                {detail?.genres && detail.genres.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {detail.genres.slice(0, 5).map((g: string) => (
                      <span key={g} className="px-2 py-0.5 rounded-full bg-white/10 dark:bg-white/10 bg-light-input text-light-muted dark:text-white/70 text-xs">{g}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {description ? (
              <div className="mb-4">
                <p className={`text-sm text-light-muted dark:text-dark-muted leading-relaxed whitespace-pre-line ${descExpanded ? '' : 'line-clamp-3'}`}>{description}</p>
                {description.length > 150 && (
                  <button onClick={() => setDescExpanded(v => !v)} className="text-xs text-brand-primary mt-1 hover:text-brand-dark transition">
                    {descExpanded ? 'عرض أقل' : 'قراءة المزيد'}
                  </button>
                )}
              </div>
            ) : null}

            <div className="flex gap-3 mb-4 flex-wrap">
              {!isSeries && !streamUrl && (
                <button onClick={handleWatch} disabled={streamLoading}
                  className="flex-1 min-w-[140px] flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-dark text-black font-bold py-3 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-lg shadow-brand-primary/20 disabled:opacity-50">
                  {streamLoading ? (
                    <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                    </svg>
                  )}
                  {streamLoading ? 'جارٍ التحميل...' : 'مشاهدة الآن'}
                </button>
              )}
              <button onClick={handleFav}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl font-medium text-sm transition ${isFav ? 'bg-red-500/15 text-red-400' : 'bg-light-card dark:bg-dark-card text-light-muted dark:text-dark-muted hover:bg-light-input dark:hover:bg-dark-input'}`}>
                <svg className={`w-5 h-5 ${isFav ? 'fill-red-400 text-red-400' : ''}`} fill={isFav ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                {isFav ? 'مفضل' : 'مفضلة'}
              </button>
              {detail?.trailer && (
                <a href={`https://www.youtube.com/watch?v=${detail.trailer}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-3 rounded-xl font-medium text-sm bg-red-600/15 text-red-500 hover:bg-red-600/25 transition">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                  </svg>
                  إعلان
                </a>
              )}
            </div>

            {/* Video Player */}
            {(streamUrl || embedUrl || streamLoading || streamError) && (
              <div className="mb-6" ref={playerRef}>
                {streamLoading && (
                  <div className="relative w-full bg-black rounded-2xl overflow-hidden shadow-2xl" style={{ paddingTop: '56.25%' }}>
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                      <div className="w-12 h-12 border-[3px] border-brand-primary border-t-transparent rounded-full animate-spin" />
                      <span className="text-white/60 text-xs">جارٍ تحميل الفيديو...</span>
                    </div>
                  </div>
                )}
                {streamError && !streamLoading && (
                  <div className="relative w-full bg-black rounded-2xl overflow-hidden shadow-2xl" style={{ paddingTop: '56.25%' }}>
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                      <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <p className="text-white/70 text-sm">{streamError}</p>
                    </div>
                  </div>
                )}
                {streamUrl && !streamLoading && !streamError && (
                  <VodPlayer
                    streamUrl={streamUrl}
                    title={title}
                    poster={poster}
                    subtitle={isSeries && currentEpisode ? `${currentEpisode.title || 'الحلقة ' + currentEpisode.episode} — الموسم ${currentSeason}` : undefined}
                    onClose={() => { setStreamUrl(''); setStreamError(''); }}
                    hasNext={isSeries && !!getNextEpisode()}
                    hasPrev={isSeries && !!getPrevEpisode()}
                    onNext={isSeries ? () => { const next = getNextEpisode(); if (next) handleEpisodePlay(next); } : undefined}
                    onPrev={isSeries ? () => { const prev = getPrevEpisode(); if (prev) handleEpisodePlay(prev); } : undefined}
                  />
                )}
                {embedUrl && !streamUrl && !streamLoading && !streamError && (
                  <div className="relative w-full bg-black rounded-2xl overflow-hidden shadow-2xl">
                    <div className="flex items-center justify-between px-3 py-2 bg-black/80 gap-2">
                      <button onClick={() => { setEmbedUrl(''); setStreamUrl(''); setStreamError(''); }} className="text-white/50 hover:text-white text-xs transition flex-shrink-0">✕ إغلاق</button>
                      {embedSources.length > 1 && (
                        <div className="flex items-center gap-1.5 overflow-x-auto flex-1 justify-end">
                          <span className="text-white/40 text-xs flex-shrink-0">المصدر:</span>
                          {embedSources.map((src, i) => (
                            <button key={i} onClick={() => { setEmbedSourceIdx(i); setEmbedUrl(src.url); }}
                              className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap transition flex-shrink-0 ${i === embedSourceIdx ? 'bg-brand-primary text-black font-bold' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}>
                              {src.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ paddingTop: '56.25%', position: 'relative' }}>
                      <iframe
                        key={embedUrl}
                        src={embedUrl}
                        className="absolute inset-0 w-full h-full border-0"
                        allowFullScreen
                        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                        referrerPolicy="no-referrer-when-downgrade"
                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-fullscreen"
                      />
                    </div>
                    {embedSources.length > 1 && (
                      <div className="px-3 py-2 bg-black/60 text-center">
                        <p className="text-white/40 text-xs">إذا لم يعمل المشغّل، جرّب مصدراً آخر أعلاه</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {(detail?.cast || detail?.director || detail?.runtime || detail?.country) && (
              <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {detail?.director && (
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-light-card dark:bg-dark-card">
                    <svg className="w-4 h-4 text-brand-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <div><p className="text-xs text-light-muted dark:text-dark-muted">المخرج</p><p className="text-sm text-light-text dark:text-dark-text font-medium">{detail.director}</p></div>
                  </div>
                )}
                {detail?.cast && (
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-light-card dark:bg-dark-card">
                    <svg className="w-4 h-4 text-brand-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <div><p className="text-xs text-light-muted dark:text-dark-muted">الممثلون</p><p className="text-sm text-light-text dark:text-dark-text font-medium line-clamp-2">{detail.cast}</p></div>
                  </div>
                )}
                {detail?.runtime && (
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-light-card dark:bg-dark-card">
                    <svg className="w-4 h-4 text-brand-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div><p className="text-xs text-light-muted dark:text-dark-muted">المدة</p><p className="text-sm text-light-text dark:text-dark-text font-medium">{detail.runtime}</p></div>
                  </div>
                )}
                {detail?.country && (
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-light-card dark:bg-dark-card">
                    <svg className="w-4 h-4 text-brand-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div><p className="text-xs text-light-muted dark:text-dark-muted">البلد</p><p className="text-sm text-light-text dark:text-dark-text font-medium">{detail.country}</p></div>
                  </div>
                )}
              </div>
            )}

            {isSeries && <div className="lg:hidden"><EpisodesList /></div>}
          </div>

          {isSeries && (
            <div className="hidden lg:flex lg:flex-col lg:w-80 xl:w-96 flex-shrink-0">
              <div className="sticky top-20 max-h-[calc(100vh-5rem)] overflow-y-auto no-scrollbar pr-1">
                <EpisodesList />
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
    <Suspense fallback={<div className="min-h-screen bg-dark-bg flex items-center justify-center"><div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" /></div>}>
      <DetailContent />
    </Suspense>
  );
}
