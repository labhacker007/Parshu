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
    
    // Production logging - only log in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[API Request]', config.method?.toUpperCase(), config.url, 'hasToken:', !!accessToken);
    }
    
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    
    // Add CSRF token if available
    const csrfToken = sessionStorage.getItem('csrf_token');
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle errors (NOTE: token refresh is handled separately below)
client.interceptors.response.use(
  (response) => {
    // Production logging - only log in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[API Response OK]', response.config?.url, 'status:', response.status);
    }
    return response;
  },
  (error) => {
    // Production logging - only log in development
    if (process.env.NODE_ENV === 'development') {
      console.error('[API Response ERROR]', error.config?.url, 'status:', error.response?.status, 'message:', error.message);
    }
    // Don't logout here - let the refresh interceptor below handle 401s
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (data) => {
    // Backend expects {email, password, otp_code?}
    return client.post('/auth/login', data);
  },
  register: (email, password, name) =>
    client.post('/auth/register', { email, password, name }),
  refresh: (refreshToken) => client.post('/auth/refresh', { refresh_token: refreshToken }),
  me: () => client.get('/auth/me'),
  logout: () => client.post('/auth/logout'),
};

// Response interceptor to handle 401 with token refresh
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

    // default behavior
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const articlesAPI = {
  getTriageQueue: (page = 1, pageSize = 20, statusFilter = null, highPriorityOnly = false, sourceId = null) => {
    const params = { page, page_size: pageSize };
    // Only include high_priority_only if true (FastAPI is strict about boolean parsing)
    if (highPriorityOnly === true) params.high_priority_only = true;
    if (statusFilter) params.status_filter = statusFilter;
    if (sourceId) params.source_id = sourceId;
    return client.get('/articles/triage', { params });
  },
  getArticle: (id) => client.get(`/articles/${id}`),
  updateStatus: (id, status, remarks = null) =>
    client.patch(`/articles/${id}/status`, { status, analyst_remarks: remarks }),
  updateAnalysis: (id, executiveSummary, technicalSummary) =>
    client.patch(`/articles/${id}/analysis`, { 
      executive_summary: executiveSummary, 
      technical_summary: technicalSummary 
    }),
  // Comments API
  getComments: (articleId) => client.get(`/articles/${articleId}/comments`),
  addComment: (articleId, commentText, isInternal = true, parentId = null) =>
    client.post(`/articles/${articleId}/comments`, { 
      comment_text: commentText, 
      is_internal: isInternal,
      parent_id: parentId
    }),
  updateComment: (articleId, commentId, commentText) =>
    client.patch(`/articles/${articleId}/comments/${commentId}`, { comment_text: commentText }),
  deleteComment: (articleId, commentId) =>
    client.delete(`/articles/${articleId}/comments/${commentId}`),
  // Assignment API
  assignArticle: (articleId, analystId) =>
    client.post(`/articles/${articleId}/assign`, { analyst_id: analystId }),
  claimArticle: (articleId) =>
    client.post(`/articles/${articleId}/claim`),
  getMyQueue: (page = 1, pageSize = 20, statusFilter = null) =>
    client.get('/articles/my-queue', { params: { page, page_size: pageSize, status_filter: statusFilter } }),
  getUnassigned: (page = 1, pageSize = 20, highPriorityOnly = false) =>
    client.get('/articles/unassigned', { params: { page, page_size: pageSize, high_priority_only: highPriorityOnly } }),
  // Manual GenAI extraction and summarization
  extractIntelligence: (articleId, useGenAI = true, modelId = null, saveResults = true) =>
    client.post(`/articles/${articleId}/extract-intelligence`, { 
      use_genai: useGenAI, 
      model_id: modelId,
      save_results: saveResults
    }),
  compareExtraction: (articleId) =>
    client.post(`/articles/${articleId}/extract-intelligence`, { compare_mode: true, save_results: false }),
  summarizeArticle: (articleId, modelId = null) =>
    client.post(`/articles/${articleId}/summarize`, { model_id: modelId }),
  // Intelligence review/approval
  reviewIntelligence: (intelId, isReviewed = true, isFalsePositive = false, notes = null) =>
    client.post(`/articles/intelligence/${intelId}/review`, { 
      is_reviewed: isReviewed, 
      is_false_positive: isFalsePositive, 
      notes 
    }),
  batchReviewIntelligence: (intelIds, isReviewed = true, isFalsePositive = false, notes = null) =>
    client.post('/articles/intelligence/batch-review', {
      intel_ids: intelIds,
      is_reviewed: isReviewed,
      is_false_positive: isFalsePositive,
      notes
    }),
  // Delete intelligence
  deleteIntelligenceItem: (intelId) =>
    client.delete(`/articles/intelligence/${intelId}`),
  deleteIntelligenceBatch: (intelIds) =>
    client.delete('/articles/intelligence/batch', { params: { intel_ids: intelIds } }),
  deleteAllArticleIntelligence: (articleId) =>
    client.delete(`/articles/${articleId}/intelligence/all`),
  // Delete article
  delete: (articleId) =>
    client.delete(`/articles/${articleId}`),
  // Mark read
  markAsRead: (articleId) =>
    client.post(`/articles/${articleId}/read`),
  markAllAsRead: (sourceId = null) =>
    client.post('/articles/mark-all-read', null, { params: sourceId ? { source_id: sourceId } : {} }),
  // Export endpoints
  exportPdf: (articleId, includeIntelligence = true, includeSummaries = true) =>
    client.get(`/articles/${articleId}/export/pdf`, { 
      responseType: 'blob',
      params: { include_intelligence: includeIntelligence, include_summaries: includeSummaries }
    }),
  exportHtml: (articleId, includeIntelligence = true, includeSummaries = true) =>
    client.get(`/articles/${articleId}/export/html`, { 
      responseType: 'blob',
      params: { include_intelligence: includeIntelligence, include_summaries: includeSummaries }
    }),
  exportCsv: (articleId) =>
    client.get(`/articles/${articleId}/export/csv`, { responseType: 'blob' }),
  // Get URLs for export (for opening in new tab)
  getExportPdfUrl: (articleId) => `/api/articles/${articleId}/export/pdf`,
  getExportHtmlUrl: (articleId) => `/api/articles/${articleId}/export/html`,
  getExportCsvUrl: (articleId) => `/api/articles/${articleId}/export/csv`,
};

