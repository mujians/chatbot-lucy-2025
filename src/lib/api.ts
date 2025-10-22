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
    api.get('/knowledge', { params }).then(res => res.data),

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

  bulkImport: (items: Array<{ question: string; answer: string; category?: string }>) =>
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
};

// ============================================
// CHAT API (già esistente - da mantenere)
// ============================================

export const chatApi = {
  getSessions: (params?: { status?: string; operatorId?: string }) =>
    api.get('/chat/sessions', { params }).then(res => res.data),

  getSession: (id: string) =>
    api.get(`/chat/sessions/${id}`).then(res => res.data),

  closeSession: (id: string) =>
    api.post(`/chat/sessions/${id}/close`).then(res => res.data),

  convertToTicket: (id: string) =>
    api.post(`/chat/sessions/${id}/convert-to-ticket`).then(res => res.data),
};
