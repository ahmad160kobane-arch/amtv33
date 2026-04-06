/** @type {import('next').NextConfig} */
const BACKEND_URL  = process.env.BACKEND_URL  || 'http://localhost:3000';
const CLOUD_URL    = process.env.CLOUD_URL    || 'http://localhost:8090';

const SECURITY_HEADERS = [
  // Prevent this app from being embedded in other sites
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  // Block MIME sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Stop referrer leakage to ad sites
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Disable potentially abused browser features used by ad networks
  {
    key: 'Permissions-Policy',
    value: [
      'camera=()',
      'microphone=()',
      'payment=()',
      'usb=()',
      'autoplay=*',
      'fullscreen=*',
    ].join(', '),
  },
];

const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'image.tmdb.org' },
      { protocol: 'https', hostname: 'img.youtube.com' },
      { protocol: 'http',  hostname: '**' },
      { protocol: 'https', hostname: '**' },
    ],
  },
  // Increase proxy timeout for streaming (default 30s is too short for VOD)
  experimental: {
    proxyTimeout: 120000,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: SECURITY_HEADERS,
      },
      // Streaming-specific headers — no buffering, CORS, long cache for segments
      {
        source: '/proxy/live/:path*',
        headers: [
          { key: 'X-Accel-Buffering', value: 'no' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
      {
        source: '/free-hls/:path*',
        headers: [
          { key: 'X-Accel-Buffering', value: 'no' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
      {
        source: '/vod-play/:path*',
        headers: [
          { key: 'X-Accel-Buffering', value: 'no' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Expose-Headers', value: 'Content-Range, Content-Length, Accept-Ranges' },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      // Cloud server endpoints (port 8090)
      { source: '/api/vidsrc/:path*',   destination: `${CLOUD_URL}/api/vidsrc/:path*`   },
      { source: '/api/stream/:path*',   destination: `${CLOUD_URL}/api/stream/:path*`   },
      { source: '/api/xtream/:path*',   destination: `${CLOUD_URL}/api/xtream/:path*`   },
      { source: '/proxy/live/:path*',   destination: `${CLOUD_URL}/proxy/live/:path*`   },
      { source: '/free-hls/:path*',     destination: `${CLOUD_URL}/free-hls/:path*`     },
      { source: '/xtream-play/:path*',  destination: `${CLOUD_URL}/xtream-play/:path*`  },
      { source: '/xtream-pipe/:path*',  destination: `${CLOUD_URL}/xtream-pipe/:path*`  },
      { source: '/vod-play/:path*',     destination: `${CLOUD_URL}/vod-play/:path*`     },
      // Backend API (port 3000) — everything else
      { source: '/api/:path*',          destination: `${BACKEND_URL}/api/:path*`         },
    ];
  },
};

module.exports = nextConfig;
