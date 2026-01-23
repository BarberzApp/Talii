// This file configures the initialization of Sentry for edge features (middleware, edge routes, etc).
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import packageJson from "./package.json";

const release = `web@${packageJson.version}`;
const environment = process.env.NODE_ENV || 'development';

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Only send errors in production
  enabled: process.env.NODE_ENV === 'production' && !!(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN),

  environment,
  release,

  // Filter out sensitive data
  beforeSend(event, hint) {
    // Remove sensitive data from request
    if (event.request) {
      if (event.request.cookies) {
        delete event.request.cookies;
      }
      
      if (event.request.headers) {
        const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
        sensitiveHeaders.forEach(header => {
          if (event.request?.headers?.[header]) {
            delete event.request.headers[header];
          }
        });
      }
    }

    return event;
  },
});

Sentry.setTag('platform', 'web');
Sentry.setTag('release', release);
Sentry.setTag('environment', environment);
