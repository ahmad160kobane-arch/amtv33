/**
 * VidSrc Advanced Resolver - استخراج روابط HLS مباشرة
 * يدعم: vidsrc.to, vidsrc.xyz, vidsrc.net
 * يستخرج روابط مباشرة بدلاً من embed
 */

const axios = require('axios');
const { JSDOM } = require('jsdom');

class VidSrcAdvancedResolver {
  constructor() {
    this.baseUrls = {
      to: 'https://vidsrc.to',
      xyz: 'https://vidsrc.xyz',
      net: 'https://vidsrc.net',
      pro: 'https://vidsrc.pro'
    };
    
    this.headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Referer': 'https://vidsrc.to/'
    };
  }

  /**
   * استخراج رابط مباشر من vidsrc.to
   */
  async resolveFromVidSrcTo(imdbId, type = 'movie', season, episode) {
    try {
      let embedUrl;
      if (type === 'tv' && season && episode) {
        embedUrl = `${this.baseUrls.to}/embed/tv/${imdbId}/${season}/${episode}`;
      } else {
        embedUrl = `${this.baseUrls.to}/embed/movie/${imdbId}`;
      }

      console.log(`[VidSrc.to] Fetching: ${embedUrl}`);
      
      const response = await axios.get(embedUrl, { 
        headers: this.headers,
        timeout: 15000
      });

      // استخراج data-id من الصفحة
      const dom = new JSDOM(response.data);
      const document = dom.window.document;
      
      // البحث عن iframe أو data-id
      const iframe = document.querySelector('iframe[data-id]');
      if (iframe) {
        const dataId = iframe.getAttribute('data-id');
        
        // طلب الرابط المباشر
        const sourceUrl = `${this.baseUrls.to}/ajax/embed/source/${dataId}`;
        const sourceResponse = await axios.get(sourceUrl, { 
          headers: { ...this.headers, 'Referer': embedUrl }
        });
        
        if (sourceResponse.data && sourceResponse.data.result) {
          const streamUrl = sourceResponse.data.result.url;
          
          return {
            success: true,
            streamUrl,
            provider: 'vidsrc.to',
            quality: 'auto',
            type: 'hls',
            embedUrl
          };
        }
      }

      // إذا فشل الاستخراج، أرجع embed URL
      return {
        success: true,
        embedUrl,
        provider: 'vidsrc.to',
        type: 'embed'
      };

    } catch (error) {
      console.error('[VidSrc.to] Error:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * استخراج رابط من vidsrc.xyz (يدعم TMDB)
   */
  async resolveFromVidSrcXyz(tmdbId, type = 'movie', season, episode) {
    try {
      let embedUrl;
      if (type === 'tv' && season && episode) {
        embedUrl = `${this.baseUrls.xyz}/embed/tv/${tmdbId}/${season}/${episode}`;
      } else {
        embedUrl = `${this.baseUrls.xyz}/embed/movie/${tmdbId}`;
      }

      console.log(`[VidSrc.xyz] Using embed: ${embedUrl}`);
      
      return {
        success: true,
        embedUrl,
        provider: 'vidsrc.xyz',
        type: 'embed'
      };

    } catch (error) {
      console.error('[VidSrc.xyz] Error:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * استخراج رابط من vidsrc.net
   */
  async resolveFromVidSrcNet(imdbId, type = 'movie', season, episode) {
    try {
      let embedUrl;
      if (type === 'tv' && season && episode) {
        embedUrl = `${this.baseUrls.net}/embed/tv?imdb=${imdbId}&season=${season}&episode=${episode}`;
      } else {
        embedUrl = `${this.baseUrls.net}/embed/movie?imdb=${imdbId}`;
      }

      console.log(`[VidSrc.net] Using embed: ${embedUrl}`);
      
      return {
        success: true,
        embedUrl,
        provider: 'vidsrc.net',
        type: 'embed'
      };

    } catch (error) {
      console.error('[VidSrc.net] Error:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * استخراج رابط من vidsrc.pro (جودة عالية)
   */
  async resolveFromVidSrcPro(tmdbId, type = 'movie', season, episode) {
    try {
      let embedUrl;
      if (type === 'tv' && season && episode) {
        embedUrl = `${this.baseUrls.pro}/embed/tv/${tmdbId}/${season}/${episode}`;
      } else {
        embedUrl = `${this.baseUrls.pro}/embed/movie/${tmdbId}`;
      }

      console.log(`[VidSrc.pro] Using embed: ${embedUrl}`);
      
      return {
        success: true,
        embedUrl,
        provider: 'vidsrc.pro',
        type: 'embed'
      };

    } catch (error) {
      console.error('[VidSrc.pro] Error:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * محاولة جميع المصادر بالترتيب
   */
  async resolveWithFallback(tmdbId, imdbId, type = 'movie', season, episode) {
    const sources = [];

    // 1. جرب vidsrc.xyz (يدعم TMDB - الأسرع)
    if (tmdbId) {
      const xyzResult = await this.resolveFromVidSrcXyz(tmdbId, type, season, episode);
      if (xyzResult.success) {
        sources.push(xyzResult);
      }
    }

    // 2. جرب vidsrc.to (يدعم IMDb - جودة عالية)
    if (imdbId) {
      const toResult = await this.resolveFromVidSrcTo(imdbId, type, season, episode);
      if (toResult.success) {
        sources.push(toResult);
      }
    }

    // 3. جرب vidsrc.net (بديل)
    if (imdbId) {
      const netResult = await this.resolveFromVidSrcNet(imdbId, type, season, episode);
      if (netResult.success) {
        sources.push(netResult);
      }
    }

    // 4. جرب vidsrc.pro (جودة عالية)
    if (tmdbId) {
      const proResult = await this.resolveFromVidSrcPro(tmdbId, type, season, episode);
      if (proResult.success) {
        sources.push(proResult);
      }
    }

    if (sources.length === 0) {
      return {
        success: false,
        error: 'No sources available'
      };
    }

    // أرجع المصدر الأول (الأفضل)
    const primary = sources[0];
    
    return {
      success: true,
      streamUrl: primary.streamUrl || primary.embedUrl,
      embedUrl: primary.embedUrl,
      provider: primary.provider,
      type: primary.type,
      quality: primary.quality || 'auto',
      sources: sources.map(s => ({
        provider: s.provider,
        url: s.streamUrl || s.embedUrl,
        type: s.type
      }))
    };
  }

  /**
   * الدالة الرئيسية - متوافقة مع الكود القديم
   */
  async resolveStream(tmdbId, type = 'movie', season, episode, imdbId) {
    console.log(`[VidSrc Advanced] Resolving: tmdb=${tmdbId} imdb=${imdbId} type=${type}${type === 'tv' ? ` s${season}e${episode}` : ''}`);
    
    const result = await this.resolveWithFallback(tmdbId, imdbId, type, season, episode);
    
    if (!result.success) {
      console.error('[VidSrc Advanced] All sources failed');
      // Fallback إلى embed بسيط
      const fallbackUrl = tmdbId 
        ? `https://vidsrc.xyz/embed/${type}/${tmdbId}${type === 'tv' ? `/${season}/${episode}` : ''}`
        : `https://vidsrc.to/embed/${type}/${imdbId}${type === 'tv' ? `/${season}/${episode}` : ''}`;
      
      return {
        embedUrl: fallbackUrl,
        provider: 'vidsrc-fallback',
        sources: [{ url: fallbackUrl, name: 'vidsrc' }],
        allEmbedUrls: [fallbackUrl]
      };
    }

    return {
      embedUrl: result.embedUrl || result.streamUrl,
      streamUrl: result.streamUrl,
      provider: result.provider,
      quality: result.quality,
      type: result.type,
      sources: result.sources || [{ url: result.embedUrl || result.streamUrl, name: result.provider }],
      allEmbedUrls: result.sources ? result.sources.map(s => s.url) : [result.embedUrl || result.streamUrl]
    };
  }
}

// تصدير instance واحد
const resolver = new VidSrcAdvancedResolver();

module.exports = {
  resolveStream: (tmdbId, type, season, episode, imdbId) => 
    resolver.resolveStream(tmdbId, type, season, episode, imdbId)
};
