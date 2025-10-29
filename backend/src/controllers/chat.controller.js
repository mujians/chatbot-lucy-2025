import { prisma } from '../server.js';
import { io } from '../server.js';
import { generateAIResponse } from '../services/openai.service.js';
import { emailService } from '../services/email.service.js';
import { uploadService } from '../services/upload.service.js';

/**
 * Create new chat session
 * POST /api/chat/session
 */
export const createSession = async (req, res) => {
  try {
    const { userName, userEmail } = req.body;

    // P0.2: Find or create user if email provided
    let userId = null;
    if (userEmail) {
      let user = await prisma.user.findUnique({
        where: { email: userEmail },
      });

      if (!user) {
        // Create new user
        user = await prisma.user.create({
          data: {
            email: userEmail,
            name: userName || null,
            totalChats: 1,
          },
        });
        console.log(`✅ P0.2: New user created: ${userEmail}`);
      } else {
        // Update existing user
        await prisma.user.update({
          where: { id: user.id },
          data: {
            lastSeenAt: new Date(),
            totalChats: { increment: 1 },
            ...(userName && { name: userName }),
          },
        });
        console.log(`✅ P0.2: Existing user updated: ${userEmail}`);
      }
      userId = user.id;
    }

    const session = await prisma.chatSession.create({
      data: {
        userName: userName || null,
        userEmail: userEmail || null, // P0.4: For email transcript
        userId: userId, // P0.2: Link to user
        status: 'ACTIVE',
        messages: JSON.stringify([]),
      },
    });

    // Notify dashboard of new chat
    io.to('dashboard').emit('new_chat_created', {
      sessionId: session.id,
      userName: session.userName,
      status: session.status,
      createdAt: session.createdAt,
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
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            totalChats: true,
            firstSeenAt: true,
            lastSeenAt: true,
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
      include: {
        operator: {
          select: { id: true, name: true, email: true }
        }
      }
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

    // Update session (P13: increment unread count if WITH_OPERATOR)
    await prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        messages: JSON.stringify(messages),
        lastMessageAt: new Date(),
        ...(session.status === 'WITH_OPERATOR' && session.operatorId
          ? { unreadMessageCount: { increment: 1 } }
          : {}),
      },
    });

    // If status is WITH_OPERATOR, forward to operator via WebSocket
    if (session.status === 'WITH_OPERATOR' && session.operatorId) {
      io.to(`operator_${session.operatorId}`).emit('user_message', {
        sessionId: sessionId,
        userName: session.userName,
        message: userMessage,
        unreadCount: session.unreadMessageCount + 1,  // P13: send unread count
      });

      return res.json({
        success: true,
        data: {
          message: userMessage,
          aiResponse: null,
          withOperator: true,
          operatorName: session.operator?.name || 'Operatore'
        },
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

    // Find available operators (only check isAvailable - isOnline removed)
    const availableOperators = await prisma.operator.findMany({
      where: {
        isAvailable: true,   // Operator marked as available
      },
      orderBy: { totalChatsHandled: 'asc' }, // Least busy first
    });

    console.log(`✅ AVAILABLE OPERATORS: ${availableOperators.length} found`);

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
    io.to(`operator_${assignedOperator.id}`).emit('new_chat_request', {
      sessionId: sessionId,
      userName: session.userName,
      lastMessage: messages[messages.length - 2]?.content || '',
    });

    // Notify dashboard
    io.to('dashboard').emit('chat_assigned', {
      sessionId: sessionId,
      operatorId: assignedOperator.id,
    });

    // Notify widget user that operator joined
    io.to(`chat_${sessionId}`).emit('operator_assigned', {
      sessionId: sessionId,
      operatorName: assignedOperator.name,
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
 * Send operator message to user
 * POST /api/chat/session/:sessionId/operator-message
 */
export const sendOperatorMessage = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { message, operatorId } = req.body;

    if (!message) {
      return res.status(400).json({
        error: { message: 'Message is required' },
      });
    }

    // Get session
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        operator: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    if (!session) {
      return res.status(404).json({
        error: { message: 'Session not found' },
      });
    }

    // Parse messages
    const messages = JSON.parse(session.messages || '[]');

    // Add operator message
    const operatorMessage = {
      id: Date.now().toString(),
      type: 'operator',
      content: message,
      timestamp: new Date().toISOString(),
      operatorId: operatorId || session.operatorId,
      operatorName: session.operator?.name || 'Operatore',
    };

    messages.push(operatorMessage);

    // Update session
    await prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        messages: JSON.stringify(messages),
        lastMessageAt: new Date(),
      },
    });

    // Emit to user via Socket.IO
    io.to(`chat_${sessionId}`).emit('operator_message', {
      sessionId: sessionId,
      message: operatorMessage,
    });

    console.log(`📤 Operator message sent to session ${sessionId}`);

    res.json({
      success: true,
      data: { message: operatorMessage },
    });
  } catch (error) {
    console.error('Send operator message error:', error);
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

    // Get session first to add closing message
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return res.status(404).json({
        error: { message: 'Session not found' },
      });
    }

    // Parse existing messages
    const messages = JSON.parse(session.messages || '[]');

    // Add system closing message
    const closingMessage = {
      id: Date.now().toString(),
      type: 'system',
      content: 'La chat è stata chiusa dall\'operatore. Grazie per averci contattato!',
      timestamp: new Date().toISOString(),
    };
    messages.push(closingMessage);

    // Update session with closing message
    const updatedSession = await prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        messages: JSON.stringify(messages),
      },
    });

    // P0.4: Send chat transcript email if user provided email
    if (updatedSession.userEmail) {
      try {
        await emailService.sendChatTranscript(updatedSession.userEmail, updatedSession);
        console.log(`✅ P0.4: Chat transcript sent to ${updatedSession.userEmail}`);
      } catch (emailError) {
        console.error('Failed to send chat transcript:', emailError);
        // Don't fail the request if email fails
      }
    }

    // If had operator, increment their stats
    if (session.operatorId) {
      await prisma.operator.update({
        where: { id: session.operatorId },
        data: {
          totalChatsHandled: { increment: 1 },
        },
      });
    }

    // Notify via WebSocket with the closing message
    io.to(`chat_${sessionId}`).emit('chat_closed', {
      sessionId: sessionId,
      message: closingMessage,
    });

    // Also emit new message event for the widget
    io.to(`chat_${sessionId}`).emit('new_message', closingMessage);

    res.json({
      success: true,
      data: updatedSession,
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
    io.to(`operator_${session.operatorId}`).emit('chat_transferred_from_you', {
      sessionId,
      toOperator: targetOperator,
      reason,
    });

    io.to(`operator_${toOperatorId}`).emit('chat_transferred_to_you', {
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

/**
 * Mark messages as read (P13)
 * POST /api/chat/session/:sessionId/mark-read
 */
export const markMessagesAsRead = async (req, res) => {
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

    // Reset unread count
    await prisma.chatSession.update({
      where: { id: sessionId },
      data: { unreadMessageCount: 0 },
    });

    console.log(`✅ Messages marked as read for session ${sessionId}`);

    res.json({
      success: true,
      message: 'Messages marked as read',
    });
  } catch (error) {
    console.error('Mark messages as read error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};

/**
 * P1.8: Update chat priority
 * PUT /api/chat/sessions/:sessionId/priority
 */
export const updatePriority = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { priority } = req.body;

    // Validate priority
    const validPriorities = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({
        error: { message: 'Invalid priority. Must be: LOW, NORMAL, HIGH, or URGENT' },
      });
    }

    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return res.status(404).json({
        error: { message: 'Session not found' },
      });
    }

    const updated = await prisma.chatSession.update({
      where: { id: sessionId },
      data: { priority },
    });

    console.log(`✅ Chat ${sessionId} priority updated to ${priority}`);

    res.json({
      success: true,
      data: { session: updated },
      message: 'Priority updated successfully',
    });
  } catch (error) {
    console.error('Update priority error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};

/**
 * P1.8: Update chat tags
 * PUT /api/chat/sessions/:sessionId/tags
 */
export const updateTags = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { tags } = req.body;

    // Validate tags
    if (!Array.isArray(tags)) {
      return res.status(400).json({
        error: { message: 'Tags must be an array of strings' },
      });
    }

    // Validate each tag is a string
    if (!tags.every((tag) => typeof tag === 'string')) {
      return res.status(400).json({
        error: { message: 'All tags must be strings' },
      });
    }

    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return res.status(404).json({
        error: { message: 'Session not found' },
      });
    }

    const updated = await prisma.chatSession.update({
      where: { id: sessionId },
      data: { tags: JSON.stringify(tags) },
    });

    console.log(`✅ Chat ${sessionId} tags updated to ${tags.join(', ')}`);

    res.json({
      success: true,
      data: { session: updated },
      message: 'Tags updated successfully',
    });
  } catch (error) {
    console.error('Update tags error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};

/**
 * P0.3: Add internal note to chat
 * POST /api/chat/sessions/:sessionId/notes
 */
export const addInternalNote = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { content } = req.body;

    if (!content || content.trim() === '') {
      return res.status(400).json({
        error: { message: 'Note content is required' },
      });
    }

    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return res.status(404).json({
        error: { message: 'Session not found' },
      });
    }

    const notes = JSON.parse(session.internalNotes || '[]');

    const newNote = {
      id: Date.now().toString(),
      content: content.trim(),
      operatorId: req.operator.id,
      operatorName: req.operator.name,
      createdAt: new Date().toISOString(),
    };

    notes.push(newNote);

    const updated = await prisma.chatSession.update({
      where: { id: sessionId },
      data: { internalNotes: JSON.stringify(notes) },
    });

    console.log(`✅ P0.3: Internal note added to chat ${sessionId} by ${req.operator.name}`);

    res.json({
      success: true,
      data: { note: newNote, session: updated },
      message: 'Internal note added successfully',
    });
  } catch (error) {
    console.error('Add internal note error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};

/**
 * P0.3: Update internal note
 * PUT /api/chat/sessions/:sessionId/notes/:noteId
 */
export const updateInternalNote = async (req, res) => {
  try {
    const { sessionId, noteId } = req.params;
    const { content } = req.body;

    if (!content || content.trim() === '') {
      return res.status(400).json({
        error: { message: 'Note content is required' },
      });
    }

    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return res.status(404).json({
        error: { message: 'Session not found' },
      });
    }

    const notes = JSON.parse(session.internalNotes || '[]');
    const noteIndex = notes.findIndex((n) => n.id === noteId);

    if (noteIndex === -1) {
      return res.status(404).json({
        error: { message: 'Note not found' },
      });
    }

    // Only allow operator to edit their own notes
    if (notes[noteIndex].operatorId !== req.operator.id) {
      return res.status(403).json({
        error: { message: 'You can only edit your own notes' },
      });
    }

    notes[noteIndex].content = content.trim();
    notes[noteIndex].updatedAt = new Date().toISOString();

    const updated = await prisma.chatSession.update({
      where: { id: sessionId },
      data: { internalNotes: JSON.stringify(notes) },
    });

    console.log(`✅ P0.3: Internal note ${noteId} updated in chat ${sessionId}`);

    res.json({
      success: true,
      data: { note: notes[noteIndex], session: updated },
      message: 'Internal note updated successfully',
    });
  } catch (error) {
    console.error('Update internal note error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};

/**
 * P0.3: Delete internal note
 * DELETE /api/chat/sessions/:sessionId/notes/:noteId
 */
export const deleteInternalNote = async (req, res) => {
  try {
    const { sessionId, noteId } = req.params;

    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return res.status(404).json({
        error: { message: 'Session not found' },
      });
    }

    const notes = JSON.parse(session.internalNotes || '[]');
    const noteIndex = notes.findIndex((n) => n.id === noteId);

    if (noteIndex === -1) {
      return res.status(404).json({
        error: { message: 'Note not found' },
      });
    }

    // Only allow operator to delete their own notes
    if (notes[noteIndex].operatorId !== req.operator.id) {
      return res.status(403).json({
        error: { message: 'You can only delete your own notes' },
      });
    }

    notes.splice(noteIndex, 1);

    const updated = await prisma.chatSession.update({
      where: { id: sessionId },
      data: { internalNotes: JSON.stringify(notes) },
    });

    console.log(`✅ P0.3: Internal note ${noteId} deleted from chat ${sessionId}`);

    res.json({
      success: true,
      data: { session: updated },
      message: 'Internal note deleted successfully',
    });
  } catch (error) {
    console.error('Delete internal note error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};

/**
 * P0.2: Get user history (all chat sessions for a user)
 * GET /api/chat/users/:userId/history
 */
export const getUserHistory = async (req, res) => {
  try {
    const { userId } = req.params;

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        error: { message: 'User not found' },
      });
    }

    // Get all chat sessions for this user
    const sessions = await prisma.chatSession.findMany({
      where: { userId: userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        createdAt: true,
        closedAt: true,
        lastMessageAt: true,
        operatorId: true,
        operator: {
          select: {
            name: true,
          },
        },
        messages: true,
        priority: true,
        tags: true,
        aiConfidence: true,
      },
    });

    // Parse messages for each session
    const sessionsWithParsedMessages = sessions.map((session) => ({
      ...session,
      messages: JSON.parse(session.messages || '[]'),
      messageCount: JSON.parse(session.messages || '[]').length,
    }));

    console.log(`✅ P0.2: User history loaded for ${user.email || userId} (${sessions.length} sessions)`);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          totalChats: user.totalChats,
          firstSeenAt: user.firstSeenAt,
          lastSeenAt: user.lastSeenAt,
        },
        sessions: sessionsWithParsedMessages,
      },
      message: 'User history retrieved successfully',
    });
  } catch (error) {
    console.error('Get user history error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};

/**
 * P0.1: Upload file attachment
 * POST /api/chat/sessions/:sessionId/upload
 */
export const uploadFile = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        error: { message: 'No file uploaded' },
      });
    }

    // Check session exists
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return res.status(404).json({
        error: { message: 'Session not found' },
      });
    }

    // Upload to Cloudinary
    const uploadResult = await uploadService.uploadFile(
      file.buffer,
      file.originalname,
      file.mimetype
    );

    // Create message with file attachment
    const messages = JSON.parse(session.messages || '[]');
    const isOperator = !!req.operator; // Check if authenticated (operator) or public (user)

    const newMessage = {
      id: Date.now().toString(),
      type: isOperator ? 'operator' : 'user',
      content: `📎 ${file.originalname}`,
      attachment: {
        url: uploadResult.url,
        publicId: uploadResult.publicId,
        originalName: uploadResult.originalName,
        mimetype: uploadResult.mimetype,
        size: uploadResult.bytes,
        resourceType: uploadResult.resourceType,
        ...(uploadResult.width && { width: uploadResult.width }),
        ...(uploadResult.height && { height: uploadResult.height }),
      },
      timestamp: new Date().toISOString(),
      ...(isOperator && { operatorName: req.operator.name, operatorId: req.operator.id }),
    };

    messages.push(newMessage);

    // Update session
    await prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        messages: JSON.stringify(messages),
        lastMessageAt: new Date(),
      },
    });

    // Emit via WebSocket
    const eventName = isOperator ? 'operator_message' : 'user_message';
    io.to(`chat_${sessionId}`).emit(eventName, {
      sessionId: sessionId,
      message: newMessage,
    });

    console.log(`✅ P0.1: File uploaded for session ${sessionId}: ${file.originalname}`);

    res.json({
      success: true,
      data: {
        message: newMessage,
        uploadResult: uploadResult,
      },
      message: 'File uploaded successfully',
    });
  } catch (error) {
    console.error('Upload file error:', error);
    res.status(500).json({
      error: { message: error.message || 'Internal server error' },
    });
  }
};

