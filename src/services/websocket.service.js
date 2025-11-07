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

// WAITING timeout (5 minutes)
// Maps sessionId -> timeout ID
// Tracks if user waits too long for operator
const waitingTimeouts = new Map();

// User disconnect timeout (5 minutes)
// Maps sessionId -> timeout ID
// Auto-close chat if user doesn't reconnect
const userDisconnectTimeouts = new Map();

// v2.3.4: User inactivity check (5 minutes warning)
// Maps sessionId -> timeout ID
// Sends "sei ancora qui?" after 5 min of inactivity
const userInactivityWarningTimeouts = new Map();

// v2.3.4: User inactivity final timeout (10 minutes total)
// Maps sessionId -> timeout ID
// Auto-close if user doesn't respond to presence check
const userInactivityFinalTimeouts = new Map();

// v2.3.11: AI chat inactivity timeout (15 minutes)
// Maps sessionId -> timeout ID
// Auto-close AI-only chats after 15 min of inactivity
const aiInactivityTimeouts = new Map();

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

      // Cancel user disconnect timeout if user reconnected
      if (userDisconnectTimeouts.has(sessionId)) {
        clearTimeout(userDisconnectTimeouts.get(sessionId));
        userDisconnectTimeouts.delete(sessionId);
        console.log(`✅ User reconnected to session ${sessionId} - auto-close cancelled`);
      } else {
        console.log(`💬 User joined chat session: ${sessionId}`);
      }
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

      // v2.3.4: Cancel inactivity timers and restart
      cancelUserInactivityCheck(sessionId);
      startUserInactivityCheck(sessionId, io);

      socket.to(`chat_${sessionId}`).emit('user_confirmed_presence', {
        sessionId,
        timestamp,
        message: '✅ L\'utente ha confermato la sua presenza'
      });
      console.log(`✅ User confirmed presence in session ${sessionId} - inactivity timer reset`);
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
              userName: true,
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
              userName: session.userName || 'Utente',
              message: 'L\'utente si è disconnesso',
              timestamp: new Date().toISOString()
            });

            // Also emit to chat room in case operator is viewing the chat
            io.to(`chat_${userSessionId}`).emit('user_disconnected', {
              sessionId: userSessionId,
              userName: session.userName || 'Utente',
              message: 'L\'utente si è disconnesso',
              timestamp: new Date().toISOString()
            });

            // Start auto-close timeout (5 minutes)
            const timeoutId = setTimeout(async () => {
              console.log(`⚠️  User disconnect timeout expired for session ${userSessionId} - auto closing`);

              try {
                // Check if session is still WITH_OPERATOR (user never reconnected)
                const latestSession = await prisma.chatSession.findUnique({
                  where: { id: userSessionId },
                  select: { status: true, operatorId: true }
                });

                if (latestSession && latestSession.status === 'WITH_OPERATOR') {
                  // Auto-close session
                  await prisma.chatSession.update({
                    where: { id: userSessionId },
                    data: {
                      status: 'CLOSED',
                      closureReason: 'USER_DISCONNECTED_TIMEOUT',
                    },
                  });

                  console.log(`✅ Auto-closed session ${userSessionId} due to user disconnect`);

                  // Notify operator
                  if (latestSession.operatorId) {
                    io.to(`operator_${latestSession.operatorId}`).emit('chat_auto_closed', {
                      sessionId: userSessionId,
                      reason: 'L\'utente non è tornato dopo 5 minuti',
                      message: 'Chat chiusa automaticamente',
                      timestamp: new Date().toISOString(),
                    });
                  }
                }

                // Clean up timeout tracking
                userDisconnectTimeouts.delete(userSessionId);
              } catch (error) {
                console.error(`❌ Error auto-closing session ${userSessionId}:`, error);
              }
            }, 5 * 60 * 1000); // 5 minutes

            // Store timeout ID
            userDisconnectTimeouts.set(userSessionId, timeoutId);
            console.log(`⏱️  Started 5-minute auto-close timeout for session ${userSessionId}`);
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
          userName: true,
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

      // Operator never responded - notify both user and operator
      console.log(`📤 Notifying user and operator in session ${sessionId}: timeout`);

      // Update session to CLOSED
      await prisma.chatSession.update({
        where: { id: sessionId },
        data: {
          status: 'CLOSED',
          closureReason: 'OPERATOR_TIMEOUT',
        },
      });

      // Notify user
      io.to(`chat_${sessionId}`).emit('operator_not_responding', {
        sessionId: sessionId,
        message: 'L\'operatore non ha risposto. Scegli come continuare:',
        timestamp: new Date().toISOString(),
      });

      // Notify operator
      if (session.operatorId) {
        io.to(`operator_${session.operatorId}`).emit('chat_timeout_cancelled', {
          sessionId: sessionId,
          userName: session.userName || 'Utente',
          reason: 'Non hai risposto entro 10 minuti',
          message: 'Questa chat è stata cancellata perché non hai risposto in tempo.',
          timestamp: new Date().toISOString(),
        });
      }

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