export const huntsAPI = {
  generateQuery: (articleId, platform) =>
    client.post('/hunts/generate', { article_id: articleId, platform }),
  execute: (huntId) =>
    client.post(`/hunts/${huntId}/execute`),
  getExecutions: (huntId) =>
    client.get(`/hunts/${huntId}/executions`),
  list: (page = 1, pageSize = 20) =>
    client.get('/hunts/', { params: { page, page_size: pageSize } }),
  get: (huntId) =>
    client.get(`/hunts/${huntId}`),
  // New endpoints
  extract: (articleIds) =>
    client.post('/hunts/extract', { article_ids: articleIds }),
  batchHunt: (articleIds, platforms, extractIntelligence = true) =>
    client.post('/hunts/batch', { 
      article_ids: articleIds, 
      platforms: platforms,
      extract_intelligence: extractIntelligence
    }),
  getReviewedArticles: (page = 1, pageSize = 20) =>
    client.get('/hunts/articles/reviewed', { params: { page, page_size: pageSize } }),
  getStats: () =>
    client.get('/hunts/stats'),
  // Delete endpoints
  delete: (huntId) =>
    client.delete(`/hunts/${huntId}`),
  deleteBatch: (huntIds) =>
    client.delete('/hunts/batch/delete', { params: { hunt_ids: huntIds } }),
  // Query preview
  previewQuery: (articleId, platform) =>
    client.post('/hunts/preview-query', { article_id: articleId, platform }),
  // Edit/Update endpoints
  update: (huntId, data) =>
    client.patch(`/hunts/${huntId}`, data),
  generateTitle: (huntId) =>
    client.post(`/hunts/${huntId}/generate-title`),
};

