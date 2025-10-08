import express from 'express';
import {
  toggleAvailability,
  updateNotificationPreferences,
  getOperators,
  getOnlineOperators,
  createOperator,
  updateOperator,
  deleteOperator,
} from '../controllers/operator.controller.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Operator self-management
router.post('/me/toggle-availability', toggleAvailability);
router.put('/me/notification-preferences', updateNotificationPreferences);

// Public to all operators
router.get('/online', getOnlineOperators);

// Admin only
router.get('/', requireAdmin, getOperators);
router.post('/', requireAdmin, createOperator);
router.put('/:operatorId', requireAdmin, updateOperator);
router.delete('/:operatorId', requireAdmin, deleteOperator);

export default router;
