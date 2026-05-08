// ============================================================
// API Service - MA Streaming Backend
// ============================================================
import AsyncStorage from "@react-native-async-storage/async-storage";

// const API_BASE_URL = 'http://192.168.0.116:3000'; // Your local network IP
// const API_BASE_URL = 'http://10.0.2.2:3000'; // Android emulator only
// const API_BASE_URL = 'http://localhost:3000'; // iOS simulator only
const API_BASE_URL = "https://amtv33-production.up.railway.app"; // Production

// السيرفر السحابي — التطبيق يتصل به مباشرة للبث
// const CLOUD_SERVER_URL = 'http://192.168.0.116:8090';
const CLOUD_SERVER_URL = "http://62.171.153.204:8090"; // Production VPS
// const CLOUD_SERVER_URL = 'http://10.0.2.2:8090'; // Android emulator only

const TOKEN_KEY = "@ma_auth_token";
const USER_KEY = "@ma_user";

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

export interface VodItem {
  id: string;
  title: string;
  vod_type: "movie" | "series";
  category: string;
  poster: string;
  year: string;
  rating: string;
  token: string;
  description?: string;
  plot?: string;
  cast?: string;
  director?: string;
  genre?: string;
  country?: string;
  duration?: string;
  duration_secs?: number;
  backdrop?: string;
  tmdb?: string;
  trailer?: string;
  source_rating?: number;
  episodes?: Episode[];
}

export interface Episode {
  id: string;
  title: string;
  season: number;
  episode: number;
  token: string;
  duration?: string;
  duration_secs?: number;
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
  role?: "user" | "agent" | "admin";
  balance?: number;
  stats?: { favorites: number; watched: number };
}

export interface AuthResult {
  token: string;
  user: UserProfile;
}

// ─── Subscription ─────────────────────────────────────────
export interface SubscriptionInfo {
  plan: "free" | "premium";
  expires_at: string | null;
  isPremium: boolean;
  daysLeft: number | null;
}

export interface ActivateCodeResult {
  success: boolean;
  plan: string;
  expires_at: string;
  plan_name: string;
  duration_days: number;
  message: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  duration_days: number;
  price_usd: number;
  is_active: number;
}

export interface ActivationCode {
  id: string;
  code: string;
  status: "unused" | "used" | "expired" | "cancelled";
  created_at: string;
  activated_at: string | null;
  plan_name: string;
  duration_days: number;
  activated_by_username: string | null;
}