/**
 * Start WAITING timeout
 * Called when user requests operator and goes into WAITING status
 * If no operator accepts within 5 minutes, notify user
 */
export function startWaitingTimeout(sessionId, io) {
  const TIMEOUT_DURATION = 5 * 60 * 1000; // 5 minutes

  console.log(`⏱️  Starting WAITING timeout for session ${sessionId} (5 minutes)`);

  const timeoutId = setTimeout(async () => {
    console.log(`⚠️  WAITING timeout expired for session ${sessionId}`);

    try {
      // Check if session is still WAITING
      const session = await prisma.chatSession.findUnique({
        where: { id: sessionId },
        select: {
          id: true,
          status: true,
        },
      });

      if (!session || session.status !== 'WAITING') {
        console.log(`ℹ️  Session ${sessionId} no longer waiting, skipping timeout notification`);
        waitingTimeouts.delete(sessionId);
        return;
      }

      // Session still waiting after 5 minutes - notify user
      console.log(`📤 Notifying user in session ${sessionId}: no operator available`);

      // Update session back to ACTIVE
      await prisma.chatSession.update({
        where: { id: sessionId },
        data: { status: 'ACTIVE' },
      });

      // Notify user
      io.to(`chat_${sessionId}`).emit('operator_wait_timeout', {
        sessionId: sessionId,
        message: 'Nessun operatore ha risposto. Scegli come continuare:',
        timestamp: new Date().toISOString(),
      });

      // Notify dashboard to remove from waiting list
      io.to('dashboard').emit('chat_request_cancelled', {
        sessionId: sessionId,
        reason: 'timeout_5_minutes',
      });

      // Clean up timeout tracking
      waitingTimeouts.delete(sessionId);
    } catch (error) {
      console.error(`❌ Error handling WAITING timeout for session ${sessionId}:`, error);
    }
  }, TIMEOUT_DURATION);

  // Store timeout ID
  waitingTimeouts.set(sessionId, timeoutId);
}

/**
 * Cancel WAITING timeout
 * Called when operator accepts the request
 */
export function cancelWaitingTimeout(sessionId) {
  if (waitingTimeouts.has(sessionId)) {
    clearTimeout(waitingTimeouts.get(sessionId));
    waitingTimeouts.delete(sessionId);
    console.log(`✅ WAITING timeout cancelled for session ${sessionId} - operator accepted`);
  }
}

/**
 * v2.3.4: Start user inactivity check
 * Called when user sends message (reset timer each message)
 * After 5 min of inactivity: sends presence check to user
 * If user doesn't respond: auto-close after another 5 min (10 min total)
 */
