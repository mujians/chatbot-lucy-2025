import express from 'express';
import {
  createSession,
  getSession,
  getActiveSessions,
  sendUserMessage,
  requestOperator,
  cancelOperatorRequest,
  acceptOperator,
  operatorIntervene,
  sendOperatorMessage,
  closeSession,
  reopenSession,
  getSessions,
  deleteSession,
  archiveSession,
  unarchiveSession,
  flagSession,
  unflagSession,
  transferSession,
  markMessagesAsRead,
  updatePriority,
  updateTags,
  addInternalNote,
  updateInternalNote,
  deleteInternalNote,
  getUserHistory,
  uploadFile,
  submitRating,
  getRatingsAnalytics,
} from '../controllers/chat.controller.js';
import { convertChatToTicket } from '../controllers/ticket.controller.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.middleware.js';
import { uploadService } from '../services/upload.service.js';
import { doubleCsrfProtection } from '../middleware/csrf.middleware.js';

const router = express.Router();

// Public routes (for widget)
router.post('/session', createSession);
router.get('/session/:sessionId', getSession);
router.post('/session/:sessionId/message', sendUserMessage);
router.post('/session/:sessionId/request-operator', requestOperator);
router.post('/session/:sessionId/cancel-operator-request', cancelOperatorRequest);
router.post('/session/:sessionId/reopen', reopenSession);

// Protected routes (for operators) - v2.2 CSRF protected
router.get('/sessions', authenticateToken, getSessions);
router.get('/sessions/active', authenticateToken, getActiveSessions); // Must be before /:sessionId
router.post('/sessions/:sessionId/accept-operator', authenticateToken, doubleCsrfProtection, acceptOperator);
router.post('/sessions/:sessionId/operator-intervene', authenticateToken, doubleCsrfProtection, operatorIntervene);
router.post('/sessions/:sessionId/operator-message', authenticateToken, doubleCsrfProtection, sendOperatorMessage);
router.post('/sessions/:sessionId/close', authenticateToken, doubleCsrfProtection, closeSession);
router.post('/sessions/:sessionId/mark-read', authenticateToken, doubleCsrfProtection, markMessagesAsRead);
router.delete('/sessions/:sessionId', authenticateToken, doubleCsrfProtection, deleteSession);
router.post('/sessions/:sessionId/archive', authenticateToken, doubleCsrfProtection, archiveSession);
router.post('/sessions/:sessionId/unarchive', authenticateToken, doubleCsrfProtection, unarchiveSession);
router.post('/sessions/:sessionId/flag', authenticateToken, doubleCsrfProtection, flagSession);
router.post('/sessions/:sessionId/unflag', authenticateToken, doubleCsrfProtection, unflagSession);
router.post('/sessions/:sessionId/transfer', authenticateToken, doubleCsrfProtection, transferSession);
router.post('/sessions/:sessionId/convert-to-ticket', authenticateToken, doubleCsrfProtection, convertChatToTicket);

// P1.8: Priority and Tags routes - v2.2 CSRF protected
router.put('/sessions/:sessionId/priority', authenticateToken, doubleCsrfProtection, updatePriority);
router.put('/sessions/:sessionId/tags', authenticateToken, doubleCsrfProtection, updateTags);

// P0.3: Internal Notes routes - v2.2 CSRF protected
router.post('/sessions/:sessionId/notes', authenticateToken, doubleCsrfProtection, addInternalNote);
router.put('/sessions/:sessionId/notes/:noteId', authenticateToken, doubleCsrfProtection, updateInternalNote);
router.delete('/sessions/:sessionId/notes/:noteId', authenticateToken, doubleCsrfProtection, deleteInternalNote);

// P0.2: User History route
router.get('/users/:userId/history', authenticateToken, getUserHistory);

// P0.1: File Upload route (both users and operators can upload)
const upload = uploadService.getUploadMiddleware();
router.post(
  '/sessions/:sessionId/upload',
  optionalAuth,
  upload.single('file'),
  uploadFile
);

// P1.2: CSAT (Customer Satisfaction) routes
router.post('/sessions/:sessionId/rating', submitRating);  // Public - users can rate
router.get('/ratings/analytics', authenticateToken, getRatingsAnalytics);  // Protected - operators only

export default router;
