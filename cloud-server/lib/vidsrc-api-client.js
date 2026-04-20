/**
 * VidSrc API Client - استخراج فيديو + ترجمات
 * استخدام: cool-dev-guy/vidsrc-api
 */

const fetch = require('node-fetch');

class VidSrcApiClient {
  constructor() {
    // ضع رابط API الخاص بك بعد Deploy على Vercel
    this.baseUrl = 'https://your-vidsrc-api.vercel.app';
  }

  /**
   * تحويل TMDB ID إلى IMDb ID
   */
  async getImdbId(tmdbId, type = 'movie') {
    try {
      const apiKey = process.env.TMDB_API_KEY || 'YOUR_TMDB_KEY';
      const endpoint = type === 'movie' ? 'movie' : 'tv';
      const url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}/external_ids?api_key=${apiKey}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      return data.imdb_id;
    } catch (error) {
      console.error('[VidSrc API] Error getting IMDb ID:', error.message);
      return null;
    }
  }

  /**
   * استخراج الفيديو + الترجمات
   */
  async getStream(tmdbId, type = 'movie', season, episode) {
    try {
      // 1. تحويل TMDB إلى IMDb
      const imdbId = await this.getImdbId(tmdbId, type);
      if (!imdbId) {
        throw new Error('Could not get IMDb ID');
      }

      // 2. بناء URL
      let url = `${this.baseUrl}/vidsrc/${imdbId}`;
      if (type === 'tv' && season && episode) {
        url += `?s=${season}&e=${episode}`;
      }

      console.log(`[VidSrc API] Fetching: ${url}`);

      // 3. طلب API
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        signal: AbortSignal.timeout(20000)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      // 4. معالجة النتيجة
      if (data.status === 200 && data.sources && data.sources.length > 0) {
        const source = data.sources[0];
        
        console.log(`[VidSrc API] ✓ Success - ${source.data.subtitle?.length || 0} subtitles found`);

        return {
          success: true,
          streamUrl: source.data.stream,
          subtitles: (source.data.subtitle || []).map(sub => ({
            language: sub.lang,
            url: sub.file,
            label: sub.lang
          })),
          provider: 'vidsrc-api',
          source: source.name
        };
      }

      throw new Error('No sources found');

    } catch (error) {
      console.error(`[VidSrc API] Error: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = VidSrcApiClient;
