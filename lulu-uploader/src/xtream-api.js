'use strict';

const axios = require('axios');

const BASE_URL = 'http://proxpanel.cc';
const USERNAME = '3839182501';
const PASSWORD = '6005823577';

// Conservative timeout — IPTV panels can be slow
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const http = axios.create({
  timeout: 20000,
  headers: { 'User-Agent': UA },
});

module.exports.UA = UA;

// ─── Rate limit: never hammer the panel ──────────────────────────────────────

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// Random jitter helper — looks more human
function jitter(base, spread = 0.4) {
  return base + Math.floor((Math.random() - 0.5) * 2 * spread * base);
}

async function apiGet(params) {
  const res = await http.get(`${BASE_URL}/player_api.php`, {
    params: { username: USERNAME, password: PASSWORD, ...params },
  });
  await sleep(jitter(1800)); // ~1.8s ± 40% jitter
  return res.data;
}

// ─── Build stream URL (no token needed — credentials in path) ─────────────────

function vodStreamUrl(streamId, container = 'ts') {
  return `${BASE_URL}/movie/${USERNAME}/${PASSWORD}/${streamId}.${container}`;
}

function seriesStreamUrl(streamId, container = 'mkv') {
  return `${BASE_URL}/series/${USERNAME}/${PASSWORD}/${streamId}.${container}`;
}

// ─── Account info ─────────────────────────────────────────────────────────────

async function getAccountInfo() {
  const data = await apiGet({});
  return data.user_info || data;
}

// ─── VOD ─────────────────────────────────────────────────────────────────────

async function getVodCategories() {
  return apiGet({ action: 'get_vod_categories' });
}

async function getVodStreamsByCategory(categoryId) {
  return apiGet({ action: 'get_vod_streams', category_id: categoryId });
}

// ─── Series ───────────────────────────────────────────────────────────────────

async function getSeriesCategories() {
  return apiGet({ action: 'get_series_categories' });
}

async function getSeriesByCategory(categoryId) {
  return apiGet({ action: 'get_series', category_id: categoryId });
}

async function getSeriesInfo(seriesId) {
  await sleep(jitter(2500)); // extra pause for series_info as it is large
  return apiGet({ action: 'get_series_info', series_id: seriesId });
}

// ─── Arabic filter ────────────────────────────────────────────────────────────
// Matches category names that contain Arabic script, "arab", "مترجم", etc.

const ARABIC_REGEX = /[\u0600-\u06FF]|arabic|arab|مترجم/i;

function isArabicCategory(name = '') {
  return ARABIC_REGEX.test(name);
}

// ─── Kids filter ──────────────────────────────────────────────────────────────
// Matches category names for kids content

const KIDS_REGEX = /kids|أطفال|طفل|كرتون|cartoon|children|اطفال/i;

function isKidsCategory(name = '') {
  return KIDS_REGEX.test(name);
}

module.exports = {
  BASE_URL,
  USERNAME,
  PASSWORD,
  vodStreamUrl,
  seriesStreamUrl,
  getAccountInfo,
  getVodCategories,
  getVodStreamsByCategory,
  getSeriesCategories,
  getSeriesByCategory,
  getSeriesInfo,
  isArabicCategory,
  isKidsCategory,
  sleep,
};
