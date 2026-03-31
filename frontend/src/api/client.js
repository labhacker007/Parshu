import axios from 'axios';
import { useAuthStore } from '../store/index';

// API URL configuration - MUST be set via environment variable in production
const API_URL = process.env.REACT_APP_API_URL || (() => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('REACT_APP_API_URL must be set in production environment');
  }
  return 'http://localhost:8000';
})();

const client = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add JWT token
client.interceptors.request.use(
  (config) => {
    const { accessToken } = useAuthStore.getState();

    if (process.env.NODE_ENV === 'development') {
      console.log('[API Request]', config.method?.toUpperCase(), config.url, 'hasToken:', !!accessToken);
    }

    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    const csrfToken = sessionStorage.getItem('csrf_token');
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for logging
client.interceptors.response.use(
  (response) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[API Response OK]', response.config?.url, 'status:', response.status);
    }
    return response;
  },
  (error) => {
    if (process.env.NODE_ENV === 'development') {
      console.error('[API Response ERROR]', error.config?.url, 'status:', error.response?.status, 'message:', error.message);
    }
    return Promise.reject(error);
  }
);

// ─── Auth ────────────────────────────────────────────────────────────────────

export const authAPI = {
  login: (data) => client.post('/auth/login', data),
  register: (email, password, name) =>
    client.post('/auth/register', { email, password, name }),
  refresh: (refreshToken) => client.post('/auth/refresh', { refresh_token: refreshToken }),
  me: () => client.get('/auth/me'),
  logout: () => client.post('/auth/logout'),
  changePassword: (currentPassword, newPassword) =>
    client.post('/auth/change-password', { current_password: currentPassword, new_password: newPassword }),
};

