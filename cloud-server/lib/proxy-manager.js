'use strict';

const { spawn } = require('child_process');
const http  = require('http');
const https = require('https');

// Active proxy processes: accountId -> ChildProcess
const _processes = new Map();

/**
 * Build proxy command based on type
 */
function buildProxyCommand(type, server, port, secret, localPort) {
  switch (type) {
    case 'shadowsocks': {
      // ss-local from shadowsocks-libev — creates local SOCKS5 proxy
      // Requires: apt-get install shadowsocks-libev
      const method = 'aes-256-cfb'; // default, may need adjustment
      return {
        cmd: 'ss-local',
        args: ['-s', server, '-p', String(port), '-l', String(localPort), '-k', secret, '-m', method, '-u'],
      };
    }
    case 'mtproto': {
      // MTProto proxy — requires external binary like mtg or python script
      // Fallback: try python3 mtproto_proxy.py if available
      return {
        cmd: 'python3',
        args: ['-c', `import socket,struct,ssl,select,sys,os
# Minimal MTProto-to-SOCKS5 bridge — requires pycryptodome
# If this fails, install mtg: https://github.com/9seconds/mtg
print('MTProto proxy not natively supported. Please install mtg or python-mtprotoproxy.')`, server, String(port), secret, String(localPort)],
      };
    }
    case 'socks5':
    case 'http':
      // Direct proxy — no subprocess needed, just use the proxy URL directly
      return null;
    default:
      return null;
  }
}

/**
 * Start proxy subprocess for an account
 */
