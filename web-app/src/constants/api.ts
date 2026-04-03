// ============================================================
// API Service - MA Streaming Web
// ============================================================

// Use relative URL so Next.js rewrites proxy to the backend (bypasses CORS)
const API_BASE_URL = '';

// ─── Simple in-memory cache ───────────────────────────
const _cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached<T>(key: string): T | null {
  const entry = _cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data as T;
  _cache.delete(key);
  return null;
}

function setCache(key: string, data: any) {
  _cache.set(key, { data, ts: Date.now() });
}

const TOKEN_KEY = 'ma_auth_token';
const USER_KEY = 'ma_user';

// ─── Storage helpers (localStorage for web) ──────────────
function getStorage(key: string): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(key);
}
function setStorage(key: string, value: string) {
  if (typeof window !== 'undefined') localStorage.setItem(key, value);
}
function removeStorage(key: string) {
  if (typeof window !== 'undefined') localStorage.removeItem(key);
}

// ─── Types ───────────────────────────────────────────────
export interface Channel {
  id: string;
  name: string;
  group: string;
  logo: string;
  is_streaming: boolean;
  enabled: boolean;
  viewers: number;
}

export interface FreeChannel {
  id: string;
  name: string;
  logo: string;
  stream_url?: string;
  group?: string;
  category?: string;
}

export interface VidsrcItem {
  id: string;
  title: string;
  poster: string;
  backdrop?: string;
  vod_type: 'movie' | 'series';
  imdb_id?: string;
  tmdb_id?: string;
  year?: string;
  rating?: string;
  genres?: string[];
  description?: string;
}

export interface VidsrcDetail {
  id: string;
  title: string;
  poster: string;
  backdrop?: string;
  vod_type: 'movie' | 'series';
  imdb_id?: string;
  tmdb_id?: string;
  year?: string;
  rating?: string;
  genres?: string[];
  description?: string;
  cast?: string;
  director?: string;
  country?: string;
  duration?: string;
  runtime?: string;
  trailer?: string;
  seasons?: number[];      // array of season numbers e.g. [1, 2, 3]
  episodes?: VidsrcEpisode[];
}

export interface VidsrcEpisode {
  id?: string;
  episode: number;
  season: number;
  title?: string;
  overview?: string;
  thumbnail?: string;
  released?: string;
  air_date?: string;
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  display_name: string;
  avatar_url?: string;
  plan: string;
  expires_at?: string;
  is_admin: boolean;
  role?: 'user' | 'agent' | 'admin';
  balance?: number;
  stats?: { favorites: number; watched: number };
}

export interface AuthResult {
  token: string;
  user: UserProfile;
}

export interface SubscriptionInfo {
  plan: 'free' | 'premium';
  expires_at: string | null;
  isPremium: boolean;
  daysLeft: number | null;
}

export interface WatchHistoryItem {
  id: string;
  item_id: string;
  item_type: string;
  title: string;
  poster: string;
  content_type: string;
  watched_at: string;
}

export interface FavoriteItem {
  id: string;
  item_id: string;
  item_type: string;
  title: string;
  poster: string;
  content_type: string;
  created_at: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  duration_days: number;
  price_usd: number;
  is_active: number;
}

// ─── Core fetch ──────────────────────────────────────────
async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getStorage(TOKEN_KEY);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(`${API_BASE_URL}${path}`, { ...options, headers });
}

// ─── Auth ─────────────────────────────────────────────────
export async function isLoggedIn(): Promise<boolean> {
  const token = getStorage(TOKEN_KEY);
  return !!token;
}

