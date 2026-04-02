/**
 * LuluStream API Integration
 * تحويل روابط IPTV إلى روابط مباشرة عبر LuluStream
 */

const LULUSTREAM_API = 'https://lulustream.com/api';
const FETCH_TIMEOUT = 30000;

class LuluStreamAPI {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  async request(endpoint, params = {}) {
    const url = new URL(`${LULUSTREAM_API}${endpoint}`);
    url.searchParams.set('key', this.apiKey);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    try {
      const res = await fetch(url.toString(), { signal: controller.signal });
      const data = await res.json();
      if (data.status !== 200) {
        throw new Error(data.msg || 'LuluStream API error');
      }
      return data.result;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * معلومات الحساب
   */
  async getAccountInfo() {
    return this.request('/account/info');
  }

  /**
   * رفع رابط URL (IPTV/m3u8) إلى LuluStream
   * @param {string} url - رابط الفيديو أو البث
   * @param {string} title - عنوان الملف (اختياري)
   * @returns {Promise<{filecode: string}>}
   */
  async uploadByUrl(url, title) {
    const params = { url };
    if (title) params.file_title = title;
    return this.request('/upload/url', params);
  }

  /**
   * معلومات الملف
   * @param {string} fileCode
   */
  async getFileInfo(fileCode) {
    const result = await this.request('/file/info', { file_code: fileCode });
    return Array.isArray(result) ? result[0] : result;
  }

  /**
   * قائمة الملفات
   */
  async listFiles(page = 1, perPage = 20, folderId) {
    const params = { page, per_page: perPage };
    if (folderId) params.fld_id = folderId;
    return this.request('/file/list', params);
  }

  /**
   * رفع ترجمة للملف
   * @param {string} fileCode
   * @param {string} subUrl - رابط ملف الترجمة
   * @param {string} lang - كود اللغة (ar, en, etc)
   */
  async uploadSubtitle(fileCode, subUrl, lang = 'ar') {
    return this.request('/upload/sub', {
      file_code: fileCode,
      sub_url: subUrl,
      sub_lang: lang,
    });
  }

  /**
   * فحص حالة رفع URL
   * @param {string} fileCode
   * @returns {Promise<{status: string, progress?: number}>}
   */
  async checkUrlUploadStatus(fileCode) {
    const info = await this.getFileInfo(fileCode);
    return {
      status: info.canplay ? 'ready' : 'processing',
      canPlay: !!info.canplay,
      length: info.file_length,
      title: info.file_title,
      thumbnail: info.player_img,
    };
  }

  /**
   * إنشاء رابط Embed للملف
   * @param {string} fileCode
   */
  getEmbedUrl(fileCode) {
    return `https://lulustream.com/e/${fileCode}`;
  }

  /**
   * إنشاء رابط مباشر للملف (يحتاج Premium)
   * @param {string} fileCode
   */
  getDirectUrl(fileCode) {
    return `https://lulustream.com/d/${fileCode}`;
  }
}

// Singleton instance
let instance = null;

function initLuluStream(apiKey) {
  if (!apiKey) {
    console.warn('[LuluStream] No API key provided');
    return null;
  }
  instance = new LuluStreamAPI(apiKey);
  console.log('[LuluStream] Initialized');
  return instance;
}

function getLuluStream() {
  return instance;
}

module.exports = { LuluStreamAPI, initLuluStream, getLuluStream };