export const reportsAPI = {
  create: (title, articleIds, reportType, useGenAI = true) =>
    client.post('/reports/', { title, article_ids: articleIds, report_type: reportType, use_genai: useGenAI }),
  get: (id) => client.get(`/reports/${id}`),
  list: (page = 1, pageSize = 20) =>
    client.get('/reports/', { params: { page, page_size: pageSize } }),
  // Report editing workflow
  update: (id, data) => client.patch(`/reports/${id}`, data),
  publish: (id, notes = null) => client.post(`/reports/${id}/publish`, { notes }),
  unpublish: (id) => client.post(`/reports/${id}/unpublish`),
  share: (id, emails) =>
    client.post(`/reports/${id}/share`, emails),
  downloadPDF: (id) => 
    client.get(`/reports/${id}/export/pdf`, { responseType: 'blob' }),
  // Delete endpoints
  delete: (id) => client.delete(`/reports/${id}`),
  batchDelete: (reportIds) => client.post('/reports/batch-delete', { report_ids: reportIds }),
  // Reviewed articles
  getReviewedArticles: (page = 1, pageSize = 50, daysBack = 7, highPriorityOnly = false) =>
    client.get('/reports/articles/reviewed', { 
      params: { page, page_size: pageSize, days_back: daysBack, high_priority_only: highPriorityOnly } 
    }),
  generateAuto: (reportType = 'executive', period = 'daily', highPriorityOnly = false) =>
    client.post('/reports/generate/auto', { 
      report_type: reportType, 
      period: period,
      include_high_priority_only: highPriorityOnly
    }),
  getStats: () => client.get('/reports/stats'),
  exportCsv: (id) => client.get(`/reports/${id}/export/csv`, { responseType: 'blob' }),
  exportDocx: (id) => client.get(`/reports/${id}/export/docx`, { responseType: 'blob' }),
  exportPdf: (id) => client.get(`/reports/${id}/export/pdf`, { responseType: 'blob' }),
  exportHtml: (id) => client.get(`/reports/${id}/export/html`, { responseType: 'blob' }),
  // Get HTML URL for opening in browser
  getHtmlUrl: (id) => `/api/reports/${id}/export/html`,
};

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
  
  // Dashboard/Operations settings
  getDashboardPresets: () => client.get('/sources/refresh/dashboard/presets'),
  getDashboardSettings: () => client.get('/sources/refresh/dashboard/settings'),
  updateDashboardSettings: (settings) => client.put('/sources/refresh/dashboard/settings', settings),
  getMyDashboardPreferences: () => client.get('/sources/refresh/dashboard/my-preferences'),
  updateMyDashboardPreferences: (preferences) => client.put('/sources/refresh/dashboard/my-preferences', preferences),
  resetMyDashboardPreferences: () => client.delete('/sources/refresh/dashboard/my-preferences'),
};

export const watchlistAPI = {
  list: () => client.get('/watchlist/'),
  create: (keyword) => client.post('/watchlist/', { keyword }),
  delete: (id) => client.delete(`/watchlist/${id}`),
  toggle: (id, isActive) => client.patch(`/watchlist/${id}`, { is_active: isActive }),
  refresh: () => client.post('/watchlist/refresh'),
};

export const auditAPI = {
  list: (page = 1, pageSize = 50, filters = {}) =>
    client.get('/audit/', { params: { page, page_size: pageSize, ...filters } }),
  get: (id) => client.get(`/audit/${id}`),
};

