'use strict';

const axios    = require('axios');
const FormData = require('form-data');

const BASE = 'https://lulustream.com/api';
const KEY  = '268974pf854aqdw63ui5sw';

const http = axios.create({ timeout: 30000 });

/**
 * Generic GET helper — appends the API key automatically.
 */
async function get(endpoint, params = {}) {
  const res = await http.get(`${BASE}${endpoint}`, {
    params: { key: KEY, ...params },
  });
  if (res.data.status !== 200) {
    throw new Error(`LuluStream API error on ${endpoint}: ${res.data.msg || JSON.stringify(res.data)}`);
  }
  return res.data;
}

// ─── Account ──────────────────────────────────────────────────────────────────

function getAccountInfo() {
  return get('/account/info');
}

// ─── Folders ──────────────────────────────────────────────────────────────────

function listFolders(fldId = 0) {
  return get('/folder/list', { fld_id: fldId });
}

function createFolder(name, parentId = 0, descr = '') {
  return get('/folder/create', { name, parent_id: parentId, descr });
}

// ─── File Upload ──────────────────────────────────────────────────────────────

/**
 * Tell LuluStream to fetch a remote URL and store it (no local download).
 * Returns the future file_code immediately; actual encoding runs server-side.
 */
function uploadByUrl(url, fldId, filePublic = 1, tags = '') {
  return get('/upload/url', {
    url,
    fld_id:      fldId,
    file_public: filePublic,
    tags,
  });
}

// ─── File Edit ────────────────────────────────────────────────────────────────

function editFile({ fileCode, title, descr, fldId, tags }) {
  return get('/file/edit', {
    file_code:   fileCode,
    file_title:  title,
    file_descr:  descr ? descr.slice(0, 1000) : '',   // stay within length limits
    file_fld_id: fldId,
    tags:        tags || '',
  });
}

// ─── Subtitles ────────────────────────────────────────────────────────────────

function uploadSubtitleByUrl(fileCode, subLang, subUrl) {
  return get('/upload/sub', {
    file_code: fileCode,
    sub_lang:  subLang,
    sub_url:   subUrl,
  });
}

// ─── Status checks ────────────────────────────────────────────────────────────

function checkUrlUploads(fileCode) {
  const params = fileCode ? { file_code: fileCode } : {};
  return get('/file/url_uploads', params);
}

function getFileInfo(fileCode) {
  return get('/file/info', { file_code: fileCode });
}

// ─── Upload server ────────────────────────────────────────────────────────────

async function getUploadServer() {
  const data = await get('/upload/server');
  return data.result; // e.g. "https://s1.lulustream.com/upload/01"
}

// ─── Streaming pipe upload ────────────────────────────────────────────────────
/**
 * Pipes a remote video (sourceUrl) directly to LuluStream without saving to disk.
 * Bytes flow: source server → RAM/pipe → LuluStream.
 *
 * @param {string} sourceUrl  - URL to stream from
 * @param {string} filename   - e.g. "فيلم.mkv"
 * @param {object} opts       - { fldId, fileTitle, tags, filePublic }
 * @returns {{ filecode, filename, status }}
 */
async function streamUpload(sourceUrl, filename, opts = {}) {
  const FormData = require('form-data');

  // 1. Get LuluStream upload server
  const uploadServer = await getUploadServer();

  // 2. Open source stream (no disk write) — same UA as API calls
  const { UA } = require('./xtream-api');
  const srcResp = await axios.get(sourceUrl, {
    responseType: 'stream',
    timeout: 0,
    headers: { 'User-Agent': UA },
  });

  const contentLength = Number(srcResp.headers['content-length'] || 0);
  if (contentLength > 0)
    process.stdout.write(`   [${(contentLength/1e6).toFixed(0)} MB] `);

  // 3. Progress tracking
  let transferred = 0;
  srcResp.data.on('data', chunk => {
    transferred += chunk.length;
    if (contentLength > 0) {
      const pct = ((transferred / contentLength) * 100).toFixed(1);
      process.stdout.write(`\r   [${pct}%] ${(transferred/1e6).toFixed(1)}/${(contentLength/1e6).toFixed(0)} MB  `);
    }
  });

  // 4. Build multipart form — pipe stream directly, no temp file
  const form = new FormData();
  form.append('key',         KEY);
  form.append('file_public', String(opts.filePublic !== false ? 1 : 0));
  if (opts.fldId)     form.append('fld_id',     String(opts.fldId));
  if (opts.fileTitle) form.append('file_title', opts.fileTitle.slice(0, 250));
  if (opts.tags)      form.append('tags',       opts.tags);

  const streamOpts = {
    filename,
    contentType: srcResp.headers['content-type'] || 'video/mp4',
  };
  if (contentLength) streamOpts.knownLength = contentLength;
  form.append('file', srcResp.data, streamOpts);

  // 5. POST — piped stream, no disk I/O
  const uploadResp = await axios.post(uploadServer, form, {
    headers:          form.getHeaders(),
    timeout:          0,
    maxBodyLength:    Infinity,
    maxContentLength: Infinity,
  });

  process.stdout.write('\n');

  if (!uploadResp.data || uploadResp.data.status !== 200) {
    throw new Error(`رفع فاشل: ${uploadResp.data?.msg || JSON.stringify(uploadResp.data)}`);
  }

  const file = (uploadResp.data.files || [])[0];
  if (!file || file.status !== 'OK') {
    throw new Error(`رد خاطئ من الرفع: ${JSON.stringify(uploadResp.data)}`);
  }

  return file; // { filecode, filename, status }
}

module.exports = {
  getAccountInfo,
  listFolders,
  createFolder,
  uploadByUrl,
  editFile,
  uploadSubtitleByUrl,
  checkUrlUploads,
  getFileInfo,
  getUploadServer,
  streamUpload,
};
