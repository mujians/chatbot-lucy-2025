import express from 'express';
import {
  getKnowledgeItems,
  getKnowledgeItem,
  createKnowledgeItem,
  updateKnowledgeItem,
  deleteKnowledgeItem,
  toggleKnowledgeItem,
  bulkImportKnowledge,
} from '../controllers/knowledge.controller.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Read operations (all operators)
router.get('/', getKnowledgeItems);
router.get('/:itemId', getKnowledgeItem);

// Write operations (admin only)
router.post('/', requireAdmin, createKnowledgeItem);
router.put('/:itemId', requireAdmin, updateKnowledgeItem);
router.delete('/:itemId', requireAdmin, deleteKnowledgeItem);
router.patch('/:itemId/toggle', requireAdmin, toggleKnowledgeItem);
router.post('/bulk', requireAdmin, bulkImportKnowledge);

export default router;