export const connectorsAPI = {
  // Connector configurations
  list: () => client.get('/connectors/'),
  get: (id) => client.get(`/connectors/${id}`),
  create: (data) => client.post('/connectors/', data),
  update: (id, data) => client.patch(`/connectors/${id}`, data),
  delete: (id) => client.delete(`/connectors/${id}`),
  test: (id) => client.post(`/connectors/${id}/test`),
  testPlatform: (platform) => client.post(`/connectors/platform/${platform}/test`),
  
  // Platform registry
  listPlatforms: (params = {}) => client.get('/connectors/platforms', { params }),
  getPlatform: (platformId) => client.get(`/connectors/platforms/${platformId}`),
  createPlatform: (data) => client.post('/connectors/platforms', data),
  updatePlatform: (platformId, data) => client.patch(`/connectors/platforms/${platformId}`, data),
  deletePlatform: (platformId) => client.delete(`/connectors/platforms/${platformId}`),
  listCategories: () => client.get('/connectors/platforms/categories'),
  listCapabilities: () => client.get('/connectors/platforms/capabilities'),
  
  // Templates
  listTemplates: (platformId, actionType = null) => 
    client.get(`/connectors/platforms/${platformId}/templates`, { params: actionType ? { action_type: actionType } : {} }),
  getTemplate: (templateId) => client.get(`/connectors/templates/${templateId}`),
  createTemplate: (platformId, data) => client.post(`/connectors/platforms/${platformId}/templates`, data),
  updateTemplate: (templateId, data) => client.patch(`/connectors/templates/${templateId}`, data),
  deleteTemplate: (templateId) => client.delete(`/connectors/templates/${templateId}`),
  
  // Executions
  listExecutions: (params = {}) => client.get('/connectors/executions', { params }),
  getExecutionStats: (days = 7) => client.get('/connectors/executions/stats', { params: { days } }),
};

export const automationAPI = {
  processArticle: (articleId, options = {}) =>
    client.post('/automation/process', { article_id: articleId, ...options }),
  processBatch: (data) =>
    client.post('/automation/process-batch', data),
  runCycle: (limit = 10) =>
    client.post(`/automation/run-cycle?limit=${limit}`),
  getStats: () =>
    client.get('/automation/stats'),
  getTracker: (articleId) =>
    client.get(`/automation/tracker/${articleId}`),
  // Scheduler
  getScheduledJobs: () =>
    client.get('/automation/scheduler/jobs'),
  getAvailableFunctions: () =>
    client.get('/automation/scheduler/functions'),
  createJob: (jobData) =>
    client.post('/automation/scheduler/jobs', jobData),
  updateJob: (jobId, jobData) =>
    client.put(`/automation/scheduler/jobs/${jobId}`, jobData),
  deleteJob: (jobId) =>
    client.delete(`/automation/scheduler/jobs/${jobId}`),
  runJob: (jobId) =>
    client.post(`/automation/scheduler/jobs/${jobId}/run`),
  runJobNow: (jobId) =>
    client.post(`/automation/scheduler/jobs/${jobId}/run`),
  pauseJob: (jobId) =>
    client.post(`/automation/scheduler/jobs/${jobId}/pause`),
  resumeJob: (jobId) =>
    client.post(`/automation/scheduler/jobs/${jobId}/resume`),
};

export const adminAPI = {
  // Generic methods for flexible API calls
  get: (url, config = {}) => client.get(url, config),
  post: (url, data, config = {}) => client.post(url, data, config),
  patch: (url, data, config = {}) => client.patch(url, data, config),
  delete: (url, config = {}) => client.delete(url, config),
  
  getSettings: () => client.get('/admin/settings'),
  getStats: () => client.get('/admin/stats'),
  getGenaiStatus: () => client.get('/admin/genai/status'),
  getSchedulerStatus: () => client.get('/admin/scheduler/status'),
  getHealth: () => client.get('/admin/health'),
  getConnectorsSummary: () => client.get('/admin/connectors'),
  getAuditSummary: (days = 7) => client.get(`/admin/audit-summary?days=${days}`),
  // Configuration management
  getConfigurations: () => client.get('/admin/configurations'),
  getCategoryConfigurations: (category) => client.get(`/admin/configurations/${category}`),
  saveConfigurations: (data) => client.post('/admin/configurations', data),
  updateConfiguration: (data) => client.post('/admin/configuration', data),
  testConfiguration: (category) => client.post(`/admin/configurations/test/${category}`),
  deleteConfiguration: (category, key) => client.delete(`/admin/configurations/${category}/${key}`),
  // GenAI
  testGenAI: (request) => client.post('/admin/genai/test', request),
  getAvailableModels: () => client.get('/admin/genai/models'),
  setModelPreferences: (preferences) => client.post('/admin/genai/models/preferences', preferences),
  // Ollama management
  setupOllama: (url, model, setAsPrimary = true) => 
    client.post('/admin/genai/ollama/setup', { url, model, set_as_primary: setAsPrimary }),
  getOllamaStatus: () => client.get('/admin/genai/ollama/status'),
  pullOllamaModel: (modelName) => client.post(`/admin/genai/ollama/pull-model?model_name=${modelName}`),
  deleteOllamaModel: (modelName) => client.delete(`/admin/genai/ollama/model/${encodeURIComponent(modelName)}`),
  // Guardrails management
  getAllGuardrails: () => client.get('/admin/guardrails'),
  getFunctionGuardrails: (functionName) => client.get(`/admin/guardrails/${functionName}`),
  updateGuardrails: (functionName, guardrails) => 
    client.put(`/admin/guardrails/${functionName}`, { function_name: functionName, guardrails }),
  resetGuardrails: (functionName) => client.delete(`/admin/guardrails/${functionName}`),
  getPersonas: () => client.get('/admin/prompts/personas'),
  previewPrompt: (functionName, persona = 'threat_intelligence') => 
    client.get('/admin/prompts/preview', { params: { function: functionName, persona } }),
};

