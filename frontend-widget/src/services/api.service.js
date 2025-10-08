import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;

if (!API_URL) {
  throw new Error('VITE_API_URL environment variable is required');
}

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Chat Session API
 */
export const chatAPI = {
  // Create new chat session
  createSession: async (userName = null) => {
    const response = await api.post('/chat/session', { userName });
    return response.data.data;
  },

  // Get session by ID
  getSession: async (sessionId) => {
    const response = await api.get(`/chat/session/${sessionId}`);
    return response.data.data;
  },

  // Send user message
  sendMessage: async (sessionId, message) => {
    const response = await api.post(`/chat/session/${sessionId}/message`, {
      message,
    });
    return response.data.data;
  },

  // Request operator
  requestOperator: async (sessionId) => {
    const response = await api.post(`/chat/session/${sessionId}/request-operator`);
    return response.data.data;
  },
};

/**
 * Ticket API
 */
export const ticketAPI = {
  // Create ticket
  createTicket: async (ticketData) => {
    const response = await api.post('/tickets', ticketData);
    return response.data.data;
  },

  // Resume ticket by token
  resumeTicket: async (resumeToken) => {
    const response = await api.get(`/tickets/resume/${resumeToken}`);
    return response.data.data;
  },
};

export default api;
