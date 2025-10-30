import express from 'express';
import {
  getCannedResponses,
  getCannedResponse,
  createCannedResponse,
  updateCannedResponse,
  deleteCannedResponse,
  useCannedResponse,
} from '../controllers/canned-response.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// All canned response routes require authentication
router.use(authenticateToken);

// CRUD operations
router.get('/', getCannedResponses);
router.get('/:id', getCannedResponse);
router.post('/', createCannedResponse);
router.put('/:id', updateCannedResponse);
router.delete('/:id', deleteCannedResponse);

// Usage tracking
router.post('/:id/use', useCannedResponse);

export default router;
