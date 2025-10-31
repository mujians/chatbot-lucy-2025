/**
 * WebSocket Service
 * Handles Socket.IO connections and events
 */

import { prisma } from '../server.js';

// Grace period for operator reconnect (10 seconds)
// Maps operatorId -> timeout ID
const operatorDisconnectTimeouts = new Map();

// Operator response timeout (10 minutes)
// Maps sessionId -> timeout ID
// Tracks if operator responds after accepting chat
const operatorResponseTimeouts = new Map();

export function setupWebSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Operator authentication and room joining
    socket.on('operator_join', (data) => {
      const { operatorId } = data;
      socket.join(`operator_${operatorId}`);
      // Store operatorId in socket data for disconnect handling
      socket.data.operatorId = operatorId;

      // Cancel disconnect timeout if operator reconnected within grace period
      if (operatorDisconnectTimeouts.has(operatorId)) {
        clearTimeout(operatorDisconnectTimeouts.get(operatorId));
        operatorDisconnectTimeouts.delete(operatorId);
        console.log(`✅ Operator ${operatorId} reconnected within grace period - notification cancelled`);
      } else {
        console.log(`👤 Operator ${operatorId} joined room`);
      }
    });

    // Operator leaves
    socket.on('operator_leave', (data) => {
      const { operatorId } = data;
      socket.leave(`operator_${operatorId}`);
      console.log(`👤 Operator ${operatorId} left room`);
    });

    // Dashboard room joining
    socket.on('join_dashboard', () => {
      socket.join('dashboard');
      console.log('📊 Dashboard client joined');
    });

    socket.on('leave_dashboard', () => {
      socket.leave('dashboard');
      console.log('📊 Dashboard client left');
    });

    // Join chat session room
    socket.on('join_chat', (data) => {
      const { sessionId } = data;
      socket.join(`chat_${sessionId}`);
      // Store sessionId in socket data for disconnect handling
      socket.data.userSessionId = sessionId;
      console.log(`💬 User joined chat session: ${sessionId}`);
    });

    // Leave chat session room
    socket.on('leave_chat', (data) => {
      const { sessionId } = data;
      socket.leave(`chat_${sessionId}`);
      console.log(`💬 Left chat session: ${sessionId}`);
    });

    // P0.5: User typing indicator
    socket.on('user_typing', (data) => {
      const { sessionId, isTyping } = data;
      // Notify operator in the chat room
      socket.to(`chat_${sessionId}`).emit('user_typing', {
        sessionId,
        isTyping,
      });
      console.log(`⌨️  User typing in session ${sessionId}: ${isTyping}`);
    });

    // P0.5: Operator typing indicator
    socket.on('operator_typing', (data) => {
      const { sessionId, operatorName, isTyping } = data;
      // Notify user in the chat room
      socket.to(`chat_${sessionId}`).emit('operator_typing', {
        sessionId,
        operatorName,
        isTyping,
      });
      console.log(`⌨️  Operator typing in session ${sessionId}: ${isTyping}`);
    });

    // User resumed chat - notify operator
    socket.on('user_resumed_chat', (data) => {
      const { sessionId, userName, timestamp } = data;
      // Notify operator via chat room (operators are joined to this room)
      socket.to(`chat_${sessionId}`).emit('user_resumed_chat', {
        sessionId,
        userName,
        timestamp,
        message: `${userName} ha ripreso la conversazione`
      });
      console.log(`🔄 User ${userName} resumed chat session ${sessionId}`);
    });

    // User confirmed presence - notify operator
    socket.on('user_confirmed_presence', (data) => {
      const { sessionId, timestamp } = data;
      socket.to(`chat_${sessionId}`).emit('user_confirmed_presence', {
        sessionId,
        timestamp,
        message: '✅ L\'utente ha confermato la sua presenza'
      });
      console.log(`✅ User confirmed presence in session ${sessionId}`);
    });

    // User switched to AI - notify operator
    socket.on('user_switched_to_ai', (data) => {
      const { sessionId, timestamp } = data;
      socket.to(`chat_${sessionId}`).emit('user_switched_to_ai', {
        sessionId,
        timestamp,
        message: '🤖 L\'utente è tornato all\'assistente AI'
      });
      console.log(`🤖 User switched to AI in session ${sessionId}`);
    });

    // User inactive (final warning) - notify operator
    socket.on('user_inactive_final', (data) => {
      const { sessionId, inactiveTime, message } = data;
      socket.to(`chat_${sessionId}`).emit('user_inactive_final', {
        sessionId,
        inactiveTime,
        message: message || '⚠️ Utente inattivo da 5 minuti'
      });
      console.log(`⚠️ User inactive (${inactiveTime}s) in session ${sessionId}`);
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);

      // Check if this was an operator disconnect
      const operatorId = socket.data.operatorId;
      if (operatorId) {
        console.log(`👤 Operator ${operatorId} disconnected - waiting 10s before notifying users`);

        try {
          // Find all active chats with this operator
          const activeChats = await prisma.chatSession.findMany({
            where: {
              operatorId: operatorId,
              status: 'WITH_OPERATOR'
            },
            select: {
              id: true,
              userName: true
            }
          });

          if (activeChats.length > 0) {
            console.log(`⏳ Operator ${operatorId} has ${activeChats.length} active chat(s) - grace period started`);

            // Create timeout for delayed notification (10 seconds)
            const timeoutId = setTimeout(() => {
              console.log(`⚠️ Grace period expired for operator ${operatorId} - notifying users`);

              // Notify each user that operator disconnected
              for (const chat of activeChats) {
                io.to(`chat_${chat.id}`).emit('operator_disconnected', {
                  sessionId: chat.id,
                  message: 'L\'operatore non è più disponibile',
                  timestamp: new Date().toISOString()
                });
                console.log(`📤 Notified user in session ${chat.id} about operator disconnect`);
              }

              // Remove timeout from map
              operatorDisconnectTimeouts.delete(operatorId);
            }, 10000); // 10 seconds grace period

            // Store timeout ID
            operatorDisconnectTimeouts.set(operatorId, timeoutId);
          }
        } catch (error) {
          console.error('❌ Error handling operator disconnect:', error);
        }
      }

      // Check if this was a user disconnect
      const userSessionId = socket.data.userSessionId;
      if (userSessionId) {
        console.log(`👤 User disconnected from session ${userSessionId}`);

        try {
          // Find session to check if operator is present
          const session = await prisma.chatSession.findUnique({
            where: { id: userSessionId },
            select: {
              id: true,
              status: true,
              operatorId: true,
              operator: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          });

          // Notify operator if user was in active chat
          if (session && session.status === 'WITH_OPERATOR' && session.operatorId) {
            console.log(`📤 Notifying operator ${session.operator?.name} that user disconnected from session ${userSessionId}`);

            // Notify operator room (dashboard)
            io.to(`operator_${session.operatorId}`).emit('user_disconnected', {
              sessionId: userSessionId,
              message: 'L\'utente si è disconnesso',
              timestamp: new Date().toISOString()
            });

            // Also emit to chat room in case operator is viewing the chat
            io.to(`chat_${userSessionId}`).emit('user_disconnected', {
              sessionId: userSessionId,
              message: 'L\'utente si è disconnesso',
              timestamp: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error('❌ Error handling user disconnect:', error);
        }
      }
    });
  });

  console.log('✅ WebSocket handlers setup complete');
}

