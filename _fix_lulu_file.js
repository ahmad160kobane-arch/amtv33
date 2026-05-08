/**
 * إصلاح ملف LuluStream بدون بيانات
 * يجلب بيانات TMDB ويحدّث العنوان والقصة والترجمات
 * 
 * استخدام: node _fix_lulu_file.js <file_code> [اسم الفيلم/المسلسل] [movie|series]
 * مثال:    node _fix_lulu_file.js 412564 "Gladiator" movie
 */

'use strict';

const http  = require('http');
const https = require('https');

const LULU_KEY    = '258176jfw9e96irnxai2fm';
const TMDB_KEY    = 'e25ac5a68fba3713e572198a050697ca';
const SUBDL_KEY   = 'MA5RWk78R1H6Gyd-Xu0B37pLWc3MjUCQ';
const TMDB_BASE   = 'https://api.themoviedb.org/3';
const TMDB_IMG    = 'https://image.tmdb.org/t/p/w500';
const TMDB_IMG_ORG= 'https://image.tmdb.org/t/p/original';

const fileCode = process.argv[2];
const forceName = process.argv[3] || '';
const forceType = process.argv[4] || 'movie'; // movie | series

if (!fileCode) {
  console.error('❌ يرجى تحديد file_code: node _fix_lulu_file.js <file_code> [اسم] [movie|series]');
  process.exit(1);
}

function httpGet(url, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout: timeoutMs }, res => {
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location)
        return httpGet(res.headers.location, timeoutMs).then(resolve).catch(reject);
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('HTTP timeout')); });
  });
}

function parseJson(body) {
  try { return JSON.parse(body); } catch { return null; }
}

