import crypto from 'crypto';
import { config } from '../config/index.js';

/**
 * Encryption utilities for sensitive settings (API keys, passwords, tokens)
 * Uses AES-256-GCM for authenticated encryption
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // For GCM mode
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32; // 256 bits

// Derive encryption key from JWT secret
// In production, use a dedicated ENCRYPTION_KEY environment variable
function getEncryptionKey() {
  const secret = config.jwtSecret || 'default-secret-change-in-production';
  // Use PBKDF2 to derive a proper encryption key
  return crypto.pbkdf2Sync(secret, 'lucine-encryption-salt', 100000, KEY_LENGTH, 'sha256');
}

/**
 * Encrypt sensitive value
 * @param {string} plainText - Value to encrypt
 * @returns {string} - Encrypted value in format: iv:authTag:encrypted
 */
export function encrypt(plainText) {
  if (!plainText || typeof plainText !== 'string') {
    return plainText; // Return as-is if empty or not string
  }

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Return format: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('❌ Encryption error:', error);
    throw new Error('Failed to encrypt value');
  }
}

/**
 * Decrypt sensitive value
 * @param {string} encryptedText - Encrypted value in format: iv:authTag:encrypted
 * @returns {string} - Decrypted plain text
 */
export function decrypt(encryptedText) {
  if (!encryptedText || typeof encryptedText !== 'string') {
    return encryptedText; // Return as-is if empty or not string
  }

  // Check if value is encrypted (has our format)
  if (!encryptedText.includes(':')) {
    // Not encrypted, return as-is (backward compatibility)
    return encryptedText;
  }

  try {
    const key = getEncryptionKey();
    const parts = encryptedText.split(':');

    if (parts.length !== 3) {
      // Invalid format, return as-is
      return encryptedText;
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('❌ Decryption error:', error);
    // Return as-is if decryption fails (might be old unencrypted value)
    return encryptedText;
  }
}

/**
 * Check if a setting key should be encrypted
 * @param {string} key - Setting key name
 * @returns {boolean}
 */
export function shouldEncrypt(key) {
  const sensitiveKeys = [
    'openaiApiKey',
    'twilioAuthToken',
    'twilioAccountSid',
    'smtpPassword',
    'smtpUser',
    'cloudinaryApiSecret',
    'cloudinaryApiKey',
    'jwtSecret',
  ];

  return sensitiveKeys.some(sensitiveKey =>
    key.toLowerCase().includes(sensitiveKey.toLowerCase()) ||
    key.toLowerCase().includes('password') ||
    key.toLowerCase().includes('secret') ||
    key.toLowerCase().includes('token') ||
    key.toLowerCase().includes('apikey') ||
    key.toLowerCase().includes('api_key')
  );
}

/**
 * Encrypt settings object (only sensitive keys)
 * @param {Object} settings - Settings object
 * @returns {Object} - Settings with encrypted values
 */
export function encryptSettings(settings) {
  if (!settings || typeof settings !== 'object') {
    return settings;
  }

  const encrypted = { ...settings };

  for (const [key, value] of Object.entries(encrypted)) {
    if (shouldEncrypt(key) && value && typeof value === 'string') {
      encrypted[key] = encrypt(value);
    }
  }

  return encrypted;
}

/**
 * Decrypt settings object (only encrypted keys)
 * @param {Object} settings - Settings object with encrypted values
 * @returns {Object} - Settings with decrypted values
 */
export function decryptSettings(settings) {
  if (!settings || typeof settings !== 'object') {
    return settings;
  }

  const decrypted = { ...settings };

  for (const [key, value] of Object.entries(decrypted)) {
    if (shouldEncrypt(key) && value && typeof value === 'string') {
      decrypted[key] = decrypt(value);
    }
  }

  return decrypted;
}
