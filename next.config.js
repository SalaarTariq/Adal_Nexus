/** @type {import('next').NextConfig} */
// Adal Nexus – Pakistan Legal Community Platform
// In local dev, /api/* requests are proxied to the FastAPI server on a dedicated port.
// On Vercel, /api/*.py files are deployed as serverless functions and the
// rewrite is a no-op (Vercel's own routing takes precedence via vercel.json).
const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8002';

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/api/:path*',
          destination: `${backendUrl}/api/:path*`,
        },
      ];
    }
    return [];
  },
};

module.exports = nextConfig;