export async function fetchSubscription(): Promise<SubscriptionInfo | null> {
  try {
    const res = await apiFetch("/api/auth/subscription");
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function activateCode(code: string): Promise<ActivateCodeResult> {
  const res = await apiFetch("/api/auth/activate-code", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "فشل تفعيل الكود");
  return data;
}

// ─── Agent ────────────────────────────────────────────────
export interface AgentInfo {
  agent: UserProfile;
  stats: { totalCodes: number; usedCodes: number; unusedCodes: number };
}

export async function fetchAgentInfo(): Promise<AgentInfo | null> {
  try {
    const res = await apiFetch("/api/agent/info");
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchAgentPlans(): Promise<SubscriptionPlan[]> {
  try {
    const res = await apiFetch("/api/agent/plans");
    if (!res.ok) return [];
    const data = await res.json();
    return data.plans || [];
  } catch {
    return [];
  }
}

export async function createActivationCodes(
  plan_id: string,
  quantity = 1,
): Promise<{
  codes: { id: string; code: string }[];
  cost: number;
  remaining_balance: number;
  plan: { name: string };
}> {
  const res = await apiFetch("/api/agent/create-code", {
    method: "POST",
    body: JSON.stringify({ plan_id, quantity }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "فشل إنشاء الكود");
  return data;
}

export async function fetchAgentCodes(params?: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ codes: ActivationCode[]; total: number }> {
  try {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.offset) q.set("offset", String(params.offset));
    const qs = q.toString();
    const res = await apiFetch(`/api/agent/codes${qs ? "?" + qs : ""}`);
    if (!res.ok) return { codes: [], total: 0 };
    return await res.json();
  } catch {
    return { codes: [], total: 0 };
  }
}

export async function cancelActivationCode(
  code_id: string,
): Promise<{ success: boolean; refunded: number; balance: number }> {
  const res = await apiFetch("/api/agent/cancel-code", {
    method: "POST",
    body: JSON.stringify({ code_id }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "فشل إلغاء الكود");
  return data;
}

export interface AgentTransaction {
  id: string;
  agent_id: string;
  type: "credit" | "debit";
  amount: number;
  balance_after: number;
  description: string;
  ref_id: string | null;
  created_at: string;
}

export async function fetchAgentTransactions(params?: {
  limit?: number;
  offset?: number;
}): Promise<{ transactions: AgentTransaction[]; total: number }> {
  try {
    const q = new URLSearchParams();
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.offset) q.set("offset", String(params.offset));
    const res = await apiFetch(`/api/agent/transactions?${q.toString()}`);
    if (!res.ok) return { transactions: [], total: 0 };
    return await res.json();
  } catch {
    return { transactions: [], total: 0 };
  }
}

// ─── Token Management ────────────────────────────────────
let _cachedToken: string | null = null;
let _tokenPromise: Promise<string | null> | null = null;

export async function getToken(): Promise<string | null> {
  if (_cachedToken) return _cachedToken;
  if (_tokenPromise) return _tokenPromise;
  _tokenPromise = AsyncStorage.getItem(TOKEN_KEY).then((t) => {
    _cachedToken = t;
    _tokenPromise = null;
    return t;
  });
  return _tokenPromise;
}

export async function setToken(token: string): Promise<void> {
  _cachedToken = token;
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  _cachedToken = null;
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
}

export async function saveUser(user: UserProfile): Promise<void> {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function getSavedUser(): Promise<UserProfile | null> {
  try {
    const json = await AsyncStorage.getItem(USER_KEY);
    return json ? JSON.parse(json) : null;
  } catch {
    return null;
  }
}

// ─── API Helper ──────────────────────────────────────────
export async function apiFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  return fetch(`${API_BASE_URL}${path}`, { ...options, headers });
}

// ─── Auth ────────────────────────────────────────────────
export async function login(
  login: string,
  password: string,
): Promise<AuthResult> {
  const res = await apiFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ login, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "فشل تسجيل الدخول");
  await setToken(data.token);
  await saveUser(data.user);
  return data;
}

export async function register(
  username: string,
  email: string,
  password: string,
  display_name?: string,
): Promise<AuthResult> {
  const res = await apiFetch("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, email, password, display_name }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "فشل إنشاء الحساب");
  await setToken(data.token);
  await saveUser(data.user);
  return data;
}

export async function logout(): Promise<void> {
  try {
    await apiFetch("/api/auth/logout", { method: "POST" });
  } catch {}
  await clearToken();
}

export async function isLoggedIn(): Promise<boolean> {
  const token = await getToken();
  return !!token;
}

// ─── Profile ─────────────────────────────────────────────
export async function fetchProfile(): Promise<UserProfile | null> {
  try {
    const res = await apiFetch("/api/auth/profile");
    if (!res.ok) return null;
    const user = await res.json();
    await saveUser(user);
    return user;
  } catch {
    return null;
  }
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

export async function fetchWatchHistory(params?: {
  limit?: number;
  offset?: number;
}): Promise<{ items: WatchHistoryItem[]; total: number }> {
  try {
    const q = new URLSearchParams();
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.offset) q.set("offset", String(params.offset));
    const res = await apiFetch(`/api/auth/history?${q.toString()}`);
    if (!res.ok) return { items: [], total: 0 };
    return await res.json();
  } catch {
    return { items: [], total: 0 };
  }
}

export async function addWatchHistory(opts: {
  item_id: string;
  item_type?: string;
  title?: string;
  poster?: string;
  content_type?: string;
}): Promise<void> {
  try {
    await apiFetch("/api/auth/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts),
    });
  } catch {}
}

// ─── Channels ────────────────────────────────────────────
export async function fetchChannels(params?: {
  group?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<PaginatedResult<Channel>> {
  try {
    const q = new URLSearchParams();
    if (params?.group) q.set("group", params.group);
    if (params?.search) q.set("search", params.search);
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.offset) q.set("offset", String(params.offset));
    const qs = q.toString();
    const res = await apiFetch(`/api/channels${qs ? "?" + qs : ""}`);
    const data = await res.json();
    return {
      items: data.channels || [],
      total: data.total || 0,
      hasMore: data.hasMore || false,
    };
  } catch {
    return { items: [], total: 0, hasMore: false };
  }
}

export async function fetchChannelGroups(): Promise<string[]> {
  try {
    const res = await apiFetch("/api/channels/groups");
    const data = await res.json();
    return data.groups || [];
  } catch {
    return [];
  }
}

// ─── Pagination Types ───────────────────────────────────
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  hasMore: boolean;
}

// ─── Favorites ──────────────────────────────────────────
export async function checkFavorite(
  itemId: string,
  itemType: "vod" | "channel",
): Promise<boolean> {
  try {
    const res = await apiFetch("/api/vod/favorites/list");
    if (!res.ok) return false;
    const data = await res.json();
    if (itemType === "vod")
      return (data.vod || []).some((v: any) => v.id === itemId);
    return (data.channels || []).some((c: any) => c.id === itemId);
  } catch {
    return false;
  }
}

export async function toggleFavorite(
  itemId: string,
  itemType: "vod" | "channel",
  meta?: { title?: string; poster?: string; content_type?: string },
): Promise<boolean> {
  try {
    const res = await apiFetch("/api/vod/favorite", {
      method: "POST",
      body: JSON.stringify({ item_id: itemId, item_type: itemType, ...meta }),
    });
    const data = await res.json();
    return data.favorited ?? false;
  } catch {
    return false;
  }
}

// ─── Ratings ────────────────────────────────────────────
export interface RatingInfo {
  average: number;
  count: number;
  userScore: number;
}

export async function fetchRating(vodId: string): Promise<RatingInfo> {
  try {
    const res = await apiFetch(`/api/vod/${vodId}/rating`);
    if (!res.ok) return { average: 0, count: 0, userScore: 0 };
    return await res.json();
  } catch {
    return { average: 0, count: 0, userScore: 0 };
  }
}

export async function submitRating(
  vodId: string,
  score: number,
): Promise<RatingInfo> {
  const res = await apiFetch("/api/vod/rate", {
    method: "POST",
    body: JSON.stringify({ vod_id: vodId, score }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "فشل التقييم");
  return data;
}

// ─── Simple In-Memory Cache with auto-cleanup ────────────────────────────
const _cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_SIZE = 100;

function getCached<T>(key: string): T | null {
  const e = _cache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_TTL_MS) {
    _cache.delete(key);
    return null;
  }
  return e.data as T;
}
function setCached(key: string, data: any) {
  // تنظيف تلقائي إذا تجاوز الحد الأقصى
  if (_cache.size >= MAX_CACHE_SIZE) {
    const oldestKey = _cache.keys().next().value;
    if (oldestKey) _cache.delete(oldestKey);
  }
  _cache.set(key, { data, ts: Date.now() });
}

// تنظيف دوري للعناصر المنتهية
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of _cache) {
    if (now - entry.ts > CACHE_TTL_MS) _cache.delete(key);
  }
}, 60000);

// ─── VidSrc — تم الحذف — كل المحتوى من lulu فقط ─────

// ─── Cloud Streaming (اتصال مباشر بالسيرفر السحابي) ─────

export interface StreamResult {
  success: boolean;
  hlsUrl?: string;
  vodUrl?: string;
  embedUrl?: string;
  provider?: string;
  sources?: { url: string; name: string }[];
  ready?: boolean;
  waiting?: boolean;
  downloading?: boolean;
  progress?: number;
  duration?: number;
  contentLength?: number;
  acceptRanges?: boolean;
  streamId?: string;
  subtitles?: {
    language: string;
    label?: string;
    url: string;
    type?: string;
  }[];
  qualities?: Record<string, { url: string; type: string }>;
  headers?: Record<string, string>;
  error?: string;
  requiresSubscription?: boolean;
  expired?: boolean;
}

/** Helper: طلب مع JWT للسيرفر السحابي */
async function cloudFetch(
  endpoint: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = await getToken();
  const headers: any = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(`${CLOUD_SERVER_URL}${endpoint}`, { ...options, headers });
}

/**
 * طلب بث قناة مباشرة — التطبيق يتصل مباشرة بالسيرفر السحابي
 * السيرفر يتحقق من JWT ويجلب رابط البث من DB ويشغل FFmpeg
 */
export async function requestLiveStream(
  channelId: string,
): Promise<StreamResult> {
  try {
    const res = await cloudFetch(`/api/stream/live/${channelId}`, {
      method: "POST",
      body: JSON.stringify({ mode: 'pipe' }),
    });
    const data = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: data.message || data.error,
        requiresSubscription: !!data.requiresSubscription,
        expired: !!data.expired,
      };
    }
    if (data.hlsUrl && !data.hlsUrl.startsWith("http")) {
      data.hlsUrl = `${CLOUD_SERVER_URL}${data.hlsUrl}`;
    }
    if (data.vodUrl && !data.vodUrl.startsWith("http")) {
      data.vodUrl = `${CLOUD_SERVER_URL}${data.vodUrl}`;
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || "خطأ في الاتصال بالسيرفر" };
  }
}

/**
 * طلب بث VOD (فيلم/حلقة) مباشرة من السيرفر السحابي
 */
export async function requestVodStream(vodId: string): Promise<StreamResult> {
  try {
    const res = await cloudFetch(
      `/api/stream/vod/${encodeURIComponent(vodId)}`,
      { method: "POST" },
    );
    const data = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: data.message || data.error,
        requiresSubscription: !!data.requiresSubscription,
        expired: !!data.expired,
      };
    }
    if (data.hlsUrl && !data.hlsUrl.startsWith("http")) {
      data.hlsUrl = `${CLOUD_SERVER_URL}${data.hlsUrl}`;
    }
    if (data.vodUrl && !data.vodUrl.startsWith("http")) {
      data.vodUrl = `${CLOUD_SERVER_URL}${data.vodUrl}`;
    }
    // تحويل روابط الترجمات لروابط كاملة
    if (data.subtitles) {
      data.subtitles = data.subtitles.map((s: any) => ({
        ...s,
        url: s.url.startsWith("http") ? s.url : `${CLOUD_SERVER_URL}${s.url}`,
      }));
    }
    // resolve quality URLs
    if (data.qualities) {
      for (const q of Object.keys(data.qualities)) {
        if (
          data.qualities[q].url &&
          !data.qualities[q].url.startsWith("http")
        ) {
          data.qualities[q].url = `${CLOUD_SERVER_URL}${data.qualities[q].url}`;
        }
      }
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || "خطأ في الاتصال بالسيرفر" };
  }
}

