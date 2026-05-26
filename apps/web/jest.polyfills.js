// jest.polyfills.js
/**
 * Polyfill Web APIs for Node.js environment in Jest.
 * This file should be loaded via setupFiles in jest.config.js
 */

// Set mock environment variables needed for top-level module evaluation
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'mock-stripe-secret';
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'mock-anon-key';

if (typeof Request === 'undefined') {
  // In Node 18+, these are available on globalThis
  const g = globalThis;
  if (g.Request) {
    global.Request = g.Request;
    global.Response = g.Response;
    global.Headers = g.Headers;
    global.fetch = g.fetch;
  } else {
    // Fallback for older node or environments where globalThis is restricted
    try {
      const fetch = require('node-fetch');
      global.Request = fetch.Request;
      global.Response = fetch.Response;
      global.Headers = fetch.Headers;
      global.fetch = fetch;
    } catch (e) {
      // If node-fetch is not available, we might be in trouble for API tests
    }
  }
}

if (typeof TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  Object.assign(global, { TextEncoder, TextDecoder });
}