// Guardrails API (cybersecurity guardrails testing and management)
export const guardrailsAPI = {
  // List and info
  list: () => client.get('/guardrails/cybersecurity/list'),
  getStats: () => client.get('/guardrails/cybersecurity/stats'),
  getCategories: () => client.get('/guardrails/cybersecurity/categories'),
  getPlatforms: () => client.get('/guardrails/cybersecurity/platforms'),
  getFunctions: () => client.get('/guardrails/cybersecurity/functions'),
  getBestPractices: (category = null) => 
    client.get('/guardrails/cybersecurity/best-practices', { params: category ? { category } : {} }),
  
  // Context preview
  getContextPreview: (functionName, platform = null) =>
    client.get(`/guardrails/cybersecurity/context-preview/${functionName}`, { params: platform ? { platform } : {} }),
  
  // Editable guardrails
  getEditable: (scope = null, functionName = null) =>
    client.get('/guardrails/cybersecurity/editable', { params: { scope, function_name: functionName } }),
  createGuardrail: (data) => client.post('/guardrails/cybersecurity/editable', data),
  updateGuardrail: (id, data) => client.put(`/guardrails/cybersecurity/editable/${id}`, data),
  deleteGuardrail: (id) => client.delete(`/guardrails/cybersecurity/editable/${id}`),
  
  // Function overrides
  getFunctionOverrides: (functionName) =>
    client.get(`/guardrails/cybersecurity/function-overrides/${functionName}`),
  createFunctionOverride: (data) => client.post('/guardrails/cybersecurity/function-override', data),
  
  // Effective guardrails
  getEffective: (functionName, platform = null) =>
    client.get(`/guardrails/cybersecurity/effective/${functionName}`, { params: platform ? { platform } : {} }),
  
  // Validation/Testing
  validateInput: (prompt, useCase, platform = null, guardrailIds = null) =>
    client.post('/guardrails/cybersecurity/validate/input', { 
      prompt, use_case: useCase, platform, guardrail_ids: guardrailIds 
    }),
  validateOutput: (output, useCase, platform = null, sourceContent = null) =>
    client.post('/guardrails/cybersecurity/validate/output', {
      output, use_case: useCase, platform, source_content: sourceContent
    }),
  validateQuery: (query, platform) =>
    client.post('/guardrails/cybersecurity/validate/query', { query, platform }),
  
  // Testing suite
  runTestSuite: (testCases, useCase, platform = null, guardrailIds = null) =>
    client.post('/guardrails/cybersecurity/test/suite', {
      test_cases: testCases, use_case: useCase, platform, guardrail_ids: guardrailIds
    }),
  runGroundTruth: (query, expectedAnswer, context = null, model = null) =>
    client.post('/guardrails/cybersecurity/test/ground-truth', {
      query, expected_answer: expectedAnswer, context, model
    }),
  runModelCompare: (testInput, useCase = 'general', models = null) =>
    client.post('/guardrails/cybersecurity/test/model-compare', {
      test_input: testInput, use_case: useCase, models
    }),
  
  // Toggle
  toggle: (guardrailId, enabled) =>
    client.put(`/guardrails/cybersecurity/toggle/${guardrailId}?enabled=${enabled}`)
};

