import express from 'express';
import {
  handleIncomingMessage,
  handleStatusCallback,
  sendMessage,
  testConnection,
} from '../controllers/whatsapp.controller.js';

const router = express.Router();

/**
 * Webhook for incoming WhatsApp messages
 * POST /api/whatsapp/webhook
 * This endpoint receives messages from Twilio when users send WhatsApp messages
 */
router.post('/webhook', handleIncomingMessage);

/**
 * Webhook for WhatsApp message status updates
 * POST /api/whatsapp/status
 * This endpoint receives delivery/read receipts from Twilio
 */
router.post('/status', handleStatusCallback);

/**
 * Send WhatsApp message to user
 * POST /api/whatsapp/send
 * Body: { sessionId, message, operatorId }
 */
router.post('/send', sendMessage);

/**
 * Test Twilio connection
 * GET /api/whatsapp/test
 */
router.get('/test', testConnection);

export default router;
