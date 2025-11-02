import express from 'express';
import { getSystemHealth, getLogs } from '../controllers/health.controller.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

// ADMIN-ONLY routes for system health and logs
router.get('/system', authenticateToken, requireAdmin, getSystemHealth);
router.get('/logs', authenticateToken, requireAdmin, getLogs);

export default router;
