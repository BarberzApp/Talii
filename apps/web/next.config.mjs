import { withSentryConfig } from '@sentry/nextjs'
import dotenv from 'dotenv'

// After moving to apps/web, `next dev` runs with cwd=apps/web.
// Load env from repo root (../../.env) so existing local setups keep working.
dotenv.config({ path: new URL('../../.env', import.meta.url) })

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Optional separate build folder (e.g. NEXT_DIST_DIR=.next-local) so two dev
  // servers can run from this directory at once. Defaults to .next.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  images: {
    domains: [
      'localhost',
      'res.cloudinary.com',
      'lh3.googleusercontent.com',
      'avatars.githubusercontent.com',
      'images.unsplash.com'
    ],
  },
  // `next build` fails on type or lint errors.
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }
    return config;
  },
};


// Sentry configuration
const sentryWebpackPluginOptions = {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  // Suppresses source map uploading logs during build
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  
  // Only upload source maps in production
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableClientWebpackPlugin: process.env.NODE_ENV !== 'production',
  disableServerWebpackPlugin: process.env.NODE_ENV !== 'production',
};

// Apply Sentry config, then PWA config
const configWithSentry = withSentryConfig(
  nextConfig,
  sentryWebpackPluginOptions
);
export default configWithSentry;