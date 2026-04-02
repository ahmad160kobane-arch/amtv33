'use client';
import React, { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { fetchVidsrcDetail, checkFavorite, toggleFavorite, addWatchHistory, isLoggedIn, VidsrcDetail, VidsrcEpisode } from '@/constants/api';

function DetailContent() {
  const params = useSearchParams();
  const router = useRouter();
  const tmdbId = params.get('tmdbId') || params.get('id') || '';
  const type = (params.get('type') || 'movie') as 'movie' | 'tv';
  const paramTitle = params.get('title') || '';
  const paramPoster = params.get('poster') || '';

  const [detail, setDetail] = useState<VidsrcDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFav, setIsFav] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [currentSeason, setCurrentSeason] = useState(1);
  const [currentEpisode, setCurrentEpisode] = useState(1);
  const [playerReady, setPlayerReady] = useState(false);
  const [proxyHtml, setProxyHtml] = useState<string | null>(null);
  const [proxyLoading, setProxyLoading] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [posterError, setPosterError] = useState(false);
  const historyRecorded = useRef('');

  const title = detail?.title || paramTitle;
  const poster = detail?.poster || paramPoster;
  const description = detail?.description || '';
  const isVod = true;
  const isSeries = type === 'tv' || detail?.vod_type === 'series';

  const vType = type === 'tv' ? 'tv' : 'movie';
  const embedUrl = playerReady
    ? (isSeries
        ? `https://vidsrc.to/embed/tv/${tmdbId}/${currentSeason}/${currentEpisode}`
        : `https://vidsrc.to/embed/movie/${tmdbId}`)
    : '';

  // Fetch proxied embed HTML with injected ad blocker
  useEffect(() => {
    if (!embedUrl) return;
    setProxyHtml(null);
    setProxyLoading(true);
    fetch(`/api/proxy/embed?url=${encodeURIComponent(embedUrl)}`)
      .then(r => { if (!r.ok) throw new Error('proxy failed'); return r.text(); })
      .then(html => setProxyHtml(html))
      .catch(() => setProxyHtml(null)) // fall back to direct iframe
      .finally(() => setProxyLoading(false));
  }, [embedUrl]);

  const loadData = useCallback(async () => {
    if (!tmdbId) return;
    try {
      const [data, logged, fav] = await Promise.all([
        fetchVidsrcDetail(vType, tmdbId),
        isLoggedIn(),
        isLoggedIn().then(l => l ? checkFavorite(tmdbId) : false),
      ]);
      setDetail(data);
      setLoggedIn(logged);
      setIsFav(fav);
    } catch (e) {
      console.error('Detail load error:', e);
    } finally {
      setLoading(false);
    }
  }, [tmdbId, vType]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleFav = async () => {
    if (!loggedIn) { router.push('/account'); return; }
    const res = await toggleFavorite({ item_id: tmdbId, item_type: 'vod', title, poster, content_type: type === 'tv' ? 'series' : 'movie' });
    setIsFav(res.favorited);
  };

  const handleWatch = () => {
    setPlayerReady(true);
  };

  const recordHistory = useCallback(() => {
    const key = `${tmdbId}_${currentSeason}_${currentEpisode}`;
    if (key === historyRecorded.current || !loggedIn) return;
    historyRecorded.current = key;
    addWatchHistory({ item_id: tmdbId, item_type: 'vod', title, poster, content_type: type === 'tv' ? 'series' : 'movie' });
  }, [tmdbId, currentSeason, currentEpisode, loggedIn, title, poster, type]);

  const seasons: number[] = detail?.seasons || [];
  const allEpisodes: VidsrcEpisode[] = detail?.episodes || [];
  const episodes = allEpisodes.filter(ep => ep.season === currentSeason);

  const MetaBadges = () => (
    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
      <span className={`px-2 py-0.5 rounded text-xs font-bold ${isSeries ? 'bg-indigo-500 text-white' : 'bg-brand-primary text-black'}`}>
        {isSeries ? 'مسلسل' : 'فيلم'}
      </span>
      {detail?.year && <span className="text-xs text-dark-muted">{detail.year}</span>}
      {detail?.rating && (
        <div className="flex items-center gap-1 bg-amber-500/15 px-1.5 py-0.5 rounded">
          <svg className="w-2.5 h-2.5 text-amber-400 fill-amber-400" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          <span className="text-xs text-amber-400 font-bold">{detail.rating}</span>
        </div>
      )}
    </div>
  );

  const EpisodesList = () => (
    <>
      {/* Season selector */}
      {isSeries && (
        loading ? (
          <div className="mb-4">
            <div className="h-3.5 w-16 rounded bg-dark-input skeleton mb-2" />
            <div className="flex gap-2">
              {[1, 2, 3].map(i => <div key={i} className="h-8 w-20 rounded-lg bg-dark-input skeleton flex-shrink-0" />)}
            </div>
          </div>
        ) : seasons.length > 0 ? (
          <div className="mb-4">
            <h3 className="text-sm font-bold text-dark-text mb-2">المواسم</h3>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {seasons.map(s => (
                <button
                  key={s}
                  onClick={() => { setCurrentSeason(s); setCurrentEpisode(1); }}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition ${currentSeason === s ? 'bg-brand-primary text-black' : 'bg-dark-card text-dark-muted hover:bg-dark-input'}`}
                >
                  الموسم {s}
                </button>
              ))}
            </div>
          </div>
        ) : null
      )}

      {/* Episodes */}
      {isSeries && loading && (
        <div className="mb-6 flex flex-col gap-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-dark-card">
              <div className="w-16 h-10 rounded-lg bg-dark-input skeleton flex-shrink-0" />
              <div className="flex-1">
                <div className="h-3 w-3/5 rounded bg-dark-input skeleton mb-1.5" />
                <div className="h-2.5 w-2/5 rounded bg-dark-input skeleton" />
              </div>
            </div>
          ))}
        </div>
      )}
      {isSeries && !loading && episodes.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-bold text-dark-text mb-2">الحلقات ({episodes.length})</h3>
          <div className="flex flex-col gap-2">
            {episodes.map(ep => (
              <button
                key={ep.episode}
                onClick={() => { setCurrentEpisode(ep.episode); setPlayerReady(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className={`flex items-center gap-3 p-3 rounded-xl text-right transition ${currentEpisode === ep.episode && playerReady ? 'bg-brand-primary/15 border border-brand-primary/40' : 'bg-dark-card hover:bg-dark-input'}`}
              >
                <div className={`w-16 h-10 rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center font-bold text-sm ${currentEpisode === ep.episode && playerReady ? 'bg-brand-primary/20' : 'bg-dark-input'}`}>
                  {ep.thumbnail ? (
                    <img src={ep.thumbnail} alt={ep.title || ''} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <span className={currentEpisode === ep.episode && playerReady ? 'text-brand-primary' : 'text-dark-muted'}>{ep.episode}</span>
                  )}
                </div>
                <div className="flex-1 text-right">
                  <p className="text-sm font-medium text-dark-text line-clamp-1">{ep.title || `الحلقة ${ep.episode}`}</p>
                  {(ep.released || ep.air_date) && <p className="text-xs text-dark-muted mt-0.5">{ep.released || ep.air_date}</p>}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-dark-bg text-dark-text pb-24 md:pb-10">
      {/* Backdrop — full width */}
      <div className="relative w-full" style={{ height: 'clamp(200px, 35vw, 420px)' }}>
        {(detail?.backdrop || poster) && !posterError ? (
          <img src={detail?.backdrop || poster} alt={title} className="w-full h-full object-cover"
            onError={() => setPosterError(true)} />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-dark-card to-dark-bg" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-dark-bg via-dark-bg/60 to-transparent" />
        <button onClick={() => router.back()}
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* ── Desktop two-column layout ── */}
      <div className="max-w-7xl mx-auto px-4 lg:px-8 -mt-16 relative z-10">
        <div className={`lg:flex lg:gap-8 ${isSeries ? '' : 'lg:justify-center'}`}>

          {/* ── LEFT / MAIN COLUMN ── */}
          <div className={`flex-1 min-w-0 ${isSeries ? '' : 'lg:max-w-4xl'}`}>

            {/* Poster + Title */}
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
                <h1 className="text-lg md:text-2xl lg:text-3xl font-black text-white leading-tight">{title}</h1>
                {detail?.genres && detail.genres.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {detail.genres.slice(0, 4).map(g => (
                      <span key={g} className="px-2 py-0.5 rounded-full bg-white/10 text-white/70 text-xs">{g}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            {description ? (
              <div className="mb-4">
                <p className={`text-sm text-dark-muted leading-relaxed ${descExpanded ? '' : 'line-clamp-3'}`}>{description}</p>
                {description.length > 150 && (
                  <button onClick={() => setDescExpanded(v => !v)} className="text-xs text-brand-primary mt-1 hover:text-brand-dark transition">
                    {descExpanded ? 'عرض أقل' : 'قراءة المزيد'}
                  </button>
                )}
              </div>
            ) : null}

            {/* Action buttons */}
            <div className="flex gap-3 mb-4 flex-wrap">
              {!playerReady && (
                <button onClick={handleWatch}
                  className="flex-1 min-w-[140px] flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-dark text-black font-bold py-3 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-lg shadow-brand-primary/20">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                  مشاهدة الآن
                </button>
              )}
              <button onClick={handleFav}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl font-medium text-sm transition ${isFav ? 'bg-red-500/15 text-red-400' : 'bg-dark-card text-dark-muted hover:bg-dark-input'}`}>
                <svg className={`w-5 h-5 ${isFav ? 'fill-red-400 text-red-400' : ''}`} fill={isFav ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                {isFav ? 'مفضل' : 'مفضلة'}
              </button>
              <button onClick={() => navigator.share?.({ title, url: window.location.href })}
                className="flex items-center gap-2 px-4 py-3 rounded-xl bg-dark-card text-dark-muted hover:bg-dark-input text-sm transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                مشاركة
              </button>
            </div>

            {/* Video Player */}
            {playerReady && embedUrl && (
              <div className="mb-6 rounded-xl overflow-hidden bg-black shadow-2xl">
                <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
                  {proxyLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
                      <div className="w-10 h-10 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  {!proxyLoading && (
                    <iframe
                      key={embedUrl}
                      {...(proxyHtml ? { srcDoc: proxyHtml } : { src: embedUrl })}
                      className="absolute inset-0 w-full h-full"
                      allowFullScreen
                      allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                      referrerPolicy="no-referrer-when-downgrade"
                      onLoad={recordHistory}
                      title={title}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Cast/Director/Info — always in main column */}
            {(detail?.cast || detail?.director || detail?.country || detail?.runtime || detail?.duration) && (
              <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {detail.director && (
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-dark-card">
                    <svg className="w-4 h-4 text-brand-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <div><p className="text-xs text-dark-muted">المخرج</p><p className="text-sm text-dark-text font-medium">{detail.director}</p></div>
                  </div>
                )}
                {detail.cast && (
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-dark-card">
                    <svg className="w-4 h-4 text-brand-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <div><p className="text-xs text-dark-muted">الممثلون</p><p className="text-sm text-dark-text font-medium line-clamp-2">{detail.cast}</p></div>
                  </div>
                )}
                {detail.country && (
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-dark-card">
                    <svg className="w-4 h-4 text-brand-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div><p className="text-xs text-dark-muted">الدولة</p><p className="text-sm text-dark-text font-medium">{detail.country}</p></div>
                  </div>
                )}
                {(detail.runtime || detail.duration) && (
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-dark-card">
                    <svg className="w-4 h-4 text-brand-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div><p className="text-xs text-dark-muted">المدة</p><p className="text-sm text-dark-text font-medium">{detail.runtime || detail.duration}</p></div>
                  </div>
                )}
              </div>
            )}

            {/* Episodes — mobile only (shown below player on small screens) */}
            {isSeries && <div className="lg:hidden"><EpisodesList /></div>}
          </div>

          {/* ── RIGHT COLUMN — Episodes sidebar (desktop only, series only) ── */}
          {isSeries && (
            <div className="hidden lg:flex lg:flex-col lg:w-80 xl:w-96 flex-shrink-0">
              <div className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto no-scrollbar pr-1">
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
