import { doubleCsrf } from 'csrf-csrf';
import { config } from '../config/index.js';

// CSRF Protection Configuration (v2.2 - Security Enhancement)
// Separated into middleware file to avoid circular dependency with server.js
const { generateToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => config.jwtSecret, // Use existing JWT secret
  cookieName: '__Host-csrf-token',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.nodeEnv === 'production',
    path: '/',
  },
  size: 64,
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
});

export { generateToken, doubleCsrfProtection };
