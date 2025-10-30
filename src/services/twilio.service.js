import twilio from 'twilio';
import { config } from '../config/index.js';
import { prisma } from '../server.js';

class TwilioService {
  constructor() {
    this.client = null;
    this.whatsappNumber = null;
    this.initialized = false;
  }

  /**
   * Initialize Twilio client with settings from database or env
   */
  async initialize() {
    try {
      // Try to get settings from database first
      const settings = await this.getSettingsFromDatabase();

      const accountSid = settings?.twilioAccountSid || config.twilio.accountSid;
      const authToken = settings?.twilioAuthToken || config.twilio.authToken;
      this.whatsappNumber = settings?.twilioWhatsappNumber || config.twilio.whatsappNumber;

      if (!accountSid || !authToken) {
        console.warn('⚠️  Twilio credentials not configured');
        this.initialized = false;
        return false;
      }

      this.client = twilio(accountSid, authToken);
      this.initialized = true;
      console.log('✅ Twilio service initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Twilio:', error);
      this.initialized = false;
      return false;
    }
  }

  /**
   * Get Twilio settings from database
   */
  async getSettingsFromDatabase() {
    try {
      const twilioAccountSid = await prisma.systemSettings.findUnique({
        where: { key: 'twilioAccountSid' },
      });
      const twilioAuthToken = await prisma.systemSettings.findUnique({
        where: { key: 'twilioAuthToken' },
      });
      const twilioWhatsappNumber = await prisma.systemSettings.findUnique({
        where: { key: 'twilioWhatsappNumber' },
      });

      return {
        twilioAccountSid: twilioAccountSid?.value,
        twilioAuthToken: twilioAuthToken?.value,
        twilioWhatsappNumber: twilioWhatsappNumber?.value,
      };
    } catch (error) {
      console.error('Failed to get Twilio settings from database:', error);
      return null;
    }
  }

  /**
   * Check if Twilio is initialized and ready
   */
  isReady() {
    return this.initialized && this.client !== null && this.whatsappNumber !== null;
  }

  /**
   * Send WhatsApp message
   * @param {string} to - Recipient WhatsApp number (format: whatsapp:+1234567890)
   * @param {string} message - Message content
   * @returns {Promise<Object>} Message result
   */
  async sendWhatsAppMessage(to, message) {
    if (!this.isReady()) {
      await this.initialize();
      if (!this.isReady()) {
        throw new Error('Twilio service not initialized. Please configure Twilio credentials.');
      }
    }

    try {
      // Ensure 'whatsapp:' prefix
      const toNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
      const fromNumber = this.whatsappNumber.startsWith('whatsapp:')
        ? this.whatsappNumber
        : `whatsapp:${this.whatsappNumber}`;

      const result = await this.client.messages.create({
        body: message,
        from: fromNumber,
        to: toNumber,
      });

      console.log(`📤 WhatsApp message sent: ${result.sid}`);
      return {
        success: true,
        sid: result.sid,
        status: result.status,
      };
    } catch (error) {
      console.error('❌ Failed to send WhatsApp message:', error);
      throw error;
    }
  }

  /**
   * Send WhatsApp notification to operator
   * @param {string} operatorId - Operator ID
   * @param {string} message - Notification message
   */
  async sendOperatorNotification(operatorId, message) {
    try {
      const operator = await prisma.operator.findUnique({
        where: { id: operatorId },
        select: {
          whatsappNumber: true,
          notificationPreferences: true,
        },
      });

      if (!operator?.whatsappNumber) {
        console.log(`No WhatsApp number for operator ${operatorId}`);
        return { success: false, reason: 'no_whatsapp_number' };
      }

      // Check notification preferences
      const prefs = operator.notificationPreferences;
      if (prefs && typeof prefs === 'object' && prefs.whatsapp === false) {
        console.log(`WhatsApp notifications disabled for operator ${operatorId}`);
        return { success: false, reason: 'notifications_disabled' };
      }

      return await this.sendWhatsAppMessage(operator.whatsappNumber, message);
    } catch (error) {
      console.error('Failed to send operator notification:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Validate Twilio webhook signature
   * @param {string} twilioSignature - X-Twilio-Signature header
   * @param {string} url - Full webhook URL
   * @param {Object} params - Request body parameters
   * @returns {boolean} Is valid
   */
  validateWebhookSignature(twilioSignature, url, params) {
    if (!this.isReady()) {
      console.warn('Cannot validate webhook - Twilio not initialized');
      return false;
    }

    try {
      return twilio.validateRequest(
        config.twilio.authToken,
        twilioSignature,
        url,
        params
      );
    } catch (error) {
      console.error('Webhook validation error:', error);
      return false;
    }
  }

  /**
   * Send template message (for approved WhatsApp templates)
   * @param {string} to - Recipient number
   * @param {string} contentSid - Template SID
   * @param {Object} contentVariables - Template variables
   */
  async sendTemplateMessage(to, contentSid, contentVariables = {}) {
    if (!this.isReady()) {
      await this.initialize();
      if (!this.isReady()) {
        throw new Error('Twilio service not initialized');
      }
    }

    try {
      const toNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
      const fromNumber = this.whatsappNumber.startsWith('whatsapp:')
        ? this.whatsappNumber
        : `whatsapp:${this.whatsappNumber}`;

      const result = await this.client.messages.create({
        contentSid,
        contentVariables: JSON.stringify(contentVariables),
        from: fromNumber,
        to: toNumber,
      });

      return {
        success: true,
        sid: result.sid,
        status: result.status,
      };
    } catch (error) {
      console.error('Failed to send template message:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const twilioService = new TwilioService();
