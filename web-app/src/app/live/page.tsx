'use client';
import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { fetchFreeChannels, requestFreeStream, FreeChannel } from '@/constants/api';
import { SkeletonChannelCard } from '@/components/Skeleton';
import LivePlayer from '@/components/LivePlayer';

interface ChannelGridProps {
  loading: boolean;
  filtered: FreeChannel[];
  groups: string[];
  search: string;
  activeGroup: string;
  activeChannel: FreeChannel | null;
  logoErrors: Set<string>;
  onSearch: (v: string) => void;
  onGroup: (g: string) => void;
  onSelect: (ch: FreeChannel) => void;
  onLogoError: (id: string) => void;
}

function ChannelGrid({ loading, filtered, groups, search, activeGroup, activeChannel, logoErrors, onSearch, onGroup, onSelect, onLogoError }: ChannelGridProps) {
  return (
    <>
      {/* Search */}
      <div className="relative mb-3">
        <input type="text" value={search} onChange={e => onSearch(e.target.value)} placeholder="ابحث عن قناة..."
          className="w-full bg-light-input dark:bg-dark-input text-light-text dark:text-dark-text rounded-xl px-4 py-2.5 pr-10 text-sm font-medium placeholder:text-light-muted dark:placeholder:text-dark-muted focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
        <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-light-muted dark:text-dark-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      {/* Group filter */}
      {groups.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-2 mb-1">
          <button onClick={() => onGroup('')} className={`flex-shrink-0 px-3 py-1 rounded-lg text-xs font-medium transition ${activeGroup === '' ? 'bg-brand-primary text-black' : 'bg-light-input dark:bg-dark-input text-light-muted dark:text-dark-muted'}`}>الكل</button>
          {groups.map(g => (
            <button key={g} onClick={() => onGroup(g === activeGroup ? '' : g)} className={`flex-shrink-0 px-3 py-1 rounded-lg text-xs font-medium transition ${activeGroup === g ? 'bg-brand-primary text-black' : 'bg-light-input dark:bg-dark-input text-light-muted dark:text-dark-muted'}`}>{g}</button>
          ))}
        </div>
      )}

      {/* Channel count */}
      {!loading && filtered.length > 0 && (
        <p className="text-xs text-light-muted dark:text-dark-muted mb-2">{filtered.length} قناة</p>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {Array.from({ length: 12 }).map((_, i) => <SkeletonChannelCard key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <svg className="w-10 h-10 text-light-muted dark:text-dark-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" /></svg>
          <p className="text-light-muted dark:text-dark-muted text-sm">لا توجد قنوات</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {filtered.map(ch => (
            <button key={ch.id} onClick={() => onSelect(ch)}
              className={`flex flex-col items-center p-2.5 rounded-xl transition relative ${
                activeChannel?.id === ch.id
                  ? 'bg-brand-primary/15 border border-brand-primary/50 shadow-sm shadow-brand-primary/20'
                  : 'bg-light-card dark:bg-dark-card hover:bg-light-input dark:hover:bg-dark-input active:scale-95'
              }`}>
              <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-brand-success live-dot" />
              <div className="w-full aspect-video rounded-lg bg-light-input dark:bg-dark-input flex items-center justify-center mb-1.5 overflow-hidden">
                {ch.logo && !logoErrors.has(ch.id) ? (
                  <img src={ch.logo} alt={ch.name} className="w-full h-full object-contain p-1" onError={() => onLogoError(ch.id)} />
                ) : (
                  <svg className="w-6 h-6 text-brand-primary opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" /></svg>
                )}
              </div>
              <span className="text-[11px] font-semibold text-light-text dark:text-dark-text text-center line-clamp-1 w-full leading-tight">{ch.name}</span>
            </button>
          ))}
        </div>
      )}
    </>
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
  const [currentStreamId, setCurrentStreamId] = useState('');
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
        setCurrentStreamId(result.streamId || '');
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
      const data = await fetchFreeChannels({ limit: 300 });
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

  const handleLogoError = useCallback((id: string) => setLogoErrors(p => new Set(p).add(id)), []);

  const gridProps: ChannelGridProps = {
    loading, filtered, groups, search, activeGroup, activeChannel, logoErrors,
    onSearch: setSearch, onGroup: setActiveGroup, onSelect: selectChannel, onLogoError: handleLogoError,
  };

  return (
    <div className="min-h-screen bg-light-bg dark:bg-dark-bg pb-24 md:pb-6">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <div className="flex items-center gap-2 py-4">
          <h1 className="text-xl font-black text-light-text dark:text-dark-text">البث المباشر</h1>
          <div className="w-2 h-2 rounded-full bg-brand-success live-dot" />
          {!loading && <span className="text-xs text-light-muted dark:text-dark-muted">({channels.length} قناة)</span>}
        </div>

        <div className="lg:flex lg:gap-6 lg:items-start">

          {/* LEFT — Player area */}
          <div className="lg:flex-1 min-w-0">

            {activeChannel ? (
              <div className="mb-4">
                {streamLoading && (
                  <div className="relative w-full bg-black rounded-2xl overflow-hidden shadow-2xl" style={{ paddingTop: '56.25%' }}>
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                      <div className="w-12 h-12 border-[3px] border-brand-primary border-t-transparent rounded-full animate-spin" />
                      <span className="text-white/60 text-sm">جارٍ تحميل {activeChannel.name}...</span>
                    </div>
                  </div>
                )}
                {streamError && !streamLoading && (
                  <div className="relative w-full bg-black rounded-2xl overflow-hidden shadow-2xl" style={{ paddingTop: '56.25%' }}>
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                      <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <p className="text-white/70 text-sm font-medium">{streamError}</p>
                      <button onClick={() => selectChannel(activeChannel)} className="px-5 py-2 rounded-xl bg-brand-primary text-black font-bold text-sm hover:bg-brand-dark transition">
                        إعادة المحاولة
                      </button>
                    </div>
                  </div>
                )}
                {streamUrl && !streamLoading && (
                  <LivePlayer
                    streamUrl={streamUrl}
                    streamId={currentStreamId}
                    title={activeChannel.name}
                    logo={activeChannel.logo}
                    group={activeChannel.group}
                    onClose={() => { setActiveChannel(null); setStreamUrl(''); setCurrentStreamId(''); }}
                    onRetry={() => selectChannel(activeChannel)}
                  />
                )}
              </div>
            ) : (
              <div className="hidden lg:flex rounded-2xl bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border relative mb-4" style={{ paddingTop: '56.25%' }}>
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-brand-primary/10 flex items-center justify-center">
                    <svg className="w-8 h-8 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                    </svg>
                  </div>
                  <p className="text-light-text dark:text-dark-text font-bold text-sm">اختر قناة لبدء المشاهدة</p>
                  <p className="text-light-muted dark:text-dark-muted text-xs">القنوات متاحة على اليمين</p>
                </div>
              </div>
            )}

            {/* Mobile: channels BELOW player */}
            <div className="lg:hidden"><ChannelGrid {...gridProps} /></div>
          </div>

          {/* RIGHT — Channel list (desktop sidebar, sticky) */}
          <div className="hidden lg:block lg:w-80 xl:w-96 flex-shrink-0">
            <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto no-scrollbar">
              <ChannelGrid {...gridProps} />
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
