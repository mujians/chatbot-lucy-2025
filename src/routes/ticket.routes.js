import express from 'express';
import {
  createTicket,
  getTickets,
  getTicket,
  assignTicket,
  resolveTicket,
  resumeTicket,
  convertChatToTicket,
  updateTicketStatus,
} from '../controllers/ticket.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// Public routes (for widget)
router.post('/', createTicket);
router.get('/resume/:resumeToken', resumeTicket);

// Protected routes (for operators)
router.get('/', authenticateToken, getTickets);
router.get('/:ticketId', authenticateToken, getTicket);
router.post('/:ticketId/assign', authenticateToken, assignTicket);
router.post('/:ticketId/resolve', authenticateToken, resolveTicket);
router.patch('/:ticketId/status', authenticateToken, updateTicketStatus); // v2.2

export default router;
