'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// Global IPTV Connection Manager
// ينسّق جميع اتصالات IPTV في العملية الواحدة
// حساب IPTV يسمح باتصال واحد فقط (max_connections=1)
// أي نظام يريد الاتصال بـ IPTV يجب أن يمر من هنا
// ═══════════════════════════════════════════════════════════════════════════

// ─── Semaphore: تحديد عدد الاتصالات المتزامنة ──────────────────────────
class IptvSemaphore {
  constructor(max) {
    this._max = max;
    this._active = 0;
    this._queue = [];
    this._stats = { acquired: 0, released: 0, waits: 0, maxWaitMs: 0 };
  }

  async acquire(label = '') {
    const startWait = Date.now();
    if (this._active < this._max) {
      this._active++;
      this._stats.acquired++;
      return;
    }
    // يجب الانتظار
    this._stats.waits++;
    return new Promise(resolve => {
      this._queue.push({ resolve, label, startWait });
    });
  }

  release() {
    this._active = Math.max(0, this._active - 1);
    this._stats.released++;
    if (this._queue.length > 0 && this._active < this._max) {
      this._active++;
      this._stats.acquired++;
      const next = this._queue.shift();
      const waitMs = Date.now() - next.startWait;
      if (waitMs > this._stats.maxWaitMs) this._stats.maxWaitMs = waitMs;
      next.resolve();
    }
  }

  get active() { return this._active; }
  get pending() { return this._queue.length; }

  getStats() {
    return {
      active: this._active,
      pending: this._queue.length,
      max: this._max,
      ...this._stats,
      waitingLabels: this._queue.map(q => q.label).filter(Boolean),
    };
  }
}

// ─── نوعان من السيمافور ──────────────────────────────────────────────────
// 1. streaming: اتصالات البث (movie/series/live) — max=1 لأن الحساب يسمح باتصال واحد
// 2. api: طلبات API (player_api.php) — سريعة، max=2
const streamingSem = new IptvSemaphore(1);
const apiSem = new IptvSemaphore(2);

// ─── Helper: تنفيذ دالة مع سيمافور ──────────────────────────────────────
async function withStreamingSemaphore(label, fn) {
  await streamingSem.acquire(label);
  try {
    return await fn();
  } finally {
    streamingSem.release();
  }
}

async function withApiSemaphore(label, fn) {
  await apiSem.acquire(label);
  try {
    return await fn();
  } finally {
    apiSem.release();
  }
}

// ─── Status endpoint data ──────────────────────────────────────────────────
function getStatus() {
  return {
    streaming: streamingSem.getStats(),
    api: apiSem.getStats(),
  };
}

module.exports = {
  streamingSem,
  apiSem,
  withStreamingSemaphore,
  withApiSemaphore,
  getStatus,
};
