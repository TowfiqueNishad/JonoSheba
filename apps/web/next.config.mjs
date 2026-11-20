import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  outputFileTracingRoot: path.join(path.dirname(fileURLToPath(import.meta.url)), '../../'),
  outputFileTracingIncludes: {
    '/api/**/*': ['../../data/**/*', '../api/dist/**/*', '../api/prisma/**/*'],
  },
  transpilePackages: ['@jonoshheba/shared', '@jonoshheba/config', '@jonoshheba/ui', '@jonoshheba/sdk'],
  webpack: (config, { isServer }) => {
    if (isServer) {
      const prevExternals = Array.isArray(config.externals)
        ? config.externals
        : config.externals
          ? [config.externals]
          : [];
      config.externals = [
        ...prevExternals,
        '@jonoshheba/api',
        '@nestjs/core',
        '@nestjs/common',
        '@nestjs/platform-express',
        '@nestjs/swagger',
        'swagger-ui-dist',
        'reflect-metadata',
        'hash-wasm',
      ];
    }
    return config;
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'geolocation=(self), camera=(), microphone=(self)',
          },
        ],
      },
    ];
  },
  async rewrites() {
    const apiTarget = process.env.INTERNAL_API_URL;
    if (!apiTarget && process.env.VERCEL) {
      return [];
    }
    const target = apiTarget || 'http://127.0.0.1:4000';
    return [
      {
        source: '/api/:path*',
        destination: `${target}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
