import { prisma } from '../server.js';

/**
 * Get dashboard analytics/statistics
 * GET /api/analytics/dashboard
 */
export const getDashboardStats = async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;

    // Build date filter
    const dateFilter = {};
    if (dateFrom || dateTo) {
      dateFilter.createdAt = {};
      if (dateFrom) dateFilter.createdAt.gte = new Date(dateFrom);
      if (dateTo) dateFilter.createdAt.lte = new Date(dateTo);
    }

    // Parallel queries for performance
    const [
      totalChats,
      activeChats,
      waitingChats,
      withOperatorChats,
      closedChats,
      archivedChats,
      flaggedChats,
      totalTickets,
      pendingTickets,
      openTickets,
      resolvedTickets,
      onlineOperators,
      availableOperators,
      totalOperators,
    ] = await Promise.all([
      // Chat stats
      prisma.chatSession.count({
        where: { deletedAt: null, ...dateFilter },
      }),
      prisma.chatSession.count({
        where: { status: 'ACTIVE', deletedAt: null, ...dateFilter },
      }),
      prisma.chatSession.count({
        where: { status: 'WAITING', deletedAt: null, ...dateFilter },
      }),
      prisma.chatSession.count({
        where: { status: 'WITH_OPERATOR', deletedAt: null, ...dateFilter },
      }),
      prisma.chatSession.count({
        where: { status: 'CLOSED', deletedAt: null, ...dateFilter },
      }),
      prisma.chatSession.count({
        where: { isArchived: true, deletedAt: null, ...dateFilter },
      }),
      prisma.chatSession.count({
        where: { isFlagged: true, deletedAt: null, ...dateFilter },
      }),

      // Ticket stats
      prisma.ticket.count({ where: dateFilter }),
      prisma.ticket.count({
        where: { status: 'PENDING', ...dateFilter },
      }),
      prisma.ticket.count({
        where: { status: 'OPEN', ...dateFilter },
      }),
      prisma.ticket.count({
        where: { status: 'RESOLVED', ...dateFilter },
      }),

      // Operator stats
      prisma.operator.count({
        where: { isOnline: true },
      }),
      prisma.operator.count({
        where: { isOnline: true, isAvailable: true },
      }),
      prisma.operator.count(),
    ]);

    // Top operators by chats handled
    const topOperators = await prisma.operator.findMany({
      select: {
        id: true,
        name: true,
        totalChatsHandled: true,
        totalTicketsHandled: true,
        averageRating: true,
      },
      orderBy: { totalChatsHandled: 'desc' },
      take: 5,
    });

    // Chats created in the last 24 hours, grouped by hour
    const oneDayAgo = new Date();
    oneDayAgo.setHours(oneDayAgo.getHours() - 24);

    const recentChats = await prisma.chatSession.findMany({
      where: {
        createdAt: { gte: oneDayAgo },
        deletedAt: null,
      },
      select: {
        createdAt: true,
      },
    });

    // Group by hour
    const chatsByHour = Array(24).fill(0);
    recentChats.forEach((chat) => {
      const hourDiff = Math.floor(
        (new Date() - new Date(chat.createdAt)) / (1000 * 60 * 60)
      );
      if (hourDiff < 24) {
        chatsByHour[23 - hourDiff]++;
      }
    });

    // Calculate average response time (time from WAITING to WITH_OPERATOR)
    const chatsWithOperator = await prisma.chatSession.findMany({
      where: {
        status: 'WITH_OPERATOR',
        operatorJoinedAt: { not: null },
        ...dateFilter,
      },
      select: {
        createdAt: true,
        operatorJoinedAt: true,
      },
      take: 100, // Sample for performance
    });

    let avgResponseTimeMinutes = null;
    if (chatsWithOperator.length > 0) {
      const totalResponseTime = chatsWithOperator.reduce((sum, chat) => {
        const responseTime =
          new Date(chat.operatorJoinedAt) - new Date(chat.createdAt);
        return sum + responseTime;
      }, 0);
      avgResponseTimeMinutes = Math.round(
        totalResponseTime / chatsWithOperator.length / 1000 / 60
      );
    }

    // Calculate average resolution time for tickets
    const resolvedTicketsWithTime = await prisma.ticket.findMany({
      where: {
        status: 'RESOLVED',
        resolvedAt: { not: null },
        ...dateFilter,
      },
      select: {
        createdAt: true,
        resolvedAt: true,
      },
      take: 100, // Sample for performance
    });

    let avgResolutionTimeHours = null;
    if (resolvedTicketsWithTime.length > 0) {
      const totalResolutionTime = resolvedTicketsWithTime.reduce(
        (sum, ticket) => {
          const resolutionTime =
            new Date(ticket.resolvedAt) - new Date(ticket.createdAt);
          return sum + resolutionTime;
        },
        0
      );
      avgResolutionTimeHours = Math.round(
        totalResolutionTime / resolvedTicketsWithTime.length / 1000 / 60 / 60
      );
    }

    // Build response
    const stats = {
      chats: {
        total: totalChats,
        active: activeChats,
        waiting: waitingChats,
        withOperator: withOperatorChats,
        closed: closedChats,
        archived: archivedChats,
        flagged: flaggedChats,
      },
      tickets: {
        total: totalTickets,
        pending: pendingTickets,
        open: openTickets,
        resolved: resolvedTickets,
      },
      operators: {
        total: totalOperators,
        online: onlineOperators,
        available: availableOperators,
        topPerformers: topOperators,
      },
      performance: {
        avgResponseTimeMinutes,
        avgResolutionTimeHours,
      },
      trends: {
        chatsByHour,
      },
    };

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};
