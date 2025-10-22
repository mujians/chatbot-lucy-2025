import { prisma } from '../server.js';
import { io } from '../server.js';
import { generateAIResponse } from '../services/openai.service.js';

/**
 * Create new chat session
 * POST /api/chat/session
 */
export const createSession = async (req, res) => {
  try {
    const { userName } = req.body;

    const session = await prisma.chatSession.create({
      data: {
        userName: userName || null,
        status: 'ACTIVE',
        messages: JSON.stringify([]),
      },
    });

    res.json({
      success: true,
      data: session,
    });
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};

/**
 * Get chat session by ID
 * GET /api/chat/session/:sessionId
 */
export const getSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
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

    if (!session) {
      return res.status(404).json({
        error: { message: 'Session not found' },
      });
    }

    res.json({
      success: true,
      data: session,
    });
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};

/**
 * Send user message (triggers AI response)
 * POST /api/chat/session/:sessionId/message
 */
export const sendUserMessage = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { message } = req.body;

    // Get session
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return res.status(404).json({
        error: { message: 'Session not found' },
      });
    }

    // Parse messages
    const messages = JSON.parse(session.messages || '[]');

    // Add user message
    const userMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };
    messages.push(userMessage);

    // Update session
    await prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        messages: JSON.stringify(messages),
        lastMessageAt: new Date(),
      },
    });

    // If status is WITH_OPERATOR, forward to operator via WebSocket
    if (session.status === 'WITH_OPERATOR' && session.operatorId) {
      io.to(`operator:${session.operatorId}`).emit('user_message', {
        sessionId: sessionId,
        userName: session.userName,
        message: userMessage,
      });

      return res.json({
        success: true,
        data: { message: userMessage, aiResponse: null },
      });
    }

    // Otherwise, generate AI response
    const aiResult = await generateAIResponse(message, messages);

    const aiMessage = {
      id: (Date.now() + 1).toString(),
      type: 'ai',
      content: aiResult.message,
      timestamp: new Date().toISOString(),
      confidence: aiResult.confidence,
      suggestOperator: aiResult.suggestOperator,
    };

    messages.push(aiMessage);

    // Update session with AI response
    await prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        messages: JSON.stringify(messages),
        lastMessageAt: new Date(),
      },
    });

    res.json({
      success: true,
      data: {
        message: userMessage,
        aiResponse: aiMessage,
      },
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};

/**
 * Request operator (for user)
 * POST /api/chat/session/:sessionId/request-operator
 */
export const requestOperator = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return res.status(404).json({
        error: { message: 'Session not found' },
      });
    }

    // Check if any operators are online AND available
    const availableOperators = await prisma.operator.findMany({
      where: {
        isOnline: true,      // Connected to dashboard
        isAvailable: true,   // Available to receive new chats
      },
      orderBy: { totalChatsHandled: 'asc' }, // Least busy first
    });

    if (availableOperators.length === 0) {
      // No operators available - suggest ticket
      return res.json({
        success: true,
        data: {
          operatorAvailable: false,
          message: 'Nessun operatore disponibile. Vuoi aprire un ticket?',
        },
      });
    }

    // Assign to least busy operator
    const assignedOperator = availableOperators[0];

    // Update session
    await prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        status: 'WITH_OPERATOR',
        operatorId: assignedOperator.id,
      },
    });

    // Add system message
    const messages = JSON.parse(session.messages || '[]');
    messages.push({
      id: Date.now().toString(),
      type: 'system',
      content: `${assignedOperator.name} si è unito alla chat`,
      timestamp: new Date().toISOString(),
    });

    await prisma.chatSession.update({
      where: { id: sessionId },
      data: { messages: JSON.stringify(messages) },
    });

    // Notify operator via WebSocket
    io.to(`operator:${assignedOperator.id}`).emit('new_chat_request', {
      sessionId: sessionId,
      userName: session.userName,
      lastMessage: messages[messages.length - 2]?.content || '',
    });

    // Notify dashboard
    io.to('dashboard').emit('chat_assigned', {
      sessionId: sessionId,
      operatorId: assignedOperator.id,
    });

    res.json({
      success: true,
      data: {
        operatorAvailable: true,
        operator: {
          id: assignedOperator.id,
          name: assignedOperator.name,
        },
      },
    });
  } catch (error) {
    console.error('Request operator error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};

/**
 * Close chat session
 * POST /api/chat/session/:sessionId/close
 */
export const closeSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
      },
    });

    // If had operator, increment their stats
    if (session.operatorId) {
      await prisma.operator.update({
        where: { id: session.operatorId },
        data: {
          totalChatsHandled: { increment: 1 },
        },
      });
    }

    // Notify via WebSocket
    io.to(`chat:${sessionId}`).emit('chat_closed', {
      sessionId: sessionId,
    });

    res.json({
      success: true,
      data: session,
    });
  } catch (error) {
    console.error('Close session error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};

/**
 * Get all chat sessions (for operators)
 * GET /api/chat/sessions?search=keyword&status=ACTIVE&isArchived=false&isFlagged=true&dateFrom=...&dateTo=...
 */
export const getSessions = async (req, res) => {
  try {
    const { status, operatorId, search, isArchived, isFlagged, dateFrom, dateTo, limit = 50 } = req.query;

    const where = {
      deletedAt: null, // Exclude soft-deleted chats
    };

    // Status filter
    if (status) where.status = status;

    // Operator filter
    if (operatorId) where.operatorId = operatorId;

    // Archive filter
    if (isArchived !== undefined) {
      where.isArchived = isArchived === 'true';
    }

    // Flag filter
    if (isFlagged !== undefined) {
      where.isFlagged = isFlagged === 'true';
    }

    // Search in userName or messages
    if (search) {
      where.OR = [
        { userName: { contains: search, mode: 'insensitive' } },
        { messages: { string_contains: search } }, // Search in JSON
      ];
    }

    // Date range filter
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const sessions = await prisma.chatSession.findMany({
      where,
      include: {
        operator: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
      take: parseInt(limit),
    });

    res.json({
      success: true,
      data: sessions,
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};

/**
 * Delete chat session (soft delete)
 * DELETE /api/chat/sessions/:sessionId
 */
export const deleteSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        deletedAt: new Date(),
      },
    });

    // Notify via WebSocket
    io.to('dashboard').emit('chat_deleted', { sessionId });

    res.json({
      success: true,
      message: 'Chat deleted successfully',
      data: session,
    });
  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};

/**
 * Archive chat session
 * POST /api/chat/sessions/:sessionId/archive
 */
export const archiveSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        isArchived: true,
        archivedAt: new Date(),
        archivedBy: req.operator.id,
      },
    });

    // Notify via WebSocket
    io.to('dashboard').emit('chat_archived', { sessionId });

    res.json({
      success: true,
      message: 'Chat archived successfully',
      data: session,
    });
  } catch (error) {
    console.error('Archive session error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};

/**
 * Unarchive chat session
 * POST /api/chat/sessions/:sessionId/unarchive
 */
export const unarchiveSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        isArchived: false,
        archivedAt: null,
        archivedBy: null,
      },
    });

    // Notify via WebSocket
    io.to('dashboard').emit('chat_unarchived', { sessionId });

    res.json({
      success: true,
      message: 'Chat unarchived successfully',
      data: session,
    });
  } catch (error) {
    console.error('Unarchive session error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};

/**
 * Flag chat session
 * POST /api/chat/sessions/:sessionId/flag
 */
export const flagSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { reason } = req.body;

    const session = await prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        isFlagged: true,
        flagReason: reason || 'Flagged by operator',
        flaggedBy: req.operator.id,
        flaggedAt: new Date(),
      },
    });

    // Notify via WebSocket
    io.to('dashboard').emit('chat_flagged', { sessionId, reason });

    res.json({
      success: true,
      message: 'Chat flagged successfully',
      data: session,
    });
  } catch (error) {
    console.error('Flag session error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};

/**
 * Unflag chat session
 * POST /api/chat/sessions/:sessionId/unflag
 */
export const unflagSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        isFlagged: false,
        flagReason: null,
        flaggedBy: null,
        flaggedAt: null,
      },
    });

    // Notify via WebSocket
    io.to('dashboard').emit('chat_unflagged', { sessionId });

    res.json({
      success: true,
      message: 'Chat unflagged successfully',
      data: session,
    });
  } catch (error) {
    console.error('Unflag session error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};

/**
 * Transfer chat session to another operator
 * POST /api/chat/sessions/:sessionId/transfer
 */
export const transferSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { toOperatorId, reason } = req.body;

    if (!toOperatorId) {
      return res.status(400).json({
        error: { message: 'Target operator ID is required' },
      });
    }

    // Get current session
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        operator: {
          select: { id: true, name: true },
        },
      },
    });

    if (!session) {
      return res.status(404).json({
        error: { message: 'Chat session not found' },
      });
    }

    // Get target operator
    const targetOperator = await prisma.operator.findUnique({
      where: { id: toOperatorId },
      select: { id: true, name: true, isOnline: true, isAvailable: true },
    });

    if (!targetOperator) {
      return res.status(404).json({
        error: { message: 'Target operator not found' },
      });
    }

    if (!targetOperator.isOnline || !targetOperator.isAvailable) {
      return res.status(400).json({
        error: { message: 'Target operator is not available' },
      });
    }

    // Parse messages and add system message
    const messages = JSON.parse(session.messages || '[]');
    const transferMessage = {
      id: Date.now().toString(),
      type: 'system',
      content: `Chat trasferita da ${session.operator?.name || 'operatore'} a ${targetOperator.name}${reason ? `. Motivo: ${reason}` : ''}`,
      timestamp: new Date().toISOString(),
    };
    messages.push(transferMessage);

    // Update session
    const updatedSession = await prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        operatorId: toOperatorId,
        messages: JSON.stringify(messages),
      },
      include: {
        operator: {
          select: { id: true, name: true },
        },
      },
    });

    // Notify both operators via WebSocket
    io.to(`operator:${session.operatorId}`).emit('chat_transferred_from_you', {
      sessionId,
      toOperator: targetOperator,
      reason,
    });

    io.to(`operator:${toOperatorId}`).emit('chat_transferred_to_you', {
      sessionId,
      fromOperator: session.operator,
      reason,
    });

    // Notify dashboard
    io.to('dashboard').emit('chat_transferred', {
      sessionId,
      fromOperatorId: session.operatorId,
      toOperatorId,
    });

    res.json({
      success: true,
      message: 'Chat transferred successfully',
      data: updatedSession,
    });
  } catch (error) {
    console.error('Transfer session error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};
