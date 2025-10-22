import express from 'express';
import { getDashboardStats } from '../controllers/analytics.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// All analytics routes require authentication
router.use(authenticateToken);

router.get('/dashboard', getDashboardStats);

export default router;
