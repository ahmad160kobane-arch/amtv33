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
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: SECURITY_HEADERS,
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
      { source: '/vod-play/:path*',     destination: `${CLOUD_URL}/vod-play/:path*`     },
      // Backend API (port 3000) — everything else
      { source: '/api/:path*',          destination: `${BACKEND_URL}/api/:path*`         },
    ];
  },
};

module.exports = nextConfig;
