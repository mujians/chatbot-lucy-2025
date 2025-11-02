import { prisma } from '../server.js';
import { io } from '../server.js';
import { generateAIResponse } from '../services/openai.service.js';
import { emailService } from '../services/email.service.js';
import { uploadService } from '../services/upload.service.js';
import { startOperatorResponseTimeout, cancelOperatorResponseTimeout, startWaitingTimeout, cancelWaitingTimeout } from '../services/websocket.service.js';

// Rate limiting: Track message timestamps per session
// Map<sessionId, timestamp[]>
const messageRateLimits = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_MESSAGES = 10; // Max 10 messages per minute
const SPAM_THRESHOLD = 20; // Notify operator if > 20 msg/min

// Track if we already notified operator about spam (Map<sessionId, boolean>)
const spamNotified = new Map();

/**
 * Check if session has exceeded rate limit
 * Returns { allowed: boolean, remaining: number, spam: boolean }
 */
function checkRateLimit(sessionId, session = null) {
  const now = Date.now();

  // Get existing timestamps for this session
  let timestamps = messageRateLimits.get(sessionId) || [];

  // Remove timestamps older than 1 minute
  timestamps = timestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW);

  // Check if this is spam (>20 msg/min) and notify operator
  if (timestamps.length >= SPAM_THRESHOLD && !spamNotified.has(sessionId)) {
    spamNotified.set(sessionId, true);

    // Notify operator if session has one
    if (session && session.operatorId) {
      io.to(`operator_${session.operatorId}`).emit('user_spam_detected', {
        sessionId: sessionId,
        userName: session.userName || 'Utente',
        messageCount: timestamps.length,
        message: `Possibile spam: ${timestamps.length} messaggi nell'ultimo minuto`,
        timestamp: new Date().toISOString(),
      });
      console.log(`🚨 Spam detected in session ${sessionId}: ${timestamps.length} messages/min`);
    }
  }

  // Check if limit exceeded (normal rate limit at 10 msg/min)
  if (timestamps.length >= RATE_LIMIT_MAX_MESSAGES) {
    messageRateLimits.set(sessionId, timestamps);
    return {
      allowed: false,
      remaining: 0,
      resetIn: RATE_LIMIT_WINDOW - (now - timestamps[0]),
      spam: timestamps.length >= SPAM_THRESHOLD
    };
  }

  // Add current timestamp
  timestamps.push(now);
  messageRateLimits.set(sessionId, timestamps);

  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX_MESSAGES - timestamps.length,
    spam: false
  };
}

/**
 * v2.3.3: Extract user name from message content
 * Detects if a message looks like a name response
 * Returns the extracted name or null
 */
