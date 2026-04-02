const { MOVIES } = require('@consumet/extensions');

// Initialize FlixHQ provider only
const flixhq = new MOVIES.FlixHQ();

/**
 * جلب الأفلام الشائعة من FlixHQ
 */
async function fetchPopularMovies(page = 1) {
  try {
    const results = await flixhq.fetchTrendingMovies(page);
    
    return (results.results || []).map(movie => ({
      id: `flixhq_movie_${movie.id}`,
      flixhq_id: movie.id,
      title: movie.title,
      vod_type: 'movie',
      category: 'أفلام',
      poster: movie.image || '',
      backdrop: movie.cover || movie.image || '',
      year: movie.releaseDate ? new Date(movie.releaseDate).getFullYear() : null,
      rating: movie.rating || 0,
      description: movie.description || '',
      source_rating: movie.rating || 0,
    }));
  } catch (err) {
    console.error('[FlixHQ] Error fetching popular movies:', err.message);
    return [];
  }
}

/**
 * جلب المسلسلات الشائعة من FlixHQ
 */
async function fetchPopularSeries(page = 1) {
  try {
    const results = await flixhq.fetchTrendingTvShows(page);
    
    return (results.results || []).map(series => ({
      id: `flixhq_series_${series.id}`,
      flixhq_id: series.id,
      title: series.title,
      vod_type: 'series',
      category: 'مسلسلات',
      poster: series.image || '',
      backdrop: series.cover || series.image || '',
      year: series.releaseDate ? new Date(series.releaseDate).getFullYear() : null,
      rating: series.rating || 0,
      description: series.description || '',
      source_rating: series.rating || 0,
    }));
  } catch (err) {
    console.error('[FlixHQ] Error fetching popular series:', err.message);
    return [];
  }
}

/**
 * جلب تفاصيل فيلم من FlixHQ
 */
async function fetchMovieDetails(flixhqId) {
  try {
    const data = await flixhq.fetchMediaInfo(flixhqId);
    
    if (!data) return null;
    
    return {
      title: data.title,
      description: data.description || '',
      plot: data.description || '',
      cast: data.casts?.join(', ') || '',
      director: data.director || '',
      genre: data.genres?.join(', ') || '',
      country: data.country || '',
      duration: data.duration || '',
      duration_secs: 0,
      backdrop: data.cover || data.image || '',
      poster: data.image || '',
      trailer: '',
      source_rating: data.rating || 0,
      year: data.releaseDate ? new Date(data.releaseDate).getFullYear() : null,
    };
  } catch (err) {
    console.error('[FlixHQ] Error fetching movie details:', err.message);
    return null;
  }
}

/**
 * جلب تفاصيل مسلسل من FlixHQ
 */
async function fetchSeriesDetails(flixhqId) {
  try {
    const data = await flixhq.fetchMediaInfo(flixhqId);
    
    if (!data) return null;
    
    // تجميع المواسم من الحلقات
    const seasons = [];
    const seasonMap = new Map();
    
    if (data.episodes) {
      for (const ep of data.episodes) {
        if (!seasonMap.has(ep.season)) {
          seasonMap.set(ep.season, {
            season_number: ep.season,
            episode_count: 0,
          });
        }
        seasonMap.get(ep.season).episode_count++;
      }
      
      seasonMap.forEach((value) => {
        seasons.push(value);
      });
    }
    
    return {
      title: data.title,
      description: data.description || '',
      plot: data.description || '',
      cast: data.casts?.join(', ') || '',
      director: data.director || '',
      genre: data.genres?.join(', ') || '',
      country: data.country || '',
      backdrop: data.cover || data.image || '',
      poster: data.image || '',
      trailer: '',
      source_rating: data.rating || 0,
      year: data.releaseDate ? new Date(data.releaseDate).getFullYear() : null,
      seasons: seasons,
    };
  } catch (err) {
    console.error('[FlixHQ] Error fetching series details:', err.message);
    return null;
  }
}

/**
 * جلب حلقات موسم معين من FlixHQ
 */
async function fetchSeasonEpisodes(flixhqId, seasonNum) {
  try {
    const data = await flixhq.fetchMediaInfo(flixhqId);
    
    if (!data || !data.episodes) return [];
    
    return data.episodes
      .filter(ep => ep.season === seasonNum)
      .map(ep => ({
        episode_num: ep.number,
        title: ep.title,
        description: ep.description || '',
        air_date: ep.releaseDate || '',
        duration_secs: 0,
        duration: '',
        flixhq_episode_id: ep.id,
      }));
  } catch (err) {
    console.error('[FlixHQ] Error fetching season episodes:', err.message);
    return [];
  }
}