// ─── Token Refresh Interceptor ───────────────────────────────────────────────

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const { refreshToken, setTokens, logout } = useAuthStore.getState();

      if (!refreshToken) {
        logout();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise(function (resolve, reject) {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = 'Bearer ' + token;
            return client(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      isRefreshing = true;

      try {
        const resp = await authAPI.refresh(refreshToken);
        const newAccess = resp.data.access_token;
        setTokens(newAccess, refreshToken);
        processQueue(null, newAccess);
        originalRequest.headers.Authorization = 'Bearer ' + newAccess;
        return client(originalRequest);
      } catch (err) {
        processQueue(err, null);
        logout();
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ─── Articles ────────────────────────────────────────────────────────────────

export const articlesAPI = {
  getTriageQueue: (page = 1, pageSize = 20, statusFilter = null, highPriorityOnly = false, sourceId = null) => {
    const params = { page, page_size: pageSize };
    if (highPriorityOnly === true) params.high_priority_only = true;
    if (statusFilter) params.status_filter = statusFilter;
    if (sourceId) params.source_id = sourceId;
    return client.get('/articles/triage', { params });
  },
  getArticle: (id) => client.get(`/articles/${id}`),
  updateStatus: (id, status) =>
    client.patch(`/articles/${id}/status`, { status }),
  summarizeArticle: (articleId, modelId = null) =>
    client.post(`/articles/${articleId}/summarize`, { model_id: modelId }),
  delete: (articleId) =>
    client.delete(`/articles/${articleId}`),
  // Read tracking
  markAsRead: (articleId) =>
    client.post(`/articles/${articleId}/read`),
  markAllAsRead: (sourceId = null) =>
    client.post('/articles/mark-all-read', null, { params: sourceId ? { source_id: sourceId } : {} }),
  // Bookmarks
  bookmark: (articleId) =>
    client.post(`/articles/${articleId}/bookmark`),
  unbookmark: (articleId) =>
    client.delete(`/articles/${articleId}/bookmark`),
  getBookmarks: (page = 1, pageSize = 20) =>
    client.get('/articles/bookmarks', { params: { page, page_size: pageSize } }),
  // Export
  exportPdf: (articleId) =>
    client.get(`/articles/${articleId}/export/pdf`, { responseType: 'blob' }),
  exportWord: (articleId) =>
    client.get(`/articles/${articleId}/export/word`, { responseType: 'blob' }),
};

// ─── Feed Sources (Admin) ────────────────────────────────────────────────────

export const sourcesAPI = {
  list: () => client.get('/sources/'),
  get: (id) => client.get(`/sources/${id}`),
  create: (data) => client.post('/sources/', data),
  update: (id, data) => client.patch(`/sources/${id}`, data),
  delete: (id, deleteArticles = false) =>
    client.delete(`/sources/${id}`, { params: { delete_articles: deleteArticles } }),
  triggerIngest: (id) => client.post(`/sources/${id}/ingest`),
  ingestAll: () => client.post('/sources/ingest-all'),
  getStats: (timeRange = null) => client.get('/sources/stats/summary', {
    params: timeRange ? { time_range: timeRange } : {}
  }),

  // Default feeds management (admin)
  listDefaultFeeds: () => client.get('/admin/default-feeds/'),
  addDefaultFeed: (sourceId) => client.post(`/admin/default-feeds/${sourceId}`),
  removeDefaultFeed: (sourceId) => client.delete(`/admin/default-feeds/${sourceId}`),

  // Refresh settings
  getRefreshPresets: () => client.get('/sources/refresh/presets'),
  getSystemRefreshSettings: () => client.get('/sources/refresh/system'),
  updateSystemRefreshSettings: (settings) => client.put('/sources/refresh/system', settings),
  getAllSourceRefreshSettings: () => client.get('/sources/refresh/sources'),
  updateSourceRefreshSettings: (sourceId, settings) =>
    client.put(`/sources/refresh/sources/${sourceId}`, settings),

  // User preferences
  getMySourcePreferences: () => client.get('/sources/refresh/my-preferences'),
  updateMySourcePreference: (sourceId, preferences) =>
    client.put(`/sources/refresh/my-preferences/${sourceId}`, preferences),
  resetMySourcePreference: (sourceId) =>
    client.delete(`/sources/refresh/my-preferences/${sourceId}`),

  // Dashboard settings
  getDashboardPresets: () => client.get('/sources/refresh/dashboard/presets'),
  getDashboardSettings: () => client.get('/sources/refresh/dashboard/settings'),
  updateDashboardSettings: (settings) => client.put('/sources/refresh/dashboard/settings', settings),
  getMyDashboardPreferences: () => client.get('/sources/refresh/dashboard/my-preferences'),
  updateMyDashboardPreferences: (preferences) => client.put('/sources/refresh/dashboard/my-preferences', preferences),
  resetMyDashboardPreferences: () => client.delete('/sources/refresh/dashboard/my-preferences'),
};

// ─── Watchlist (Global - Admin) ──────────────────────────────────────────────

export const watchlistAPI = {
  list: () => client.get('/watchlist/'),
  create: (keyword) => client.post('/watchlist/', { keyword }),
  delete: (id) => client.delete(`/watchlist/${id}`),
  toggle: (id, isActive) => client.patch(`/watchlist/${id}`, { is_active: isActive }),
  refresh: () => client.post('/watchlist/refresh'),
};

// ─── User Personal Watchlist ─────────────────────────────────────────────────

export const userWatchlistAPI = {
  list: () => client.get('/users/watchlist/'),
  create: (keyword) => client.post('/users/watchlist/', { keyword }),
  delete: (id) => client.delete(`/users/watchlist/${id}`),
  toggle: (id) => client.patch(`/users/watchlist/${id}/toggle`),
};

// ─── User Custom Feeds ───────────────────────────────────────────────────────

export const userFeedsAPI = {
  list: (includeInactive = false) =>
    client.get('/users/feeds/', { params: { include_inactive: includeInactive } }),
  get: (feedId) => client.get(`/users/feeds/${feedId}`),
  create: (data) => client.post('/users/feeds/', data),
  update: (feedId, data) => client.patch(`/users/feeds/${feedId}`, data),
  delete: (feedId) => client.delete(`/users/feeds/${feedId}`),
  toggle: (feedId) => client.post(`/users/feeds/${feedId}/toggle`),
  ingest: (feedId) => client.post(`/users/feeds/${feedId}/ingest`),
  getArticles: (feedId, page = 1, limit = 20) =>
    client.get(`/users/feeds/${feedId}/articles`, { params: { page, limit } }),
  validateUrl: (url) =>
    client.post('/users/feeds/validate-url', null, { params: { url } }),
};

// ─── User Categories ─────────────────────────────────────────────────────────

export const userCategoriesAPI = {
  list: () => client.get('/users/categories/'),
  create: (data) => client.post('/users/categories/', data),
  update: (id, data) => client.patch(`/users/categories/${id}`, data),
  delete: (id) => client.delete(`/users/categories/${id}`),
  reorder: (categoryIds) => client.post('/users/categories/reorder', { category_ids: categoryIds }),
};

// ─── Audit Logs ──────────────────────────────────────────────────────────────

export const auditAPI = {
  list: (page = 1, pageSize = 50, filters = {}) =>
    client.get('/audit/', { params: { page, page_size: pageSize, ...filters } }),
  get: (id) => client.get(`/audit/${id}`),
};

// ─── Admin ───────────────────────────────────────────────────────────────────

export const adminAPI = {
  get: (url, config = {}) => client.get(url, config),
  post: (url, data, config = {}) => client.post(url, data, config),
  patch: (url, data, config = {}) => client.patch(url, data, config),
  delete: (url, config = {}) => client.delete(url, config),

  getSettings: () => client.get('/admin/settings'),
  getStats: () => client.get('/admin/stats'),
  getHealth: () => client.get('/admin/health'),
  getAuditSummary: (days = 7) => client.get(`/admin/audit-summary?days=${days}`),

  // GenAI model management
  getGenaiStatus: () => client.get('/admin/genai/status'),
  getAvailableModels: () => client.get('/admin/genai/models'),
  testGenAI: (request) => client.post('/admin/genai/test', request),

  // Ollama management
  getOllamaStatus: () => client.get('/admin/genai/ollama/status'),
  setupOllama: (url, model, setAsPrimary = true) =>
    client.post('/admin/genai/ollama/setup', { url, model, set_as_primary: setAsPrimary }),
  pullOllamaModel: (modelName) => client.post(`/admin/genai/ollama/pull-model?model_name=${modelName}`),

  // GenAI Functions
  listFunctions: () => client.get('/admin/genai-functions/'),
  createFunction: (data) => client.post('/admin/genai-functions/', data),
  updateFunction: (id, data) => client.patch(`/admin/genai-functions/${id}`, data),
  deleteFunction: (id) => client.delete(`/admin/genai-functions/${id}`),

  // Prompt Templates
  listPrompts: () => client.get('/admin/prompts/'),
  createPrompt: (data) => client.post('/admin/prompts/', data),
  updatePrompt: (id, data) => client.patch(`/admin/prompts/${id}`, data),
  deletePrompt: (id) => client.delete(`/admin/prompts/${id}`),
  renderPrompt: (id, variables) => client.post(`/admin/prompts/${id}/render`, { variables }),

  // Guardrails
  listGuardrails: () => client.get('/admin/genai-guardrails/'),
  getGuardrailTypes: () => client.get('/admin/genai-guardrails/types'),
  createGuardrail: (data) => client.post('/admin/genai-guardrails/', data),
  updateGuardrail: (id, data) => client.patch(`/admin/genai-guardrails/${id}`, data),
  deleteGuardrail: (id) => client.delete(`/admin/genai-guardrails/${id}`),
  testGuardrail: (id, input) => client.post(`/admin/genai-guardrails/${id}/test`, { input_text: input }),
  assignGuardrailToPrompt: (promptId, guardrailId, order) =>
    client.post(`/admin/prompts/${promptId}/guardrails`, { guardrail_id: guardrailId, execution_order: order }),
  removeGuardrailFromPrompt: (promptId, guardrailId) =>
    client.delete(`/admin/prompts/${promptId}/guardrails/${guardrailId}`),
};

// ─── Users (Admin) ───────────────────────────────────────────────────────────

export const usersAPI = {
  list: () => client.get('/users/'),
  listUsers: () => client.get('/users/'),
  get: (id) => client.get(`/users/${id}`),
  create: (data) => client.post('/users/', data),
  createUser: (data) => client.post('/users/', data),
  update: (id, data) => client.patch(`/users/${id}`, data),
  updateUser: (id, data) => client.patch(`/users/${id}`, data),
  delete: (id) => client.delete(`/users/${id}`),
  deleteUser: (id) => client.delete(`/users/${id}`),
  resetPassword: (id) => client.post(`/users/${id}/reset-password`),
  toggleActive: (id, isActive) => client.patch(`/users/${id}`, { is_active: isActive }),

  // Role switching (admin only)
  getAvailableRoles: () => client.get('/users/available-roles'),
  switchRole: (targetRole) => client.post('/users/switch-role', { target_role: targetRole }),
  restoreRole: () => client.post('/users/restore-role'),

  // Permissions
  getMyPermissions: () => client.get('/users/my-permissions'),
};

// ─── RBAC (Admin) ────────────────────────────────────────────────────────────

export const rbacAPI = {
  getPermissions: () => client.get('/admin/rbac/permissions'),
  getRoles: () => client.get('/admin/rbac/roles'),
  getMatrix: () => client.get('/admin/rbac/matrix'),
  getRolePermissions: (role) => client.get(`/admin/rbac/comprehensive/role/${role}`),
  updateRolePermissions: (role, permissions) =>
    client.put(`/admin/rbac/comprehensive/role/${role}`, { permissions }),
  getUserPermissions: (userId) =>
    client.get(`/admin/rbac/users/${userId}/permissions`),
  setUserPermission: (userId, permission, granted, reason = null) =>
    client.post(`/admin/rbac/users/${userId}/permissions`, { permission, granted, reason }),
  removeUserPermission: (userId, permission) =>
    client.delete(`/admin/rbac/users/${userId}/permissions/${permission}`),
  getPageDefinitions: () => client.get('/admin/rbac/pages'),
  getRolePageAccess: (role) => client.get(`/admin/rbac/pages/role/${role}`),
  updatePageAccess: (pageKey, role, permissions) =>
    client.put(`/admin/rbac/pages/${pageKey}/role/${role}`, { permissions }),
};

export default client;