export const knowledgeAPI = {
  // Document management
  list: (docType = null, status = null, isActive = null, limit = 100) => {
    const params = { limit };
    if (docType) params.doc_type = docType;
    if (status) params.status_filter = status;
    if (isActive !== null) params.is_active = isActive;
    return client.get('/knowledge/', { params });
  },
  get: (docId) => client.get(`/knowledge/${docId}`),
  getContent: (docId) => client.get(`/knowledge/${docId}/content`),
  getStats: () => client.get('/knowledge/stats'),
  
  // Upload
  uploadFile: (formData, onProgress = null) => 
    client.post('/knowledge/upload/file', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress
    }),
  uploadUrl: (data) => client.post('/knowledge/upload/url', data),
  crawl: (url, title, depth = 1, maxPages = 20, options = {}) => 
    client.post('/knowledge/crawl', {
      url,
      title,
      depth,
      max_pages: maxPages,
      same_domain_only: options.sameDomainOnly ?? true,
      doc_type: options.docType || 'product_documentation',
      target_functions: options.targetFunctions,
      target_platforms: options.targetPlatforms,
      tags: options.tags,
      priority: options.priority || 5
    }),
  
  // GitHub repository crawler
  crawlGitHub: (githubUrl, title, options = {}) =>
    client.post('/knowledge/crawl/github', {
      github_url: githubUrl,
      title,
      description: options.description,
      include_code: options.includeCode ?? true,
      include_docs: options.includeDocs ?? true,
      max_files: options.maxFiles || 100,
      doc_type: options.docType || 'custom',
      target_functions: options.targetFunctions,
      target_platforms: options.targetPlatforms,
      tags: options.tags || ['github', 'code'],
      priority: options.priority || 5
    }),
  
  // Self-documentation (admin only - creates KB from Parshu codebase)
  selfDocument: (options = {}) =>
    client.post('/knowledge/self-document', null, {
      params: {
        include_code: options.includeCode ?? true,
        include_docs: options.includeDocs ?? true,
        max_files: options.maxFiles || 200
      }
    }),
  
  // Processing
  process: (docId) => client.post(`/knowledge/${docId}/process`),
  
  // Update/Delete
  update: (docId, data) => client.patch(`/knowledge/${docId}`, data),
  delete: (docId) => client.delete(`/knowledge/${docId}`),
  
  // Search
  search: (query, targetFunction = null, targetPlatform = null, topK = 5) =>
    client.post('/knowledge/search', { 
      query, 
      target_function: targetFunction,
      target_platform: targetPlatform,
      top_k: topK
    }),
  
  // User-level (personal) knowledge base
  addUserUrl: (url, title, crawlDepth = 0, maxPages = 10, description = null) =>
    client.post('/knowledge/user/url', {
      source_url: url,
      title,
      description,
      crawl_depth: crawlDepth,
      max_pages: maxPages
    }),
  getUserDocuments: () => client.get('/knowledge/user/documents'),
  deleteUserDocument: (docId) => client.delete(`/knowledge/user/documents/${docId}`),
  
  // Chunks management (admin)
  getAllChunks: (page = 1, pageSize = 50, documentId = null, search = null) => {
    const params = { page, page_size: pageSize };
    if (documentId) params.document_id = documentId;
    if (search) params.search = search;
    return client.get('/knowledge/chunks/all', { params });
  },
  deleteChunk: (chunkId) => client.delete(`/knowledge/chunks/${chunkId}`),
};