function extractUserName(messageContent) {
  if (!messageContent || typeof messageContent !== 'string') {
    return null;
  }

  const trimmed = messageContent.trim();

  // Skip if message is too long (likely not just a name)
  if (trimmed.length > 50) {
    return null;
  }

  // Skip if message contains typical conversation phrases
  const conversationPhrases = [
    'ciao', 'salve', 'buongiorno', 'buonasera', 'grazie', 'prego',
    'aiuto', 'help', 'problema', 'non funziona', 'come', 'cosa',
    'quando', 'dove', 'perché', 'vorrei', 'ho bisogno', 'mi serve'
  ];

  const lowerMessage = trimmed.toLowerCase();
  if (conversationPhrases.some(phrase => lowerMessage.includes(phrase))) {
    return null;
  }

  // Common patterns for name responses
  const namePatterns = [
    /^(?:mi chiamo|sono|il mio nome è|chiamami)\s+([a-zA-ZÀ-ÿ\s]+)$/i,
    /^([a-zA-ZÀ-ÿ]+(?:\s+[a-zA-ZÀ-ÿ]+){0,2})$/  // 1-3 words with letters only
  ];

  for (const pattern of namePatterns) {
    const match = trimmed.match(pattern);
    if (match) {
      const name = match[1] || match[0];
      // Capitalize first letter of each word
      return name.trim()
        .split(/\s+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    }
  }

  return null;
}

/**
 * BUG #6: Create single message in Message table with transaction
 * Replaces addMessageWithLock for new Message model
 */
async function createMessage(sessionId, messageData, additionalSessionData = {}) {
  return await prisma.$transaction(async (tx) => {
    // Step 1: Lock the session row with FOR UPDATE
    // Cast column to text instead of casting parameter to uuid
    const session = await tx.$queryRaw`
      SELECT * FROM "ChatSession"
      WHERE id::text = ${sessionId}
      FOR UPDATE
    `;

    if (!session || session.length === 0) {
      throw new Error('Session not found');
    }

    // Step 2: Create message in Message table
    const message = await tx.message.create({
      data: {
        sessionId,
        type: messageData.type,
        content: messageData.content,
        operatorId: messageData.operatorId || null,
        operatorName: messageData.operatorName || null,
        aiConfidence: messageData.aiConfidence || null,
        aiSuggestOperator: messageData.aiSuggestOperator || false,
        attachmentUrl: messageData.attachmentUrl || null,
        attachmentPublicId: messageData.attachmentPublicId || null,
        attachmentName: messageData.attachmentName || null,
        attachmentMimetype: messageData.attachmentMimetype || null,
        attachmentResourceType: messageData.attachmentResourceType || null,
        attachmentSize: messageData.attachmentSize || null,
      },
    });

    // Step 3: Update session with additional data
    const updated = await tx.chatSession.update({
      where: { id: sessionId },
      data: {
        lastMessageAt: new Date(),
        ...additionalSessionData,
      },
    });

    return { message, session: updated };
  });
}

/**
 * BUG #6: Create multiple messages in Message table with transaction
 * Replaces addMessagesWithLock for new Message model
 */
async function createMessages(sessionId, messagesData, additionalSessionData = {}) {
  return await prisma.$transaction(async (tx) => {
    // Step 1: Lock the session row with FOR UPDATE
    // Cast column to text instead of casting parameter to uuid
    const session = await tx.$queryRaw`
      SELECT * FROM "ChatSession"
      WHERE id::text = ${sessionId}
      FOR UPDATE
    `;

    if (!session || session.length === 0) {
      throw new Error('Session not found');
    }

    // Step 2: Create all messages in Message table
    const messages = await Promise.all(
      messagesData.map((messageData) =>
        tx.message.create({
          data: {
            sessionId,
            type: messageData.type,
            content: messageData.content,
            operatorId: messageData.operatorId || null,
            operatorName: messageData.operatorName || null,
            aiConfidence: messageData.aiConfidence || null,
            aiSuggestOperator: messageData.aiSuggestOperator || false,
            attachmentUrl: messageData.attachmentUrl || null,
            attachmentPublicId: messageData.attachmentPublicId || null,
            attachmentName: messageData.attachmentName || null,
            attachmentMimetype: messageData.attachmentMimetype || null,
            attachmentResourceType: messageData.attachmentResourceType || null,
            attachmentSize: messageData.attachmentSize || null,
          },
        })
      )
    );

    // Step 3: Update session with additional data
    const updated = await tx.chatSession.update({
      where: { id: sessionId },
      data: {
        lastMessageAt: new Date(),
        ...additionalSessionData,
      },
    });

    return { messages, session: updated };
  });
}

/**
 * BUG #5 FIX: Add internal note with pessimistic locking
 * Prevents race conditions when multiple operators add notes simultaneously
 */
async function addInternalNoteWithLock(sessionId, newNote) {
  return await prisma.$transaction(async (tx) => {
    // Step 1: Lock the session row with FOR UPDATE
    const session = await tx.$queryRaw`
      SELECT * FROM "ChatSession"
      WHERE id = ${sessionId}::uuid
      FOR UPDATE
    `;

    if (!session || session.length === 0) {
      throw new Error('Session not found');
    }

    // Step 2: Parse existing notes safely
    const notes = JSON.parse(session[0].internalNotes || '[]');

    // Step 3: Add new note
    notes.push(newNote);

    // Step 4: Update with new notes array
    const updated = await tx.chatSession.update({
      where: { id: sessionId },
      data: { internalNotes: JSON.stringify(notes) },
    });

    return updated;
  });
}

/**
 * BUG #5 FIX: Update internal note with pessimistic locking
 * Prevents race conditions when modifying notes
 */
async function updateInternalNoteWithLock(sessionId, noteId, updatedContent) {
  return await prisma.$transaction(async (tx) => {
    // Step 1: Lock the session row with FOR UPDATE
    const session = await tx.$queryRaw`
      SELECT * FROM "ChatSession"
      WHERE id = ${sessionId}::uuid
      FOR UPDATE
    `;

    if (!session || session.length === 0) {
      throw new Error('Session not found');
    }

    // Step 2: Parse existing notes safely
    const notes = JSON.parse(session[0].internalNotes || '[]');

    // Step 3: Find and update the note
    const noteIndex = notes.findIndex(note => note.id === noteId);
    if (noteIndex === -1) {
      throw new Error('Note not found');
    }

    notes[noteIndex] = {
      ...notes[noteIndex],
      content: updatedContent,
      updatedAt: new Date().toISOString(),
    };

    // Step 4: Update with modified notes array
    const updated = await tx.chatSession.update({
      where: { id: sessionId },
      data: { internalNotes: JSON.stringify(notes) },
    });

    return updated;
  });
}

/**
 * AUDIT FIX: Delete internal note with pessimistic locking
 * Prevents race conditions when deleting notes (matches add/update pattern)
 */
async function deleteInternalNoteWithLock(sessionId, noteId) {
  return await prisma.$transaction(async (tx) => {
    // Step 1: Lock the session row with FOR UPDATE
    const session = await tx.$queryRaw`
      SELECT * FROM "ChatSession"
      WHERE id = ${sessionId}::uuid
      FOR UPDATE
    `;

    if (!session || session.length === 0) {
      throw new Error('Session not found');
    }

    // Step 2: Parse existing notes safely
    const notes = JSON.parse(session[0].internalNotes || '[]');

    // Step 3: Find and remove the note
    const noteIndex = notes.findIndex(note => note.id === noteId);
    if (noteIndex === -1) {
      throw new Error('Note not found');
    }

    // Remove note from array
    notes.splice(noteIndex, 1);

    // Step 4: Update with modified notes array
    const updated = await tx.chatSession.update({
      where: { id: sessionId },
      data: { internalNotes: JSON.stringify(notes) },
    });

    return updated;
  });
}

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

    // Notify dashboard of new chat (AI chat)
    io.to('dashboard').emit('new_chat_created', {
      sessionId: session.id,
      userName: session.userName,
      status: session.status,
      createdAt: session.createdAt,
    });

    // Also emit specific AI chat event for monitoring
    io.to('dashboard').emit('ai_chat_active', {
      sessionId: session.id,
      userName: session.userName,
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
 * Get active AI chat sessions
 * GET /api/chat/sessions/active
 */
export const getActiveSessions = async (req, res) => {
  try {
    const activeSessions = await prisma.chatSession.findMany({
      where: {
        status: 'ACTIVE',
      },
      select: {
        id: true,
        userName: true,
        createdAt: true,
        updatedAt: true,
        messages: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    // Parse messages and get last message for each session
    const sessionsWithLastMessage = activeSessions.map(session => {
      const messages = JSON.parse(session.messages || '[]');
      const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;

      return {
        id: session.id,
        userName: session.userName || 'Utente',
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        lastMessage: lastMessage ? {
          content: lastMessage.content?.substring(0, 100) || '',
          timestamp: lastMessage.timestamp
        } : null,
        messageCount: messages.length,
      };
    });

    res.json({
      success: true,
      data: sessionsWithLastMessage,
    });
  } catch (error) {
    console.error('Get active sessions error:', error);
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

    // Check session age - reject if older than 7 days
    const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
    const sessionAge = Date.now() - new Date(session.createdAt).getTime();
    if (sessionAge > SESSION_MAX_AGE) {
      console.log(`⚠️ Session ${sessionId} expired (age: ${Math.floor(sessionAge / (24 * 60 * 60 * 1000))} days)`);
      return res.status(410).json({
        error: { message: 'Session expired', code: 'SESSION_EXPIRED' },
      });
    }

    // Check if operator is currently online (WebSocket connected)
    let operatorOnline = false;
    if (session.operatorId && session.status === 'WITH_OPERATOR') {
      const operatorRoom = `operator_${session.operatorId}`;
      const operatorSockets = io.sockets.adapter.rooms.get(operatorRoom);
      operatorOnline = operatorSockets && operatorSockets.size > 0;
      console.log(`🔍 Operator ${session.operatorId} online check: ${operatorOnline} (${operatorSockets?.size || 0} sockets)`);
    }

    res.json({
      success: true,
      data: {
        ...session,
        operatorOnline,
      },
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

    // Get session first (for spam detection)
    let session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        operatorId: true,
        userName: true,
        status: true,
      },
    });

    if (!session) {
      return res.status(404).json({
        error: { message: 'Session not found' },
      });
    }

    // v2.3.3: Extract and save user name if not already set
    if (!session.userName && session.status === 'WITH_OPERATOR') {
      const extractedName = extractUserName(message);
      if (extractedName) {
        console.log(`📝 Extracted user name: "${extractedName}" from session ${sessionId}`);

        // Update session with userName
        session = await prisma.chatSession.update({
          where: { id: sessionId },
          data: { userName: extractedName },
          select: {
            id: true,
            operatorId: true,
            userName: true,
            status: true,
          },
        });

        // Notify operator that we captured the name
        if (session.operatorId) {
          io.to(`operator_${session.operatorId}`).emit('user_name_captured', {
            sessionId: sessionId,
            userName: extractedName,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    // Check rate limit (pass session for spam detection)
    const rateLimit = checkRateLimit(sessionId, session);
    if (!rateLimit.allowed) {
      const resetInSeconds = Math.ceil(rateLimit.resetIn / 1000);
      console.log(`⚠️ Rate limit exceeded for session ${sessionId} - ${resetInSeconds}s until reset`);
      return res.status(429).json({
        error: {
          message: 'Rallenta, per favore. Troppi messaggi inviati.',
          code: 'RATE_LIMIT_EXCEEDED',
          resetIn: resetInSeconds
        }
      });
    }

    // Get full session with operator details
    const fullSession = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        operator: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    if (!fullSession) {
      return res.status(404).json({
        error: { message: 'Session not found' },
      });
    }

    // If status is WITH_OPERATOR, add user message and forward to operator
    if (fullSession.status === 'WITH_OPERATOR' && fullSession.operatorId) {
      // BUG #6: Create message in Message table with transaction
      const result = await createMessage(sessionId, {
        type: 'USER',
        content: message,
      }, {
        unreadMessageCount: { increment: 1 },
      });

      // Convert to legacy format for Socket.IO
      const userMessage = {
        id: result.message.id,
        type: 'user',
        content: result.message.content,
        timestamp: result.message.createdAt.toISOString(),
      };

      // Emit to operator's personal room
      io.to(`operator_${fullSession.operatorId}`).emit('user_message', {
        sessionId: sessionId,
        userName: fullSession.userName,
        message: userMessage,
        unreadCount: fullSession.unreadMessageCount + 1,
      });

      // Also emit to chat room (for dashboard ChatWindow)
      io.to(`chat_${sessionId}`).emit('user_message', {
        sessionId: sessionId,
        userName: fullSession.userName,
        message: userMessage,
      });

      return res.json({
        success: true,
        data: {
          message: userMessage,
          aiResponse: null,
          withOperator: true,
          operatorName: fullSession.operator?.name || 'Operatore'
        },
      });
    }

    // Otherwise, generate AI response
    // BUG #6: Read messages from Message table instead of JSON
    // AUDIT FIX: Limit to last 50 messages for AI context (performance optimization)
    const existingMessages = await prisma.message.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        type: true,
        content: true,
        aiConfidence: true,
        aiSuggestOperator: true,
      },
    });

    // Reverse to chronological order for AI service
    existingMessages.reverse();

    // Convert to legacy format for AI service
    const messagesForAI = existingMessages.map(m => ({
      type: m.type.toLowerCase(),
      content: m.content,
      confidence: m.aiConfidence,
      suggestOperator: m.aiSuggestOperator,
    }));

    const aiResult = await generateAIResponse(message, messagesForAI);

    // BUG #6: Create both user and AI messages in single transaction
    const result = await createMessages(sessionId, [
      {
        type: 'USER',
        content: message,
      },
      {
        type: 'AI',
        content: aiResult.message,
        aiConfidence: aiResult.confidence,
        aiSuggestOperator: aiResult.suggestOperator,
      },
    ]);

    // Convert to legacy format for response
    const userMessage = {
      id: result.messages[0].id,
      type: 'user',
      content: result.messages[0].content,
      timestamp: result.messages[0].createdAt.toISOString(),
    };

    const aiMessage = {
      id: result.messages[1].id,
      type: 'ai',
      content: result.messages[1].content,
      timestamp: result.messages[1].createdAt.toISOString(),
      confidence: result.messages[1].aiConfidence,
      suggestOperator: result.messages[1].aiSuggestOperator,
    };

    // P2.2: Emit WebSocket event to notify dashboard of AI chat activity
    // Replaces 30-second HTTP polling with real-time updates
    io.to('dashboard').emit('ai_chat_updated', {
      sessionId: sessionId,
      userName: fullSession.userName || 'Utente',
      lastMessage: aiMessage.content.substring(0, 100),
      timestamp: aiMessage.timestamp,
      messageCount: result.messages.length,
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
 * Cancel operator request (for user)
 * POST /api/chat/session/:sessionId/cancel-operator-request
 */
export const cancelOperatorRequest = async (req, res) => {
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

    if (session.status !== 'WAITING') {
      return res.status(400).json({
        error: { message: 'Session is not waiting for operator' },
      });
    }

    // Update session: revert to ACTIVE status
    await prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        status: 'ACTIVE',
        lastMessageAt: new Date(),
      },
    });

    // Notify dashboard: remove from pending list
    io.to('dashboard').emit('chat_request_cancelled', {
      sessionId: sessionId,
      reason: 'cancelled_by_user',
    });

    // Notify widget: request cancelled
    io.to(`chat_${sessionId}`).emit('operator_request_cancelled', {
      sessionId: sessionId,
      status: 'ACTIVE',
      message: 'Richiesta annullata. Puoi continuare a chattare con l\'assistente AI.',
    });

    console.log(`🚫 User cancelled operator request for session ${sessionId}`);

    res.json({
      success: true,
      data: {
        status: 'ACTIVE',
        message: 'Richiesta operatore annullata',
      },
    });
  } catch (error) {
    console.error('Cancel operator request error:', error);
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

    // Update session to WAITING status (don't auto-assign)
    await prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        status: 'WAITING',
        lastMessageAt: new Date(),
      },
    });

    // BUG #6: Get last user message from Message table for notification
    const lastUserMessage = await prisma.message.findFirst({
      where: {
        sessionId,
        type: 'USER',
      },
      orderBy: { createdAt: 'desc' },
      select: { content: true },
    });

    // Notify ALL available operators via WebSocket
    for (const operator of availableOperators) {
      io.to(`operator_${operator.id}`).emit('new_chat_request', {
        sessionId: sessionId,
        userName: session.userName || `Utente #${sessionId.slice(0, 8)}`,
        lastMessage: lastUserMessage?.content || '',
        timestamp: new Date().toISOString(),
      });
    }

    // Notify dashboard: chat waiting for operator
    io.to('dashboard').emit('chat_waiting_operator', {
      sessionId: sessionId,
      userName: session.userName || `Utente #${sessionId.slice(0, 8)}`,
      timestamp: new Date().toISOString(),
    });

    // Notify widget user that request was sent
    io.to(`chat_${sessionId}`).emit('operator_request_sent', {
      sessionId: sessionId,
      status: 'WAITING',
      message: 'Richiesta inviata. In attesa di un operatore...',
    });

    console.log(`⏳ Chat ${sessionId} waiting for operator (${availableOperators.length} available)`);

    // Start WAITING timeout (5 minutes)
    startWaitingTimeout(sessionId, io);

    res.json({
      success: true,
      data: {
        operatorAvailable: true,
        status: 'WAITING',
        message: 'Richiesta inviata. In attesa di un operatore...',
        availableOperators: availableOperators.length,
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
 * Operator intervenes in AI chat
 * POST /api/chat/sessions/:sessionId/operator-intervene
 */
export const operatorIntervene = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { operatorId } = req.body;

    if (!operatorId) {
      return res.status(400).json({
        error: { message: 'Operator ID is required' },
      });
    }

    // Get session
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return res.status(404).json({
        error: { message: 'Session not found' },
      });
    }

    // Verify session is ACTIVE (AI chat)
    if (session.status !== 'ACTIVE') {
      return res.status(400).json({
        error: { message: 'Can only intervene in active AI chats' },
      });
    }

    // Get operator details
    const operator = await prisma.operator.findUnique({
      where: { id: operatorId },
    });

    if (!operator) {
      return res.status(404).json({
        error: { message: 'Operator not found' },
      });
    }

    // Create system message and update session to WITH_OPERATOR
    const { message: systemMessage } = await createMessage(
      sessionId,
      {
        type: 'SYSTEM',
        content: `${operator.name} si è unito alla chat`,
      },
      {
        status: 'WITH_OPERATOR',
        operatorId: operatorId,
      }
    );

    // v2.3.3: Send automatic greeting message from operator
    const greetingMessage = await prisma.message.create({
      data: {
        sessionId: sessionId,
        type: 'OPERATOR',
        content: `Ciao! Dammi un attimo che controllo la conversazione. Intanto, come ti chiami?`,
        operatorId: operator.id,
      },
    });

    // Update operator stats
    await prisma.operator.update({
      where: { id: operatorId },
      data: {
        totalChatsHandled: { increment: 1 },
      },
    });

    // Notify widget: operator joined
    io.to(`chat_${sessionId}`).emit('operator_joined', {
      sessionId: sessionId,
      operatorName: operator.name,
      operatorId: operator.id,
      message: {
        id: systemMessage.id,
        type: systemMessage.type,
        content: systemMessage.content,
        timestamp: systemMessage.createdAt,
      },
    });

    // v2.3.3: Notify widget: automatic greeting message
    io.to(`chat_${sessionId}`).emit('operator_message', {
      sessionId: sessionId,
      message: {
        id: greetingMessage.id,
        type: greetingMessage.type,
        content: greetingMessage.content,
        timestamp: greetingMessage.createdAt,
        operatorId: operator.id,
        operatorName: operator.name,
      },
    });

    // Notify dashboard: AI chat taken
    io.to('dashboard').emit('ai_chat_intervened', {
      sessionId: sessionId,
      operatorId: operator.id,
      operatorName: operator.name,
    });

    console.log(`✅ Operator ${operator.name} intervened in AI chat ${sessionId}`);

    // Start operator response timeout
    startOperatorResponseTimeout(sessionId, io);

    res.json({
      success: true,
      data: {
        session: {
          id: sessionId,
          status: 'WITH_OPERATOR',
          operatorId: operator.id,
          operatorName: operator.name,
        },
      },
    });
  } catch (error) {
    console.error('Operator intervene error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};

/**
 * Accept operator request (for operators)
 * POST /api/chat/sessions/:sessionId/accept-operator
 */
export const acceptOperator = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { operatorId } = req.body;

    if (!operatorId) {
      return res.status(400).json({
        error: { message: 'Operator ID is required' },
      });
    }

    // Get operator details first
    const operator = await prisma.operator.findUnique({
      where: { id: operatorId },
    });

    if (!operator) {
      return res.status(404).json({
        error: { message: 'Operator not found' },
      });
    }

    // SECURITY FIX: Atomic check-and-set to prevent race condition
    // Try to update session only if status is WAITING (atomic operation)
    let session;
    try {
      session = await prisma.chatSession.updateMany({
        where: {
          id: sessionId,
          status: 'WAITING', // Only update if still WAITING
        },
        data: {
          status: 'WITH_OPERATOR',
          operatorId: operatorId,
        },
      });

      // Check if update was successful (count > 0 means session was found and updated)
      if (session.count === 0) {
        // Session not found OR already accepted by another operator
        const existingSession = await prisma.chatSession.findUnique({
          where: { id: sessionId },
          select: { id: true, status: true, operatorId: true },
        });

        if (!existingSession) {
          return res.status(404).json({
            error: { message: 'Session not found' },
          });
        }

        if (existingSession.status !== 'WAITING') {
          return res.status(409).json({
            error: {
              message: 'Session already accepted by another operator',
              code: 'ALREADY_ACCEPTED'
            },
          });
        }
      }

      // Fetch updated session with operator details
      session = await prisma.chatSession.findUnique({
        where: { id: sessionId },
      });
    } catch (error) {
      console.error('Error updating session:', error);
      return res.status(500).json({
        error: { message: 'Failed to accept session' },
      });
    }

    // Create system message
    const systemMessage = await prisma.message.create({
      data: {
        sessionId: sessionId,
        type: 'SYSTEM',
        content: `${operator.name} si è unito alla chat`,
      },
    });

    // v2.3.3: Send automatic greeting message from operator
    const greetingMessage = await prisma.message.create({
      data: {
        sessionId: sessionId,
        type: 'OPERATOR',
        content: `Ciao! Dammi un attimo che controllo la conversazione. Intanto, come ti chiami?`,
        operatorId: operator.id,
      },
    });

    // Notify widget: automatic greeting message
    io.to(`chat_${sessionId}`).emit('operator_message', {
      sessionId: sessionId,
      message: {
        id: greetingMessage.id,
        type: greetingMessage.type,
        content: greetingMessage.content,
        timestamp: greetingMessage.createdAt,
        operatorId: operator.id,
        operatorName: operator.name,
      },
    });

    // Update operator stats
    await prisma.operator.update({
      where: { id: operatorId },
      data: {
        totalChatsHandled: { increment: 1 },
      },
    });

    // Notify widget: operator joined
    io.to(`chat_${sessionId}`).emit('operator_joined', {
      sessionId: sessionId,
      operatorName: operator.name,
      operatorId: operator.id,
      message: {
        id: systemMessage.id,
        type: systemMessage.type,
        content: systemMessage.content,
        timestamp: systemMessage.createdAt,
      },
    });

    // Notify dashboard: chat accepted
    io.to('dashboard').emit('chat_accepted', {
      sessionId: sessionId,
      operatorId: operator.id,
      operatorName: operator.name,
    });

    // Notify OTHER operators: this chat is now taken
    io.to('dashboard').emit('chat_request_cancelled', {
      sessionId: sessionId,
      reason: 'accepted_by_another_operator',
    });

    console.log(`✅ Operator ${operator.name} accepted chat ${sessionId}`);

    // Cancel WAITING timeout - operator accepted
    cancelWaitingTimeout(sessionId);

    // Start operator response timeout (10 minutes)
    startOperatorResponseTimeout(sessionId, io);

    res.json({
      success: true,
      data: {
        session: {
          id: sessionId,
          status: 'WITH_OPERATOR',
          operatorId: operator.id,
          operatorName: operator.name,
        },
      },
    });
  } catch (error) {
    console.error('Accept operator error:', error);
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

    // BUG #6: Create operator message in Message table with transaction
    const result = await createMessage(sessionId, {
      type: 'OPERATOR',
      content: message,
      operatorId: operatorId || session.operatorId,
      operatorName: session.operator?.name || 'Operatore',
    });

    // Convert to legacy format for Socket.IO
    const operatorMessage = {
      id: result.message.id,
      type: 'operator',
      content: result.message.content,
      timestamp: result.message.createdAt.toISOString(),
      operatorId: result.message.operatorId,
      operatorName: result.message.operatorName,
    };

    // Cancel operator response timeout - operator responded
    cancelOperatorResponseTimeout(sessionId);

    // Emit to chat room via Socket.IO (for widget and dashboard)
    // Dashboard adds message locally, so it will receive via this room
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
 * Reopen recently closed chat session
 * POST /api/chat/sessions/:sessionId/reopen
 */
export const reopenSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Get session
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        status: true,
        operatorId: true,
        updatedAt: true,
        operator: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!session) {
      return res.status(404).json({
        error: { message: 'Session not found' },
      });
    }

    // Verify session is CLOSED
    if (session.status !== 'CLOSED') {
      return res.status(400).json({
        error: { message: 'Can only reopen closed chats' },
      });
    }

    // Check if closed less than 5 minutes ago
    const closedTime = Date.now() - new Date(session.updatedAt).getTime();
    const REOPEN_WINDOW = 5 * 60 * 1000; // 5 minutes

    if (closedTime > REOPEN_WINDOW) {
      return res.status(410).json({
        error: {
          message: 'Chat closed too long ago. Please start a new chat.',
          code: 'REOPEN_WINDOW_EXPIRED'
        },
      });
    }

    // Reopen session
    const result = await createMessage(
      sessionId,
      {
        type: 'SYSTEM',
        content: 'Chat riaperta dall\'utente',
      },
      {
        status: 'WITH_OPERATOR',
      }
    );

    console.log(`🔄 Session ${sessionId} reopened by user`);

    // Notify operator
    if (session.operatorId) {
      io.to(`operator_${session.operatorId}`).emit('chat_reopened', {
        sessionId: sessionId,
        message: 'L\'utente ha riaperto la chat',
        timestamp: new Date().toISOString(),
      });

      // Also notify chat room
      io.to(`chat_${sessionId}`).emit('chat_reopened', {
        sessionId: sessionId,
        operatorName: session.operator?.name,
        message: {
          id: result.message.id,
          type: result.message.type,
          content: result.message.content,
          timestamp: result.message.createdAt,
        },
      });
    }

    res.json({
      success: true,
      data: {
        sessionId: sessionId,
        status: 'WITH_OPERATOR',
        operatorName: session.operator?.name,
      },
    });
  } catch (error) {
    console.error('Reopen session error:', error);
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

    // AUDIT FIX: Check if already closed (idempotency)
    if (session.status === 'CLOSED') {
      return res.status(400).json({
        error: { message: 'Chat is already closed' },
      });
    }

    // BUG #6: Create system closing message in Message table with transaction
    const result = await createMessage(sessionId, {
      type: 'SYSTEM',
      content: 'La chat è stata chiusa dall\'operatore. Grazie per averci contattato!',
    }, {
      status: 'CLOSED',
      closedAt: new Date(),
    });

    const updatedSession = result.session;

    // Convert to legacy format for Socket.IO events
    const closingMessage = {
      id: result.message.id,
      type: 'system',
      content: result.message.content,
      timestamp: result.message.createdAt.toISOString(),
    };

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
    // AUDIT FIX: Search in Message table instead of old JSON field
    if (search) {
      where.OR = [
        { userName: { contains: search, mode: 'insensitive' } },
        { messagesNew: {
          some: {
            content: { contains: search, mode: 'insensitive' }
          }
        }},
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
        // BUG #6: Include messages from Message table
        messagesNew: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            type: true,
            content: true,
            operatorId: true,
            operatorName: true,
            aiConfidence: true,
            aiSuggestOperator: true,
            attachmentUrl: true,
            attachmentPublicId: true,
            attachmentName: true,
            attachmentMimetype: true,
            attachmentResourceType: true,
            attachmentSize: true,
            createdAt: true,
          },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
      take: parseInt(limit),
    });

    // BUG #6: Convert messagesNew to legacy format for frontend compatibility
    const sessionsWithMessages = sessions.map((session) => ({
      ...session,
      messages: session.messagesNew.map(msg => ({
        id: msg.id,
        type: msg.type.toLowerCase(),
        content: msg.content,
        timestamp: msg.createdAt.toISOString(),
        ...(msg.operatorId && { operatorId: msg.operatorId, operatorName: msg.operatorName }),
        ...(msg.aiConfidence !== null && { confidence: msg.aiConfidence, suggestOperator: msg.aiSuggestOperator }),
        ...(msg.attachmentUrl && {
          attachment: {
            url: msg.attachmentUrl,
            publicId: msg.attachmentPublicId,
            originalName: msg.attachmentName,
            mimetype: msg.attachmentMimetype,
            resourceType: msg.attachmentResourceType,
            size: msg.attachmentSize,
          },
        }),
      })),
      messagesNew: undefined, // Remove from response
    }));

    res.json({
      success: true,
      data: sessionsWithMessages,
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

    if (!targetOperator.isAvailable) {
      return res.status(400).json({
        error: { message: 'Target operator is not available' },
      });
    }

    // BUG #6: Create transfer system message in Message table with transaction
    await createMessage(sessionId, {
      type: 'SYSTEM',
      content: `Chat trasferita da ${session.operator?.name || 'operatore'} a ${targetOperator.name}${reason ? `. Motivo: ${reason}` : ''}`,
    }, {
      operatorId: toOperatorId,
    });

    // Fetch updated session with new operator details for response
    const updatedSession = await prisma.chatSession.findUnique({
      where: { id: sessionId },
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
 * POST /api/chat/sessions/:sessionId/mark-read
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

    // Create new note
    const newNote = {
      id: Date.now().toString(),
      content: content.trim(),
      operatorId: req.operator.id,
      operatorName: req.operator.name,
      createdAt: new Date().toISOString(),
    };

    // BUG #5 FIX: Use transaction-based helper to prevent race conditions
    const updated = await addInternalNoteWithLock(sessionId, newNote);

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

    // Verify note exists and check permissions BEFORE transaction
    const notes = JSON.parse(session.internalNotes || '[]');
    const noteToUpdate = notes.find((n) => n.id === noteId);

    if (!noteToUpdate) {
      return res.status(404).json({
        error: { message: 'Note not found' },
      });
    }

    // Only allow operator to edit their own notes
    if (noteToUpdate.operatorId !== req.operator.id) {
      return res.status(403).json({
        error: { message: 'You can only edit your own notes' },
      });
    }

    // BUG #5 FIX: Use transaction-based helper to prevent race conditions
    const updated = await updateInternalNoteWithLock(sessionId, noteId, content.trim());

    // Get the updated note from the result
    const updatedNotes = JSON.parse(updated.internalNotes || '[]');
    const updatedNote = updatedNotes.find((n) => n.id === noteId);

    console.log(`✅ P0.3: Internal note ${noteId} updated in chat ${sessionId}`);

    res.json({
      success: true,
      data: { note: updatedNote, session: updated },
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
 * AUDIT FIX: Now uses transaction lock to prevent race conditions
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

    // Verify note exists and check permissions BEFORE transaction
    const notes = JSON.parse(session.internalNotes || '[]');
    const noteToDelete = notes.find((n) => n.id === noteId);

    if (!noteToDelete) {
      return res.status(404).json({
        error: { message: 'Note not found' },
      });
    }

    // Only allow operator to delete their own notes
    if (noteToDelete.operatorId !== req.operator.id) {
      return res.status(403).json({
        error: { message: 'You can only delete your own notes' },
      });
    }

    // AUDIT FIX: Use transaction-based helper to prevent race conditions
    const updated = await deleteInternalNoteWithLock(sessionId, noteId);

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

    // BUG #6: Get all chat sessions for this user with messages from Message table
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
        messagesNew: {
          orderBy: { createdAt: 'asc' },
          take: 100, // AUDIT FIX: Limit messages per session to prevent memory overflow
          select: {
            id: true,
            type: true,
            content: true,
            operatorId: true,
            operatorName: true,
            aiConfidence: true,
            aiSuggestOperator: true,
            attachmentUrl: true,
            attachmentPublicId: true,
            attachmentName: true,
            attachmentMimetype: true,
            attachmentResourceType: true,
            attachmentSize: true,
            createdAt: true,
          },
        },
        priority: true,
        tags: true,
        aiConfidence: true,
      },
    });

    // BUG #6: Convert messages to legacy format
    const sessionsWithParsedMessages = sessions.map((session) => ({
      ...session,
      messages: session.messagesNew.map(msg => ({
        id: msg.id,
        type: msg.type.toLowerCase(),
        content: msg.content,
        timestamp: msg.createdAt.toISOString(),
        ...(msg.operatorId && { operatorId: msg.operatorId, operatorName: msg.operatorName }),
        ...(msg.aiConfidence !== null && { confidence: msg.aiConfidence, suggestOperator: msg.aiSuggestOperator }),
        ...(msg.attachmentUrl && {
          attachment: {
            url: msg.attachmentUrl,
            publicId: msg.attachmentPublicId,
            originalName: msg.attachmentName,
            mimetype: msg.attachmentMimetype,
            resourceType: msg.attachmentResourceType,
            size: msg.attachmentSize,
          },
        }),
      })),
      messageCount: session.messagesNew.length,
      messagesNew: undefined, // Remove messagesNew from response
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

    // AUDIT FIX: Validate file MIME type (security)
    const ALLOWED_MIMETYPES = [
      // Images
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      // Documents
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      // Text
      'text/plain',
      'text/csv',
      // Archives
      'application/zip',
      'application/x-zip-compressed',
    ];

    if (!ALLOWED_MIMETYPES.includes(file.mimetype)) {
      return res.status(400).json({
        error: { message: `File type not allowed: ${file.mimetype}. Allowed types: images, PDFs, documents, text files.` },
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

    // BUG #6: Create message with file attachment in Message table with transaction
    const isOperator = !!req.operator; // Check if authenticated (operator) or public (user)

    const result = await createMessage(sessionId, {
      type: isOperator ? 'OPERATOR' : 'USER',
      content: `📎 ${file.originalname}`,
      attachmentUrl: uploadResult.url,
      attachmentPublicId: uploadResult.publicId,
      attachmentName: uploadResult.originalName,
      attachmentMimetype: uploadResult.mimetype,
      attachmentSize: uploadResult.bytes,
      attachmentResourceType: uploadResult.resourceType,
      ...(isOperator && {
        operatorName: req.operator.name,
        operatorId: req.operator.id
      }),
    });

    // Convert to legacy format for Socket.IO events
    const newMessage = {
      id: result.message.id,
      type: isOperator ? 'operator' : 'user',
      content: result.message.content,
      attachment: {
        url: result.message.attachmentUrl,
        publicId: result.message.attachmentPublicId,
        originalName: result.message.attachmentName,
        mimetype: result.message.attachmentMimetype,
        size: result.message.attachmentSize,
        resourceType: result.message.attachmentResourceType,
      },
      timestamp: result.message.createdAt.toISOString(),
      ...(isOperator && {
        operatorName: result.message.operatorName,
        operatorId: result.message.operatorId
      }),
    };

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