/**
 * Start operator response timeout
 * Called when operator accepts chat
 * If operator doesn't send first message within 10 minutes, notify user
 */
export function startOperatorResponseTimeout(sessionId, io) {
  const TIMEOUT_DURATION = 10 * 60 * 1000; // 10 minutes

  console.log(`⏱️  Starting operator response timeout for session ${sessionId} (10 minutes)`);

  const timeoutId = setTimeout(async () => {
    console.log(`⚠️  Operator response timeout expired for session ${sessionId}`);

    try {
      // Check if operator sent at least one message
      const session = await prisma.chatSession.findUnique({
        where: { id: sessionId },
        select: {
          id: true,
          status: true,
          operatorId: true,
          messages: true,
        },
      });

      if (!session || session.status !== 'WITH_OPERATOR') {
        console.log(`ℹ️  Session ${sessionId} no longer active, skipping timeout notification`);
        operatorResponseTimeouts.delete(sessionId);
        return;
      }

      // Parse messages and check if operator sent any
      const messages = JSON.parse(session.messages || '[]');
      const operatorMessages = messages.filter(m => m.type === 'OPERATOR');

      if (operatorMessages.length > 0) {
        console.log(`✅ Operator already responded in session ${sessionId}, cancelling timeout`);
        operatorResponseTimeouts.delete(sessionId);
        return;
      }

      // Operator never responded - notify user
      console.log(`📤 Notifying user in session ${sessionId}: operator not responding`);

      io.to(`chat_${sessionId}`).emit('operator_not_responding', {
        sessionId: sessionId,
        message: 'L\'operatore non ha risposto. Scegli come continuare:',
        timestamp: new Date().toISOString(),
      });

      // Clean up timeout tracking
      operatorResponseTimeouts.delete(sessionId);
    } catch (error) {
      console.error(`❌ Error handling operator response timeout for session ${sessionId}:`, error);
    }
  }, TIMEOUT_DURATION);

  // Store timeout ID
  operatorResponseTimeouts.set(sessionId, timeoutId);
}

/**
 * Cancel operator response timeout
 * Called when operator sends first message
 */
export function cancelOperatorResponseTimeout(sessionId) {
  if (operatorResponseTimeouts.has(sessionId)) {
    clearTimeout(operatorResponseTimeouts.get(sessionId));
    operatorResponseTimeouts.delete(sessionId);
    console.log(`✅ Operator response timeout cancelled for session ${sessionId} - operator responded`);
  }
}
