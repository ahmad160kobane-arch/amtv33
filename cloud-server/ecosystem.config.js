/**
 * PM2 Configuration — Cloud Streaming Server (High-Perf)
 *
 * Tuned for 100+ concurrent users (live + VOD streaming)
 *
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 restart cloud-server
 *   pm2 logs cloud-server
 *   pm2 monit
 *
 * Important:
 *   - Single instance (fork mode) because xtream-proxy uses in-memory
 *     shared state (manifest/segment caches, request coalescing).
 *     Clustering would duplicate caches and waste IPTV connections.
 *   - UV_THREADPOOL_SIZE=16 gives Node.js more async I/O threads
 *     (default is 4, too low for 100+ concurrent file/network ops).
 *   - max-old-space-size=2048 allows up to 2GB heap for segment caches.
 */
module.exports = {
  apps: [{
    name: 'cloud-server',
    script: 'server.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '2G',
    // Node.js flags for high concurrency
    node_args: '--max-old-space-size=2048',
    env: {
      NODE_ENV: 'production',
      PORT: 8090,
      // More async I/O threads (default 4 is too low for 100+ streams)
      UV_THREADPOOL_SIZE: 16,
    },
    // Graceful restart with exponential backoff
    exp_backoff_restart_delay: 200,
    kill_timeout: 10000,
    listen_timeout: 10000,
    // Log files
    error_file: './logs/error.log',
    out_file: './logs/output.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
  }],
};
