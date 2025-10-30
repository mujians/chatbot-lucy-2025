import { prisma } from '../server.js';

/**
 * Get all canned responses (for the authenticated operator)
 * GET /api/canned-responses
 */
export const getCannedResponses = async (req, res) => {
  try {
    const operatorId = req.operator.id;

    const responses = await prisma.cannedResponse.findMany({
      where: {
        OR: [
          { createdBy: operatorId }, // Own responses
          { isGlobal: true },         // Global responses
        ],
        isActive: true,
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { isGlobal: 'desc' },
        { timesUsed: 'desc' },
        { title: 'asc' },
      ],
    });

    res.json({
      success: true,
      data: responses,
    });
  } catch (error) {
    console.error('Get canned responses error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};

/**
 * Get single canned response by ID
 * GET /api/canned-responses/:id
 */
export const getCannedResponse = async (req, res) => {
  try {
    const { id } = req.params;
    const operatorId = req.operator.id;

    const response = await prisma.cannedResponse.findFirst({
      where: {
        id,
        OR: [
          { createdBy: operatorId },
          { isGlobal: true },
        ],
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!response) {
      return res.status(404).json({
        error: { message: 'Canned response not found' },
      });
    }

    res.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Get canned response error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};

/**
 * Create new canned response
 * POST /api/canned-responses
 */
export const createCannedResponse = async (req, res) => {
  try {
    const { title, content, shortcut, isGlobal } = req.body;
    const operatorId = req.operator.id;

    if (!title || !content) {
      return res.status(400).json({
        error: { message: 'Title and content are required' },
      });
    }

    // Only admins can create global responses
    if (isGlobal && req.operator.role !== 'ADMIN') {
      return res.status(403).json({
        error: { message: 'Only admins can create global responses' },
      });
    }

    // Check if shortcut already exists (if provided)
    if (shortcut) {
      const existing = await prisma.cannedResponse.findFirst({
        where: {
          shortcut,
          isActive: true,
        },
      });

      if (existing) {
        return res.status(400).json({
          error: { message: 'Shortcut already in use' },
        });
      }
    }

    const response = await prisma.cannedResponse.create({
      data: {
        title,
        content,
        shortcut: shortcut || null,
        isGlobal: isGlobal || false,
        createdBy: operatorId,
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Create canned response error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};

/**
 * Update canned response
 * PUT /api/canned-responses/:id
 */
export const updateCannedResponse = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, shortcut, isGlobal, isActive } = req.body;
    const operatorId = req.operator.id;

    // Find existing response
    const existing = await prisma.cannedResponse.findFirst({
      where: {
        id,
        createdBy: operatorId, // Can only edit own responses
      },
    });

    if (!existing) {
      return res.status(404).json({
        error: { message: 'Canned response not found or you cannot edit it' },
      });
    }

    // Only admins can update isGlobal
    if (isGlobal !== undefined && isGlobal !== existing.isGlobal && req.operator.role !== 'ADMIN') {
      return res.status(403).json({
        error: { message: 'Only admins can change global status' },
      });
    }

    // Check if shortcut already exists (if changing)
    if (shortcut && shortcut !== existing.shortcut) {
      const shortcutExists = await prisma.cannedResponse.findFirst({
        where: {
          shortcut,
          isActive: true,
          id: { not: id },
        },
      });

      if (shortcutExists) {
        return res.status(400).json({
          error: { message: 'Shortcut already in use' },
        });
      }
    }

    const response = await prisma.cannedResponse.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content }),
        ...(shortcut !== undefined && { shortcut: shortcut || null }),
        ...(isGlobal !== undefined && { isGlobal }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Update canned response error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};

/**
 * Delete canned response (soft delete by setting isActive to false)
 * DELETE /api/canned-responses/:id
 */
export const deleteCannedResponse = async (req, res) => {
  try {
    const { id } = req.params;
    const operatorId = req.operator.id;

    // Find existing response
    const existing = await prisma.cannedResponse.findFirst({
      where: {
        id,
        createdBy: operatorId, // Can only delete own responses
      },
    });

    if (!existing) {
      return res.status(404).json({
        error: { message: 'Canned response not found or you cannot delete it' },
      });
    }

    await prisma.cannedResponse.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({
      success: true,
      message: 'Canned response deleted successfully',
    });
  } catch (error) {
    console.error('Delete canned response error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};

/**
 * Use canned response (increment usage counter)
 * POST /api/canned-responses/:id/use
 */
export const useCannedResponse = async (req, res) => {
  try {
    const { id } = req.params;
    const operatorId = req.operator.id;

    const response = await prisma.cannedResponse.findFirst({
      where: {
        id,
        OR: [
          { createdBy: operatorId },
          { isGlobal: true },
        ],
        isActive: true,
      },
    });

    if (!response) {
      return res.status(404).json({
        error: { message: 'Canned response not found' },
      });
    }

    // Increment usage counter
    const updated = await prisma.cannedResponse.update({
      where: { id },
      data: {
        timesUsed: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });

    res.json({
      success: true,
      data: {
        content: updated.content,
        timesUsed: updated.timesUsed,
      },
    });
  } catch (error) {
    console.error('Use canned response error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};