/**
 * إنهاء مشاهدة
 */
export async function releaseStream(streamId: string): Promise<void> {
  try {
    await cloudFetch(`/api/stream/release/${streamId}`, { method: "POST" });
  } catch {}
}

/**
 * فحص جهوزية البث
 */
export async function isStreamReady(streamId: string): Promise<boolean> {
  try {
    const res = await cloudFetch(`/api/stream/ready/${streamId}`);
    const data = await res.json();
    return data.ready || false;
  } catch {
    return false;
  }
}

/**
 * جلب معلومات البث (المدة) — يُستدعى بشكل دوري حتى تتوفر المدة
 */
export async function fetchStreamInfo(
  streamId: string,
): Promise<{ duration?: number; completed?: boolean } | null> {
  try {
    const res = await cloudFetch(`/api/stream/info/${streamId}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Seeking في VOD — إعادة بدء FFmpeg من موضع جديد
 * يُستخدم عندما المستخدم يقفز لموضع لم يتم تحميله بعد
 */
export async function seekVodStream(
  streamId: string,
  positionSec: number,
): Promise<{ success: boolean }> {
  try {
    const res = await cloudFetch(`/api/stream/seek/${streamId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ position: positionSec }),
    });
    return await res.json();
  } catch {
    return { success: false };
  }
}

