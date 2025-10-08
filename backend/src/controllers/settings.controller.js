import { prisma } from '../server.js';

/**
 * Get all system settings
 * GET /api/settings
 * Query params: ?category=chat|ai|notification|general
 */
export const getSettings = async (req, res) => {
  try {
    const { category } = req.query;

    const where = category ? { category } : {};

    const settings = await prisma.systemSettings.findMany({
      where,
      orderBy: { key: 'asc' },
    });

    res.json({
      success: true,
      data: { settings },
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};

/**
 * Get single setting by key
 * GET /api/settings/:key
 */
export const getSetting = async (req, res) => {
  try {
    const { key } = req.params;

    const setting = await prisma.systemSettings.findUnique({
      where: { key },
    });

    if (!setting) {
      return res.status(404).json({
        error: { message: 'Setting not found' },
      });
    }

    res.json({
      success: true,
      data: setting,
    });
  } catch (error) {
    console.error('Get setting error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};

/**
 * Update setting by key
 * PUT /api/settings/:key
 * Body: { value: any }
 */
export const updateSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    if (value === undefined) {
      return res.status(400).json({
        error: { message: 'Value is required' },
      });
    }

    // Check if setting exists
    const existing = await prisma.systemSettings.findUnique({
      where: { key },
    });

    if (!existing) {
      return res.status(404).json({
        error: { message: 'Setting not found' },
      });
    }

    // Update setting
    const updated = await prisma.systemSettings.update({
      where: { key },
      data: {
        value,
        updatedBy: req.operator.id, // Track who updated
      },
    });

    res.json({
      success: true,
      data: updated,
      message: 'Setting updated successfully',
    });
  } catch (error) {
    console.error('Update setting error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};

/**
 * Create or update setting (upsert)
 * POST /api/settings
 * Body: { key, value, description?, category? }
 */
export const upsertSetting = async (req, res) => {
  try {
    const { key, value, description, category } = req.body;

    if (!key || value === undefined) {
      return res.status(400).json({
        error: { message: 'Key and value are required' },
      });
    }

    const setting = await prisma.systemSettings.upsert({
      where: { key },
      update: {
        value,
        ...(description && { description }),
        ...(category && { category }),
        updatedBy: req.operator.id,
      },
      create: {
        key,
        value,
        description,
        category,
        updatedBy: req.operator.id,
      },
    });

    res.json({
      success: true,
      data: setting,
      message: 'Setting saved successfully',
    });
  } catch (error) {
    console.error('Upsert setting error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};

/**
 * Delete setting
 * DELETE /api/settings/:key
 */
export const deleteSetting = async (req, res) => {
  try {
    const { key } = req.params;

    await prisma.systemSettings.delete({
      where: { key },
    });

    res.json({
      success: true,
      message: 'Setting deleted successfully',
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        error: { message: 'Setting not found' },
      });
    }

    console.error('Delete setting error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};
