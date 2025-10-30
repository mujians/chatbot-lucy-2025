import nodemailer from 'nodemailer';
import { config } from '../config/index.js';
import { prisma } from '../server.js';

class EmailService {
  constructor() {
    this.transporter = null;
    this.initialized = false;
    this.from = null;
  }

  /**
   * Initialize email transporter with settings from database or env
   */
  async initialize() {
    try {
      // Try to get settings from database first
      const settings = await this.getSettingsFromDatabase();

      const smtpHost = settings?.smtpHost || config.email.smtp.host;
      const smtpPort = settings?.smtpPort || config.email.smtp.port;
      const smtpUser = settings?.smtpUser || config.email.smtp.user;
      const smtpPass = settings?.smtpPass || config.email.smtp.pass;
      this.from = settings?.emailFrom || config.email.from;

      if (!smtpHost || !smtpUser || !smtpPass) {
        console.warn('⚠️  SMTP credentials not configured');
        this.initialized = false;
        return false;
      }

      // Create nodemailer transporter
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465, // true for 465, false for other ports
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      // Verify connection
      await this.transporter.verify();
      this.initialized = true;
      console.log('✅ Email service initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Email service:', error);
      this.initialized = false;
      return false;
    }
  }

  /**
   * Get email settings from database
   */
  async getSettingsFromDatabase() {
    try {
      const smtpHost = await prisma.systemSettings.findUnique({
        where: { key: 'smtpHost' },
      });
      const smtpPort = await prisma.systemSettings.findUnique({
        where: { key: 'smtpPort' },
      });
      const smtpUser = await prisma.systemSettings.findUnique({
        where: { key: 'smtpUser' },
      });
      const smtpPass = await prisma.systemSettings.findUnique({
        where: { key: 'smtpPassword' },
      });
      const emailFrom = await prisma.systemSettings.findUnique({
        where: { key: 'emailFrom' },
      });

      return {
        smtpHost: smtpHost?.value,
        smtpPort: smtpPort?.value ? parseInt(smtpPort.value) : null,
        smtpUser: smtpUser?.value,
        smtpPass: smtpPass?.value,
        emailFrom: emailFrom?.value,
      };
    } catch (error) {
      console.error('Failed to get email settings from database:', error);
      return null;
    }
  }

  /**
   * Check if email service is initialized and ready
   */
  isReady() {
    return this.initialized && this.transporter !== null;
  }

  /**
   * Send email
   * @param {Object} options - Email options
   * @param {string} options.to - Recipient email
   * @param {string} options.subject - Email subject
   * @param {string} options.text - Plain text content
   * @param {string} options.html - HTML content (optional)
   * @returns {Promise<Object>} Send result
   */
  async sendEmail({ to, subject, text, html }) {
    if (!this.isReady()) {
      await this.initialize();
      if (!this.isReady()) {
        throw new Error('Email service not initialized. Please configure SMTP credentials.');
      }
    }

    try {
      const mailOptions = {
        from: this.from,
        to,
        subject,
        text,
        ...(html && { html }),
      };

      const result = await this.transporter.sendMail(mailOptions);

      console.log(`📧 Email sent: ${result.messageId}`);
      return {
        success: true,
        messageId: result.messageId,
        response: result.response,
      };
    } catch (error) {
      console.error('❌ Failed to send email:', error);
      throw error;
    }
  }

