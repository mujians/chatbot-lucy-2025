import express from 'express';
import {
  getSettings,
  getSetting,
  updateSetting,
  upsertSetting,
  deleteSetting,
  bulkUpdateSettings,
  getPublicSettings,
  testEmailConnection,
  testWhatsAppConnection,
} from '../controllers/settings.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// Public endpoint (no auth) - must be BEFORE /:key to avoid matching "public" as a key
router.get('/public', getPublicSettings);

// Test connection endpoints (require auth)
router.post('/test-email', authenticateToken, testEmailConnection);
router.post('/test-whatsapp', authenticateToken, testWhatsAppConnection);

// P2.3: Bulk update endpoint - must be BEFORE /:key to avoid matching "bulk" as a key
router.post('/bulk', authenticateToken, bulkUpdateSettings);

// All settings routes require authentication (ADMIN only ideally)
// For now, all authenticated operators can view, only updates should be restricted
router.get('/', authenticateToken, getSettings);
router.get('/:key', authenticateToken, getSetting);
router.post('/', authenticateToken, upsertSetting);
router.put('/:key', authenticateToken, updateSetting);
router.delete('/:key', authenticateToken, deleteSetting);

export default router;
