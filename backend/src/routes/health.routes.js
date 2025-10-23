import express from 'express';
import { getSystemHealth, getHealthQuick, getSystemLogs } from '../controllers/health.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * Quick health check (public - for monitoring)
 * GET /api/health
 */
router.get('/', getHealthQuick);

/**
 * Comprehensive system health check (authenticated)
 * GET /api/health/system
 */
router.get('/system', authenticate, getSystemHealth);

/**
 * System logs (authenticated, admin only recommended)
 * GET /api/health/logs?limit=50
 */
router.get('/logs', authenticate, getSystemLogs);

export default router;