  /**
   * Send notification email to operator
   * @param {string} operatorId - Operator ID
   * @param {string} subject - Email subject
   * @param {string} message - Email message
   */
  async sendOperatorNotification(operatorId, subject, message) {
    try {
      const operator = await prisma.operator.findUnique({
        where: { id: operatorId },
        select: {
          email: true,
          name: true,
          notificationPreferences: true,
        },
      });

      if (!operator?.email) {
        console.log(`No email for operator ${operatorId}`);
        return { success: false, reason: 'no_email' };
      }

      // Check notification preferences
      const prefs = operator.notificationPreferences;
      if (prefs && typeof prefs === 'object' && prefs.email === false) {
        console.log(`Email notifications disabled for operator ${operatorId}`);
        return { success: false, reason: 'notifications_disabled' };
      }

      const html = `
        <h2>Ciao ${operator.name},</h2>
        <p>${message}</p>
        <br>
        <p><em>Lucine di Natale - Dashboard Operatore</em></p>
      `;

      return await this.sendEmail({
        to: operator.email,
        subject,
        text: message,
        html,
      });
    } catch (error) {
      console.error('Failed to send operator notification:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send ticket notification
   * @param {string} email - Recipient email
   * @param {Object} ticket - Ticket data
   */
  async sendTicketNotification(email, ticket) {
    const subject = `Nuovo Ticket: ${ticket.subject}`;
    const text = `
Ciao,

Hai ricevuto un nuovo ticket:

Oggetto: ${ticket.subject}
Priorità: ${ticket.priority}
Stato: ${ticket.status}

Descrizione:
${ticket.description}

Accedi alla dashboard per gestire il ticket.

---
Lucine di Natale
    `;

    const html = `
      <h2>Nuovo Ticket Ricevuto</h2>
      <p><strong>Oggetto:</strong> ${ticket.subject}</p>
      <p><strong>Priorità:</strong> <span style="color: ${
        ticket.priority === 'URGENT' ? '#dc2626' : ticket.priority === 'HIGH' ? '#f59e0b' : '#059669'
      }">${ticket.priority}</span></p>
      <p><strong>Stato:</strong> ${ticket.status}</p>
      <hr>
      <h3>Descrizione:</h3>
      <p>${ticket.description.replace(/\n/g, '<br>')}</p>
      <br>
      <p><em>Accedi alla dashboard per gestire il ticket.</em></p>
    `;

    return await this.sendEmail({ to: email, subject, text, html });
  }

  /**
   * P0.4: Send chat transcript email
   * @param {string} email - User email
   * @param {Object} session - Chat session data
   */
  async sendChatTranscript(email, session) {
    try {
      if (!email) {
        console.log('No email provided for chat transcript');
        return { success: false, reason: 'no_email' };
      }

      const messages = JSON.parse(session.messages || '[]');
      const userName = session.userName || 'Cliente';
      const sessionDate = new Date(session.createdAt).toLocaleString('it-IT');

      // Format messages for email
      const messagesHtml = messages
        .map((msg) => {
          const time = new Date(msg.timestamp).toLocaleTimeString('it-IT', {
            hour: '2-digit',
            minute: '2-digit',
          });

          let senderName = '';
          let bgColor = '';
          let textColor = '#000';

          if (msg.type === 'user') {
            senderName = userName;
            bgColor = '#f3f4f6';
          } else if (msg.type === 'operator') {
            senderName = msg.operatorName || 'Operatore';
            bgColor = '#dbeafe';
          } else if (msg.type === 'bot') {
            senderName = 'Assistente AI';
            bgColor = '#e0e7ff';
          } else {
            senderName = 'Sistema';
            bgColor = '#fef3c7';
            textColor = '#92400e';
          }

          return `
            <div style="margin-bottom: 12px; padding: 12px; background-color: ${bgColor}; border-radius: 8px;">
              <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">
                <strong>${senderName}</strong> - ${time}
              </div>
              <div style="color: ${textColor};">${msg.content.replace(/\n/g, '<br>')}</div>
            </div>
          `;
        })
        .join('');

      const subject = 'Trascrizione della tua chat - Lucine di Natale';

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #4f46e5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0;">Trascrizione Chat</h1>
          </div>

          <div style="background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb;">
            <p>Ciao ${userName},</p>
            <p>Ecco la trascrizione completa della tua conversazione con noi.</p>

            <div style="background-color: white; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Data:</strong> ${sessionDate}</p>
              <p style="margin: 5px 0;"><strong>ID Sessione:</strong> ${session.id}</p>
            </div>

            <h2 style="color: #4f46e5; border-bottom: 2px solid #4f46e5; padding-bottom: 8px;">Messaggi</h2>

            <div style="margin-top: 20px;">
              ${messagesHtml}
            </div>
          </div>

          <div style="background-color: #f3f4f6; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; margin-top: 0;">
            <p style="margin: 0; font-size: 14px; color: #6b7280;">
              Grazie per averci contattato!<br>
              <em>Lucine di Natale - Assistenza Clienti</em>
            </p>
          </div>
        </body>
        </html>
      `;

      const text = `
Ciao ${userName},

Ecco la trascrizione della tua conversazione:

Data: ${sessionDate}
ID Sessione: ${session.id}

MESSAGGI:
${messages.map((msg) => {
  const time = new Date(msg.timestamp).toLocaleTimeString('it-IT');
  const sender = msg.type === 'user' ? userName : msg.type === 'operator' ? (msg.operatorName || 'Operatore') : msg.type === 'bot' ? 'Assistente AI' : 'Sistema';
  return `[${time}] ${sender}: ${msg.content}`;
}).join('\n\n')}

---
Grazie per averci contattato!
Lucine di Natale - Assistenza Clienti
      `;

      const result = await this.sendEmail({
        to: email,
        subject,
        text,
        html,
      });

      console.log(`✅ Chat transcript sent to ${email} for session ${session.id}`);
      return result;
    } catch (error) {
      console.error('Failed to send chat transcript:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Test email connection
   * @returns {Promise<boolean>} Connection test result
   */
  async testConnection() {
    try {
      await this.initialize();
      return this.isReady();
    } catch (error) {
      console.error('Email connection test failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const emailService = new EmailService();
