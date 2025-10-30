import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'https://chatbot-lucy-2025.onrender.com/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor per JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor per error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ============================================
// TICKETS API
// ============================================

export const ticketsApi = {
  getAll: (params?: { status?: string; priority?: string }) =>
    api.get('/tickets', { params }).then(res => res.data),

  getById: (id: string) =>
    api.get(`/tickets/${id}`).then(res => res.data),

  assign: (id: string, operatorId: string) =>
    api.post(`/tickets/${id}/assign`, { operatorId }).then(res => res.data),

  resolve: (id: string, resolutionNotes: string) =>
    api.post(`/tickets/${id}/resolve`, { resolutionNotes }).then(res => res.data),

  update: (id: string, data: { priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' }) =>
    api.patch(`/tickets/${id}`, data).then(res => res.data),

  create: (data: {
    sessionId: string;
    userName: string;
    contactMethod: 'WHATSAPP' | 'EMAIL';
    whatsappNumber?: string;
    email?: string;
    initialMessage: string;
    priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  }) =>
    api.post('/tickets', data).then(res => res.data),
};

// ============================================
// KNOWLEDGE API
// ============================================

export const knowledgeApi = {
  getAll: (params?: { category?: string; isActive?: boolean }) =>
    api.get('/knowledge', { params }).then(res => res.data.data),

  getById: (id: string) =>
    api.get(`/knowledge/${id}`).then(res => res.data),

  create: (data: {
    question: string;
    answer: string;
    category?: string;
  }) =>
    api.post('/knowledge', data).then(res => res.data),

  update: (id: string, data: {
    question?: string;
    answer?: string;
    category?: string;
  }) =>
    api.put(`/knowledge/${id}`, data).then(res => res.data),

  delete: (id: string) =>
    api.delete(`/knowledge/${id}`).then(res => res.data),

  toggle: (id: string) =>
    api.patch(`/knowledge/${id}/toggle`).then(res => res.data),

  bulkImport: (items: Array<{
    question?: string;
    answer?: string;
    title?: string;
    content?: string;
    category?: string
  }>) =>
    api.post('/knowledge/bulk', { items }).then(res => res.data),

  regenerateEmbeddings: () =>
    api.post('/knowledge/regenerate-embeddings').then(res => res.data),
};

// ============================================
// OPERATORS API
// ============================================

export const operatorsApi = {
  getAll: () =>
    api.get('/operators').then(res => res.data),

  getOnline: () =>
    api.get('/operators/online').then(res => res.data),

  create: (data: {
    email: string;
    password: string;
    name: string;
    role?: 'ADMIN' | 'OPERATOR' | 'VIEWER';
  }) =>
    api.post('/operators', data).then(res => res.data),

  update: (id: string, data: {
    email?: string;
    name?: string;
    role?: 'ADMIN' | 'OPERATOR' | 'VIEWER';
  }) =>
    api.put(`/operators/${id}`, data).then(res => res.data),

  delete: (id: string) =>
    api.delete(`/operators/${id}`).then(res => res.data),

  toggleAvailability: (isAvailable: boolean) =>
    api.post('/operators/me/toggle-availability', { isAvailable }).then(res => res.data),

  updateNotificationPreferences: (preferences: any) =>
    api.put('/operators/me/notification-preferences', { preferences }).then(res => res.data),
};

// ============================================
// SETTINGS API
// ============================================

export const settingsApi = {
  getAll: () =>
    api.get('/settings').then(res => res.data),

  getByKey: (key: string) =>
    api.get(`/settings/${key}`).then(res => res.data),

  update: (key: string, value: any) =>
    api.put(`/settings/${key}`, { value }).then(res => res.data),

  upsert: (key: string, value: any) =>
    api.post('/settings', { key, value }).then(res => res.data),

  delete: (key: string) =>
    api.delete(`/settings/${key}`).then(res => res.data),

  testEmail: (to?: string) =>
    api.post('/settings/test-email', { to }).then(res => res.data),

  testWhatsApp: (to: string) =>
    api.post('/settings/test-whatsapp', { to }).then(res => res.data),
};

// ============================================
// CHAT API (già esistente - da mantenere)
// ============================================

export const chatApi = {
  getSessions: (params?: {
    status?: string;
    operatorId?: string;
    search?: string;
    isArchived?: boolean;
    isFlagged?: boolean;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
  }) =>
    api.get('/chat/sessions', { params }).then(res => res.data),

  getSession: (id: string) =>
    api.get(`/chat/sessions/${id}`).then(res => res.data),

  closeSession: (id: string) =>
    api.post(`/chat/sessions/${id}/close`).then(res => res.data),

  deleteSession: (id: string) =>
    api.delete(`/chat/sessions/${id}`).then(res => res.data),

  archiveSession: (id: string) =>
    api.post(`/chat/sessions/${id}/archive`).then(res => res.data),

  unarchiveSession: (id: string) =>
    api.post(`/chat/sessions/${id}/unarchive`).then(res => res.data),

  flagSession: (id: string, reason?: string) =>
    api.post(`/chat/sessions/${id}/flag`, { reason }).then(res => res.data),

  unflagSession: (id: string) =>
    api.post(`/chat/sessions/${id}/unflag`).then(res => res.data),

  convertToTicket: (id: string) =>
    api.post(`/chat/sessions/${id}/convert-to-ticket`).then(res => res.data),

  transferSession: (id: string, data: { toOperatorId: string; reason?: string }) =>
    api.post(`/chat/sessions/${id}/transfer`, data).then(res => res.data),

  // Internal Notes
  addInternalNote: (sessionId: string, content: string) =>
    api.post(`/chat/sessions/${sessionId}/notes`, { content }).then(res => res.data),

  updateInternalNote: (sessionId: string, noteId: string, content: string) =>
    api.put(`/chat/sessions/${sessionId}/notes/${noteId}`, { content }).then(res => res.data),

  deleteInternalNote: (sessionId: string, noteId: string) =>
    api.delete(`/chat/sessions/${sessionId}/notes/${noteId}`).then(res => res.data),

  // User History
  getUserHistory: (userId: string) =>
    api.get(`/chat/users/${userId}/history`).then(res => res.data),
};

// ============================================
// ANALYTICS API
// ============================================

export const analyticsApi = {
  getDashboardStats: (params?: { dateFrom?: string; dateTo?: string }) =>
    api.get('/analytics/dashboard', { params }).then(res => res.data),
};

// ============================================
// CANNED RESPONSES API
// ============================================

export const cannedResponsesApi = {
  getAll: () =>
    api.get('/canned-responses').then(res => res.data),

  getById: (id: string) =>
    api.get(`/canned-responses/${id}`).then(res => res.data),

  create: (data: {
    title: string;
    content: string;
    shortcut?: string;
    isGlobal?: boolean;
  }) =>
    api.post('/canned-responses', data).then(res => res.data),

  update: (id: string, data: {
    title?: string;
    content?: string;
    shortcut?: string;
    isGlobal?: boolean;
    isActive?: boolean;
  }) =>
    api.put(`/canned-responses/${id}`, data).then(res => res.data),

  delete: (id: string) =>
    api.delete(`/canned-responses/${id}`).then(res => res.data),

  incrementUsage: (id: string) =>
    api.post(`/canned-responses/${id}/use`).then(res => res.data),
};

// ============================================
// HEALTH API
// ============================================

export const healthApi = {
  getSystemHealth: () =>
    api.get('/health/system').then(res => res.data),

  getQuickHealth: () =>
    api.get('/health').then(res => res.data),

  getLogs: (limit?: number) =>
    api.get('/health/logs', { params: { limit } }).then(res => res.data),
};
