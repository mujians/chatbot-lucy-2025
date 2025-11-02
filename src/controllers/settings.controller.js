import { prisma } from '../server.js';
import { emailService } from '../services/email.service.js';
import { twilioService } from '../services/twilio.service.js';
import { encrypt, decrypt, shouldEncrypt } from '../utils/encryption.js';

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

    // Decrypt sensitive settings before sending
    const decryptedSettings = settings.map(setting => ({
      ...setting,
      value: shouldEncrypt(setting.key) ? decrypt(setting.value) : setting.value,
    }));

    res.json({
      success: true,
      data: { settings: decryptedSettings },
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

    // Decrypt sensitive setting before sending
    const decryptedSetting = {
      ...setting,
      value: shouldEncrypt(setting.key) ? decrypt(setting.value) : setting.value,
    };

    res.json({
      success: true,
      data: decryptedSetting,
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

    // Encrypt sensitive value before saving
    const valueToSave = shouldEncrypt(key) ? encrypt(value) : value;

    // Update setting
    const updated = await prisma.systemSettings.update({
      where: { key },
      data: {
        value: valueToSave,
        updatedBy: req.operator.id, // Track who updated
      },
    });

    // Decrypt before sending response
    const decryptedUpdated = {
      ...updated,
      value: shouldEncrypt(key) ? decrypt(updated.value) : updated.value,
    };

    res.json({
      success: true,
      data: decryptedUpdated,
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

    // Encrypt sensitive value before saving
    const valueToSave = shouldEncrypt(key) ? encrypt(value) : value;

    const setting = await prisma.systemSettings.upsert({
      where: { key },
      update: {
        value: valueToSave,
        ...(description && { description }),
        ...(category && { category }),
        updatedBy: req.operator.id,
      },
      create: {
        key,
        value: valueToSave,
        description,
        category,
        updatedBy: req.operator.id,
      },
    });

    // Decrypt before sending response
    const decryptedSetting = {
      ...setting,
      value: shouldEncrypt(key) ? decrypt(setting.value) : setting.value,
    };

    res.json({
      success: true,
      data: decryptedSetting,
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
 * Bulk update/create settings (P2.3 optimization)
 * POST /api/settings/bulk
 * Body: { settings: [{ key, value, description?, category? }] }
 */
export const bulkUpdateSettings = async (req, res) => {
  try {
    const { settings } = req.body;

    if (!Array.isArray(settings) || settings.length === 0) {
      return res.status(400).json({
        error: { message: 'Settings array is required and must not be empty' },
      });
    }

    // Validate each setting has key and value
    for (const setting of settings) {
      if (!setting.key || setting.value === undefined) {
        return res.status(400).json({
          error: { message: 'Each setting must have key and value' },
        });
      }
    }

    // Use transaction to update all settings atomically
    const results = await prisma.$transaction(async (tx) => {
      const updatedSettings = [];

      for (const setting of settings) {
        // Encrypt sensitive value before saving
        const valueToSave = shouldEncrypt(setting.key) ? encrypt(setting.value) : setting.value;

        const updated = await tx.systemSettings.upsert({
          where: { key: setting.key },
          update: {
            value: valueToSave,
            ...(setting.description && { description: setting.description }),
            ...(setting.category && { category: setting.category }),
            updatedBy: req.operator.id,
          },
          create: {
            key: setting.key,
            value: valueToSave,
            description: setting.description,
            category: setting.category,
            updatedBy: req.operator.id,
          },
        });

        // Decrypt before adding to results
        updatedSettings.push({
          ...updated,
          value: shouldEncrypt(setting.key) ? decrypt(updated.value) : updated.value,
        });
      }

      return updatedSettings;
    });

    res.json({
      success: true,
      data: { settings: results },
      message: `${results.length} settings updated successfully`,
    });
  } catch (error) {
    console.error('Bulk update settings error:', error);
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

/**
 * Get public widget settings (no auth required)
 * GET /api/settings/public
 * Returns only widget-related settings for frontend widget
 */
export const getPublicSettings = async (req, res) => {
  try {
    // Fetch only widget-related settings
    const widgetKeys = [
      'widgetPrimaryColor',
      'widgetPosition',
      'widgetGreeting',
      'widgetTitle',
    ];

    const settings = await prisma.systemSettings.findMany({
      where: {
        key: { in: widgetKeys },
      },
      select: {
        key: true,
        value: true,
        updatedAt: true,
      },
    });

    // Convert array to object for easier access
    // Strip quotes from values (legacy from when values were stored as JSON)
    const settingsMap = settings.reduce((acc, setting) => {
      let value = setting.value;
      // Remove surrounding quotes if present
      if (typeof value === 'string' && value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      acc[setting.key] = value;
      return acc;
    }, {});

    // Find the most recent update timestamp for cache busting
    const lastUpdated = settings.reduce((latest, setting) => {
      const settingDate = new Date(setting.updatedAt);
      return settingDate > latest ? settingDate : latest;
    }, new Date(0));

    // Set defaults if not configured
    const widgetSettings = {
      primaryColor: settingsMap.widgetPrimaryColor || '#4F46E5',
      position: settingsMap.widgetPosition || 'bottom-right',
      greeting: settingsMap.widgetGreeting || 'Ciao! Come possiamo aiutarti?',
      title: settingsMap.widgetTitle || 'Chat con noi',
      version: lastUpdated.getTime(), // Timestamp for cache busting
    };

    // Set cache control headers to prevent stale cached settings
    // Short TTL (5 minutes) with must-revalidate ensures widgets get updates quickly
    res.set({
      'Cache-Control': 'public, max-age=300, must-revalidate', // 5 minutes cache
      'ETag': `"${lastUpdated.getTime()}"`, // ETag based on last update
      'Last-Modified': lastUpdated.toUTCString(),
    });

    res.json({
      success: true,
      data: widgetSettings,
    });
  } catch (error) {
    console.error('Get public settings error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' },
    });
  }
};

/**
 * Test email connection (SMTP)
 * POST /api/settings/test-email
 * Body: { to?: string } - optional test email address (defaults to operator's email)
 */
export const testEmailConnection = async (req, res) => {
  try {
    const { to } = req.body;
    const testEmail = to || req.operator.email;

    if (!testEmail) {
      return res.status(400).json({
        error: { message: 'Test email address required' },
      });
    }

    // Test sending email
    const result = await emailService.sendEmail({
      to: testEmail,
      subject: 'Test Email from Lucine Chatbot',
      text: `This is a test email sent at ${new Date().toISOString()}.\n\nIf you received this, your SMTP configuration is working correctly!`,
    });

    if (result.success) {
      res.json({
        success: true,
        message: 'Test email sent successfully',
        data: {
          recipient: testEmail,
          messageId: result.messageId,
        },
      });
    } else {
      res.status(500).json({
        error: {
          message: 'Failed to send test email',
          details: result.error,
        },
      });
    }
  } catch (error) {
    console.error('Test email connection error:', error);
    res.status(500).json({
      error: {
        message: 'Email connection test failed',
        details: error.message,
      },
    });
  }
};

/**
 * Test WhatsApp connection (Twilio)
 * POST /api/settings/test-whatsapp
 * Body: { to: string } - WhatsApp number to test (required)
 */
export const testWhatsAppConnection = async (req, res) => {
  try {
    const { to } = req.body;

    if (!to) {
      return res.status(400).json({
        error: { message: 'Test WhatsApp number required' },
      });
    }

    // Test sending WhatsApp message
    const result = await twilioService.sendWhatsAppMessage(
      to,
      `Test message from Lucine Chatbot sent at ${new Date().toISOString()}. If you received this, your Twilio configuration is working correctly!`
    );

    if (result.success) {
      res.json({
        success: true,
        message: 'Test WhatsApp message sent successfully',
        data: {
          recipient: to,
          sid: result.sid,
        },
      });
    } else {
      res.status(500).json({
        error: {
          message: 'Failed to send test WhatsApp message',
          details: result.error,
        },
      });
    }
  } catch (error) {
    console.error('Test WhatsApp connection error:', error);
    res.status(500).json({
      error: {
        message: 'WhatsApp connection test failed',
        details: error.message,
      },
    });
  }
};
