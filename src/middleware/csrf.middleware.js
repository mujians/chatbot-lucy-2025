import { doubleCsrf } from 'csrf-csrf';
import { config } from '../config/index.js';

// CSRF Protection Configuration (v2.2 - Security Enhancement)
// Separated into middleware file to avoid circular dependency with server.js
//
// v2.3.1 Fix: Changed sameSite from 'strict' to 'none' for cross-origin support
// This allows frontend (Vercel) and backend (Render) on different domains
const { generateToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => config.jwtSecret, // Use existing JWT secret
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

export { generateToken, doubleCsrfProtection };
