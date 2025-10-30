import { prisma } from '../server.js';
import { emailService } from '../services/email.service.js';
import { twilioService } from '../services/twilio.service.js';

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

    if (value === undefined || value === null) {
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

    // Convert value to string for database storage
    const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);

    // Update setting
    const updated = await prisma.systemSettings.update({
      where: { key },
      data: {
        value: stringValue,
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
      error: {
        message: 'Internal server error',
        details: error.message
      },
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

    if (!key || value === undefined || value === null) {
      return res.status(400).json({
        error: { message: 'Key and value are required' },
      });
    }

    // Convert value to string for database storage
    // Database schema expects String @db.Text
    const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);

    const setting = await prisma.systemSettings.upsert({
      where: { key },
      update: {
        value: stringValue,
        ...(description && { description }),
        ...(category && { category }),
        updatedBy: req.operator.id,
      },
      create: {
        key,
        value: stringValue,
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
    console.error('Failed key:', key, 'value:', value);
    res.status(500).json({
      error: {
        message: 'Internal server error',
        details: error.message
      },
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

    // Re-initialize email service with latest settings from database
    await emailService.initialize();

    if (!emailService.isReady()) {
      return res.status(400).json({
        error: {
          message: 'SMTP not configured',
          details: 'Please configure SMTP settings (Host, Port, User, Password) before testing.',
          hint: 'For SendGrid: Host=smtp.sendgrid.net, Port=587, User=apikey, Password=<your_api_key>',
        },
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