export const intelligenceAPI = {
  getSummary: (statusFilter = null, intelType = null) => {
    const params = {};
    if (statusFilter) params.status_filter = statusFilter;
    if (intelType) params.intel_type = intelType;
    return client.get('/articles/intelligence/summary', { params });
  },
  getAll: (page = 1, pageSize = 50, filters = {}) => {
    const params = { page, page_size: pageSize, ...filters };
    return client.get('/articles/intelligence/all', { params });
  },
  getMitreMatrix: (framework = 'attack', statusFilter = null) => {
    const params = { framework };
    if (statusFilter) params.status_filter = statusFilter;
    return client.get('/articles/intelligence/mitre-matrix', { params });
  },
  // Delete endpoints
  delete: (intelId) =>
    client.delete(`/articles/intelligence/${intelId}`),
  deleteBatch: (intelIds) =>
    client.delete('/articles/intelligence/batch', { params: { intel_ids: intelIds } }),
  deleteAllForArticle: (articleId) =>
    client.delete(`/articles/${articleId}/intelligence/all`),
};

export const usersAPI = {
  list: () => client.get('/users/'),
  listUsers: () => client.get('/users/'),  // Alias for compatibility
  get: (id) => client.get(`/users/${id}`),
  create: (data) => client.post('/users/', data),
  createUser: (data) => client.post('/users/', data),  // Alias for compatibility
  update: (id, data) => client.patch(`/users/${id}`, data),
  updateUser: (id, data) => client.patch(`/users/${id}`, data),  // Alias for compatibility
  delete: (id) => client.delete(`/users/${id}`),
  deleteUser: (id) => client.delete(`/users/${id}`),  // Alias for compatibility
  resetPassword: (id) => client.post(`/users/${id}/reset-password`),
  toggleActive: (id, isActive) => client.patch(`/users/${id}`, { is_active: isActive }),
  
  // Role switching (admin only)
  getAvailableRoles: () => client.get('/users/available-roles'),
  switchRole: (targetRole) => client.post('/users/switch-role', { target_role: targetRole }),
  restoreRole: () => client.post('/users/restore-role'),
  
  // Get current user's permissions (respects impersonation)
  getMyPermissions: () => client.get('/users/my-permissions'),
};

export const rbacAPI = {
  // Get all available permissions
  getPermissions: () => client.get('/admin/rbac/permissions'),
  
  // Get all roles
  getRoles: () => client.get('/admin/rbac/roles'),
  
  // Get permission matrix (roles x permissions)
  getMatrix: () => client.get('/admin/rbac/matrix'),
  
  // Get permissions for a specific role
  getRolePermissions: (role) => client.get(`/admin/rbac/comprehensive/role/${role}`),
  
  // Update role permissions
  updateRolePermissions: (role, permissions) =>
    client.put(`/admin/rbac/comprehensive/role/${role}`, { permissions }),
  
  // User permission overrides
  getUserPermissions: (userId) =>
    client.get(`/admin/rbac/users/${userId}/permissions`),
  
  setUserPermission: (userId, permission, granted, reason = null) =>
    client.post(`/admin/rbac/users/${userId}/permissions`, {
      permission,
      granted,
      reason
    }),
  
  removeUserPermission: (userId, permission) =>
    client.delete(`/admin/rbac/users/${userId}/permissions/${permission}`),
  
  // Page-level permissions
  getPageDefinitions: () => client.get('/admin/rbac/pages'),
  
  getRolePageAccess: (role) => client.get(`/admin/rbac/pages/role/${role}`),
  
  updatePageAccess: (pageKey, role, permissions) =>
    client.put(`/admin/rbac/pages/${pageKey}/role/${role}`, { permissions }),
  
  // Comprehensive RBAC - all permissions and functional areas
  getAllPermissions: () => client.get('/admin/rbac/comprehensive/permissions'),
  getFunctionalAreas: () => client.get('/admin/rbac/comprehensive/areas'),
  getRolePermissions: (role) => client.get(`/admin/rbac/comprehensive/role/${role}`),
  updateRolePermissions: (role, permissions) =>
    client.put(`/admin/rbac/comprehensive/role/${role}`, { permissions })
};

export const iocsAPI = {
  // List all IOCs
  list: (page = 1, pageSize = 50, iocType = null, search = null) => {
    const params = { page, page_size: pageSize };
    if (iocType) params.ioc_type = iocType;
    if (search) params.search = search;
    return client.get('/iocs/', { params });
  },
  
  // Get IOC details
  get: (iocId) => client.get(`/iocs/${iocId}`),
  
  // Search IOC by value
  searchByValue: (value) => client.get(`/iocs/search/${value}`),
  
  // Get IOCs for an article
  getForArticle: (articleId) => client.get(`/iocs/article/${articleId}`),
  
  // Get IOC statistics
  getStats: () => client.get('/iocs/stats/summary')
};

