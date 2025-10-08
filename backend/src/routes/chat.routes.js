import express from 'express';
import {
  createSession,
  getSession,
  sendUserMessage,
  requestOperator,
  closeSession,
  getSessions,
} from '../controllers/chat.controller.js';
import { convertChatToTicket } from '../controllers/ticket.controller.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.middleware.js';

const router = express.Router();

// Public routes (for widget)
router.post('/session', createSession);
router.get('/session/:sessionId', getSession);
router.post('/session/:sessionId/message', sendUserMessage);
router.post('/session/:sessionId/request-operator', requestOperator);

// Protected routes (for operators)
router.get('/sessions', authenticateToken, getSessions);
router.post('/session/:sessionId/close', authenticateToken, closeSession);
router.post('/session/:sessionId/convert-to-ticket', authenticateToken, convertChatToTicket);

export default router;
