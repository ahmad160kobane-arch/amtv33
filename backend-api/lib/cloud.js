/**
 * وحدة التواصل مع السيرفر السحابي
 * 
 * الباك اند الرئيسي يتحكم بالسيرفر السحابي عبر API داخلي محمي بمفتاح سري
 * السيرفر السحابي مسؤول فقط عن البث (FFmpeg → HLS)
 */

// إعدادات السيرفر السحابي
const CLOUD_SERVER_URL = process.env.CLOUD_SERVER_URL || 'http://localhost:8080';
const INTERNAL_SECRET = process.env.INTERNAL_SECRET || 'cloud-internal-secret-change-me';

/**
 * إرسال طلب للسيرفر السحابي
 */
async function cloudRequest(method, path, body = null) {
  try {
    const opts = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': INTERNAL_SECRET,
      },
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${CLOUD_SERVER_URL}${path}`, opts);
    return await res.json();
  } catch (err) {
    console.error(`[Cloud] خطأ اتصال بالسيرفر السحابي:`, err.message);
    return { error: 'السيرفر السحابي غير متاح', offline: true };
  }
}

/**
 * بدء بث قناة مباشرة
 * @param {string} streamId - معرف القناة
 * @param {string} sourceUrl - رابط مصدر IPTV
 * @param {string} name - اسم القناة
 * @returns {{ success, hlsUrl, ready, waiting }}
 */
async function startLiveStream(streamId, sourceUrl, name) {
  return cloudRequest('POST', '/internal/stream/start', {
    streamId, type: 'live', sourceUrl, name,
  });
}

/**
 * بدء بث VOD (فيلم/حلقة) مع ترجمة
 * @param {string} streamId - معرف الفيلم/الحلقة
 * @param {string} sourceUrl - رابط المصدر
 * @param {string} name - عنوان المحتوى
 */
async function startVodStream(streamId, sourceUrl, name) {
  return cloudRequest('POST', '/internal/stream/start', {
    streamId, type: 'vod', sourceUrl, name,
  });
}

/**
 * إنهاء مشاهدة (تقليل عدد المشاهدين)
 */
async function releaseStream(streamId) {
  return cloudRequest('POST', '/internal/stream/release', { streamId });
}

/**
 * إيقاف بث (من الأدمن)
 */
async function stopStream(streamId) {
  return cloudRequest('POST', '/internal/stream/stop', { streamId });
}

/**
 * إيقاف كل البث
 */
async function stopAll() {
  return cloudRequest('POST', '/internal/stream/stop-all');
}

/**
 * حالة كل البث النشط
 */
async function getStreamStatus() {
  return cloudRequest('GET', '/internal/stream/status');
}

/**
 * هل البث جاهز للتشغيل؟
 */
async function isStreamReady(streamId) {
  return cloudRequest('GET', `/internal/stream/ready/${streamId}`);
}

/**
 * فحص مسارات الترجمة
 */
async function probeSubtitles(sourceUrl) {
  return cloudRequest('POST', '/internal/stream/probe-subtitles', { sourceUrl });
}

/**
 * فحص صحة السيرفر السحابي
 */
async function healthCheck() {
  try {
    const res = await fetch(`${CLOUD_SERVER_URL}/health`, { signal: AbortSignal.timeout(5000) });
    return await res.json();
  } catch {
    return { status: 'offline' };
  }
}

/**
 * الحصول على رابط HLS الكامل للمشاهد
 */
function getHlsUrl(streamId, type = 'live') {
  if (type === 'vod') return `${CLOUD_SERVER_URL}/hls/vod/${streamId}/stream.m3u8`;
  return `${CLOUD_SERVER_URL}/hls/${streamId}/stream.m3u8`;
}

module.exports = {
  CLOUD_SERVER_URL,
  startLiveStream,
  startVodStream,
  releaseStream,
  stopStream,
  stopAll,
  getStreamStatus,
  isStreamReady,
  probeSubtitles,
  healthCheck,
  getHlsUrl,
};