function cleanTitle(name = '') {
  return name
    .replace(/^(EN|AR|NF|TR|HN|KR|IT|FR|DE|ES|PL|PER|KRD|NL|CH|JP|RU)\s*[|\-]/i, '')
    .replace(/^(NETFLIX|DISNEY|HBO|APPLE|AMAZON|PRIME|SHAHID)\s*[|\-]/i, '')
    .replace(/VOD\s*\d*/i, '')
    .replace(/\s*[-–]\s*\d{4}$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ─── Step 1: جلب معلومات الملف من LuluStream ───────────────────────────────
async function getLuluFileInfo() {
  console.log(`\n📂 جلب معلومات الملف ${fileCode} من LuluStream...`);
  const p = new URLSearchParams({ key: LULU_KEY, file_code: fileCode });
  const res = await httpGet(`https://api.lulustream.com/api/file/info?${p}`, 20000);
  const data = parseJson(res.body);
  const info = Array.isArray(data?.result) ? data.result[0] : data?.result;
  if (!info) {
    console.error('❌ ملف غير موجود في LuluStream:', res.body?.slice(0, 200));
    return null;
  }
  const title = info.title || info.file_title || '';
  console.log(`✅ الملف موجود:`);
  console.log(`   العنوان الحالي: ${title || '(بدون عنوان)'}`);
  console.log(`   الحالة: ${info.status}`);
  console.log(`   canplay: ${info.canplay}`);
  return { title, status: info.status, canplay: info.canplay };
}

// ─── Step 2: البحث في TMDB ─────────────────────────────────────────────────
async function fetchTMDB(title, type) {
  const searchType = type === 'series' ? 'tv' : 'movie';
  const cleanName  = cleanTitle(title);
  console.log(`\n🔍 البحث في TMDB: "${cleanName}" (${searchType})...`);

  const searchEndpoint = searchType === 'tv' ? '/search/tv' : '/search/movie';

  // بحث عربي أولاً
  let results = [];
  for (const lang of ['ar', 'en-US']) {
    const p = new URLSearchParams({ api_key: TMDB_KEY, query: cleanName, language: lang });
    const res = await httpGet(`${TMDB_BASE}${searchEndpoint}?${p}`, 15000);
    const data = parseJson(res.body);
    results = data?.results || [];
    if (results.length > 0) break;
  }

  if (results.length === 0) {
    console.log(`⚠️  لم يتم العثور على "${cleanName}" في TMDB`);
    return null;
  }

  const top = results[0];
  console.log(`✅ وُجد: "${top.title || top.name}" (TMDB ID: ${top.id})`);

  const detailEndpoint = searchType === 'tv' ? `/tv/${top.id}` : `/movie/${top.id}`;
  const [arDetail, enDetail, credits] = await Promise.all([
    httpGet(`${TMDB_BASE}${detailEndpoint}?${new URLSearchParams({ api_key: TMDB_KEY, language: 'ar' })}`, 15000).then(r => parseJson(r.body)),
    httpGet(`${TMDB_BASE}${detailEndpoint}?${new URLSearchParams({ api_key: TMDB_KEY, language: 'en-US' })}`, 15000).then(r => parseJson(r.body)),
    httpGet(`${TMDB_BASE}${detailEndpoint}/credits?${new URLSearchParams({ api_key: TMDB_KEY })}`, 15000).then(r => parseJson(r.body)),
  ]);

  const detail   = arDetail || enDetail || top;
  const fallback = enDetail || top;

  const title_ar  = arDetail?.title  || arDetail?.name  || '';
  const title_en  = enDetail?.title  || enDetail?.name  || '';
  const poster    = detail.poster_path   ? `${TMDB_IMG}${detail.poster_path}`    : '';
  const backdrop  = detail.backdrop_path ? `${TMDB_IMG_ORG}${detail.backdrop_path}` : '';
  const plot      = arDetail?.overview || enDetail?.overview || '';
  const year      = (detail.release_date || detail.first_air_date || '').substring(0, 4);
  const rating    = detail.vote_average ? String(Math.round(detail.vote_average * 10) / 10) : '';
  const genres    = (detail.genres || []).map(g => g.name).join('، ');
  const castList  = (credits?.cast || []).slice(0, 8).map(c => c.name).join('، ');
  const crew      = credits?.crew || [];
  const director  = (crew.find(c => c.job === 'Director') || crew.find(c => c.department === 'Directing'))?.name || '';
  const countries = detail.production_countries || detail.origin_country || [];
  const country   = Array.isArray(countries) ? countries.map(c => typeof c === 'string' ? c : c.name).join('، ') : '';
  const runtime   = detail.runtime ? `${detail.runtime} دقيقة` : (detail.episode_run_time?.[0] ? `${detail.episode_run_time[0]} دقيقة` : '');
  const imdbId    = detail.imdb_id || '';

  return { tmdbId: top.id, title_ar, title_en, poster, backdrop, plot, year, rating, genres, castList, director, country, runtime, imdbId };
}

// ─── Step 3: تحديث بيانات الملف في LuluStream ──────────────────────────────
async function updateLuluFile(tmdb, originalTitle) {
  const bestTitle = tmdb?.title_ar || tmdb?.title_en || originalTitle;
  const tags = [
    tmdb?.genres || '',
    tmdb?.year || '',
    tmdb?.rating ? `تقييم ${tmdb.rating}` : '',
    tmdb?.director ? `إخراج ${tmdb.director}` : '',
    tmdb?.country || '',
  ].filter(Boolean).join(' | ');

  // القصة كاملة
  const descr = [
    tmdb?.plot || '',
    tmdb?.castList ? `الممثلون: ${tmdb.castList}` : '',
    tmdb?.director ? `الإخراج: ${tmdb.director}` : '',
    tmdb?.runtime || '',
  ].filter(Boolean).join('\n\n');

  console.log(`\n✏️  تحديث بيانات الملف في LuluStream...`);
  console.log(`   العنوان: ${bestTitle}`);
  console.log(`   وصف: ${descr.slice(0, 100)}...`);
  console.log(`   تاغز: ${tags}`);

  const params = new URLSearchParams({
    key: LULU_KEY,
    file_code: fileCode,
    file_public: '1',
    file_title: bestTitle.slice(0, 200),
    file_descr: descr.slice(0, 1000),
    tags: tags.slice(0, 300),
  });

  const res  = await httpGet(`https://api.lulustream.com/api/file/edit?${params}`, 20000);
  const data = parseJson(res.body);

  if (data?.msg === 'OK' || data?.status === 200) {
    console.log('✅ تم تحديث بيانات الملف بنجاح!');
    return true;
  } else {
    console.error('❌ فشل تحديث الملف:', res.body?.slice(0, 300));
    return false;
  }
}

// ─── Step 4: البحث عن ترجمات وإضافتها ────────────────────────────────────
async function addSubtitles(title, year, imdbId, type) {
  console.log(`\n🔤 البحث عن ترجمات عربية (SubDL)...`);

  try {
    const p = new URLSearchParams({
      api_key: SUBDL_KEY,
      film_name: cleanTitle(title),
      languages: 'AR',
      type: type === 'series' ? 'tv' : 'movie',
    });
    if (year)   p.set('year', year);
    if (imdbId) p.set('imdb_id', imdbId);

    const res  = await httpGet(`https://api.subdl.com/api/v1/subtitles?${p}`, 25000);
    const data = parseJson(res.body);
    const subs = data?.subtitles || [];

    if (subs.length === 0) {
      console.log('⚠️  لم يتم العثور على ترجمات عربية');
      return;
    }

    const sub = subs[0];
    const subUrl = sub.url ? `https://dl.subdl.com${sub.url}` : '';
    if (!subUrl) { console.log('⚠️  رابط الترجمة غير متوفر'); return; }

    console.log(`   وُجدت ترجمة: ${sub.release_name || sub.name || ''}`);

    const sp = new URLSearchParams({
      key: LULU_KEY,
      file_code: fileCode,
      sub_url: subUrl,
      sub_lang: 'Arabic',
    });
    const subRes  = await httpGet(`https://api.lulustream.com/api/upload/sub?${sp}`, 30000);
    const subData = parseJson(subRes.body);

    if (subData?.status === 200 || subData?.msg === 'OK') {
      console.log('✅ تم إضافة الترجمة العربية بنجاح!');
    } else {
      console.log('⚠️  لم يتم إضافة الترجمة:', subRes.body?.slice(0, 200));
    }
  } catch (e) {
    console.log('⚠️  خطأ في الترجمات:', e.message);
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`🎬 إصلاح ملف LuluStream: ${fileCode}`);
  console.log(`${'═'.repeat(60)}`);

  // 1. جلب معلومات الملف الحالي
  const fileInfo = await getLuluFileInfo();
  if (!fileInfo) process.exit(1);

  // 2. تحديد اسم البحث
  const searchName = forceName || fileInfo.title;
  if (!searchName) {
    console.error('❌ الملف بدون عنوان ولم تُحدد اسماً. استخدم: node _fix_lulu_file.js 412564 "اسم الفيلم" movie');
    process.exit(1);
  }

  // 3. جلب بيانات TMDB
  const tmdb = await fetchTMDB(searchName, forceType);

  if (!tmdb) {
    // حتى بدون TMDB، نحدث العنوان على الأقل إذا كان forceName موجود
    if (forceName) {
      console.log('\n⚠️  لا توجد بيانات TMDB، سيتم تحديث العنوان فقط...');
      await updateLuluFile(null, forceName);
    }
    return;
  }

  console.log(`\n📊 بيانات TMDB:`);
  console.log(`   العنوان العربي: ${tmdb.title_ar}`);
  console.log(`   العنوان الإنجليزي: ${tmdb.title_en}`);
  console.log(`   السنة: ${tmdb.year}`);
  console.log(`   التقييم: ${tmdb.rating}/10`);
  console.log(`   الأنواع: ${tmdb.genres}`);
  console.log(`   المخرج: ${tmdb.director}`);
  console.log(`   IMDb: ${tmdb.imdbId || 'غير معروف'}`);
  console.log(`   البوستر: ${tmdb.poster ? '✅' : '❌'}`);
  console.log(`   القصة: ${tmdb.plot ? tmdb.plot.slice(0, 80) + '...' : '❌'}`);

  // 4. تحديث الملف في LuluStream
  await updateLuluFile(tmdb, searchName);

  // 5. إضافة ترجمات
  await addSubtitles(
    tmdb.title_en || searchName,
    tmdb.year,
    tmdb.imdbId,
    forceType,
  );

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`✅ اكتمل! الملف ${fileCode} تم تحديثه.`);
  console.log(`   يمكن مشاهدته: https://lulustream.com/e/${fileCode}`);
  console.log(`${'═'.repeat(60)}\n`);
}

main().catch(e => { console.error('❌ خطأ:', e.message); process.exit(1); });
