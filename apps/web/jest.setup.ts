import '@testing-library/jest-dom'

// Polyfill Web APIs for Node.js environment in tests
// Node 18+ has these on globalThis, but Jest context might not see them
if (typeof Request === 'undefined') {
  Object.assign(global, {
    Request: globalThis.Request,
    Response: globalThis.Response,
    Headers: globalThis.Headers,
    fetch: globalThis.fetch,
  });
}

if (typeof TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  Object.assign(global, { TextEncoder, TextDecoder });
}