export function startUserInactivityCheck(sessionId, io) {
  // Cancel existing timers first
  cancelUserInactivityCheck(sessionId);

  const WARNING_TIMEOUT = 5 * 60 * 1000; // 5 minutes

  console.log(`⏱️  Starting user inactivity check for session ${sessionId} (5 min warning)`);

  const warningTimeoutId = setTimeout(async () => {
    console.log(`⚠️  User inactive for 5 minutes in session ${sessionId} - sending presence check`);

    try {
      // Check if session is still WITH_OPERATOR
      const session = await prisma.chatSession.findUnique({
        where: { id: sessionId },
        select: {
          id: true,
          status: true,
          operatorId: true,
          userName: true,
          operator: {
            select: { id: true, name: true }
          }
        },
      });

      if (!session || session.status !== 'WITH_OPERATOR') {
        console.log(`ℹ️  Session ${sessionId} no longer active, skipping presence check`);
        userInactivityWarningTimeouts.delete(sessionId);
        return;
      }

      // Notify USER: "Sei ancora qui?" with countdown and buttons
      io.to(`chat_${sessionId}`).emit('user_presence_check', {
        sessionId: sessionId,
        message: 'Sei ancora qui? Hai ancora bisogno di aiuto?',
        warningTime: 5, // minutes until auto-close
        countdown: 300, // seconds until auto-close
        timestamp: new Date().toISOString(),
      });

      // Notify OPERATOR: User is inactive, presence check sent
      if (session.operatorId) {
        io.to(`operator_${session.operatorId}`).emit('user_inactivity_warning', {
          sessionId: sessionId,
          userName: session.userName || 'Utente',
          message: `${session.userName || 'L\'utente'} è inattivo da 5 minuti. Gli è stato chiesto se è ancora presente.`,
          countdown: 300, // seconds until auto-close
          timestamp: new Date().toISOString(),
        });
      }

      // Start final timeout (another 5 minutes)
      startUserInactivityFinalTimeout(sessionId, io);

      // Clean up warning timeout
      userInactivityWarningTimeouts.delete(sessionId);
    } catch (error) {
      console.error(`❌ Error handling user inactivity warning for session ${sessionId}:`, error);
    }
  }, WARNING_TIMEOUT);

  // Store timeout ID
  userInactivityWarningTimeouts.set(sessionId, warningTimeoutId);
}

/**
 * v2.3.4: Start final timeout after presence check sent
 * If user doesn't respond within 5 more minutes, auto-close chat
 */
function startUserInactivityFinalTimeout(sessionId, io) {
  const FINAL_TIMEOUT = 5 * 60 * 1000; // 5 minutes

  console.log(`⏱️  Starting final inactivity timeout for session ${sessionId} (5 min until auto-close)`);

  const finalTimeoutId = setTimeout(async () => {
    console.log(`⚠️  User didn't respond to presence check in session ${sessionId} - auto closing`);

    try {
      // Check if session is still WITH_OPERATOR
      const session = await prisma.chatSession.findUnique({
        where: { id: sessionId },
        select: {
          id: true,
          status: true,
          operatorId: true,
          userName: true,
        },
      });

      if (!session || session.status !== 'WITH_OPERATOR') {
        console.log(`ℹ️  Session ${sessionId} already closed, skipping auto-close`);
        userInactivityFinalTimeouts.delete(sessionId);
        return;
      }

      // Auto-close session
      await prisma.chatSession.update({
        where: { id: sessionId },
        data: {
          status: 'CLOSED',
          closureReason: 'USER_INACTIVITY_TIMEOUT',
        },
      });

      console.log(`✅ Auto-closed session ${sessionId} due to user inactivity (10 min total)`);

      // Notify USER: Chat closed due to inactivity
      io.to(`chat_${sessionId}`).emit('chat_closed_inactivity', {
        sessionId: sessionId,
        reason: 'inactivity',
        message: 'La chat è stata chiusa per inattività. Puoi iniziare una nuova conversazione quando vuoi!',
        timestamp: new Date().toISOString(),
      });

      // Notify OPERATOR: Chat auto-closed
      if (session.operatorId) {
        io.to(`operator_${session.operatorId}`).emit('chat_auto_closed', {
          sessionId: sessionId,
          userName: session.userName || 'Utente',
          reason: 'L\'utente non ha risposto al controllo di presenza (10 minuti di inattività)',
          message: 'Chat chiusa automaticamente per inattività utente',
          timestamp: new Date().toISOString(),
        });

        // Also emit to dashboard for chat list refresh
        io.to('dashboard').emit('chat_closed', {
          sessionId: sessionId,
        });
      }

      // Clean up timeout tracking
      userInactivityFinalTimeouts.delete(sessionId);
    } catch (error) {
      console.error(`❌ Error auto-closing session ${sessionId} due to inactivity:`, error);
    }
  }, FINAL_TIMEOUT);

  // Store timeout ID
  userInactivityFinalTimeouts.set(sessionId, finalTimeoutId);
}

