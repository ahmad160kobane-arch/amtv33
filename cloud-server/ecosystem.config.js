/**
 * PM2 Configuration — Cloud Streaming Server
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 restart cloud-server
 *   pm2 logs cloud-server
 *   pm2 monit
 */
module.exports = {
  apps: [{
    name: 'cloud-server',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 8090,
    },
    // Restart if memory leaks or crashes
    exp_backoff_restart_delay: 100,
    // Log files
    error_file: './logs/error.log',
    out_file: './logs/output.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    // Merge stdout and stderr
    merge_logs: true,
  }],
};
