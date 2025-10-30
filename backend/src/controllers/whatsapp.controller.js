import { prisma } from '../server.js';
import { io } from '../server.js';
import { twilioService } from '../services/twilio.service.js';

/**
 * Handle incoming WhatsApp messages from Twilio webhook
 * POST /api/whatsapp/webhook
 */
export const handleIncomingMessage = async (req, res) => {
  try {
    const {
      MessageSid,
      From,
      To,
      Body,
      ProfileName,
      NumMedia,
    } = req.body;

    console.log('📥 WhatsApp webhook received:', {
      sid: MessageSid,
      from: From,
      body: Body?.substring(0, 50),
    });

    // Extract phone number from WhatsApp format (whatsapp:+1234567890 -> +1234567890)
    const userPhone = From.replace('whatsapp:', '');
    const userName = ProfileName || userPhone;

    // Find or create chat session for this WhatsApp number
    let session = await findOrCreateWhatsAppSession(userPhone, userName);

    // Parse existing messages
    const messages = typeof session.messages === 'string'
      ? JSON.parse(session.messages)
      : Array.isArray(session.messages)
      ? session.messages
      : [];

    // Add new user message
    const newMessage = {
      id: MessageSid,
      type: 'user',
      content: Body,
      timestamp: new Date().toISOString(),
      channel: 'whatsapp',
      from: userPhone,
    };

    messages.push(newMessage);

    // Update session with new message
    session = await prisma.chatSession.update({
      where: { id: session.id },
      data: {
        messages: JSON.stringify(messages),
        lastMessageAt: new Date(),
        status: session.status === 'CLOSED' ? 'ACTIVE' : session.status,
      },
      include: {
        operator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // AUDIT FIX: Emit to specific chat room instead of global broadcast (privacy)
    io.to(`chat_${session.id}`).emit('whatsapp_message', {
      sessionId: session.id,
      userName: session.userName,
      message: newMessage,
      status: session.status,
    });

    // If no operator assigned and status is ACTIVE, check for AI response or operator assignment
    if (session.status === 'ACTIVE' && !session.operatorId) {
      // Set status to WAITING for operator
      await prisma.chatSession.update({
        where: { id: session.id },
        data: { status: 'WAITING' },
      });

      // AUDIT FIX: Emit to dashboard room instead of global broadcast
      io.to('dashboard').emit('new_chat', {
        sessionId: session.id,
        userName: session.userName,
        channel: 'whatsapp',
        message: Body,
      });

      // Notify operators via WhatsApp if configured
      notifyAvailableOperators(session.id, userName, Body);
    }

    // Respond with TwiML (required by Twilio)
    res.type('text/xml');
    res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  } catch (error) {
    console.error('❌ WhatsApp webhook error:', error);

    // Still respond with valid TwiML to avoid Twilio retries
    res.type('text/xml');
    res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  }
};

/**
 * Handle WhatsApp status callbacks (delivery, read, etc.)
 * POST /api/whatsapp/status
 */
export const handleStatusCallback = async (req, res) => {
  try {
    const {
      MessageSid,
      MessageStatus,
      ErrorCode,
      ErrorMessage,
    } = req.body;

    console.log('📊 WhatsApp status update:', {
      sid: MessageSid,
      status: MessageStatus,
    });

    // Update message status in database if needed
    // TODO: Implement message status tracking

    res.type('text/xml');
    res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  } catch (error) {
    console.error('❌ WhatsApp status webhook error:', error);
    res.type('text/xml');
    res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  }
};

/**
 * Send WhatsApp message to user
 * POST /api/whatsapp/send
 */
export const sendMessage = async (req, res) => {
  try {
    const { sessionId, message, operatorId } = req.body;

    if (!sessionId || !message) {
      return res.status(400).json({
        error: { message: 'sessionId and message are required' },
      });
    }

    // Get session with user's WhatsApp number
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        ticket: {
          select: {
            whatsappNumber: true,
          },
        },
      },
    });

    if (!session) {
      return res.status(404).json({
        error: { message: 'Chat session not found' },
      });
    }

    // Get WhatsApp number from ticket or derive from session
    let whatsappNumber = session.ticket?.whatsappNumber;

    if (!whatsappNumber) {
      // Try to extract from messages
      const messages = typeof session.messages === 'string'
        ? JSON.parse(session.messages)
        : Array.isArray(session.messages)
        ? session.messages
        : [];

      const whatsappMsg = messages.find(m => m.channel === 'whatsapp' && m.from);
      if (whatsappMsg) {
        whatsappNumber = whatsappMsg.from;
      }
    }

    if (!whatsappNumber) {
      return res.status(400).json({
        error: { message: 'No WhatsApp number found for this session' },
      });
    }

    // Send message via Twilio
    const result = await twilioService.sendWhatsAppMessage(whatsappNumber, message);

    // Save message to session
    const messages = typeof session.messages === 'string'
      ? JSON.parse(session.messages)
      : Array.isArray(session.messages)
      ? session.messages
      : [];

    const newMessage = {
      id: result.sid,
      type: 'operator',
      content: message,
      timestamp: new Date().toISOString(),
      channel: 'whatsapp',
      operatorId,
    };

    messages.push(newMessage);

    await prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        messages: JSON.stringify(messages),
        lastMessageAt: new Date(),
      },
    });

    // AUDIT FIX: Emit to specific chat room instead of global broadcast
    io.to(`chat_${sessionId}`).emit('operator_message', {
      sessionId,
      message: newMessage,
    });

    res.json({
      success: true,
      data: {
        messageSid: result.sid,
        status: result.status,
      },
    });
  } catch (error) {
    console.error('❌ Failed to send WhatsApp message:', error);
    res.status(500).json({
      error: { message: error.message || 'Failed to send message' },
    });
  }
};

