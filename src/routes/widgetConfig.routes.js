import express from 'express';
import {
  getWidgetStrings,
  getWidgetStringsForAdmin,
  updateWidgetStrings,
  resetWidgetStrings
} from '../controllers/widgetConfig.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// Public route (for widget)
router.get('/widget-strings', getWidgetStrings);

// Protected routes (for admin dashboard)
router.get('/settings/widget-strings', authenticateToken, getWidgetStringsForAdmin);
router.put('/settings/widget-strings', authenticateToken, updateWidgetStrings);
router.post('/settings/widget-strings/reset', authenticateToken, resetWidgetStrings);

export default router;
