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
router.post('/sessions/:sessionId/accept-operator', authenticateToken, acceptOperator);
router.post('/sessions/:sessionId/operator-intervene', authenticateToken, operatorIntervene);
router.post('/sessions/:sessionId/operator-message', authenticateToken, sendOperatorMessage);
router.post('/sessions/:sessionId/close', authenticateToken, closeSession);
router.post('/sessions/:sessionId/mark-read', authenticateToken, markMessagesAsRead);
router.delete('/sessions/:sessionId', authenticateToken, deleteSession);
router.post('/sessions/:sessionId/archive', authenticateToken, archiveSession);
router.post('/sessions/:sessionId/unarchive', authenticateToken, unarchiveSession);
router.post('/sessions/:sessionId/flag', authenticateToken, flagSession);
router.post('/sessions/:sessionId/unflag', authenticateToken, unflagSession);
router.post('/sessions/:sessionId/transfer', authenticateToken, transferSession);
router.post('/sessions/:sessionId/convert-to-ticket', authenticateToken, convertChatToTicket);

// P0.3: Internal Notes routes - v2.2 CSRF protected
router.post('/sessions/:sessionId/notes', authenticateToken, addInternalNote);
router.put('/sessions/:sessionId/notes/:noteId', authenticateToken, updateInternalNote);
router.delete('/sessions/:sessionId/notes/:noteId', authenticateToken, deleteInternalNote);

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
