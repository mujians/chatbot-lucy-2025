import { prisma } from '../server.js';
import { io } from '../server.js';
import { config } from '../config/index.js';

/**
 * Background Jobs Service
 * Handles periodic tasks like timeout warnings and operator auto-offline
 */

class BackgroundJobsService {
  constructor() {
    this.chatTimeoutInterval = null;
    this.operatorTimeoutInterval = null;
  }

  /**
   * Start all background jobs
   */
  start() {
    console.log('🚀 Starting background jobs...');
    this.startChatTimeoutMonitor();
    this.startOperatorTimeoutMonitor();
  }

  /**
   * Stop all background jobs
   */
  stop() {
    console.log('⏹️ Stopping background jobs...');
    if (this.chatTimeoutInterval) {
      clearInterval(this.chatTimeoutInterval);
    }
    if (this.operatorTimeoutInterval) {
      clearInterval(this.operatorTimeoutInterval);
    }
  }

  /**
   * SCENARIO 6: Chat Timeout Warning
   * Check for inactive chat sessions every minute
   * Warn users after 4 minutes, close after 5 minutes
   */
  startChatTimeoutMonitor() {
    const CHECK_INTERVAL = 60 * 1000; // 1 minute
    const WARNING_THRESHOLD = 4 * 60 * 1000; // 4 minutes
    const TIMEOUT_THRESHOLD = 5 * 60 * 1000; // 5 minutes

    this.chatTimeoutInterval = setInterval(async () => {
      try {
        const now = new Date();

        // Find sessions that need timeout warning (4 min inactive)
        const warningTime = new Date(now - WARNING_THRESHOLD);
        const sessionsToWarn = await prisma.chatSession.findMany({
          where: {
            status: { in: ['ACTIVE', 'WITH_OPERATOR'] },
            lastMessageAt: { lt: warningTime, gte: new Date(now - TIMEOUT_THRESHOLD) },
          },
        });

        for (const session of sessionsToWarn) {
          // Send timeout warning via WebSocket
          io.to(`chat:${session.id}`).emit('timeout_warning', {
            message: 'La chat verrà chiusa tra 1 minuto per inattività',
            secondsLeft: 60,
          });

          console.log(`⚠️ Timeout warning sent to session ${session.id}`);
        }

        // Find sessions to auto-close (5 min inactive)
        const closeTime = new Date(now - TIMEOUT_THRESHOLD);
        const sessionsToClose = await prisma.chatSession.findMany({
          where: {
            status: { in: ['ACTIVE', 'WITH_OPERATOR'] },
            lastMessageAt: { lt: closeTime },
          },
        });

        for (const session of sessionsToClose) {
          // Close session
          await prisma.chatSession.update({
            where: { id: session.id },
            data: {
              status: 'CLOSED',
              closedAt: now,
            },
          });

          // Increment operator stats if applicable
          if (session.operatorId) {
            await prisma.operator.update({
              where: { id: session.operatorId },
              data: { totalChatsHandled: { increment: 1 } },
            });
          }

          // Notify via WebSocket
          io.to(`chat:${session.id}`).emit('chat_closed', {
            reason: 'timeout',
            message: 'Chat chiusa per inattività',
          });

          console.log(`⏱️ Auto-closed session ${session.id} due to timeout`);
        }
      } catch (error) {
        console.error('Chat timeout monitor error:', error);
      }
    }, CHECK_INTERVAL);

    console.log('✅ Chat timeout monitor started');
  }

  /**
   * SCENARIO 20: Operator Disconnect Auto-Failover
   * Check for disconnected operators every 30 seconds
   * Set operators offline if lastSeenAt > 30 seconds
   * Reassign their active chats to other operators
   */
  startOperatorTimeoutMonitor() {
    const CHECK_INTERVAL = 30 * 1000; // 30 seconds
    const OPERATOR_TIMEOUT = 30 * 1000; // 30 seconds

    this.operatorTimeoutInterval = setInterval(async () => {
      try {
        const now = new Date();
        const timeoutThreshold = new Date(now - OPERATOR_TIMEOUT);

        // Find operators marked online but haven't been seen recently
        const disconnectedOperators = await prisma.operator.findMany({
          where: {
            isOnline: true,
            lastSeenAt: { lt: timeoutThreshold },
          },
          include: {
            chatSessions: {
              where: {
                status: 'WITH_OPERATOR',
              },
            },
          },
        });

        for (const operator of disconnectedOperators) {
          // Set operator offline
          await prisma.operator.update({
            where: { id: operator.id },
            data: { isOnline: false },
          });

          console.log(`🔴 Operator ${operator.name} set offline due to timeout`);

          // Broadcast operator status change
          io.to('dashboard').emit('operator_status_changed', {
            operatorId: operator.id,
            operatorName: operator.name,
            isOnline: false,
            reason: 'timeout',
          });

          // Reassign their active chats
          for (const session of operator.chatSessions) {
            // Find another available operator
            const availableOperators = await prisma.operator.findMany({
              where: {
                isOnline: true,
                id: { not: operator.id },
              },
              orderBy: { totalChatsHandled: 'asc' }, // Least busy first
              take: 1,
            });

            if (availableOperators.length > 0) {
              const newOperator = availableOperators[0];

              // Reassign chat
              await prisma.chatSession.update({
                where: { id: session.id },
                data: {
                  operatorId: newOperator.id,
                  operatorJoinedAt: now,
                },
              });

              // Notify new operator
              io.to(`operator:${newOperator.id}`).emit('chat_reassigned', {
                sessionId: session.id,
                userName: session.userName,
                reason: 'operator_timeout',
              });

              // Notify user
              io.to(`chat:${session.id}`).emit('operator_changed', {
                oldOperatorName: operator.name,
                newOperatorName: newOperator.name,
                message: `${newOperator.name} ha preso in carico la chat`,
              });

              console.log(
                `🔄 Chat ${session.id} reassigned from ${operator.name} to ${newOperator.name}`
              );
            } else {
              // No operators available - set chat to WAITING
              await prisma.chatSession.update({
                where: { id: session.id },
                data: {
                  status: 'WAITING',
                  operatorId: null,
                },
              });

              // Notify user
              io.to(`chat:${session.id}`).emit('operator_disconnected', {
                message: 'Operatore disconnesso. In attesa di un nuovo operatore...',
              });

              console.log(
                `⏳ Chat ${session.id} set to WAITING - no operators available`
              );
            }
          }
        }
      } catch (error) {
        console.error('Operator timeout monitor error:', error);
      }
    }, CHECK_INTERVAL);

    console.log('✅ Operator timeout monitor started');
  }
}

export default new BackgroundJobsService();
