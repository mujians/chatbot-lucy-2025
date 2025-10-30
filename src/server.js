import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { config } from './config/index.js';
import { PrismaClient } from '@prisma/client';
import backgroundJobsService from './services/background-jobs.service.js';

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
app.use(cors({
  origin: config.corsOrigins,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