/**
 * جلب معلومات الوسائط — الجودة + الترجمة + الصوت
 */
export async function fetchMediaInfo(streamId: string): Promise<{
  duration: number;
  videoInfo: {
    width: number;
    height: number;
    codec: string;
    bitrate: number;
  } | null;
  subtitleTracks: {
    index: number;
    codec: string;
    language: string;
    title: string;
  }[];
  audioTracks: {
    index: number;
    codec: string;
    language: string;
    title: string;
    channels: number;
  }[];
  probing?: boolean;
} | null> {
  try {
    const res = await cloudFetch(`/api/stream/media-info/${streamId}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * رابط ملف الترجمة WebVTT
 */
export function getSubtitleUrl(streamId: string, trackIndex: number): string {
  return `${CLOUD_SERVER_URL}/vod/subtitle/${streamId}/${trackIndex}`;
}

export interface Subtitle {
  language: string;
  label: string;
  url: string;
  filename: string;
  format: string;
}

/**
 * جلب ترجمات عربية للفيلم أو المسلسل
 */
export async function fetchSubtitles(params: {
  tmdbId?: string;
  imdbId?: string;
  type?: "movie" | "tv";
  season?: number;
  episode?: number;
}): Promise<Subtitle[]> {
  try {
    const query = new URLSearchParams();
    if (params.tmdbId) query.set("tmdbId", params.tmdbId);
    if (params.imdbId) query.set("imdbId", params.imdbId);
    if (params.type) query.set("type", params.type);
    if (params.season) query.set("season", String(params.season));
    if (params.episode) query.set("episode", String(params.episode));

    const res = await fetch(
      `${CLOUD_SERVER_URL}/api/subtitles?${query.toString()}`,
      {
        headers: { Accept: "application/json" },
      },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.subtitles || [];
  } catch {
    return [];
  }
}

// proxyHls — تم الحذف — لا يوجد بث embed بعد الآن

export function getCloudServerUrl(): string {
  return CLOUD_SERVER_URL;
}

export function getBaseUrl(): string {
  return API_BASE_URL;
}

// ─── Xtream Channels (beIN Sports + الكأس + عراقي + عربي) ─────────────
export interface FreeChannel {
  id: string;
  name: string;
  logo: string;
  group: string;
}

export interface FreeChannelsResult {
  success: boolean;
  channels: FreeChannel[];
  total: number;
  hasMore: boolean;
  categories: string[];
}

export interface FreeStreamResult {
  success: boolean;
  name?: string;
  logo?: string;
  group?: string;
  streamUrl?: string;
  headers?: Record<string, string>;
  error?: string;
}

/**
 * جلب قائمة القنوات المجانية من السيرفر
 */
export async function fetchFreeChannels(params?: {
  group?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<FreeChannelsResult> {
  try {
    const q = new URLSearchParams();
    // السيرفر السحابي يستخدم "category" كاسم المعامل
    if (params?.group) q.set("category", params.group);
    if (params?.search) q.set("search", params.search);
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.offset) q.set("offset", String(params.offset));
    const qs = q.toString();
    const cacheKey = `free_channels_${qs}`;
    const cached = getCached<FreeChannelsResult>(cacheKey);
    if (cached) return cached;
    // إرسال JWT مع طلب القنوات المجانية لدعم إحصائيات المشاهدة
    const token = await getToken();
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(
      `${CLOUD_SERVER_URL}/api/xtream/channels${qs ? "?" + qs : ""}`,
      { headers },
    );
    if (!res.ok) throw new Error("Failed to fetch");
    const data = await res.json();
    const result: FreeChannelsResult = {
      success: true,
      channels: (data.channels || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        logo: c.logo,
        group: c.category,
      })),
      total: data.total || 0,
      hasMore: data.hasMore || false,
      categories: data.categories || [],
    };
    setCached(cacheKey, result);
    return result;
  } catch {
    return {
      success: false,
      channels: [],
      total: 0,
      hasMore: false,
      categories: [],
    };
  }
}

// fetchFreeCategories — تم الحذف

// requestFreeStream — تم الحذف — كل القنوات بريميوم فقط
// استخدم requestPremiumStream بدلاً من ذلك

// refreshFreeChannels — تم الحذف

// ─── Premium (beIN Sports + الكأس) ─ now served from Xtream ────────────────────────

export interface PremiumChannel {
  id: string;
  name: string;
  logo: string;
}

export interface PremiumChannelsResult {
  success: boolean;
  channels: PremiumChannel[];
  total: number;
  categories: string[];
  requiresSubscription?: boolean;
  expired?: boolean;
  error?: string;
}

export interface PremiumStreamResult {
  success: boolean;
  name?: string;
  logo?: string;
  group?: string;
  streamUrl?: string;
  headers?: Record<string, string>;
  requiresSubscription?: boolean;
  expired?: boolean;
  error?: string;
}

export async function fetchPremiumChannels(): Promise<PremiumChannelsResult> {
  try {
    // إرسال JWT للتحقق من حالة الاشتراك
    const token = await getToken();
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(
      `${CLOUD_SERVER_URL}/api/xtream/channels?category=beIN Sports&limit=50`,
      { headers },
    );
    const data = await res.json();
    if (!res.ok)
      return {
        success: false,
        channels: [],
        total: 0,
        categories: [],
        error: data.error,
      };
    return {
      success: true,
      channels: (data.channels || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        logo: c.logo,
        group: c.category,
      })),
      total: data.total || 0,
      categories: data.categories || [],
    };
  } catch {
    return {
      success: false,
      channels: [],
      total: 0,
      categories: [],
      error: "خطأ في الاتصال",
    };
  }
}

// ─── IPTV VOD API — تم الحذف — lulu هو المصدر الوحيد للأفلام والمسلسلات ─────

// ─────────────────────────────────────────────────────────────────────────────

export async function requestPremiumStream(
  channelId: string,
): Promise<PremiumStreamResult> {
  try {
    const res = await cloudFetch(
      `/api/xtream/stream/${encodeURIComponent(channelId)}`,
    );
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error };
    // Prefer hlsUrl (HLS proxy) — shares one IPTV connection for all users
    let streamUrl = data.hlsUrl || data.directUrl || data.proxyUrl || "";
    if (streamUrl && !streamUrl.startsWith("http")) {
      streamUrl = `${CLOUD_SERVER_URL}${streamUrl}`;
    }
    return {
      success: true,
      name: data.name,
      logo: data.logo,
      group: data.category,
      streamUrl,
    };
  } catch (err: any) {
    return { success: false, error: err.message || "خطأ في الاتصال" };
  }
}

// ─── LuluStream Catalog ──────────────────────────────────────────────────────

export interface LuluItem {
  id: string;
  title: string;
  poster: string;
  year: string;
  genre: string;
  rating: string;
  lang: string;
  vod_type: "movie" | "series";
  episodeCount?: number;
}

export interface LuluEpisode {
  id: string;
  episode: number;
  season: number;
  title: string;
  fileCode: string;
  hlsUrl: string;
  embedUrl: string;
  canplay?: boolean;
  thumbnail?: string;
  overview?: string;
  air_date?: string;
}

export interface LuluSeason {
  season: number;
  episodes: LuluEpisode[];
}

export interface LuluDetail extends LuluItem {
  backdrop?: string;
  plot?: string;
  cast_list?: string;
  director?: string;
  country?: string;
  runtime?: string;
  genres?: string;
  seasons?: LuluSeason[];
  episodes?: LuluEpisode[];
  fileCode?: string;
  hlsUrl?: string;
  embedUrl?: string;
  canplay?: boolean;
}

export async function fetchLuluHome(): Promise<{
  latestMovies: LuluItem[];
  latestSeries: LuluItem[];
}> {
  try {
    const res = await apiFetch("/api/lulu/home");
    if (!res.ok) throw new Error("failed");
    return await res.json();
  } catch {
    return { latestMovies: [], latestSeries: [] };
  }
}

export async function fetchLuluList(params?: {
  type?: "movie" | "series";
  page?: number;
  search?: string;
}): Promise<{
  items: LuluItem[];
  page: number;
  total: number;
  hasMore: boolean;
}> {
  try {
    const q = new URLSearchParams({
      type: params?.type || "movie",
      page: String(params?.page || 1),
    });
    if (params?.search) q.set("search", params.search);
    const res = await apiFetch(`/api/lulu/list?${q}`);
    if (!res.ok) throw new Error("failed");
    return await res.json();
  } catch {
    return { items: [], page: 1, total: 0, hasMore: false };
  }
}

export async function fetchLuluDetail(
  id: string,
  type: "movie" | "series",
): Promise<LuluDetail | null> {
  try {
    const q = new URLSearchParams({ type, id });
    const res = await apiFetch(`/api/lulu/detail?${q}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function requestLuluStream(opts: {
  type: "movie" | "series";
  id?: string;
  ep_id?: string;
}): Promise<{
  available: boolean;
  hlsUrl?: string;
  embedUrl?: string;
  fileCode?: string;
}> {
  try {
    const p = new URLSearchParams({ type: opts.type });
    if (opts.id) p.set("id", opts.id);
    if (opts.ep_id) p.set("ep_id", opts.ep_id);
    const res = await apiFetch(`/api/lulu/stream?${p}`);
    if (!res.ok) return { available: false };
    return await res.json();
  } catch {
    return { available: false };
  }
}