export async function getSavedUser(): Promise<UserProfile | null> {
  const raw = getStorage(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function login(loginField: string, password: string): Promise<AuthResult> {
  const res = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ login: loginField, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل تسجيل الدخول');
  setStorage(TOKEN_KEY, data.token);
  setStorage(USER_KEY, JSON.stringify(data.user));
  return data;
}

export async function register(username: string, email: string, password: string, displayName?: string): Promise<AuthResult> {
  const res = await apiFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, email, password, display_name: displayName }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل إنشاء الحساب');
  setStorage(TOKEN_KEY, data.token);
  setStorage(USER_KEY, JSON.stringify(data.user));
  return data;
}

export async function logout(): Promise<void> {
  removeStorage(TOKEN_KEY);
  removeStorage(USER_KEY);
}

export async function fetchProfile(): Promise<UserProfile | null> {
  try {
    const res = await apiFetch('/api/auth/profile');
    if (!res.ok) return null;
    const data = await res.json();
    setStorage(USER_KEY, JSON.stringify(data));
    return data;
  } catch { return null; }
}

export async function fetchSubscription(): Promise<SubscriptionInfo | null> {
  try {
    const res = await apiFetch('/api/auth/subscription');
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export async function activateCode(code: string): Promise<{ success: boolean; message: string }> {
  const res = await apiFetch('/api/auth/activate-code', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل تفعيل الكود');
  return data;
}

// ─── Vidsrc Content ──────────────────────────────────────
export async function fetchVidsrcHome(): Promise<{ latestMovies: VidsrcItem[]; latestTvShows: VidsrcItem[]; trending: VidsrcItem[]; popularMovies: VidsrcItem[]; popularTvShows: VidsrcItem[] }> {
  const empty = { latestMovies: [], latestTvShows: [], trending: [], popularMovies: [], popularTvShows: [] };
  const cached = getCached<typeof empty>('home');
  if (cached) return cached;
  try {
    const res = await apiFetch('/api/vidsrc/home');
    if (!res.ok) return empty;
    const data = await res.json();
    const result = {
      latestMovies: data.latestMovies || [],
      latestTvShows: data.latestTvShows || [],
      trending: data.trending || [],
      popularMovies: data.popularMovies || [],
      popularTvShows: data.popularTvShows || [],
    };
    setCache('home', result);
    return result;
  } catch { return empty; }
}

export async function fetchVidsrcBrowse(params: { type?: string; category?: string; page?: number; limit?: number }): Promise<{ items: VidsrcItem[]; total: number; page: number; hasMore: boolean }> {
  const empty = { items: [], total: 0, page: 1, hasMore: false };
  try {
    const q = new URLSearchParams();
    if (params.type) q.set('type', params.type);
    if (params.category) q.set('category', params.category);
    if (params.page) q.set('page', String(params.page));
    if (params.limit) q.set('limit', String(params.limit));
    const cacheKey = `browse_${q.toString()}`;
    const cached = getCached<typeof empty>(cacheKey);
    if (cached) return cached;
    const res = await apiFetch(`/api/vidsrc/browse?${q.toString()}`);
    if (!res.ok) return empty;
    const data = await res.json();
    const result = { items: data.items || [], total: data.total || 0, page: data.page || 1, hasMore: data.hasMore ?? false };
    setCache(cacheKey, result);
    return result;
  } catch { return empty; }
}

export async function fetchVidsrcDetail(type: 'movie' | 'tv', id: string): Promise<VidsrcDetail | null> {
  try {
    const res = await apiFetch(`/api/vidsrc/detail/${type}/${id}`);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export async function searchVidsrc(query: string): Promise<VidsrcItem[]> {
  try {
    const res = await apiFetch(`/api/vidsrc/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.items || [];
  } catch { return []; }
}

// ═══════════════════════════════════════════════════════════════════
// النظام الجديد: Xtream VOD — أفلام ومسلسلات من IPTV
// ═══════════════════════════════════════════════════════════════════

export interface IptvVodItem {
  id: string;
  name: string;
  poster: string;
  rating: string;
  year: string;
  genre?: string;
  category_id?: string;
  ext?: string;
  vod_type: 'movie' | 'series';
}

export interface IptvVodDetail extends IptvVodItem {
  backdrop?: string;
  plot?: string;
  cast?: string;
  director?: string;
  runtime?: string;
  trailer?: string;
}

export interface IptvEpisode {
  id: string;
  episode: number;
  title: string;
  poster?: string;
  plot?: string;
  duration?: string;
  released?: string;
  ext: string;
  season: number;
}

export interface IptvSeason {
  season: number;
  episodes: IptvEpisode[];
}

export interface IptvSeriesDetail extends IptvVodDetail {
  seasons: IptvSeason[];
}

export interface IptvBrowseResult {
  items: IptvVodItem[];
  page: number;
  total: number;
  hasMore: boolean;
}

export interface IptvHomeData {
  latestMovies: IptvVodItem[];
  latestSeries: IptvVodItem[];
  vodCategories: { id: string; name: string }[];
  seriesCategories: { id: string; name: string }[];
}

export interface IptvCategoryWithMovies {
  id: string;
  name: string;
  items: IptvVodItem[];
}

export async function fetchIptvHome(): Promise<IptvHomeData> {
  const cached = getCached<IptvHomeData>('iptv_home');
  if (cached) return cached;
  try {
    const res = await apiFetch('/api/xtream/vod/home');
    if (!res.ok) throw new Error();
    const data = await res.json();
    setCache('iptv_home', data);
    return data;
  } catch {
    return { latestMovies: [], latestSeries: [], vodCategories: [], seriesCategories: [] };
  }
}

export async function fetchIptvCategoriesWithMovies(maxCategories = 40, filter = ''): Promise<{ categories: IptvCategoryWithMovies[]; total: number }> {
  const key = `iptv_cats_movies_${maxCategories}_${filter}`;
  const cached = getCached<{ categories: IptvCategoryWithMovies[]; total: number }>(key);
  if (cached) return cached;
  try {
    const res = await apiFetch(`/api/xtream/vod/categories-with-movies?max_categories=${maxCategories}&per_category=12${filter ? '&filter=' + filter : ''}`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    setCache(key, data);
    return data;
  } catch {
    return { categories: [], total: 0 };
  }
}

export async function fetchIptvMovies(params?: { categoryId?: string; page?: number; search?: string }): Promise<IptvBrowseResult> {
  const q = new URLSearchParams();
  if (params?.categoryId) q.set('category_id', params.categoryId);
  if (params?.page) q.set('page', String(params.page));
  if (params?.search) q.set('search', params.search);
  const qs = q.toString();
  const key = `iptv_movies_${qs}`;
  const cached = getCached<IptvBrowseResult>(key);
  if (cached) return cached;
  try {
    const res = await apiFetch(`/api/xtream/vod/streams${qs ? '?' + qs : ''}`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    setCache(key, data);
    return data;
  } catch {
    return { items: [], page: 1, total: 0, hasMore: false };
  }
}

export async function fetchIptvSeries(params?: { categoryId?: string; page?: number; search?: string }): Promise<IptvBrowseResult> {
  const q = new URLSearchParams();
  if (params?.categoryId) q.set('category_id', params.categoryId);
  if (params?.page) q.set('page', String(params.page));
  if (params?.search) q.set('search', params.search);
  const qs = q.toString();
  const key = `iptv_series_${qs}`;
  const cached = getCached<IptvBrowseResult>(key);
  if (cached) return cached;
  try {
    const res = await apiFetch(`/api/xtream/series/list${qs ? '?' + qs : ''}`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    setCache(key, data);
    return data;
  } catch {
    return { items: [], page: 1, total: 0, hasMore: false };
  }
}

export async function fetchIptvMovieDetail(vodId: string): Promise<IptvVodDetail | null> {
  try {
    const res = await apiFetch(`/api/xtream/vod/info/${vodId}`);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export async function fetchIptvSeriesDetail(seriesId: string): Promise<IptvSeriesDetail | null> {
  try {
    const res = await apiFetch(`/api/xtream/series/info/${seriesId}`);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export async function fetchIptvSearch(query: string, page = 1): Promise<IptvBrowseResult> {
  try {
    const res = await apiFetch(`/api/xtream/vod/search?q=${encodeURIComponent(query)}&page=${page}`);
    if (!res.ok) throw new Error();
    return await res.json();
  } catch { return { items: [], page: 1, total: 0, hasMore: false }; }
}

export async function requestIptvVodStream(vodId: string, ext = 'mp4'): Promise<{ success: boolean; streamUrl?: string; error?: string }> {
  try {
    const res = await apiFetch(`/api/xtream/vod/stream/${vodId}?ext=${ext}`);
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error };
    return { success: true, streamUrl: data.streamUrl || '' };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function requestIptvSeriesStream(episodeId: string, ext = 'mp4'): Promise<{ success: boolean; streamUrl?: string; error?: string }> {
  try {
    const res = await apiFetch(`/api/xtream/series/stream/${episodeId}?ext=${ext}`);
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error };
    return { success: true, streamUrl: data.streamUrl || '' };
  } catch (err: any) { return { success: false, error: err.message }; }
}

// ─── Xtream Channels (beIN Sports + الكأس + عراقي + عربي) ─────────────
export interface FreeStreamResult {
  success: boolean;
  name?: string;
  logo?: string;
  group?: string;
  streamUrl?: string;
  headers?: Record<string, string>;
  error?: string;
}

export async function requestFreeStream(channelId: string): Promise<FreeStreamResult> {
  try {
    const res = await apiFetch(`/api/xtream/stream/${encodeURIComponent(channelId)}`);
    if (!res.ok) return { success: false, error: 'فشل جلب الرابط' };
    const data = await res.json();
    return {
      success: true,
      name: data.name,
      logo: data.logo,
      group: data.category,
      streamUrl: data.directUrl || data.proxyUrl,
    };
  } catch { return { success: false, error: 'خطأ في الاتصال' }; }
}

export async function fetchFreeChannels(params?: { limit?: number; group?: string; search?: string }): Promise<{ channels: FreeChannel[] }> {
  try {
    const q = new URLSearchParams();
    if (params?.limit)  q.set('limit', String(params.limit));
    if (params?.group)  q.set('category', params.group);
    if (params?.search) q.set('search', params.search);
    const res = await apiFetch(`/api/xtream/channels?${q.toString()}`);
    if (!res.ok) return { channels: [] };
    const data = await res.json();
    return {
      channels: (data.channels || []).map((c: any) => ({
        id: c.id, name: c.name, logo: c.logo, group: c.category,
      })),
    };
  } catch { return { channels: [] }; }
}

// ─── Premium Channels ────────────────────────────────────
export async function fetchChannels(params?: { group?: string; search?: string; limit?: number; offset?: number }): Promise<{ items: Channel[]; total: number }> {
  try {
    const q = new URLSearchParams();
    if (params?.group) q.set('group', params.group);
    if (params?.search) q.set('search', params.search);
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    const res = await apiFetch(`/api/channels?${q.toString()}`);
    if (!res.ok) return { items: [], total: 0 };
    const data = await res.json();
    return { items: data.channels || data.items || [], total: data.total || 0 };
  } catch { return { items: [], total: 0 }; }
}

// ─── Favorites ───────────────────────────────────────────
export async function checkFavorite(itemId: string): Promise<boolean> {
  try {
    const res = await apiFetch('/api/vod/favorites/list');
    if (!res.ok) return false;
    const data = await res.json();
    return (data.vod || []).some((v: any) => v.id === itemId || v.item_id === itemId);
  } catch { return false; }
}

export async function toggleFavorite(params: { item_id: string; item_type: string; title: string; poster: string; content_type: string }): Promise<{ favorited: boolean }> {
  const res = await apiFetch('/api/vod/favorite', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل');
  return data;
}

export async function fetchFavorites(): Promise<FavoriteItem[]> {
  try {
    const res = await apiFetch('/api/vod/favorites/list');
    if (!res.ok) return [];
    const data = await res.json();
    return data.vod || data.items || [];
  } catch { return []; }
}

// ─── Watch History ───────────────────────────────────────
export async function fetchWatchHistory(params?: { limit?: number; offset?: number }): Promise<{ items: WatchHistoryItem[]; total: number }> {
  try {
    const q = new URLSearchParams();
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    const res = await apiFetch(`/api/auth/history?${q.toString()}`);
    if (!res.ok) return { items: [], total: 0 };
    return await res.json();
  } catch { return { items: [], total: 0 }; }
}

export async function addWatchHistory(opts: {
  item_id: string;
  item_type?: string;
  title?: string;
  poster?: string;
  content_type?: string;
}): Promise<void> {
  try {
    await apiFetch('/api/auth/history', {
      method: 'POST',
      body: JSON.stringify(opts),
    });
  } catch {}
}

// ─── Agent ────────────────────────────────────────────────
export interface AgentStats {
  totalCodes: number;
  usedCodes: number;
  unusedCodes: number;
}

export async function fetchAgentInfo(): Promise<{ agent: UserProfile; stats: AgentStats } | null> {
  try {
    const res = await apiFetch('/api/agent/info');
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export async function fetchAgentPlans(): Promise<SubscriptionPlan[]> {
  try {
    const res = await apiFetch('/api/agent/plans');
    if (!res.ok) return [];
    const data = await res.json();
    return data.plans || [];
  } catch { return []; }
}

export async function createActivationCodes(plan_id: string, quantity: number = 1) {
  const res = await apiFetch('/api/agent/create-code', {
    method: 'POST',
    body: JSON.stringify({ plan_id, quantity }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل إنشاء الكود');
  return data;
}

export async function fetchAgentCodes(params?: { status?: string; limit?: number; offset?: number }) {
  try {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    const res = await apiFetch(`/api/agent/codes?${q.toString()}`);
    if (!res.ok) return { codes: [], total: 0 };
    return await res.json();
  } catch { return { codes: [], total: 0 }; }
}
