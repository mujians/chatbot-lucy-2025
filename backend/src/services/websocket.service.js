/**
 * WebSocket Service
 * Handles Socket.IO connections and events
 */

import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

export function setupWebSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // AUDIT FIX: Operator authentication and room joining (with JWT verification)
    socket.on('operator_join', async (data) => {
      try {
        const { operatorId, token } = data;

        // Verify token is provided
        if (!token) {
          socket.emit('auth_error', { message: 'Authentication token required' });
          console.log(`❌ Operator join failed: No token provided`);
          return;
        }

        // Verify JWT token
        const decoded = jwt.verify(token, config.jwtSecret);

        // Verify operatorId matches token
        if (decoded.operatorId !== operatorId) {
          socket.emit('auth_error', { message: 'Unauthorized: Token mismatch' });
          console.log(`❌ Operator join failed: Token mismatch for ${operatorId}`);
          return;
        }

        // All checks passed - join room
        socket.join(`operator_${operatorId}`);
        socket.emit('auth_success', { message: 'Authenticated successfully' });
        console.log(`👤 Operator ${operatorId} joined room (authenticated)`);
      } catch (error) {
        if (error.name === 'TokenExpiredError') {
          socket.emit('auth_error', { message: 'Token expired' });
        } else if (error.name === 'JsonWebTokenError') {
          socket.emit('auth_error', { message: 'Invalid token' });
        } else {
          socket.emit('auth_error', { message: 'Authentication failed' });
        }
        console.log(`❌ Operator join failed: ${error.message}`);
      }
    });

    // Operator leaves
    socket.on('operator_leave', (data) => {
      const { operatorId } = data;
      socket.leave(`operator_${operatorId}`);
      console.log(`👤 Operator ${operatorId} left room`);
    });

    // Dashboard room joining
    socket.on('join_dashboard', () => {
      socket.join('dashboard');
      console.log('📊 Dashboard client joined');
    });

    socket.on('leave_dashboard', () => {
      socket.leave('dashboard');
      console.log('📊 Dashboard client left');
    });

    // Join chat session room
    socket.on('join_chat', (data) => {
      const { sessionId } = data;
      socket.join(`chat_${sessionId}`);
      console.log(`💬 Joined chat session: ${sessionId}`);
    });

    // Leave chat session room
    socket.on('leave_chat', (data) => {
      const { sessionId } = data;
      socket.leave(`chat_${sessionId}`);
      console.log(`💬 Left chat session: ${sessionId}`);
    });

    // P0.5: User typing indicator
    socket.on('user_typing', (data) => {
      const { sessionId, isTyping } = data;
      // Notify operator in the chat room
      socket.to(`chat_${sessionId}`).emit('user_typing', {
        sessionId,
        isTyping,
      });
      console.log(`⌨️  User typing in session ${sessionId}: ${isTyping}`);
    });

    // P0.5: Operator typing indicator
    socket.on('operator_typing', (data) => {
      const { sessionId, operatorName, isTyping } = data;
      // Notify user in the chat room
      socket.to(`chat_${sessionId}`).emit('operator_typing', {
        sessionId,
        operatorName,
        isTyping,
      });
      console.log(`⌨️  Operator typing in session ${sessionId}: ${isTyping}`);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });

  console.log('✅ WebSocket handlers setup complete');
}
