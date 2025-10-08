import express from 'express';
import {
  login,
  logout,
  getCurrentOperator,
  refreshToken,
  verifyToken,
} from '../controllers/auth.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// Public routes
router.post('/login', login);

// Protected routes
router.get('/me', authenticateToken, getCurrentOperator);
router.post('/refresh', authenticateToken, refreshToken);
router.post('/logout', authenticateToken, logout);
router.post('/verify', authenticateToken, verifyToken);

export default router;
