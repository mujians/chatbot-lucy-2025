import dotenv from 'dotenv';
dotenv.config();

export const config = {
  // Server
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database
  databaseUrl: process.env.DATABASE_URL,

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'lucine-chatbot-secret-key',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  // OpenAI
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
    embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '500'),
  },

  // Twilio
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    whatsappNumber: process.env.TWILIO_WHATSAPP_NUMBER || '+14155238886',
  },

  // Email
  email: {
    from: process.env.EMAIL_FROM || 'noreply@lucine.it',
    smtp: {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  },

  // SMTP (backward compatibility - deprecated, use email.smtp)
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM || 'noreply@lucine.it',
  },

  // URLs
  urls: {
    shopify: process.env.SHOPIFY_SITE_URL || 'https://lucine.it',
    widget: process.env.WIDGET_URL || 'http://localhost:5173',
    dashboard: process.env.DASHBOARD_URL || 'http://localhost:5174',
  },

  // CORS
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:5174').split(','),

  // Session & Chat
  session: {
    ttlHours: parseInt(process.env.SESSION_TTL_HOURS || '24'),
    chatTimeoutMinutes: parseInt(process.env.CHAT_TIMEOUT_MINUTES || '5'),
    operatorTimeoutSeconds: parseInt(process.env.OPERATOR_TIMEOUT_SECONDS || '30'),
  },

  // Knowledge Base
  kb: {
    confidenceThreshold: parseFloat(process.env.KB_CONFIDENCE_THRESHOLD || '0.7'),
    maxResults: parseInt(process.env.KB_MAX_RESULTS || '5'),
  },
};

// Validation
if (!config.jwtSecret || config.jwtSecret === 'lucine-chatbot-secret-key') {
  console.warn('⚠️  JWT_SECRET not set or using default. Insecure for production!');
}

if (!config.openai.apiKey) {
  console.warn('⚠️  OPENAI_API_KEY not set. AI features will not work.');
}

if (!config.twilio.accountSid || !config.twilio.authToken) {
  console.warn('⚠️  Twilio credentials not set. WhatsApp notifications will not work.');
}

export default config;
