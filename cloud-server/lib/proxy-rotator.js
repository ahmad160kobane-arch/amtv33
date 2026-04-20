/**
 * Proxy Rotator - تدوير البروكسي لتجنب حظر IPTV
 * 
 * يستخدم قائمة من البروكسيات المجانية ويدورها تلقائياً
 * عند فشل البروكسي الحالي، ينتقل للتالي
 */

const { HttpsProxyAgent } = require('https-proxy-agent');
const { HttpProxyAgent } = require('http-proxy-agent');

class ProxyRotator {
  constructor() {
    // قائمة البروكسيات المجانية (يمكن تحديثها)
    this.proxyList = [
      // يمكن إضافة بروكسيات هنا إذا كانت متوفرة
      // 'http://proxy1.com:8080',
      // 'http://proxy2.com:8080',
    ];
    
    this.currentIndex = 0;
    this.failedProxies = new Set();
    this.lastRotation = Date.now();
    this.rotationInterval = 5 * 60 * 1000; // تدوير كل 5 دقائق
    this.enabled = false; // معطل افتراضياً (لا توجد بروكسيات)
  }

  /**
   * تفعيل/تعطيل البروكسي
   */
  setEnabled(enabled) {
    this.enabled = enabled && this.proxyList.length > 0;
    if (this.enabled) {
      console.log(`[ProxyRotator] ✓ Enabled with ${this.proxyList.length} proxies`);
    } else {
      console.log(`[ProxyRotator] ✗ Disabled (no proxies available)`);
    }
  }

  /**
   * إضافة بروكسيات جديدة
   */
  addProxies(proxies) {
    this.proxyList.push(...proxies);
    this.enabled = this.proxyList.length > 0;
    console.log(`[ProxyRotator] Added ${proxies.length} proxies, total: ${this.proxyList.length}`);
  }

  /**
   * الحصول على البروكسي الحالي
   */
  getCurrentProxy() {
    if (!this.enabled || this.proxyList.length === 0) return null;
    
    // تدوير تلقائي كل 5 دقائق
    if (Date.now() - this.lastRotation > this.rotationInterval) {
      this.rotate();
    }
    
    return this.proxyList[this.currentIndex];
  }

  /**
   * الحصول على HTTP Agent مع البروكسي
   */
  getAgent(url) {
    const proxy = this.getCurrentProxy();
    if (!proxy) return null;
    
    const isHttps = url.startsWith('https://');
    return isHttps 
      ? new HttpsProxyAgent(proxy)
      : new HttpProxyAgent(proxy);
  }

  /**
   * تدوير البروكسي للتالي
   */
  rotate() {
    if (!this.enabled || this.proxyList.length === 0) return;
    
    const oldProxy = this.proxyList[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.proxyList.length;
    this.lastRotation = Date.now();
    
    const newProxy = this.proxyList[this.currentIndex];
    console.log(`[ProxyRotator] Rotated: ${oldProxy} → ${newProxy}`);
  }

  /**
   * تسجيل فشل البروكسي الحالي
   */
  markFailed() {
    if (!this.enabled || this.proxyList.length === 0) return;
    
    const failed = this.proxyList[this.currentIndex];
    this.failedProxies.add(failed);
    console.warn(`[ProxyRotator] ⚠️ Proxy failed: ${failed}`);
    
    // إذا فشلت كل البروكسيات، أعد تعيين القائمة
    if (this.failedProxies.size >= this.proxyList.length) {
      console.warn(`[ProxyRotator] All proxies failed, resetting...`);
      this.failedProxies.clear();
    }
    
    // انتقل للبروكسي التالي
    this.rotate();
  }

  /**
   * الحصول على إحصائيات
   */
  getStats() {
    return {
      enabled: this.enabled,
      total: this.proxyList.length,
      current: this.enabled ? this.proxyList[this.currentIndex] : null,
      failed: this.failedProxies.size,
      lastRotation: this.lastRotation,
    };
  }
}

module.exports = new ProxyRotator();