/**
 * الحصول على روابط التشغيل من FlixHQ
 */
async function getMovieStreamUrl(flixhqId) {
  try {
    console.log(`[FlixHQ] Getting stream for movie: ${flixhqId}`);
    
    const mediaInfo = await flixhq.fetchMediaInfo(flixhqId);
    if (!mediaInfo || !mediaInfo.episodes || mediaInfo.episodes.length === 0) {
      console.log(`[FlixHQ] No episodes found for movie: ${flixhqId}`);
      return null;
    }
    
    const episodeId = mediaInfo.episodes[0].id;
    console.log(`[FlixHQ] Movie episode ID: ${episodeId}`);
    
    const streamData = await flixhq.fetchEpisodeSources(episodeId);
    if (!streamData || !streamData.sources || streamData.sources.length === 0) {
      console.log(`[FlixHQ] No stream sources found for: ${flixhqId}`);
      return null;
    }
    
    const source = streamData.sources.find(s => s.quality === '1080p' || s.quality === 'auto') || streamData.sources[0];
    
    console.log(`[FlixHQ] Stream found: ${source.quality} - ${source.url.substring(0, 80)}...`);
    
    return {
      url: source.url,
      quality: source.quality,
      subtitles: streamData.subtitles || [],
      headers: streamData.headers || {},
    };
  } catch (err) {
    console.error('[FlixHQ] Error getting movie stream:', err.message);
    return null;
  }
}

/**
 * الحصول على روابط التشغيل للحلقة من FlixHQ
 */
async function getEpisodeStreamUrl(flixhqId, season, episode) {
  try {
    console.log(`[FlixHQ] Getting stream for: ${flixhqId} S${season}E${episode}`);
    
    // جلب معلومات المسلسل
    const mediaInfo = await flixhq.fetchMediaInfo(flixhqId);
    if (!mediaInfo || !mediaInfo.episodes) {
      console.log(`[FlixHQ] No episodes found for: ${flixhqId}`);
      return null;
    }
    
    // البحث عن الحلقة المطلوبة
    const episodeData = mediaInfo.episodes.find(
      ep => ep.season === season && ep.number === episode
    );
    
    if (!episodeData) {
      console.log(`[FlixHQ] Episode S${season}E${episode} not found`);
      return null;
    }
    
    console.log(`[FlixHQ] Found episode: ${episodeData.title} (${episodeData.id})`);
    
    // جلب روابط البث
    const streamData = await flixhq.fetchEpisodeSources(episodeData.id);
    if (!streamData || !streamData.sources || streamData.sources.length === 0) {
      console.log(`[FlixHQ] No stream sources found for episode: ${episodeData.id}`);
      return null;
    }
    
    const source = streamData.sources.find(s => s.quality === '1080p' || s.quality === 'auto') || streamData.sources[0];
    
    console.log(`[FlixHQ] Stream found: ${source.quality} - ${source.url.substring(0, 80)}...`);
    
    return {
      url: source.url,
      quality: source.quality,
      subtitles: streamData.subtitles || [],
      headers: streamData.headers || {},
    };
  } catch (err) {
    console.error('[FlixHQ] Error getting episode stream:', err.message);
    return null;
  }
}

/**
 * البحث في FlixHQ
 */
async function searchContent(query, type = 'multi') {
  try {
    const results = await flixhq.search(query);
    
    return (results.results || []).map(item => {
      const isMovie = item.type === 'Movie';
      return {
        id: `flixhq_${isMovie ? 'movie' : 'series'}_${item.id}`,
        flixhq_id: item.id,
        title: item.title,
        vod_type: isMovie ? 'movie' : 'series',
        category: isMovie ? 'أفلام' : 'مسلسلات',
        poster: item.image || '',
        backdrop: item.cover || item.image || '',
        year: item.releaseDate ? new Date(item.releaseDate).getFullYear() : null,
        rating: item.rating || 0,
        description: item.description || '',
        source_rating: item.rating || 0,
      };
    });
  } catch (err) {
    console.error('[FlixHQ] Error searching content:', err.message);
    return [];
  }
}

module.exports = {
  fetchPopularMovies,
  fetchPopularSeries,
  fetchMovieDetails,
  fetchSeriesDetails,
  fetchSeasonEpisodes,
  getMovieStreamUrl,
  getEpisodeStreamUrl,
  searchContent,
};
