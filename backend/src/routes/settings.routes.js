import express from 'express';
import {
  getSettings,
  getSetting,
  updateSetting,
  upsertSetting,
  deleteSetting,
} from '../controllers/settings.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// All settings routes require authentication (ADMIN only ideally)
// For now, all authenticated operators can view, only updates should be restricted
router.get('/', authenticateToken, getSettings);
router.get('/:key', authenticateToken, getSetting);
router.post('/', authenticateToken, upsertSetting);
router.put('/:key', authenticateToken, updateSetting);
router.delete('/:key', authenticateToken, deleteSetting);

export default router;