// User Custom Feeds API - personal feeds managed by each user
export const userFeedsAPI = {
  // List user's custom feeds
  list: (includeInactive = false) => 
    client.get('/users/feeds/', { params: { include_inactive: includeInactive } }),
  
  // Get a specific feed
  get: (feedId) => client.get(`/users/feeds/${feedId}`),
  
  // Create a new custom feed
  create: (data) => client.post('/users/feeds/', data),
  
  // Update a feed
  update: (feedId, data) => client.patch(`/users/feeds/${feedId}`, data),
  
  // Delete a feed
  delete: (feedId) => client.delete(`/users/feeds/${feedId}`),
  
  // Toggle feed active status
  toggle: (feedId) => client.post(`/users/feeds/${feedId}/toggle`),
  
  // Trigger ingestion for a feed
  ingest: (feedId) => client.post(`/users/feeds/${feedId}/ingest`),
  
  // Get articles from a specific feed
  getArticles: (feedId, page = 1, limit = 20) => 
    client.get(`/users/feeds/${feedId}/articles`, { params: { page, limit } }),
  
  // Validate a feed URL before adding
  validateUrl: (url) => 
    client.post('/users/feeds/validate-url', null, { params: { url } }),
};

// Chatbot/AI Assistant API
export const chatbotAPI = {
  // Send a message to the AI assistant
  sendMessage: (message, context = null) =>
    client.post('/genai/chat', { message, context }),
  
  // Ask for help with documentation (uses RAG)
  askDocumentation: (question) =>
    client.post('/genai/help', { question }),
  
  // Troubleshoot an issue
  troubleshoot: (issue, systemInfo = null) =>
    client.post('/genai/troubleshoot', { issue, system_info: systemInfo }),
  
  // Get suggested fixes for common issues
  getSuggestions: (topic) =>
    client.get('/genai/suggestions', { params: { topic } }),
};

// Analytics API for enterprise reporting
export const analyticsAPI = {
  // Get dashboard metrics
  getDashboard: (startDate = null, endDate = null) => {
    const params = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    return client.get('/analytics/dashboard', { params });
  },
  
  // Get hunt analytics
  getHuntSummary: (startDate = null, endDate = null, status = null, platform = null) => {
    const params = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    if (status) params.status = status;
    if (platform) params.platform = platform;
    return client.get('/analytics/hunts/summary', { params });
  },
  
  // Get intel to hunt ratio
  getIntelToHuntRatio: (startDate = null, endDate = null) => {
    const params = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    return client.get('/analytics/intel-to-hunt-ratio', { params });
  },
  
  // Generate custom report
  generateReport: (reportType, metrics, dateRange = null, filters = null) => {
    return client.post('/analytics/reports/generate', {
      report_type: reportType,
      metrics,
      date_range: dateRange,
      filters
    });
  },
  
  // MITRE ATT&CK endpoints
  getMitreTactics: () => client.get('/analytics/mitre/tactics'),
  
  getMitreHeatmap: (startDate = null, endDate = null, articlesFilter = 'reviewed') => {
    const params = { articles_filter: articlesFilter };
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    return client.get('/analytics/mitre/heatmap', { params });
  },
  
  generateMitreReport: (options) => {
    return client.post('/analytics/mitre/report', {
      report_format: options.report_format || 'tabular',
      output_format: options.output_format || 'json',
      include_articles: options.include_articles ?? true,
      include_hunts: options.include_hunts ?? true,
      articles_filter: options.articles_filter || 'reviewed',
      date_range: options.date_range
    });
  },
  
  exportMitreCsv: (startDate = null, endDate = null, articlesFilter = 'reviewed') => {
    const params = { articles_filter: articlesFilter };
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    return client.get('/analytics/mitre/export/csv', { params, responseType: 'blob' });
  }
};

export default client;
