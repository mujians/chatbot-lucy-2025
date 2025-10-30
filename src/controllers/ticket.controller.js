import { prisma } from '../server.js';
import { io } from '../server.js';
import { emailService } from '../services/email.service.js';
import { twilioService } from '../services/twilio.service.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Create ticket
 * POST /api/tickets
 */
export const createTicket = async (req, res) => {
  try {
    const {
      sessionId,
      userName,
      contactMethod,
      whatsappNumber,
      email,
      initialMessage,
      priority = 'NORMAL',
    } = req.body;

    // Validation
    if (!sessionId || !userName || !contactMethod || !initialMessage) {
      return res.status(400).json({
        error: { message: 'Missing required fields' },
      });
    }

    if (contactMethod === 'WHATSAPP' && !whatsappNumber) {
      return res.status(400).json({
        error: { message: 'WhatsApp number required for WhatsApp contact method' },
      });
    }

    if (contactMethod === 'EMAIL' && !email) {
      return res.status(400).json({
        error: { message: 'Email required for email contact method' },
      });
    }

    // Ensure chat session exists (create if missing - handles stale localStorage)
    let session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      console.log(`⚠️ Session ${sessionId} not found in DB, creating it...`);
      session = await prisma.chatSession.create({
        data: {
          id: sessionId,
          userName: userName,
          status: 'ACTIVE',
          messages: JSON.stringify([]),
        },
      });
    }

    // Check if ticket already exists for this session
    let ticket = await prisma.ticket.findUnique({
      where: { sessionId },
    });

    if (ticket) {
      console.log(`⚠️ Ticket already exists for session ${sessionId}, returning existing ticket`);
      // Return existing ticket with its resume URL
      const existingResumeUrl = `${process.env.SHOPIFY_SITE_URL || 'https://lucine.it'}/chat?token=${ticket.resumeToken}`;

      return res.json({
        success: true,
        data: {
          ticket,
          resumeUrl: existingResumeUrl,
        },
      });
    }

    // Generate resume token
    const resumeToken = uuidv4();
    const resumeTokenExpiresAt = new Date();
    resumeTokenExpiresAt.setDate(resumeTokenExpiresAt.getDate() + 30); // 30 days

    // Create ticket
    ticket = await prisma.ticket.create({
      data: {
        userName,
        contactMethod,
        whatsappNumber: contactMethod === 'WHATSAPP' ? whatsappNumber : null,
        email: contactMethod === 'EMAIL' ? email : null,
        initialMessage,
        priority,
        status: 'PENDING',
        sessionId,
        resumeToken,
        resumeTokenExpiresAt,
      },
    });

    // Update chat session status (non-blocking - ticket already created)
    try {
      await prisma.chatSession.update({
        where: { id: sessionId },
        data: { status: 'TICKET_CREATED' },
      });
    } catch (sessionUpdateError) {
      console.error('⚠️ Chat session update failed (ticket created anyway):', sessionUpdateError);
      // Don't throw - ticket is already created, just log the failure
    }

    // Generate resume URL
    const resumeUrl = `${process.env.SHOPIFY_SITE_URL || 'https://lucine.it'}/chat?token=${resumeToken}`;

    // Send notification based on contact method (non-blocking - don't fail ticket creation if notification fails)
    try {
      if (contactMethod === 'WHATSAPP') {
        await twilioService.sendWhatsAppMessage(
          whatsappNumber,
          `Ciao ${userName}! Abbiamo ricevuto la tua richiesta. Ti ricontatteremo presto. Clicca qui per riprendere: ${resumeUrl}`
        );
      } else if (contactMethod === 'EMAIL') {
        await emailService.sendEmail({
          to: email,
          subject: 'La tua richiesta Lucine di Natale',
          text: `Ciao ${userName},\n\nAbbiamo ricevuto la tua richiesta e ti risponderemo al più presto.\n\nPuoi riprendere la conversazione qui: ${resumeUrl}\n\nGrazie!`
        });
      }
    } catch (notificationError) {
      console.error('⚠️ Notification sending failed (ticket created anyway):', notificationError);
      // Don't throw - ticket is already created, just log the notification failure
    }

    // Notify all operators
    io.to('dashboard').emit('new_ticket_created', {
      ticketId: ticket.id,
      userName: ticket.userName,
      contactMethod: ticket.contactMethod,
      priority: ticket.priority,
    });

    res.json({
      success: true,
      data: {
        ticket,
        resumeUrl,
      },
    });
  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};

/**
 * Get tickets
 * GET /api/tickets
 */
