import twilio from 'twilio';
import nodemailer from 'nodemailer';
import { config } from '../config/index.js';

// Fix for ES6 import of CommonJS module
const createTransporter = nodemailer.createTransport || nodemailer.default?.createTransport || nodemailer;

// Initialize Twilio client
let twilioClient = null;
if (config.twilio.accountSid && config.twilio.authToken) {
  twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);
}

// Initialize email transporter
let emailTransporter = null;
if (config.email.smtp.host && config.email.smtp.user) {
  // Use the function reference we extracted above
  const createTransportFn = typeof createTransporter === 'function'
    ? createTransporter
    : createTransporter.createTransport;

  emailTransporter = createTransportFn({
    host: config.email.smtp.host,
    port: config.email.smtp.port,
    secure: false, // Use TLS
    auth: {
      user: config.email.smtp.user,
      pass: config.email.smtp.pass,
    },
  });
}

/**
 * Send WhatsApp notification via Twilio
 */
export async function sendWhatsAppNotification(to, message) {
  try {
    if (!twilioClient) {
      console.warn('⚠️  Twilio not configured. WhatsApp notification skipped.');
      console.log(`Would send to ${to}: ${message}`);
      return { success: false, reason: 'Twilio not configured' };
    }

    // Ensure number has whatsapp: prefix
    const whatsappNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

    const result = await twilioClient.messages.create({
      from: config.twilio.whatsappNumber,
      to: whatsappNumber,
      body: message,
    });

    console.log(`✅ WhatsApp sent to ${to}: ${result.sid}`);
    return { success: true, sid: result.sid };
  } catch (error) {
    console.error('❌ WhatsApp notification error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send email notification
 */
export async function sendEmailNotification(to, subject, text, html = null) {
  try {
    if (!emailTransporter) {
      console.warn('⚠️  Email not configured. Email notification skipped.');
      console.log(`Would send to ${to}: ${subject}`);
      return { success: false, reason: 'Email not configured' };
    }

    const mailOptions = {
      from: config.email.from,
      to: to,
      subject: subject,
      text: text,
      html: html || text.replace(/\n/g, '<br>'),
    };

    const result = await emailTransporter.sendMail(mailOptions);

    console.log(`✅ Email sent to ${to}: ${result.messageId}`);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('❌ Email notification error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send notification to operator based on preferences
 */
export async function notifyOperator(operator, notification) {
  const prefs = operator.notificationPreferences || {};

  const results = {};

  // Check quiet hours
  const isQuietTime = checkQuietHours(prefs.quietHours);

  // Email notification
  if (prefs.email?.[notification.type]) {
    results.email = await sendEmailNotification(
      operator.email,
      notification.title,
      notification.message
    );
  }

  // WhatsApp notification (skip during quiet hours)
  if (
    prefs.whatsapp?.[notification.type] &&
    operator.whatsappNumber &&
    !isQuietTime
  ) {
    results.whatsapp = await sendWhatsAppNotification(
      operator.whatsappNumber,
      `${notification.title}\n\n${notification.message}`
    );
  }

  return results;
}

/**
 * Check if current time is in quiet hours
 */
function checkQuietHours(quietHours) {
  if (!quietHours || !quietHours.start || !quietHours.end) {
    return false;
  }

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startHour, startMin] = quietHours.start.split(':').map(Number);
  const [endHour, endMin] = quietHours.end.split(':').map(Number);

  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  // Handle overnight ranges (e.g., 22:00 - 08:00)
  if (startMinutes > endMinutes) {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}
