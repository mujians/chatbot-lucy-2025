import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config/index.js';
import { PrismaClient } from '@prisma/client';
import backgroundJobsService from './services/background-jobs.service.js';
import { generateToken, doubleCsrfProtection } from './middleware/csrf.middleware.js';

// Initialize Express app
const app = express();
const httpServer = createServer(app);

// Initialize Prisma
export const prisma = new PrismaClient({
  log: config.nodeEnv === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Initialize Socket.io
export const io = new Server(httpServer, {
  cors: {
    origin: config.corsOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Middleware

// Security Headers (v2.2 - Security Enhancement)
app.use(helmet({
  // Disable CSP for now (widget can be embedded in Shopify stores)
  contentSecurityPolicy: false,
  // Allow cross-origin embedding (widget in Shopify)
  crossOriginEmbedderPolicy: false,
  // Keep other security headers enabled:
  // - X-Content-Type-Options: nosniff
  // - X-Frame-Options: SAMEORIGIN
  // - X-XSS-Protection: 0 (modern browsers use CSP)
  // - Strict-Transport-Security (HSTS)
  // - X-Download-Options: noopen
  // - X-Permitted-Cross-Domain-Policies: none
}));

app.use(cors({
  origin: config.corsOrigins,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// CSRF Protection middleware imported from ./middleware/csrf.middleware.js (v2.2)
// Separated to avoid circular dependency with routes

// API Rate Limiting (v2.2 - Security Enhancement)
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per IP per minute
  message: {
    error: {
      message: 'Troppi tentativi. Riprova tra un minuto.',
      code: 'RATE_LIMIT_EXCEEDED',
    },
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  // Skip rate limiting for health check
  skip: (req) => req.path === '/health',
});

// Apply rate limiting to all API routes
app.use('/api', apiLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API Routes (will be added)
app.get('/api', (req, res) => {
  res.json({
    name: 'Lucine Chatbot API',
    version: '1.0.0',
    status: 'running',
  });
});

// CSRF Token endpoint (v2.2)
app.get('/api/csrf-token', (req, res) => {
  try {
    console.log('🔑 Generating CSRF token...');
    console.log('Environment:', config.nodeEnv);
    console.log('JWT Secret exists:', !!config.jwtSecret);

    const csrfToken = generateToken(req, res);

    console.log('✅ CSRF token generated:', csrfToken ? 'yes' : 'no');
    console.log('Token length:', csrfToken?.length);

    res.json({
      success: true,
      token: csrfToken,
    });
  } catch (error) {
    console.error('❌ CSRF token generation error:', error);
    console.error('Error stack:', error.stack);

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to generate CSRF token',
        details: config.nodeEnv === 'development' ? error.message : undefined,
      },
    });
  }
});

// Debug endpoint to check CSRF token and cookies (v2.3.1)
app.get('/api/debug-csrf', (req, res) => {
  res.json({
    success: true,
    debug: {
      cookies: req.cookies,
      headers: {
        'x-csrf-token': req.headers['x-csrf-token'],
        'origin': req.headers['origin'],
        'referer': req.headers['referer'],
      },
      corsOrigins: config.corsOrigins,
    },
  });
});

// Import routes
import authRoutes from './routes/auth.routes.js';
import chatRoutes from './routes/chat.routes.js';
import ticketRoutes from './routes/ticket.routes.js';
import knowledgeRoutes from './routes/knowledge.routes.js';
import operatorRoutes from './routes/operator.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import cannedResponseRoutes from './routes/canned-response.routes.js';
import whatsappRoutes from './routes/whatsapp.routes.js';
import widgetConfigRoutes from './routes/widgetConfig.routes.js';
import { setupWebSocketHandlers } from './services/websocket.service.js';

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/operators', operatorRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/canned-responses', cannedResponseRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api', widgetConfigRoutes); // Widget config routes (both /config and /settings)

// Setup WebSocket handlers
setupWebSocketHandlers(io);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal server error',
      ...(config.nodeEnv === 'development' && { stack: err.stack }),
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      message: 'Route not found',
      path: req.path,
    },
  });
});

// Start server
const PORT = config.port;

httpServer.listen(PORT, () => {
  // Determine public URL based on environment
  const publicUrl = config.nodeEnv === 'production'
    ? (process.env.RENDER_EXTERNAL_URL || `https://chatbot-lucy-2025.onrender.com`)
    : `http://localhost:${PORT}`;

  const wsUrl = publicUrl.replace('https://', 'wss://').replace('http://', 'ws://');

  console.log('\n🚀 Lucine Chatbot Backend Server');
  console.log('================================');
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${config.nodeEnv}`);
  console.log(`🔗 API: ${publicUrl}/api`);
  console.log(`🔌 WebSocket: ${wsUrl}`);
  console.log(`📊 Health: ${publicUrl}/health`);
  console.log('================================\n');

  // Start background jobs
  backgroundJobsService.start();
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('⚠️  SIGTERM received, shutting down gracefully...');
  backgroundJobsService.stop();
  await prisma.$disconnect();
  httpServer.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('\n⚠️  SIGINT received, shutting down gracefully...');
  backgroundJobsService.stop();
  await prisma.$disconnect();
  httpServer.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

export default app;