/**
 * P1.2: Submit chat rating (CSAT)
 * POST /api/chat/sessions/:sessionId/rating
 * Body: { rating: 1-5, comment?: string }
 */
export const submitRating = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { rating, comment } = req.body;

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        error: { message: 'Rating must be between 1 and 5' },
      });
    }

    // Get session
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        operator: true,
        user: true,
      },
    });

    if (!session) {
      return res.status(404).json({
        error: { message: 'Session not found' },
      });
    }

    // Check if rating already exists
    const existingRating = await prisma.chatRating.findUnique({
      where: { sessionId: sessionId },
    });

    if (existingRating) {
      return res.status(400).json({
        error: { message: 'Rating already submitted for this session' },
      });
    }

    // Create rating
    const chatRating = await prisma.chatRating.create({
      data: {
        sessionId: sessionId,
        rating: rating,
        comment: comment || null,
        userId: session.userId || null,
        userEmail: session.userEmail || null,
        operatorId: session.operatorId || null,
        operatorName: session.operator?.name || null,
      },
    });

    console.log(`✅ P1.2: Rating ${rating}⭐ submitted for session ${sessionId}`);

    res.json({
      success: true,
      data: { rating: chatRating },
      message: 'Rating submitted successfully',
    });
  } catch (error) {
    console.error('Submit rating error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};

/**
 * P1.2: Get ratings analytics
 * GET /api/chat/ratings/analytics
 * Query params: ?operatorId=xxx, ?startDate=xxx, ?endDate=xxx
 */
export const getRatingsAnalytics = async (req, res) => {
  try {
    const { operatorId, startDate, endDate } = req.query;

    // Build where clause
    const where = {};
    if (operatorId) where.operatorId = operatorId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    // Get all ratings
    const ratings = await prisma.chatRating.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        session: {
          select: {
            id: true,
            userName: true,
            userEmail: true,
          },
        },
      },
    });

    // Calculate stats
    const totalRatings = ratings.length;
    const averageRating = totalRatings > 0
      ? ratings.reduce((sum, r) => sum + r.rating, 0) / totalRatings
      : 0;

    // Rating distribution
    const distribution = {
      1: ratings.filter((r) => r.rating === 1).length,
      2: ratings.filter((r) => r.rating === 2).length,
      3: ratings.filter((r) => r.rating === 3).length,
      4: ratings.filter((r) => r.rating === 4).length,
      5: ratings.filter((r) => r.rating === 5).length,
    };

    // Per operator stats
    const operatorStats = {};
    ratings.forEach((r) => {
      if (r.operatorId) {
        if (!operatorStats[r.operatorId]) {
          operatorStats[r.operatorId] = {
            operatorId: r.operatorId,
            operatorName: r.operatorName,
            totalRatings: 0,
            sumRatings: 0,
            averageRating: 0,
          };
        }
        operatorStats[r.operatorId].totalRatings++;
        operatorStats[r.operatorId].sumRatings += r.rating;
      }
    });

    // Calculate averages
    Object.values(operatorStats).forEach((stat) => {
      stat.averageRating = stat.sumRatings / stat.totalRatings;
    });

    res.json({
      success: true,
      data: {
        totalRatings,
        averageRating: Math.round(averageRating * 10) / 10,
        distribution,
        operatorStats: Object.values(operatorStats),
        ratings: ratings.slice(0, 50), // Last 50 ratings
      },
    });
  } catch (error) {
    console.error('Get ratings analytics error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};