/**
 * v2.3.4: Cancel user inactivity check
 * Called when user sends a message (reset the timer)
 */
export function cancelUserInactivityCheck(sessionId) {
  // Cancel warning timeout if exists
  if (userInactivityWarningTimeouts.has(sessionId)) {
    clearTimeout(userInactivityWarningTimeouts.get(sessionId));
    userInactivityWarningTimeouts.delete(sessionId);
    console.log(`✅ User inactivity warning cancelled for session ${sessionId} - user is active`);
  }

  // Cancel final timeout if exists
  if (userInactivityFinalTimeouts.has(sessionId)) {
    clearTimeout(userInactivityFinalTimeouts.get(sessionId));
    userInactivityFinalTimeouts.delete(sessionId);
    console.log(`✅ User inactivity final timeout cancelled for session ${sessionId} - user responded`);
  }
}

/**
 * v2.3.11: Start AI chat inactivity check
 * Auto-close AI chats after 15 minutes of inactivity
 */
export function startAIInactivityCheck(sessionId, io) {
  // Cancel existing timer first
  cancelAIInactivityCheck(sessionId);

  const AI_TIMEOUT = 15 * 60 * 1000; // 15 minutes

  console.log(`⏱️  Starting AI inactivity check for session ${sessionId} (15 minutes)`);

  const timeoutId = setTimeout(async () => {
    console.log(`⚠️  AI chat ${sessionId} inactive for 15 minutes - auto closing`);

    try {
      // Check if session is still ACTIVE
      const session = await prisma.chatSession.findUnique({
        where: { id: sessionId },
        select: {
          id: true,
          status: true,
          userName: true,
        },
      });

      if (!session || session.status !== 'ACTIVE') {
        console.log(`ℹ️  Session ${sessionId} no longer active, skipping auto-close`);
        aiInactivityTimeouts.delete(sessionId);
        return;
      }

      // Auto-close AI chat
      await prisma.chatSession.update({
        where: { id: sessionId },
        data: {
          status: 'CLOSED',
          closureReason: 'AI_INACTIVITY_TIMEOUT',
        },
      });

      console.log(`✅ Auto-closed AI chat ${sessionId} due to inactivity (15 minutes)`);

      // Notify USER: Chat closed for inactivity with reactivation option
      io.to(`chat_${sessionId}`).emit('ai_chat_closed_inactivity', {
        sessionId: sessionId,
        reason: 'inactivity',
        message: 'Chat chiusa per inattività. Puoi riaprirla o iniziarne una nuova!',
        timestamp: new Date().toISOString(),
      });

      // Update dashboard - remove from active AI chats list
      io.to('dashboard').emit('chat_closed', {
        sessionId: sessionId,
      });

      // Clean up timeout tracking
      aiInactivityTimeouts.delete(sessionId);
    } catch (error) {
      console.error(`❌ Error auto-closing AI session ${sessionId} due to inactivity:`, error);
    }
  }, AI_TIMEOUT);

  // Store timeout ID
  aiInactivityTimeouts.set(sessionId, timeoutId);
}

/**
 * v2.3.11: Cancel AI chat inactivity check
 * Called when user sends a message or chat is closed manually
 */
export function cancelAIInactivityCheck(sessionId) {
  if (aiInactivityTimeouts.has(sessionId)) {
    clearTimeout(aiInactivityTimeouts.get(sessionId));
    aiInactivityTimeouts.delete(sessionId);
    console.log(`✅ AI inactivity timer cancelled for session ${sessionId} - user is active`);
  }
}
