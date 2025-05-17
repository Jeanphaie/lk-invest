/** @type {import('next').NextConfig} */
const withTM = require('next-transpile-modules')(['shared']);

const nextConfig = {
  reactStrictMode: true,
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: '163.172.32.45',
        port: '3001',
        pathname: '/uploads/**',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://163.172.32.45:3001/api/:path*',
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
        ],
      },
    ];
  },
};

module.exports = withTM(nextConfig); 