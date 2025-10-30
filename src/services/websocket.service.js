/**
 * WebSocket Service
 * Handles Socket.IO connections and events
 */

export function setupWebSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Operator authentication and room joining
    socket.on('operator_join', (data) => {
      const { operatorId } = data;
      socket.join(`operator_${operatorId}`);
      console.log(`👤 Operator ${operatorId} joined room`);
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

    // User resumed chat - notify operator
    socket.on('user_resumed_chat', (data) => {
      const { sessionId, userName, timestamp } = data;
      // Notify operator via chat room (operators are joined to this room)
      socket.to(`chat_${sessionId}`).emit('user_resumed_chat', {
        sessionId,
        userName,
        timestamp,
        message: `${userName} ha ripreso la conversazione`
      });
      console.log(`🔄 User ${userName} resumed chat session ${sessionId}`);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });

  console.log('✅ WebSocket handlers setup complete');
}
