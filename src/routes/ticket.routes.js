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
import { doubleCsrfProtection } from '../middleware/csrf.middleware.js';

const router = express.Router();

// Public routes (for widget)
router.post('/', createTicket);
router.get('/resume/:resumeToken', resumeTicket);

// Protected routes (for operators)
router.get('/', authenticateToken, getTickets);
router.get('/:ticketId', authenticateToken, getTicket);
router.post('/:ticketId/assign', authenticateToken, doubleCsrfProtection, assignTicket); // v2.2 CSRF
router.post('/:ticketId/resolve', authenticateToken, doubleCsrfProtection, resolveTicket); // v2.2 CSRF
router.patch('/:ticketId/status', authenticateToken, doubleCsrfProtection, updateTicketStatus); // v2.2 CSRF

export default router;
