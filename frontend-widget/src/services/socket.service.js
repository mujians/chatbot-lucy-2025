import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL;

if (!SOCKET_URL) {
  throw new Error('VITE_SOCKET_URL environment variable is required');
}

class SocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.transportMethod = null;
    this.onTransportChangeCallback = null;
  }

  connect() {
    if (this.socket) return;

    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'], // Try WebSocket first, fallback to polling
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    this.socket.on('connect', () => {
      const transport = this.socket.io.engine.transport.name;
      console.log('✅ Socket connected:', this.socket.id, 'via', transport);
      this.connected = true;
      this.transportMethod = transport;

      // Notify if using polling fallback
      if (transport === 'polling' && this.onTransportChangeCallback) {
        this.onTransportChangeCallback('polling');
      }
    });

    // Monitor transport upgrades (e.g., polling → websocket)
    this.socket.io.engine.on('upgrade', (transport) => {
      const newTransport = transport.name;
      console.log('🔄 Transport upgraded to:', newTransport);
      this.transportMethod = newTransport;

      if (this.onTransportChangeCallback) {
        this.onTransportChangeCallback(newTransport);
      }
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Socket disconnected');
      this.connected = false;
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    return this.socket;
  }

  // Set callback for transport method changes
  onTransportChange(callback) {
    this.onTransportChangeCallback = callback;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }

  // Join chat room
  joinChat(sessionId) {
    if (!this.socket) return;
    this.socket.emit('join_chat', sessionId);
  }

  // Send user message
  sendMessage(sessionId, message) {
    if (!this.socket) return;
    this.socket.emit('user_message', { sessionId, message });
  }

  // Request operator
  requestOperator(sessionId) {
    if (!this.socket) return;
    this.socket.emit('request_operator', { sessionId });
  }

  // Listen for operator messages
  onOperatorMessage(callback) {
    if (!this.socket) return;
    this.socket.on('operator_message', callback);
  }

  // Listen for operator assigned
  onOperatorAssigned(callback) {
    if (!this.socket) return;
    this.socket.on('operator_assigned', callback);
  }

  // Listen for no operators available
  onNoOperatorsAvailable(callback) {
    if (!this.socket) return;
    this.socket.on('no_operators_available', callback);
  }

  // Listen for chat closed
  onChatClosed(callback) {
    if (!this.socket) return;
    this.socket.on('chat_closed', callback);
  }

  // Remove all listeners
  removeAllListeners() {
    if (!this.socket) return;
    this.socket.removeAllListeners();
  }
}

export default new SocketService();
