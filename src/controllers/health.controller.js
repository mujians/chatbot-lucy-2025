import { prisma } from '../server.js';
import { config } from '../config/index.js';

/**
 * GET /health/system
 * Get comprehensive system health status
 * ADMIN ONLY
 */
export const getSystemHealth = async (req, res) => {
  try {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.nodeEnv,
      version: '2.2.0',

      services: {},
      database: {},
      memory: {},
    };

    // Database health
    try {
      await prisma.$queryRaw`SELECT 1`;
      health.database = {
        status: 'connected',
        type: 'PostgreSQL',
      };

      // Get DB stats
      const sessionCount = await prisma.chatSession.count();
      const operatorCount = await prisma.operator.count();
      const ticketCount = await prisma.ticket.count();
      const knowledgeCount = await prisma.knowledgeBase.count();

      health.database.stats = {
        sessions: sessionCount,
        operators: operatorCount,
        tickets: ticketCount,
        knowledgeItems: knowledgeCount,
      };
    } catch (error) {
      health.database = {
        status: 'disconnected',
        error: error.message,
      };
      health.status = 'degraded';
    }

    // OpenAI Service
    health.services.openai = {
      status: config.openaiApiKey ? 'configured' : 'not_configured',
      model: config.openaiModel || 'gpt-4-turbo-preview',
    };

    // Email Service (SMTP)
    health.services.email = {
      status: (config.smtpHost && config.smtpUser) ? 'configured' : 'not_configured',
      host: config.smtpHost || 'not_set',
    };

    // WhatsApp Service (Twilio)
    health.services.whatsapp = {
      status: (config.twilioAccountSid && config.twilioWhatsappNumber) ? 'configured' : 'not_configured',
    };

    // Cloudinary Service
    health.services.cloudinary = {
      status: config.cloudinaryCloudName ? 'configured' : 'not_configured',
    };

    // Memory usage
    const memoryUsage = process.memoryUsage();
    health.memory = {
      used: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
      total: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
    };

    res.json({
      success: true,
      data: health,
    });
  } catch (error) {
    console.error('❌ Health check error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to get system health',
        details: error.message,
      },
    });
  }
};

/**
 * GET /health/logs
 * Get recent application logs
 * ADMIN ONLY
 */
export const getLogs = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;

    // For now, return mock logs
    // In production, you would read from actual log files or logging service
    const logs = [
      {
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: 'System health check requested',
        source: 'health.controller',
      },
      {
        timestamp: new Date(Date.now() - 60000).toISOString(),
        level: 'INFO',
        message: 'Background jobs running',
        source: 'background-jobs.service',
      },
    ];

    res.json({
      success: true,
      data: {
        logs: logs.slice(0, limit),
        total: logs.length,
        limit,
      },
    });
  } catch (error) {
    console.error('❌ Get logs error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to get logs',
        details: error.message,
      },
    });
  }
};
