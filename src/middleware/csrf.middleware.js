import { doubleCsrf } from 'csrf-csrf';
import { config } from '../config/index.js';

// CSRF Protection Configuration (v2.2 - Security Enhancement)
// Separated into middleware file to avoid circular dependency with server.js
//
// v2.3.1 Fix: Changed sameSite from 'strict' to 'none' for cross-origin support
// This allows frontend (Vercel) and backend (Render) on different domains
//
// v2.3.2 Fix: Use direct secret value instead of getSecret function
// The library was throwing "invalid csrf token" during initialization
const csrfSecret = config.jwtSecret || 'fallback-csrf-secret-change-in-production-min-32-chars';

console.log('🔒 Initializing CSRF protection...');
console.log('Environment:', config.nodeEnv);
console.log('CSRF Secret length:', csrfSecret.length);

const { generateToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => csrfSecret, // Use secret as string, not function result
  cookieName: 'csrf-token', // Changed from __Host- prefix (requires same-origin)
  cookieOptions: {
    httpOnly: true,
    sameSite: config.nodeEnv === 'production' ? 'none' : 'lax', // 'none' for cross-origin in production
    secure: config.nodeEnv === 'production', // Required for sameSite: 'none'
    path: '/',
  },
  size: 64,
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
});

console.log('✅ CSRF protection initialized successfully');

export { generateToken, doubleCsrfProtection };