/**
 * Test Twilio connection
 * GET /api/whatsapp/test
 */
export const testConnection = async (req, res) => {
  try {
    await twilioService.initialize();

    if (twilioService.isReady()) {
      res.json({
        success: true,
        message: 'Twilio WhatsApp is configured and ready',
        whatsappNumber: twilioService.whatsappNumber,
      });
    } else {
      res.json({
        success: false,
        message: 'Twilio credentials not configured. Please add them in Settings.',
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Helper functions

/**
 * Find or create chat session for WhatsApp user
 */
async function findOrCreateWhatsAppSession(phoneNumber, userName) {
  // Look for existing active/waiting session for this phone number
  // We check in ticket.whatsappNumber since that's where we store it
  const existingSession = await prisma.chatSession.findFirst({
    where: {
      ticket: {
        whatsappNumber: phoneNumber,
      },
      status: {
        in: ['ACTIVE', 'WAITING', 'WITH_OPERATOR'],
      },
    },
    include: {
      operator: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      ticket: true,
    },
    orderBy: {
      lastMessageAt: 'desc',
    },
  });

  if (existingSession) {
    return existingSession;
  }

  // Create new session and associated ticket
  const session = await prisma.chatSession.create({
    data: {
      userName,
      status: 'ACTIVE',
      messages: JSON.stringify([]),
    },
  });

  // Create associated ticket
  await prisma.ticket.create({
    data: {
      userName,
      contactMethod: 'WHATSAPP',
      whatsappNumber: phoneNumber,
      initialMessage: 'Messaggio da WhatsApp',
      sessionId: session.id,
      resumeTokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
  });

  // Refetch with ticket included
  return await prisma.chatSession.findUnique({
    where: { id: session.id },
    include: {
      operator: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      ticket: true,
    },
  });
}

/**
 * Notify available operators about new WhatsApp message
 */
async function notifyAvailableOperators(sessionId, userName, message) {
  try {
    const operators = await prisma.operator.findMany({
      where: {
        isAvailable: true,
      },
      select: {
        id: true,
        whatsappNumber: true,
        notificationPreferences: true,
      },
    });

    for (const operator of operators) {
      if (operator.whatsappNumber) {
        const prefs = operator.notificationPreferences;
        const shouldNotify = !prefs ||
          typeof prefs !== 'object' ||
          prefs.whatsapp?.newChat !== false;

        if (shouldNotify) {
          await twilioService.sendOperatorNotification(
            operator.id,
            `🔔 Nuova chat WhatsApp da ${userName}: "${message.substring(0, 100)}..."`
          );
        }
      }
    }
  } catch (error) {
    console.error('Failed to notify operators:', error);
  }
}
