import { prisma } from '../server.js';

/**
 * Setup WebSocket event handlers
 */
export function setupWebSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`✅ Client connected: ${socket.id}`);

    // ============================================
    // USER EVENTS (Widget)
    // ============================================

    /**
     * User joins chat room
     */
    socket.on('join_chat', async (sessionId) => {
      try {
        socket.join(`chat:${sessionId}`);
        console.log(`👤 User joined chat: ${sessionId}`);

        // Emit confirmation
        socket.emit('chat_joined', { sessionId });
      } catch (error) {
        console.error('Join chat error:', error);
        socket.emit('error', { message: 'Failed to join chat' });
      }
    });

    /**
     * User sends message
     */
    socket.on('user_message', async ({ sessionId, message }) => {
      try {
        const session = await prisma.chatSession.findUnique({
          where: { id: sessionId },
        });

        if (!session) {
          socket.emit('error', { message: 'Session not found' });
          return;
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

        // If chat is WITH_OPERATOR, forward to operator
        if (session.status === 'WITH_OPERATOR' && session.operatorId) {
          io.to(`operator:${session.operatorId}`).emit('user_message', {
            sessionId,
            userName: session.userName,
            message: userMessage,
          });

          io.to('dashboard').emit('message_received', {
            sessionId,
            operatorId: session.operatorId,
          });
        }

        // Emit confirmation to user
        socket.emit('message_sent', { message: userMessage });
      } catch (error) {
        console.error('User message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    /**
     * User requests operator
     */
    socket.on('request_operator', async ({ sessionId }) => {
      try {
        // Check for online operators
        const onlineOperators = await prisma.operator.findMany({
          where: { isOnline: true },
          orderBy: { totalChatsHandled: 'asc' },
        });

        if (onlineOperators.length === 0) {
          socket.emit('no_operators_available', {
            message: 'Nessun operatore disponibile. Vuoi aprire un ticket?',
          });
          return;
        }

        // Assign to least busy operator
        const operator = onlineOperators[0];

        await prisma.chatSession.update({
          where: { id: sessionId },
          data: {
            status: 'WITH_OPERATOR',
            operatorId: operator.id,
          },
        });

        // Notify operator
        io.to(`operator:${operator.id}`).emit('new_chat_request', {
          sessionId,
        });

        // Notify user
        socket.emit('operator_assigned', {
          operatorId: operator.id,
          operatorName: operator.name,
        });
      } catch (error) {
        console.error('Request operator error:', error);
        socket.emit('error', { message: 'Failed to request operator' });
      }
    });

    // ============================================
    // OPERATOR EVENTS (Dashboard)
    // ============================================

    /**
     * Operator joins dashboard
     */
    socket.on('join_dashboard', async (operatorId) => {
      try {
        socket.join(`operator:${operatorId}`);
        socket.join('dashboard');
        console.log(`👨‍💼 Operator ${operatorId} joined dashboard`);

        // Update last seen
        await prisma.operator.update({
          where: { id: operatorId },
          data: { lastSeenAt: new Date() },
        });

        socket.emit('dashboard_joined', { operatorId });
      } catch (error) {
        console.error('Join dashboard error:', error);
        socket.emit('error', { message: 'Failed to join dashboard' });
      }
    });

    /**
     * Operator sends message to user
     */
    socket.on('operator_message', async ({ sessionId, message, operatorId }) => {
      try {
        const session = await prisma.chatSession.findUnique({
          where: { id: sessionId },
        });

        if (!session) {
          socket.emit('error', { message: 'Session not found' });
          return;
        }

        // Get operator name
        const operator = await prisma.operator.findUnique({
          where: { id: operatorId },
          select: { name: true },
        });

        // Parse messages
        const messages = JSON.parse(session.messages || '[]');

        // Add operator message
        const operatorMessage = {
          id: Date.now().toString(),
          type: 'operator',
          content: message,
          operatorName: operator.name,
          timestamp: new Date().toISOString(),
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

        // Send to user
        io.to(`chat:${sessionId}`).emit('operator_message', {
          message: operatorMessage,
        });

        // Confirm to operator
        socket.emit('message_sent', { message: operatorMessage });
      } catch (error) {
        console.error('Operator message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    /**
     * Operator joins specific chat
     */
    socket.on('join_chat_as_operator', async ({ sessionId, operatorId }) => {
      try {
        socket.join(`chat:${sessionId}`);

        // Update session if needed
        const session = await prisma.chatSession.findUnique({
          where: { id: sessionId },
        });

        if (session.status === 'WAITING') {
          await prisma.chatSession.update({
            where: { id: sessionId },
            data: {
              status: 'WITH_OPERATOR',
              operatorId,
            },
          });

          // Notify user
          io.to(`chat:${sessionId}`).emit('operator_joined', {
            operatorId,
          });
        }

        socket.emit('chat_joined_as_operator', { sessionId });
      } catch (error) {
        console.error('Join chat as operator error:', error);
        socket.emit('error', { message: 'Failed to join chat' });
      }
    });

    /**
     * Operator closes chat
     */
    socket.on('close_chat', async ({ sessionId, operatorId }) => {
      try {
        await prisma.chatSession.update({
          where: { id: sessionId },
          data: {
            status: 'CLOSED',
            closedAt: new Date(),
          },
        });

        // Increment operator stats
        await prisma.operator.update({
          where: { id: operatorId },
          data: {
            totalChatsHandled: { increment: 1 },
          },
        });

        // Notify user
        io.to(`chat:${sessionId}`).emit('chat_closed', {
          message: 'Chat terminata. Grazie per averci contattato!',
        });

        // Notify dashboard
        io.to('dashboard').emit('chat_closed', { sessionId });

        socket.emit('chat_closed_confirmed', { sessionId });
      } catch (error) {
        console.error('Close chat error:', error);
        socket.emit('error', { message: 'Failed to close chat' });
      }
    });

    // ============================================
    // DISCONNECT
    // ============================================

    socket.on('disconnect', () => {
      console.log(`❌ Client disconnected: ${socket.id}`);
    });
  });

  return io;
}
