import { prisma } from '../server.js';
import { config } from '../config/index.js';

/**
 * Comprehensive system health check
 * GET /api/health/system
 */
export const getSystemHealth = async (req, res) => {
  try {
    const healthData = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      checks: {},
    };

    // 1. Database connectivity check
    try {
      await prisma.$queryRaw`SELECT 1`;
      healthData.checks.database = {
        status: 'healthy',
        message: 'Database connection successful',
      };
    } catch (error) {
      healthData.checks.database = {
        status: 'unhealthy',
        message: 'Database connection failed',
        error: error.message,
      };
      healthData.status = 'unhealthy';
    }

    // 2. Operator statistics
    try {
      const totalOperators = await prisma.operator.count();
      const onlineOperators = await prisma.operator.count({
        where: { isOnline: true },
      });
      const availableOperators = await prisma.operator.count({
        where: { isOnline: true, isAvailable: true },
      });

      // Get detailed operator states
      const operatorStates = await prisma.operator.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          isOnline: true,
          isAvailable: true,
          lastSeenAt: true,
        },
        orderBy: { lastSeenAt: 'desc' },
      });

      healthData.checks.operators = {
        status: 'healthy',
        total: totalOperators,
        online: onlineOperators,
        available: availableOperators,
        details: operatorStates,
      };

      // Warning if no available operators
      if (availableOperators === 0) {
        healthData.checks.operators.warning = 'No operators currently available to handle chats';
      }
    } catch (error) {
      healthData.checks.operators = {
        status: 'unhealthy',
        message: 'Failed to fetch operator statistics',
        error: error.message,
      };
      healthData.status = 'unhealthy';
    }

    // 3. Chat sessions statistics
    try {
      const totalSessions = await prisma.chatSession.count();
      const activeSessions = await prisma.chatSession.count({
        where: { status: 'WITH_OPERATOR' },
      });
      const waitingSessions = await prisma.chatSession.count({
        where: { status: 'WAITING' },
      });

      healthData.checks.chatSessions = {
        status: 'healthy',
        total: totalSessions,
        active: activeSessions,
        waiting: waitingSessions,
      };

      // Warning if sessions waiting
      if (waitingSessions > 0) {
        healthData.checks.chatSessions.warning = `${waitingSessions} session(s) waiting for operator`;
      }
    } catch (error) {
      healthData.checks.chatSessions = {
        status: 'unhealthy',
        message: 'Failed to fetch chat session statistics',
        error: error.message,
      };
    }

    // 4. Ticket statistics
    try {
      const totalTickets = await prisma.ticket.count();
      const openTickets = await prisma.ticket.count({
        where: { status: 'OPEN' },
      });
      const assignedTickets = await prisma.ticket.count({
        where: { status: 'ASSIGNED' },
      });

      healthData.checks.tickets = {
        status: 'healthy',
        total: totalTickets,
        open: openTickets,
        assigned: assignedTickets,
      };
    } catch (error) {
      healthData.checks.tickets = {
        status: 'unhealthy',
        message: 'Failed to fetch ticket statistics',
        error: error.message,
      };
    }

    // 5. Recent activity (last 24 hours)
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const recentChats = await prisma.chatSession.count({
        where: { createdAt: { gte: oneDayAgo } },
      });
      const recentTickets = await prisma.ticket.count({
        where: { createdAt: { gte: oneDayAgo } },
      });

      healthData.checks.recentActivity = {
        status: 'healthy',
        period: 'last 24 hours',
        chats: recentChats,
        tickets: recentTickets,
      };
    } catch (error) {
      healthData.checks.recentActivity = {
        status: 'unhealthy',
        message: 'Failed to fetch recent activity',
        error: error.message,
      };
    }

    // 6. Configuration check
    healthData.checks.configuration = {
      status: 'healthy',
      environment: config.nodeEnv,
      jwtConfigured: !!config.jwtSecret,
      openaiConfigured: !!config.openaiApiKey,
      databaseConfigured: !!config.databaseUrl,
    };

    // 7. Migration status check
    try {
      // Check if isAvailable column exists
      const result = await prisma.$queryRaw`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'Operator'
        AND column_name = 'isAvailable';
      `;

      healthData.checks.migrations = {
        status: result.length > 0 ? 'healthy' : 'unhealthy',
        isAvailableColumn: result.length > 0 ? 'exists' : 'missing',
        message: result.length > 0
          ? 'All required migrations applied'
          : 'isAvailable column missing - migrations not applied',
      };

      if (result.length === 0) {
        healthData.status = 'unhealthy';
      }
    } catch (error) {
      healthData.checks.migrations = {
        status: 'unhealthy',
        message: 'Failed to check migration status',
        error: error.message,
      };
    }

    // Overall health status
    const unhealthyChecks = Object.values(healthData.checks).filter(
      check => check.status === 'unhealthy'
    ).length;

    if (unhealthyChecks > 0) {
      healthData.status = 'unhealthy';
      healthData.message = `${unhealthyChecks} unhealthy check(s) detected`;
    } else {
      healthData.message = 'All systems operational';
    }

    res.json({
      success: true,
      data: healthData,
    });
  } catch (error) {
    console.error('❌ System health check error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Health check failed', details: error.message },
      data: {
        timestamp: new Date().toISOString(),
        status: 'unhealthy',
        message: 'Critical system error',
      },
    });
  }
};

/**
 * Quick health check (for monitoring/uptime)
 * GET /api/health
 */
export const getHealthQuick = async (req, res) => {
  try {
    // Just check database connectivity
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
};

/**
 * Get system logs (last N entries)
 * GET /api/health/logs?limit=50
 */
export const getSystemLogs = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;

    // Get recent activity as "logs"
    const recentChats = await prisma.chatSession.findMany({
      take: Math.floor(limit / 3),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        userName: true,
        operatorId: true,
        createdAt: true,
        closedAt: true,
      },
    });

    const recentTickets = await prisma.ticket.findMany({
      take: Math.floor(limit / 3),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        userName: true,
        operatorId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const logs = [
      ...recentChats.map(chat => ({
        timestamp: chat.createdAt,
        type: 'chat',
        event: `Chat ${chat.status}`,
        details: {
          sessionId: chat.id,
          userName: chat.userName,
          operatorId: chat.operatorId,
          status: chat.status,
        },
      })),
      ...recentTickets.map(ticket => ({
        timestamp: ticket.createdAt,
        type: 'ticket',
        event: `Ticket ${ticket.status}`,
        details: {
          ticketId: ticket.id,
          userName: ticket.userName,
          operatorId: ticket.operatorId,
          status: ticket.status,
        },
      })),
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, limit);

    res.json({
      success: true,
      data: {
        logs,
        count: logs.length,
      },
    });
  } catch (error) {
    console.error('❌ Get system logs error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch logs', details: error.message },
    });
  }
};