export const getTickets = async (req, res) => {
  try {
    const { status, operatorId } = req.query;

    const where = {};
    if (status) where.status = status;
    if (operatorId) where.operatorId = operatorId;

    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        operator: {
          select: {
            id: true,
            name: true,
          },
        },
        session: {
          select: {
            id: true,
            messages: true,
          },
        },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    res.json({
      success: true,
      data: tickets,
    });
  } catch (error) {
    console.error('Get tickets error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};

/**
 * Get ticket by ID
 * GET /api/tickets/:ticketId
 */
export const getTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        operator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        session: {
          select: {
            id: true,
            messages: true,
            userName: true,
          },
        },
      },
    });

    if (!ticket) {
      return res.status(404).json({
        error: { message: 'Ticket not found' },
      });
    }

    res.json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    console.error('Get ticket error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};

/**
 * Assign ticket to operator
 * POST /api/tickets/:ticketId/assign
 */
export const assignTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const operatorId = req.operator.id; // Assign to current operator

    const ticket = await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        operatorId,
        status: 'ASSIGNED',
        assignedAt: new Date(),
      },
      include: {
        operator: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Notify via WebSocket
    io.to('dashboard').emit('ticket_assigned', {
      ticketId: ticket.id,
      operatorId: ticket.operatorId,
      operatorName: ticket.operator.name,
    });

    res.json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    console.error('Assign ticket error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};

/**
 * Resolve ticket
 * POST /api/tickets/:ticketId/resolve
 */
export const resolveTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { resolutionNotes } = req.body;

    const ticket = await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolutionNotes: resolutionNotes || null,
      },
    });

    // Increment operator stats
    if (ticket.operatorId) {
      await prisma.operator.update({
        where: { id: ticket.operatorId },
        data: {
          totalTicketsHandled: { increment: 1 },
        },
      });
    }

    // Notify via WebSocket
    io.to('dashboard').emit('ticket_resolved', {
      ticketId: ticket.id,
    });

    res.json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    console.error('Resolve ticket error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};

/**
 * Resume ticket by token (for user)
 * GET /api/tickets/resume/:resumeToken
 */
export const resumeTicket = async (req, res) => {
  try {
    const { resumeToken } = req.params;

    const ticket = await prisma.ticket.findUnique({
      where: { resumeToken },
      include: {
        session: {
          select: {
            id: true,
            userName: true,
            messages: true,
          },
        },
        operator: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!ticket) {
      return res.status(404).json({
        error: { message: 'Invalid or expired ticket link' },
      });
    }

    // Check if token expired
    if (new Date() > ticket.resumeTokenExpiresAt) {
      return res.status(410).json({
        error: { message: 'Ticket link has expired' },
      });
    }

    // Update ticket status to OPEN if it was PENDING or ASSIGNED
    if (ticket.status === 'PENDING' || ticket.status === 'ASSIGNED') {
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: 'OPEN' },
      });

      // Notify operator
      if (ticket.operatorId) {
        io.to(`operator:${ticket.operatorId}`).emit('ticket_resumed', {
          ticketId: ticket.id,
          userName: ticket.userName,
        });
      }
    }

    res.json({
      success: true,
      data: {
        ticketId: ticket.id,
        sessionId: ticket.sessionId,
        userName: ticket.userName,
        contactMethod: ticket.contactMethod,
        chatHistory: ticket.session.messages,
        operatorName: ticket.operator?.name,
      },
    });
  } catch (error) {
    console.error('Resume ticket error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};

/**
 * Convert chat to ticket
 * POST /api/chat/:sessionId/convert-to-ticket
 */
export const convertChatToTicket = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const {
      contactMethod,
      whatsappNumber,
      email,
      operatorNotes,
    } = req.body;

    // Get session
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return res.status(404).json({
        error: { message: 'Session not found' },
      });
    }

    // Extract last user message as initial message
    const messages = JSON.parse(session.messages || '[]');
    const lastUserMessage = messages.reverse().find(m => m.type === 'user');
    const initialMessage = lastUserMessage?.content || 'Richiesta convertita da chat';

    // Create ticket
    const resumeToken = uuidv4();
    const resumeTokenExpiresAt = new Date();
    resumeTokenExpiresAt.setDate(resumeTokenExpiresAt.getDate() + 30);

    const ticket = await prisma.ticket.create({
      data: {
        userName: session.userName || 'Utente',
        contactMethod,
        whatsappNumber: contactMethod === 'WHATSAPP' ? whatsappNumber : null,
        email: contactMethod === 'EMAIL' ? email : null,
        initialMessage,
        status: 'ASSIGNED', // Auto-assign to current operator
        operatorId: req.operator.id,
        assignedAt: new Date(),
        sessionId,
        resumeToken,
        resumeTokenExpiresAt,
        resolutionNotes: operatorNotes,
      },
    });

    // Update session status (non-blocking - ticket already created)
    try {
      await prisma.chatSession.update({
        where: { id: sessionId },
        data: { status: 'TICKET_CREATED' },
      });
    } catch (sessionUpdateError) {
      console.error('⚠️ Chat session update failed (ticket created anyway):', sessionUpdateError);
      // Don't throw - ticket is already created, just log the failure
    }

    // Generate resume URL
    const resumeUrl = `${process.env.SHOPIFY_SITE_URL || 'https://lucine.it'}/chat?token=${resumeToken}`;

    // Send notification (non-blocking - don't fail ticket creation if notification fails)
    try {
      if (contactMethod === 'WHATSAPP') {
        await twilioService.sendWhatsAppMessage(
          whatsappNumber,
          `Ciao! Abbiamo ricevuto la tua richiesta. Ti risponderemo presto. Riprendi qui: ${resumeUrl}`
        );
      } else if (contactMethod === 'EMAIL') {
        await emailService.sendEmail({
          to: email,
          subject: 'La tua richiesta Lucine di Natale',
          text: `Abbiamo ricevuto la tua richiesta e ti risponderemo al più presto.\n\nRiprendi qui: ${resumeUrl}`
        });
      }
    } catch (notificationError) {
      console.error('⚠️ Notification sending failed (ticket created anyway):', notificationError);
      // Don't throw - ticket is already created, just log the notification failure
    }

    // Notify dashboard
    io.to('dashboard').emit('chat_converted_to_ticket', {
      ticketId: ticket.id,
      sessionId,
      operatorId: req.operator.id,
    });

    res.json({
      success: true,
      data: {
        ticket,
        resumeUrl,
      },
    });
  } catch (error) {
    console.error('Convert chat to ticket error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};
