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

    // Check if any operators are online
    const onlineOperators = await prisma.operator.findMany({
      where: { isOnline: true },
      orderBy: { totalChatsHandled: 'asc' }, // Least busy first
    });

    if (onlineOperators.length === 0) {
      // No operators online - suggest ticket
      return res.json({
        success: true,
        data: {
          operatorAvailable: false,
          message: 'Nessun operatore disponibile. Vuoi aprire un ticket?',
        },
      });
    }

    // Assign to least busy operator
    const assignedOperator = onlineOperators[0];

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
 * GET /api/chat/sessions
 */
export const getSessions = async (req, res) => {
  try {
    const { status, operatorId } = req.query;

    const where = {};
    if (status) where.status = status;
    if (operatorId) where.operatorId = operatorId;

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
      take: 50,
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
