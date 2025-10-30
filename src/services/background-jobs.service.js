/**
 * Background Jobs Service
 * Handles periodic tasks and cleanup jobs
 */

import { prisma } from '../server.js';
import { twilioService } from './twilio.service.js';

class BackgroundJobsService {
  constructor() {
    this.intervals = [];
  }

  /**
   * Start all background jobs
   */
  start() {
    console.log('🔄 Starting background jobs...');

    // Initialize Twilio service
    this.initializeTwilio();

    // Clean up old closed sessions (every hour)
    this.intervals.push(
      setInterval(() => this.cleanupOldSessions(), 60 * 60 * 1000)
    );

    // Update operator last seen (every 5 minutes)
    this.intervals.push(
      setInterval(() => this.updateOperatorStatus(), 5 * 60 * 1000)
    );

    console.log('✅ Background jobs started');
  }

  /**
   * Stop all background jobs
   */
  stop() {
    console.log('⏹️  Stopping background jobs...');
    this.intervals.forEach((interval) => clearInterval(interval));
    this.intervals = [];
    console.log('✅ Background jobs stopped');
  }

  /**
   * Initialize Twilio service on startup
   */
  async initializeTwilio() {
    try {
      await twilioService.initialize();
      if (twilioService.isReady()) {
        console.log('✅ Twilio WhatsApp ready');
      } else {
        console.log('⚠️  Twilio WhatsApp not configured');
      }
    } catch (error) {
      console.error('Failed to initialize Twilio:', error);
    }
  }

  /**
   * Clean up old closed chat sessions
   */
  async cleanupOldSessions() {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const result = await prisma.chatSession.updateMany({
        where: {
          status: 'CLOSED',
          closedAt: {
            lt: thirtyDaysAgo,
          },
          deletedAt: null,
        },
        data: {
          deletedAt: new Date(),
        },
      });

      if (result.count > 0) {
        console.log(`🧹 Soft deleted ${result.count} old chat sessions`);
      }
    } catch (error) {
      console.error('Failed to cleanup old sessions:', error);
    }
  }

  /**
   * Update operator status based on activity
   * DISABLED: Operators manage their own availability manually
   */
  async updateOperatorStatus() {
    // Auto-offline disabled - operators control their status manually
    // If needed in future, add notification before auto-offline
    return;
  }
}

// Export singleton instance
export default new BackgroundJobsService();