function startProxy(account) {
  const {
    id, proxy_type, proxy_server, proxy_port, proxy_secret, proxy_local_port,
  } = account;

  if (!proxy_type || proxy_type === 'none' || !proxy_server || !proxy_port) {
    return { success: false, error: 'Proxy not configured' };
  }

  // Direct proxies don't need a subprocess
  if (proxy_type === 'socks5' || proxy_type === 'http') {
    return { success: true, type: 'direct', url: buildProxyUrl(account) };
  }

  // Kill existing process for this account
  killProxy(id);

  const localPort = proxy_local_port || (10000 + Number(id));
  const spec = buildProxyCommand(proxy_type, proxy_server, proxy_port, proxy_secret, localPort);
  if (!spec) {
    return { success: false, error: `Unsupported proxy type: ${proxy_type}` };
  }

  console.log(`[ProxyManager] Starting ${proxy_type} proxy for account #${id} on port ${localPort} → ${proxy_server}:${proxy_port}`);

  const proc = spawn(spec.cmd, spec.args, {
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  proc.stdout.on('data', (d) => console.log(`[Proxy #${id}] ${d.toString().trim()}`));
  proc.stderr.on('data', (d) => console.error(`[Proxy #${id} err] ${d.toString().trim()}`));
  proc.on('exit', (code) => {
    console.log(`[ProxyManager] Account #${id} proxy exited with code ${code}`);
    _processes.delete(id);
  });
  proc.on('error', (err) => {
    console.error(`[ProxyManager] Account #${id} proxy error: ${err.message}`);
    _processes.delete(id);
  });

  _processes.set(id, { proc, localPort, type: proxy_type });

  return { success: true, pid: proc.pid, localPort, type: proxy_type };
}

/**
 * Stop proxy subprocess for an account
 */
function killProxy(accountId) {
  const entry = _processes.get(accountId);
  if (!entry) return false;
  try {
    entry.proc.kill('SIGTERM');
    setTimeout(() => {
      if (!entry.proc.killed) entry.proc.kill('SIGKILL');
    }, 3000);
  } catch (e) {
    console.error(`[ProxyManager] Failed to kill proxy #${accountId}: ${e.message}`);
  }
  _processes.delete(accountId);
  return true;
}

/**
 * Get proxy status for an account
 */
function getProxyStatus(accountId) {
  const entry = _processes.get(accountId);
  if (!entry) return { running: false };
  return { running: true, pid: entry.proc.pid, localPort: entry.localPort, type: entry.type };
}

/**
 * Build proxy URL string for http/https agents
 */
function buildProxyUrl(account) {
  const {
    proxy_type, proxy_server, proxy_port, proxy_secret,
    proxy_local_port, id,
  } = account;

  if (!proxy_type || proxy_type === 'none') return null;

  // Direct HTTP/SOCKS5 proxy (no local subprocess)
  if (proxy_type === 'http') {
    const auth = proxy_secret ? `${proxy_secret}@` : '';
    return `http://${auth}${proxy_server}:${proxy_port}`;
  }
  if (proxy_type === 'socks5') {
    // SOCKS5 URLs: socks5://host:port (auth rarely used for IPTV proxies)
    return `socks5://${proxy_server}:${proxy_port}`;
  }

  // Subprocess-based proxies expose a local SOCKS5 port
  const localPort = proxy_local_port || (10000 + Number(id));
  return `socks5://127.0.0.1:${localPort}`;
}

/**
 * Auto-start all proxies marked with proxy_auto_start=true
 */
async function autoStartProxies(db) {
  try {
    const rows = await db.prepare("SELECT * FROM iptv_accounts WHERE proxy_enabled = true AND proxy_auto_start = true").all();
    console.log(`[ProxyManager] Auto-starting ${rows.length} proxy(s)...`);
    for (const acc of rows) {
      const result = startProxy(acc);
      if (result.success) {
        console.log(`[ProxyManager] ✓ Proxy started for account #${acc.id} (${acc.name || 'no name'})`);
      } else {
        console.error(`[ProxyManager] ✗ Failed to start proxy for account #${acc.id}: ${result.error}`);
      }
    }
  } catch (e) {
    console.error(`[ProxyManager] Auto-start error: ${e.message}`);
  }
}

/**
 * Create a ProxyAgent for node-fetch / http.request
 */
function createProxyAgent(account) {
  if (!account || !account.proxy_enabled || !account.proxy_type || account.proxy_type === 'none') return null;
  const url = buildProxyUrl(account);
  if (!url) return null;
  try {
    const ProxyAgent = require('proxy-agent');
    return new ProxyAgent(url);
  } catch (e) {
    console.error(`[ProxyManager] Failed to create ProxyAgent for ${url}: ${e.message}`);
    return null;
  }
}

/**
 * Create an http/https request function that routes through proxy if configured
 * Uses built-in http/https modules (no external agent packages needed for HTTP proxy)
 */
function proxyRequest(url, options, proxyUrl, callback) {
  if (!proxyUrl) {
    // No proxy — direct request
    const isHttps = url.startsWith('https');
    const mod = isHttps ? https : http;
    return mod.request(url, options, callback);
  }

  // Parse proxy URL
  const proxy = new URL(proxyUrl);
  const isHttpsTarget = url.startsWith('https');
  const target = new URL(url);

  if (proxy.protocol === 'http:' && !isHttpsTarget) {
    // HTTP target through HTTP proxy
    const req = http.request({
      host: proxy.hostname,
      port: proxy.port || 80,
      method: options.method || 'GET',
      path: url,
      headers: options.headers || {},
      timeout: options.timeout || 30000,
    }, callback);
    if (options.timeout) req.setTimeout(options.timeout);
    req.on('error', (err) => callback && callback(err));
    return req;
  }

  // For HTTPS targets through HTTP proxy, or SOCKS5 — use CONNECT tunneling
  // Simplified: fallback to direct request with a warning
  console.warn(`[ProxyManager] Proxy type ${proxy.protocol} for ${url} — using direct request (full proxy tunneling not implemented)`);
  const isHttps = url.startsWith('https');
  const mod = isHttps ? https : http;
  return mod.request(url, options, callback);
}

module.exports = {
  startProxy,
  killProxy,
  getProxyStatus,
  buildProxyUrl,
  createProxyAgent,
  autoStartProxies,
  proxyRequest,
  _processes,
};
