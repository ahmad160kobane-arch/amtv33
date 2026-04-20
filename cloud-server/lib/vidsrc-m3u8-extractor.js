/**
 * VidSrc M3U8 Extractor — استخراج روابط m3u8 مباشرة من VidSrc
 * 
 * يدعم:
 * - vidsrc.xyz (TMDB)
 * - vidsrc.net (IMDb)
 * - vidsrc.to (IMDb)
 * - vidsrc.pro (TMDB)
 * 
 * يستخرج روابط m3u8 مباشرة بدلاً من embed URLs
 */

const axios = require('axios');
const { JSDOM } = require('jsdom');

class VidSrcM3U8Extractor {
  constructor() {
    this.headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://vidsrc.xyz/',
    };
  }

  /**
   * فك تشفير Base64 المعدل (VidSrc encoding)
   */
  decodeVidSrcData(encoded) {
    try {
      // VidSrc uses custom base64 encoding
      const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
      return decoded;
    } catch {
      return null;
    }
  }

  /**
   * استخراج data-id من صفحة VidSrc
   */
  async extractDataId(embedUrl) {
    try {
      const response = await axios.get(embedUrl, {
        headers: this.headers,
        timeout: 15000,
      });

      const dom = new JSDOM(response.data);
      const document = dom.window.document;

      // البحث عن data-id في iframe أو div
      const iframe = document.querySelector('iframe[data-id]');
      if (iframe) {
        return iframe.getAttribute('data-id');
      }

      // البحث في script tags
      const scripts = document.querySelectorAll('script');
      for (const script of scripts) {
        const content = script.textContent || '';
        const match = content.match(/data-id["\s]*[:=]["\s]*["']([^"']+)["']/i);
        if (match) return match[1];
      }

      return null;
    } catch (error) {
      console.error('[VidSrc M3U8] Extract data-id error:', error.message);
      return null;
    }
  }

  /**
   * استخراج m3u8 من vidsrc.to (IMDb)
   */
  async extractFromVidSrcTo(imdbId, type = 'movie', season, episode) {
    try {
      let embedUrl;
      if (type === 'tv' && season && episode) {
        embedUrl = `https://vidsrc.to/embed/tv/${imdbId}/${season}/${episode}`;
      } else {
        embedUrl = `https://vidsrc.to/embed/movie/${imdbId}`;
      }

      console.log(`[VidSrc.to M3U8] Fetching: ${embedUrl}`);

      const dataId = await this.extractDataId(embedUrl);
      if (!dataId) {
        console.log('[VidSrc.to M3U8] No data-id found');
        return null;
      }

      // طلب الرابط المباشر من API
      const sourceUrl = `https://vidsrc.to/ajax/embed/source/${dataId}`;
      const sourceResponse = await axios.get(sourceUrl, {
        headers: { ...this.headers, 'Referer': embedUrl },
        timeout: 10000,
      });

      if (sourceResponse.data && sourceResponse.data.result) {
        const streamUrl = sourceResponse.data.result.url;
        
        // التحقق من أن الرابط m3u8
        if (streamUrl && (streamUrl.includes('.m3u8') || streamUrl.includes('playlist'))) {
          console.log(`[VidSrc.to M3U8] ✓ Found: ${streamUrl.substring(0, 80)}...`);
          return {
            url: streamUrl,
            provider: 'vidsrc.to',
            type: 'hls',
            quality: 'auto',
          };
        }
      }

      return null;
    } catch (error) {
      console.error('[VidSrc.to M3U8] Error:', error.message);
      return null;
    }
  }

  /**
   * استخراج m3u8 من vidsrc.xyz (TMDB)
   */
  async extractFromVidSrcXyz(tmdbId, type = 'movie', season, episode) {
    try {
      let embedUrl;
      if (type === 'tv' && season && episode) {
        embedUrl = `https://vidsrc.xyz/embed/tv/${tmdbId}/${season}/${episode}`;
      } else {
        embedUrl = `https://vidsrc.xyz/embed/movie/${tmdbId}`;
      }

      console.log(`[VidSrc.xyz M3U8] Fetching: ${embedUrl}`);

      const response = await axios.get(embedUrl, {
        headers: this.headers,
        timeout: 8000,
      });

      const dom = new JSDOM(response.data);
      const document = dom.window.document;

      // البحث عن iframe مع src
      const iframe = document.querySelector('iframe[src]');
      if (iframe) {
        const iframeSrc = iframe.getAttribute('src');
        
        // إذا كان iframe يحتوي على رابط مباشر
        if (iframeSrc && (iframeSrc.includes('.m3u8') || iframeSrc.includes('playlist'))) {
          console.log(`[VidSrc.xyz M3U8] ✓ Found in iframe: ${iframeSrc.substring(0, 80)}...`);
          return {
            url: iframeSrc,
            provider: 'vidsrc.xyz',
            type: 'hls',
            quality: 'auto',
          };
        }

        // إذا كان iframe يشير إلى مصدر آخر، جرب استخراجه
        if (iframeSrc && iframeSrc.startsWith('http')) {
          const nestedResult = await this.extractFromNestedIframe(iframeSrc);
          if (nestedResult) {
            return { ...nestedResult, provider: 'vidsrc.xyz' };
          }
        }
      }

      // البحث في script tags عن روابط m3u8
      const scripts = document.querySelectorAll('script');
      for (const script of scripts) {
        const content = script.textContent || '';
        const m3u8Match = content.match(/(https?:\/\/[^\s"']+\.m3u8[^\s"']*)/);
        if (m3u8Match) {
          console.log(`[VidSrc.xyz M3U8] ✓ Found in script: ${m3u8Match[1].substring(0, 80)}...`);
          return {
            url: m3u8Match[1],
            provider: 'vidsrc.xyz',
            type: 'hls',
            quality: 'auto',
          };
        }
      }

      return null;
    } catch (error) {
      console.error('[VidSrc.xyz M3U8] Error:', error.message);
      return null;
    }
  }

  /**
   * استخراج m3u8 من vidsrc.net (IMDb)
   */
  async extractFromVidSrcNet(imdbId, type = 'movie', season, episode) {
    try {
      let embedUrl;
      if (type === 'tv' && season && episode) {
        embedUrl = `https://vidsrc.net/embed/tv?imdb=${imdbId}&season=${season}&episode=${episode}`;
      } else {
        embedUrl = `https://vidsrc.net/embed/movie?imdb=${imdbId}`;
      }

      console.log(`[VidSrc.net M3U8] Fetching: ${embedUrl}`);

      const response = await axios.get(embedUrl, {
        headers: this.headers,
        timeout: 15000,
      });

      // البحث عن روابط m3u8 في HTML
      const m3u8Match = response.data.match(/(https?:\/\/[^\s"']+\.m3u8[^\s"']*)/);
      if (m3u8Match) {
        console.log(`[VidSrc.net M3U8] ✓ Found: ${m3u8Match[1].substring(0, 80)}...`);
        return {
          url: m3u8Match[1],
          provider: 'vidsrc.net',
          type: 'hls',
          quality: 'auto',
        };
      }

      return null;
    } catch (error) {
      console.error('[VidSrc.net M3U8] Error:', error.message);
      return null;
    }
  }

  /**
   * استخراج m3u8 من vidsrc.pro (TMDB)
   */
  async extractFromVidSrcPro(tmdbId, type = 'movie', season, episode) {
    try {
      let embedUrl;
      if (type === 'tv' && season && episode) {
        embedUrl = `https://vidsrc.pro/embed/tv/${tmdbId}/${season}/${episode}`;
      } else {
        embedUrl = `https://vidsrc.pro/embed/movie/${tmdbId}`;
      }

      console.log(`[VidSrc.pro M3U8] Fetching: ${embedUrl}`);

      const response = await axios.get(embedUrl, {
        headers: this.headers,
        timeout: 15000,
      });

      // البحث عن روابط m3u8
      const m3u8Match = response.data.match(/(https?:\/\/[^\s"']+\.m3u8[^\s"']*)/);
      if (m3u8Match) {
        console.log(`[VidSrc.pro M3U8] ✓ Found: ${m3u8Match[1].substring(0, 80)}...`);
        return {
          url: m3u8Match[1],
          provider: 'vidsrc.pro',
          type: 'hls',
          quality: 'auto',
        };
      }

      return null;
    } catch (error) {
      console.error('[VidSrc.pro M3U8] Error:', error.message);
      return null;
    }
  }

  /**
   * استخراج m3u8 من iframe متداخل
   */
  async extractFromNestedIframe(iframeUrl) {
    try {
      const response = await axios.get(iframeUrl, {
        headers: this.headers,
        timeout: 10000,
      });

      const m3u8Match = response.data.match(/(https?:\/\/[^\s"']+\.m3u8[^\s"']*)/);
      if (m3u8Match) {
        return {
          url: m3u8Match[1],
          type: 'hls',
          quality: 'auto',
        };
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * الدالة الرئيسية — محاولة جميع المصادر
   */
  async extract({ tmdbId, imdbId, type = 'movie', season, episode }) {
    console.log(`[VidSrc M3U8 Extractor] tmdb=${tmdbId} imdb=${imdbId} type=${type}${type === 'tv' ? ` s${season}e${episode}` : ''}`);

    const results = [];

    // 1. جرب vidsrc.xyz (TMDB - سريع)
    if (tmdbId) {
      const xyzResult = await this.extractFromVidSrcXyz(tmdbId, type, season, episode);
      if (xyzResult) results.push(xyzResult);
    }

    // 2. جرب vidsrc.to (IMDb - جودة عالية)
    if (imdbId) {
      const toResult = await this.extractFromVidSrcTo(imdbId, type, season, episode);
      if (toResult) results.push(toResult);
    }

    // 3. جرب vidsrc.net (IMDb - بديل)
    if (imdbId) {
      const netResult = await this.extractFromVidSrcNet(imdbId, type, season, episode);
      if (netResult) results.push(netResult);
    }

    // 4. vidsrc.pro — محذوف: يعتمد على embed.su الذي يفشل DNS من VPS

    if (results.length === 0) {
      console.log('[VidSrc M3U8 Extractor] ✗ No m3u8 found from any source');
      return null;
    }

    // أرجع المصدر الأول (الأفضل)
    const best = results[0];
    console.log(`[VidSrc M3U8 Extractor] ✓ Success: ${best.provider} — ${best.url.substring(0, 80)}...`);
    
    return {
      url: best.url,
      provider: best.provider,
      type: best.type,
      quality: best.quality,
      sources: results,
    };
  }
}

// تصدير instance واحد
const extractor = new VidSrcM3U8Extractor();

module.exports = {
  extractVidSrcM3U8: (opts) => extractor.extract(opts),
};
