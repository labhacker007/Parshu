import React, { useState, useEffect, useCallback } from 'react';
import { 
  Table, Drawer, Tabs, Button, Space, Tag, Spin, Alert, 
  Card, Row, Col, Statistic, Select, Typography, Badge,
  Descriptions, Empty, Tooltip, message, Modal, List, Input, Avatar, Popconfirm, Divider, Switch
} from 'antd';
import { 
  FileTextOutlined, 
  SyncOutlined, 
  FilterOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  LinkOutlined,
  SaveOutlined,
  DatabaseOutlined,
  CommentOutlined,
  SendOutlined,
  UserOutlined,
  DeleteOutlined,
  EditOutlined,
  ThunderboltOutlined,
  BugOutlined,
  RobotOutlined,
  ExperimentOutlined,
  LoadingOutlined,
  FileSearchOutlined,
  CodeOutlined,
  PlayCircleOutlined,
  CopyOutlined,
  FilePdfOutlined,
  FileExcelOutlined,
  GlobalOutlined,
  DownloadOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  AlertOutlined,
  FieldTimeOutlined,
  TeamOutlined
} from '@ant-design/icons';
import { useLocation } from 'react-router-dom';
import { articlesAPI, sourcesAPI, adminAPI, huntsAPI } from '../api/client';
import { CloudDownloadOutlined } from '@ant-design/icons';
import { useArticleStore } from '../store/index';
import { useAuthStore } from '../store/index';
import FormattedContent from '../components/FormattedContent';
import { useTimezone } from '../context/TimezoneContext';
import { useHuntLauncher } from '../hooks/useHuntLauncher';
import './ArticleQueue.css';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

// Clean AI-generated summary by removing common prefixes
const cleanAISummary = (text) => {
  if (!text) return text;
  // Remove common AI prefixes
  const prefixes = [
    /^Here is a \d+-?\d* sentence executive summary:?\s*/i,
    /^Here is an executive summary:?\s*/i,
    /^Executive Summary:?\s*/i,
    /^Here is a technical summary:?\s*/i,
    /^Technical Summary:?\s*/i,
    /^Summary:?\s*/i,
  ];
  let cleaned = text;
  for (const prefix of prefixes) {
    cleaned = cleaned.replace(prefix, '');
  }
  return cleaned.trim();
};

function ArticleQueue() {
  const location = useLocation();
  const { getRelativeTime, formatDateTime } = useTimezone();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [drawerVisible, setDrawerVisible] = useState(false);
  const { articles, setArticles, selectedArticle, setSelectedArticle, total } = useArticleStore();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState(null);
  const [highPriorityOnly, setHighPriorityOnly] = useState(false);
  const [sources, setSources] = useState([]);
  const [sourceFilter, setSourceFilter] = useState(null);
const [globalStats, setGlobalStats] = useState({
    new: 0,
    in_analysis: 0,
    need_to_hunt: 0,
    hunt_generated: 0,
    reviewed: 0,
    archived: 0,
    high_priority: 0,
    sla_breaches: 0
  });
  
  // SLA breach filter
  const [slaBreachOnly, setSlaBreachOnly] = useState(false);
  
  // SLA thresholds in hours - articles older than these without progress are breaching SLA
  const SLA_THRESHOLDS = {
    NEW: 4, // NEW articles should be triaged within 4 hours
    IN_ANALYSIS: 24, // Articles in analysis should move forward within 24 hours
    NEED_TO_HUNT: 8, // Articles needing hunt should have hunts generated within 8 hours
  };
  
  // Helper function to check if article is breaching SLA
  const isArticleBreachingSLA = (article) => {
    if (!article.created_at) return false;
    const threshold = SLA_THRESHOLDS[article.status];
    if (!threshold) return false; // Completed statuses don't have SLA
    const ageHours = (Date.now() - new Date(article.created_at).getTime()) / (1000 * 60 * 60);
    return ageHours > threshold;
  };
  
  // Hunt status filter for Generated Hunts section
  const [huntStatusFilter, setHuntStatusFilter] = useState(null);
  const [statusChange, setStatusChange] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [sourcesModalVisible, setSourcesModalVisible] = useState(false);
  
  // Archived visibility - admin can enable this for analysts
  const [showArchived, setShowArchived] = useState(false);
  const [canViewArchived, setCanViewArchived] = useState(false); // Permission from admin settings
  
  // Comments state
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const { user } = useAuthStore();
  
  // Hunt launch state
  const [huntPlatform, setHuntPlatform] = useState('defender');
  const [huntQueryPreview, setHuntQueryPreview] = useState('');
  const [generatingQuery, setGeneratingQuery] = useState(false);
  const [launchingHunt, setLaunchingHunt] = useState(false);
  
  // GenAI extraction and summarization state - track per-article to allow parallel operations
  const [extractingArticles, setExtractingArticles] = useState({}); // { articleId: true/false }
  const [summarizingArticles, setSummarizingArticles] = useState({}); // { articleId: true/false }
  const [availableModels, setAvailableModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  
  // Feed ingestion state
  const [fetchingFeeds, setFetchingFeeds] = useState(false);
  const [lastFetchResult, setLastFetchResult] = useState(null);
  
  // Comparison mode state
  const [comparing, setComparing] = useState(false);
  const [comparisonResults, setComparisonResults] = useState(null);
  const [comparisonModalVisible, setComparisonModalVisible] = useState(false);
  
  // Bulk selection state
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  
  // Auto-refresh state
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

  // Processing type filter: 'automated' (has AI summary) or 'manual' (reviewed but no AI summary)
  const [processingFilter, setProcessingFilter] = useState(null);
  
  // Read URL parameters on mount
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const status = params.get('status');
    const highPriority = params.get('high_priority');
    const sourceId = params.get('source_id');
    const articleId = params.get('article_id');
    const slaBreach = params.get('sla_breach');
    const processing = params.get('processing'); // 'automated' or 'manual'
    
    if (status) setStatusFilter(status);
    if (highPriority === 'true') setHighPriorityOnly(true);
    if (sourceId) setSourceFilter(parseInt(sourceId));
    if (slaBreach === 'true') setSlaBreachOnly(true);
    if (processing) setProcessingFilter(processing);
    
    // Auto-open article detail if article_id is in URL
    if (articleId) {
      const openArticle = async () => {
        try {
          const response = await articlesAPI.getArticle(parseInt(articleId));
          if (response.data) {
            // Use showDetails to ensure all auto-generation triggers
            showDetails(response.data);
          }
        } catch (err) {
          console.error('Failed to load article from URL', err);
          message.error('Article not found');
        }
      };
      openArticle();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  // Check if user can view archived articles (admin setting)
  const fetchArchivedPermission = async () => {
    try {
      // Admins can always view archived
      if (user?.role === 'ADMIN') {
        setCanViewArchived(true);
        return;
      }
      // Check admin settings for analyst permission
      const response = await adminAPI.getSettings();
      const settings = response.data?.settings || {};
      setCanViewArchived(settings.analysts_can_view_archived === true);
    } catch (err) {
      console.error('Failed to fetch archived permission', err);
      setCanViewArchived(false);
    }
  };

  useEffect(() => {
    fetchArchivedPermission();
  }, [user?.role]);

  const fetchSources = useCallback(async () => {
    try {
      const response = await sourcesAPI.list();
      setSources(response.data || []);
    } catch (err) {
      console.error('Failed to fetch sources', err);
    }
  }, []);

  // Fetch GLOBAL stats (across ALL pages) - separate from filtered results
  const fetchGlobalStats = useCallback(async () => {
    console.log('[ArticleQueue] Starting fetchGlobalStats...');
    try {
      // Get counts for all statuses and high priority
      // Also fetch recent articles to calculate SLA breaches
      const [newResponse, inAnalysisResponse, needToHuntResponse, huntGeneratedResponse, reviewedResponse, archivedResponse, highPriorityResponse, recentArticles] = await Promise.all([
        articlesAPI.getTriageQueue(1, 1, 'NEW', false, null),
        articlesAPI.getTriageQueue(1, 1, 'IN_ANALYSIS', false, null),
        articlesAPI.getTriageQueue(1, 1, 'NEED_TO_HUNT', false, null),
        articlesAPI.getTriageQueue(1, 1, 'HUNT_GENERATED', false, null),
        articlesAPI.getTriageQueue(1, 1, 'REVIEWED', false, null),
        articlesAPI.getTriageQueue(1, 1, 'ARCHIVED', false, null),
        articlesAPI.getTriageQueue(1, 1, null, true, null),
        articlesAPI.getTriageQueue(1, 200, null, false, null), // Get recent articles to check SLA
      ]);
      
      // Calculate SLA breaches from recent articles
      const allArticles = recentArticles?.data?.articles || [];
      const slaBreaches = allArticles.filter(article => {
        if (!article.created_at) return false;
        const threshold = SLA_THRESHOLDS[article.status];
        if (!threshold) return false;
        const ageHours = (Date.now() - new Date(article.created_at).getTime()) / (1000 * 60 * 60);
        return ageHours > threshold;
      }).length;
      
      console.log('[ArticleQueue] Raw responses:', {
        new: newResponse?.data,
        inAnalysis: inAnalysisResponse?.data,
        needToHunt: needToHuntResponse?.data,
        slaBreaches
      });
      
      const stats = {
        new: newResponse?.data?.total ?? 0,
        in_analysis: inAnalysisResponse?.data?.total ?? 0,
        need_to_hunt: needToHuntResponse?.data?.total ?? 0,
        hunt_generated: huntGeneratedResponse?.data?.total ?? 0,
        reviewed: reviewedResponse?.data?.total ?? 0,
        archived: archivedResponse?.data?.total ?? 0,
        high_priority: highPriorityResponse?.data?.total ?? 0,
        sla_breaches: slaBreaches
      };
      
      console.log('[ArticleQueue] Global stats fetched:', stats);
      setGlobalStats(stats);
    } catch (err) {
      console.error('[ArticleQueue] Failed to fetch global stats:', err);
      // Don't reset to 0 if we already have data
    }
  }, []);

  // Fetch global stats on mount and when user changes
  useEffect(() => {
    fetchGlobalStats();
  }, [fetchGlobalStats, user?.id]);

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Determine effective status filter
      // If not explicitly filtering for ARCHIVED, and showArchived is false, exclude archived
      let effectiveStatusFilter = statusFilter;
      
      // If filtering for SLA breaches, we need to fetch more articles to filter client-side
      // since SLA breach is calculated based on age and status
      const fetchPageSize = slaBreachOnly ? 500 : pageSize;
      const fetchPage = slaBreachOnly ? 1 : page;
      
      const response = await articlesAPI.getTriageQueue(
        fetchPage,
        fetchPageSize,
        effectiveStatusFilter,
        highPriorityOnly,
        sourceFilter
      );
      
      let data = response.data;
      let filteredArticles = data.articles || [];
      
      // If not explicitly filtering for archived and showArchived is false, exclude archived articles
      if (statusFilter !== 'ARCHIVED' && !showArchived) {
        filteredArticles = filteredArticles.filter(a => a.status !== 'ARCHIVED');
      }
      
      // If filtering for SLA breaches, only show articles breaching SLA
      if (slaBreachOnly) {
        filteredArticles = filteredArticles.filter(isArticleBreachingSLA);
        // Apply pagination manually for SLA breach filtering
        const startIdx = (page - 1) * pageSize;
        const paginatedArticles = filteredArticles.slice(startIdx, startIdx + pageSize);
        setArticles(paginatedArticles, filteredArticles.length);
        return;
      }
      
      // If filtering by processing type (automated vs manual)
      if (processingFilter) {
        if (processingFilter === 'automated') {
          // Automated = has executive_summary OR technical_summary
          filteredArticles = filteredArticles.filter(a => 
            (a.executive_summary && a.executive_summary.trim() !== '') || 
            (a.technical_summary && a.technical_summary.trim() !== '')
          );
        } else if (processingFilter === 'manual') {
          // Manual = no AI summary (neither executive nor technical)
          filteredArticles = filteredArticles.filter(a => 
            (!a.executive_summary || a.executive_summary.trim() === '') && 
            (!a.technical_summary || a.technical_summary.trim() === '')
          );
        }
        // Apply pagination manually for processing filtering
        const startIdx = (page - 1) * pageSize;
        const paginatedArticles = filteredArticles.slice(startIdx, startIdx + pageSize);
        setArticles(paginatedArticles, filteredArticles.length);
        return;
      }
      
      setArticles(filteredArticles, statusFilter === 'ARCHIVED' ? data.total : filteredArticles.length);
    } catch (err) {
      console.error('Failed to load articles', err);
      setError('Failed to load articles. Make sure you have ingested feeds first.');
      setArticles([], 0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, highPriorityOnly, sourceFilter, showArchived, slaBreachOnly, processingFilter, setArticles]);

  useEffect(() => {
    fetchArticles();
    fetchSources();
  }, [fetchArticles, fetchSources]);

  // Manual refresh function
  const handleManualRefresh = useCallback(() => {
    setLastRefresh(new Date());
    fetchGlobalStats();
    fetchArticles();
    fetchSources();
  }, [fetchArticles, fetchGlobalStats, fetchSources]);

  // Fetch all feeds from sources
  const handleFetchAllFeeds = async () => {
    setFetchingFeeds(true);
    setLastFetchResult(null);
    try {
      const response = await sourcesAPI.ingestAll();
      const data = response.data;
      
      setLastFetchResult(data);
      message.success(`Fetched ${data.total_new_articles} new articles from ${data.results?.length || 0} sources`);
      
      // Refresh the article list and stats
      fetchGlobalStats();
      fetchArticles();
      fetchSources();
    } catch (err) {
      console.error('Failed to fetch feeds:', err);
      message.error(err.response?.data?.detail || 'Failed to fetch feeds');
    } finally {
      setFetchingFeeds(false);
    }
  };

  // Auto-refresh every 5 minutes
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      console.log('Auto-refreshing article queue...');
      handleManualRefresh();
    }, AUTO_REFRESH_INTERVAL);
    
    return () => clearInterval(interval);
  }, [autoRefresh, handleManualRefresh]);

  const fetchAvailableModels = async () => {
    try {
      const response = await adminAPI.getAvailableModels();
      setAvailableModels(response.data.models || []);
      setSelectedModel(response.data.primary_model);
    } catch (err) {
      console.error('Failed to fetch available models', err);
    }
  };

  // Fetch comments for an article
  const fetchComments = async (articleId) => {
    if (!articleId) return;
    setCommentsLoading(true);
    try {
      const response = await articlesAPI.getComments(articleId);
      setComments(response.data.comments || response.data || []);
    } catch (err) {
      console.error('Failed to fetch comments', err);
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  };

  const showDetails = async (article) => {
    setSelectedArticle(article);
    setStatusChange(article.status);
    setDrawerVisible(true);
    
    // Fetch comments for this article
    fetchComments(article.id);
    
    // Fetch available models for GenAI operations (this sets the primary model)
    await fetchAvailableModels();
    
    // Auto-extract IOCs if not already extracted (for Hunt Workbench)
    if (!article.extracted_intelligence?.length) {
      autoExtractIOCs(article);
    }
    
    // Auto-generate summaries if not already generated
    if (!article.executive_summary && !article.technical_summary) {
      autoGenerateSummary(article);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedArticle) return;
    
    setSubmittingComment(true);
    try {
      const response = await articlesAPI.addComment(selectedArticle.id, newComment.trim());
      setComments([...comments, response.data]);
      setNewComment('');
      message.success('Comment added');
    } catch (err) {
      console.error('Failed to add comment', err);
      message.error('Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await articlesAPI.deleteComment(selectedArticle.id, commentId);
      setComments(comments.filter(c => c.id !== commentId));
      message.success('Comment deleted');
    } catch (err) {
      console.error('Failed to delete comment', err);
      message.error('Failed to delete comment');
    }
  };

  // Hunt launch handlers
  const handlePreviewHuntQuery = async () => {
    if (!selectedArticle) return;
    
    setGeneratingQuery(true);
    try {
      const response = await huntsAPI.previewQuery(selectedArticle.id, huntPlatform);
      setHuntQueryPreview(response.data?.query || response.data?.query_logic || '');
      message.success('Query generated');
    } catch (err) {
      message.error(err.response?.data?.detail || 'Failed to generate query');
    } finally {
      setGeneratingQuery(false);
    }
  };

  const handleLaunchHunt = async () => {
    if (!selectedArticle) return;
    
    setLaunchingHunt(true);
    try {
      // Generate the hunt
      const genResponse = await huntsAPI.generateQuery(selectedArticle.id, huntPlatform);
      const huntId = genResponse.data?.id;
      
      if (huntId) {
        // Execute the hunt
        const execResponse = await huntsAPI.execute(huntId);
        
        // Determine result message for comment
        const status = execResponse.data?.status || 'RUNNING';
        const hitsCount = execResponse.data?.hits_count || 0;
        let resultMsg = `Hunt status: ${status}`;
        if (status === 'COMPLETED') {
          resultMsg = hitsCount > 0 
            ? `Hunt completed with ${hitsCount} hit(s) found!` 
            : 'Hunt completed - no hits found.';
        } else if (status === 'FAILED') {
          resultMsg = `Hunt failed: ${execResponse.data?.error_message || 'Check Hunt Workbench for details'}`;
        }
        
        // Add automatic comment to article with hunt result
        try {
          await articlesAPI.addComment(
            selectedArticle.id,
            `[Hunt] ${huntPlatform.toUpperCase()} hunt launched. ${resultMsg}`,
            true // internal comment
          );
        } catch (commentErr) {
          console.error('Failed to add hunt comment', commentErr);
        }
        
        message.success('Hunt launched successfully! Check Hunt Workbench for results.');
        
        // Update article status to HUNT_GENERATED (move from NEED_TO_HUNT)
        try {
          await articlesAPI.updateStatus(selectedArticle.id, 'HUNT_GENERATED');
        } catch (statusErr) {
          console.error('Failed to update article status', statusErr);
        }
        
        // Refresh article to show new hunt, status, and comment
        const refreshed = await articlesAPI.getArticle(selectedArticle.id);
        setSelectedArticle(refreshed.data);
        
        // Refresh comments to show the new one
        fetchComments(selectedArticle.id);
        
        // Refresh stats
        fetchGlobalStats();
        fetchArticles();
      }
    } catch (err) {
      // Add failure comment
      try {
        await articlesAPI.addComment(
          selectedArticle.id,
          `[Hunt] ${huntPlatform.toUpperCase()} hunt failed: ${err.response?.data?.detail || err.message}`,
          true
        );
        fetchComments(selectedArticle.id);
      } catch (commentErr) {
        console.error('Failed to add hunt failure comment', commentErr);
      }
      message.error(err.response?.data?.detail || 'Failed to launch hunt');
    } finally {
      setLaunchingHunt(false);
    }
  };

  const handleLaunchHuntWithQuery = async () => {
    if (!selectedArticle || !huntQueryPreview) return;
    
    setLaunchingHunt(true);
    try {
      // Generate hunt first (creates the hunt record)
      const genResponse = await huntsAPI.generateQuery(selectedArticle.id, huntPlatform);
      const huntId = genResponse.data?.id;
      
      if (huntId) {
        // Update with custom query if modified
        if (huntQueryPreview !== genResponse.data?.query_logic) {
          await huntsAPI.update(huntId, { query_logic: huntQueryPreview });
        }
        
        // Execute the hunt
        const execResponse = await huntsAPI.execute(huntId);
        
        // Determine result message for comment
        const status = execResponse.data?.status || 'RUNNING';
        const hitsCount = execResponse.data?.hits_count || 0;
        let resultMsg = `Hunt status: ${status}`;
        if (status === 'COMPLETED') {
          resultMsg = hitsCount > 0 
            ? `Hunt completed with ${hitsCount} hit(s) found!` 
            : 'Hunt completed - no hits found.';
        } else if (status === 'FAILED') {
          resultMsg = `Hunt failed: ${execResponse.data?.error_message || 'Check Hunt Workbench for details'}`;
        }
        
        // Add automatic comment to article with hunt result
        try {
          await articlesAPI.addComment(
            selectedArticle.id,
            `[Hunt] ${huntPlatform.toUpperCase()} hunt launched (custom query). ${resultMsg}`,
            true
          );
        } catch (commentErr) {
          console.error('Failed to add hunt comment', commentErr);
        }
        
        message.success('Hunt launched with custom query! Check Hunt Workbench for results.');
        
        // Update article status to HUNT_GENERATED (move from NEED_TO_HUNT)
        try {
          await articlesAPI.updateStatus(selectedArticle.id, 'HUNT_GENERATED');
        } catch (statusErr) {
          console.error('Failed to update article status', statusErr);
        }
        
        // Refresh article
        const refreshed = await articlesAPI.getArticle(selectedArticle.id);
        setSelectedArticle(refreshed.data);
        setHuntQueryPreview('');
        
        // Refresh comments
        fetchComments(selectedArticle.id);
        
        // Refresh stats
        fetchGlobalStats();
        fetchArticles();
      }
    } catch (err) {
      // Add failure comment
      try {
        await articlesAPI.addComment(
          selectedArticle.id,
          `[Hunt] ${huntPlatform.toUpperCase()} hunt (custom query) failed: ${err.response?.data?.detail || err.message}`,
          true
        );
        fetchComments(selectedArticle.id);
      } catch (commentErr) {
        console.error('Failed to add hunt failure comment', commentErr);
      }
      message.error(err.response?.data?.detail || 'Failed to launch hunt');
    } finally {
      setLaunchingHunt(false);
    }
  };
  
  // Auto-extract IOCs when opening article if not already extracted
  const autoExtractIOCs = async (article) => {
    if (!article?.extracted_intelligence?.length && !extractingArticles[article.id]) {
      setExtractingArticles(prev => ({ ...prev, [article.id]: true }));
      try {
        await articlesAPI.extractIntelligence(article.id, true, null, true);
        const refreshed = await articlesAPI.getArticle(article.id);
        setSelectedArticle(refreshed.data);
        message.success('Auto-extracted IOCs & TTPs');
      } catch (err) {
        console.error('Auto-extraction failed', err);
      } finally {
        setExtractingArticles(prev => ({ ...prev, [article.id]: false }));
      }
    }
  };
  
  // Auto-generate summaries when opening article if not already generated
  const autoGenerateSummary = async (article) => {
    // Only generate if no executive or technical summary exists
    if (!article?.executive_summary && !article?.technical_summary && !summarizingArticles[article.id]) {
      setSummarizingArticles(prev => ({ ...prev, [article.id]: true }));
      try {
        // Use the primary model (selectedModel will be set by fetchAvailableModels)
        await articlesAPI.summarizeArticle(article.id, selectedModel);
        const refreshed = await articlesAPI.getArticle(article.id);
        setSelectedArticle(refreshed.data);
        message.success('Auto-generated executive & technical summaries');
      } catch (err) {
        console.error('Auto-summary generation failed', err);
        // Don't show error message for auto-generation - user can manually trigger if needed
      } finally {
        setSummarizingArticles(prev => ({ ...prev, [article.id]: false }));
      }
    }
  };

  const handleStatusUpdate = async () => {
    if (!selectedArticle || !statusChange) return;
    
    setUpdatingStatus(true);
    try {
      await articlesAPI.updateStatus(selectedArticle.id, statusChange);
      message.success(`Article status updated to ${statusChange}`);
      
      // Update the article in the list
      setSelectedArticle({ ...selectedArticle, status: statusChange });
      
      // Refresh the articles list
      await fetchArticles();
      
      // Close drawer after successful update
      setTimeout(() => {
        setDrawerVisible(false);
      }, 1000);
    } catch (err) {
      console.error('Failed to update status', err);
      message.error('Failed to update article status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Bulk operations
  const handleBulkStatusChange = async (newStatus) => {
    if (selectedRowKeys.length === 0) {
      message.warning('Please select articles first');
      return;
    }
    
    Modal.confirm({
      title: `Update ${selectedRowKeys.length} articles`,
      content: `Change status of ${selectedRowKeys.length} selected articles to "${newStatus}"?`,
      okText: 'Update All',
      onOk: async () => {
        setBulkUpdating(true);
        try {
          let successCount = 0;
          for (const articleId of selectedRowKeys) {
            try {
              await articlesAPI.updateStatus(articleId, newStatus);
              successCount++;
            } catch (e) {
              console.error(`Failed to update article ${articleId}`, e);
            }
          }
          message.success(`Updated ${successCount} articles to ${newStatus}`);
          setSelectedRowKeys([]);
          await fetchArticles();
        } catch (err) {
          message.error('Failed to update some articles');
        } finally {
          setBulkUpdating(false);
        }
      }
    });
  };

  const handleBulkDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('Please select articles first');
      return;
    }
    
    Modal.confirm({
      title: `Delete ${selectedRowKeys.length} articles`,
      content: 'Are you sure? This action cannot be undone.',
      okText: 'Delete All',
      okType: 'danger',
      onOk: async () => {
        setBulkUpdating(true);
        try {
          let successCount = 0;
          for (const articleId of selectedRowKeys) {
            try {
              await articlesAPI.delete(articleId);
              successCount++;
            } catch (e) {
              console.error(`Failed to delete article ${articleId}`, e);
            }
          }
          message.success(`Deleted ${successCount} articles`);
          setSelectedRowKeys([]);
          await fetchArticles();
        } catch (err) {
          message.error('Failed to delete some articles');
        } finally {
          setBulkUpdating(false);
        }
      }
    });
  };

  // Row selection config
  const rowSelection = {
    selectedRowKeys,
    onChange: setSelectedRowKeys,
  };

  const getStatusColor = (status) => {
    const colors = {
      NEW: 'blue',
      IN_ANALYSIS: 'orange',
      NEED_TO_HUNT: 'purple',
      HUNT_GENERATED: 'cyan',
      REVIEWED: 'green',
      ARCHIVED: 'default',
    };
    return colors[status] || 'default';
  };

  const formatStatusDisplay = (status) => {
    const displays = {
      NEW: 'New',
      IN_ANALYSIS: 'In Analysis',
      NEED_TO_HUNT: 'Need to Hunt',
      HUNT_GENERATED: 'Hunt Generated',
      REVIEWED: 'Reviewed',
      ARCHIVED: 'Archived',
    };
    return displays[status] || status;
  };

  const columns = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      width: '35%',
      render: (text, record) => (
        <Space direction="vertical" size={0}>
          <Space>
            {record.is_high_priority && (
              <Badge status="error" />
            )}
            <Text strong={record.status === 'NEW'} style={{ cursor: 'pointer' }}>
              {text?.substring(0, 80)}{text?.length > 80 ? '...' : ''}
            </Text>
          </Space>
          {record.watchlist_match_keywords?.length > 0 && (
            <Space size={2}>
              {record.watchlist_match_keywords.slice(0, 3).map((kw, i) => (
                <Tag key={i} color="orange" style={{ fontSize: 10 }}>{kw}</Tag>
              ))}
            </Space>
          )}
        </Space>
      ),
    },
    {
      title: 'Source',
      dataIndex: 'source_name',
      key: 'source',
      width: '15%',
      render: (name) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {name || 'Unknown'}
        </Text>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: '12%',
      render: (status) => (
        <Tag color={getStatusColor(status)}>{formatStatusDisplay(status)}</Tag>
      ),
    },
    {
      title: 'Priority',
      dataIndex: 'is_high_priority',
      key: 'priority',
      width: '8%',
      render: (isHigh, record) => (
        <Space direction="vertical" size={0}>
          {isHigh || record.watchlist_match_keywords?.length > 0 ? (
            <Tag color="red" icon={<WarningOutlined />}>High</Tag>
          ) : (
            <Tag icon={<CheckCircleOutlined />}>Normal</Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Tags',
      key: 'tags',
      width: '12%',
      render: (_, record) => {
        const tags = record.watchlist_match_keywords || [];
        if (tags.length === 0) {
          return <Text type="secondary" style={{ fontSize: 11 }}>—</Text>;
        }
        return (
          <Space size={2} wrap>
            {tags.slice(0, 3).map((tag, i) => (
              <Tag key={i} color="orange" style={{ fontSize: 10, margin: 1 }}>{tag}</Tag>
            ))}
            {tags.length > 3 && (
              <Tooltip title={tags.slice(3).join(', ')}>
                <Tag style={{ fontSize: 10 }}>+{tags.length - 3}</Tag>
              </Tooltip>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Hunt Status',
      key: 'hunt_status',
      width: '12%',
      render: (_, record) => {
        const huntStatuses = record.hunt_status || [];
        if (huntStatuses.length === 0) {
          return <Tag>No Hunts</Tag>;
        }
        
        // Show aggregated status
        const completed = huntStatuses.filter(h => h.status === 'COMPLETED').length;
        const failed = huntStatuses.filter(h => h.status === 'FAILED').length;
        const running = huntStatuses.filter(h => h.status === 'RUNNING' || h.status === 'PENDING').length;
        const totalHits = huntStatuses.reduce((sum, h) => sum + (h.hits_count || 0), 0);
        
        if (running > 0) {
          return <Tag color="processing" icon={<SyncOutlined spin />}>Running</Tag>;
        }
        if (completed > 0 && failed === 0) {
          return (
            <Tooltip title={`${completed} hunt(s), ${totalHits} hits`}>
              <Tag color="success" icon={<CheckCircleOutlined />}>
                {totalHits > 0 ? `${totalHits} Hits` : 'Complete'}
              </Tag>
            </Tooltip>
          );
        }
        if (failed > 0) {
          return <Tag color="error">Failed</Tag>;
        }
        return <Tag color="default">{huntStatuses.length} hunts</Tag>;
      },
    },
    {
      title: 'Published',
      dataIndex: 'published_at',
      key: 'published',
      width: '12%',
      render: (date, record) => {
        const ingDate = record.ingested_at || record.created_at;
        const showIngested = ingDate && date && 
          Math.abs(new Date(date) - new Date(ingDate)) > 60000;
        
        return (
        <Tooltip
          title={
            <div>
              <div><strong>Published:</strong> {date ? new Date(date).toLocaleString() : 'Unknown'}</div>
              <div><strong>Ingested:</strong> {ingDate ? new Date(ingDate).toLocaleString() : 'Unknown'}</div>
            </div>
          }
        >
          <Space direction="vertical" size={0}>
            <Text style={{ fontSize: 12 }}>{getRelativeTime(date) || 'Unknown'}</Text>
            {showIngested && (
              <Text type="secondary" style={{ fontSize: 10 }}>
                Ingested {getRelativeTime(ingDate)}
              </Text>
            )}
          </Space>
        </Tooltip>
        );
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      width: '16%',
      render: (_, record) => (
        <Space>
          <Button 
            size="small" 
            type="primary"
            onClick={(e) => {
              e.stopPropagation();
              showDetails(record);
            }}
          >
            View
          </Button>
          {record.url && (
            <Tooltip title="Open original">
              <Button 
                size="small"
                icon={<LinkOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(record.url, '_blank');
                }}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="queue-container">
      <div className="queue-header">
        <div>
          <Title level={2}>
            <FileTextOutlined /> Article Queue
          </Title>
          <Text type="secondary">
            Review and triage threat intelligence articles from monitored feeds
          </Text>
        </div>
        <Space>
          <Tooltip title={`Auto-refresh every 5 minutes. Last: ${lastRefresh.toLocaleTimeString()}`}>
            <Switch
              checkedChildren="Auto"
              unCheckedChildren="Manual"
              checked={autoRefresh}
              onChange={setAutoRefresh}
              size="small"
            />
          </Tooltip>
          <Tooltip title="Fetch new articles from all RSS/Atom feed sources">
            <Button 
              icon={<CloudDownloadOutlined />}
              onClick={handleFetchAllFeeds} 
              loading={fetchingFeeds}
            >
              Fetch Feeds
            </Button>
          </Tooltip>
          <Button 
            type="primary" 
            icon={<SyncOutlined spin={loading} />}
            onClick={handleManualRefresh} 
            loading={loading}
          >
            Refresh
          </Button>
        </Space>
      </div>

{/* Status Tiles Row - All tiles in one row using flex */}
      <Row gutter={[8, 8]} style={{ marginBottom: 24 }}>
        <Col flex="1">
          <Card 
            size="small" 
            hoverable 
            className={`status-tile status-new ${statusFilter === 'NEW' ? 'active' : ''}`}
            onClick={() => {
              setPage(1);
              setStatusFilter(statusFilter === 'NEW' ? null : 'NEW');
              setHighPriorityOnly(false);
            }}
            style={{ cursor: 'pointer' }}
          >
            <Statistic 
              title="New" 
              value={globalStats.new} 
              valueStyle={{ fontSize: 20 }}
              prefix={<ClockCircleOutlined style={{ color: 'var(--primary)' }} />}
            />
          </Card>
        </Col>
        <Col flex="1">
          <Card 
            size="small"
            hoverable
            className={`status-tile status-in-analysis ${statusFilter === 'IN_ANALYSIS' ? 'active' : ''}`}
            onClick={() => {
              setPage(1);
              setStatusFilter(statusFilter === 'IN_ANALYSIS' ? null : 'IN_ANALYSIS');
              setHighPriorityOnly(false);
            }}
            style={{ cursor: 'pointer' }}
          >
            <Statistic 
              title="In Analysis" 
              value={globalStats.in_analysis}
              valueStyle={{ fontSize: 20 }}
              prefix={<FileSearchOutlined style={{ color: 'var(--warning)' }} />}
            />
          </Card>
        </Col>
        <Col flex="1">
          <Card 
            size="small"
            hoverable
            className={`status-tile status-need-to-hunt ${statusFilter === 'NEED_TO_HUNT' ? 'active' : ''}`}
            onClick={() => {
              setPage(1);
              setStatusFilter(statusFilter === 'NEED_TO_HUNT' ? null : 'NEED_TO_HUNT');
              setHighPriorityOnly(false);
            }}
            style={{ cursor: 'pointer' }}
          >
            <Statistic 
              title="Need to Hunt" 
              value={globalStats.need_to_hunt}
              valueStyle={{ fontSize: 20 }}
              prefix={<ThunderboltOutlined style={{ color: 'var(--primary)' }} />}
            />
          </Card>
        </Col>
        <Col flex="1">
          <Card 
            size="small"
            hoverable
            className={`status-tile status-hunt-generated ${statusFilter === 'HUNT_GENERATED' ? 'active' : ''}`}
            onClick={() => {
              setPage(1);
              setStatusFilter(statusFilter === 'HUNT_GENERATED' ? null : 'HUNT_GENERATED');
              setHighPriorityOnly(false);
            }}
            style={{ cursor: 'pointer' }}
          >
            <Statistic 
              title="Hunt Generated" 
              value={globalStats.hunt_generated}
              valueStyle={{ fontSize: 20 }}
              prefix={<PlayCircleOutlined style={{ color: 'var(--info)' }} />}
            />
          </Card>
        </Col>
        <Col flex="1">
          <Card 
            size="small"
            hoverable
            className={`status-tile status-reviewed ${statusFilter === 'REVIEWED' ? 'active' : ''}`}
            onClick={() => {
              setPage(1);
              setStatusFilter(statusFilter === 'REVIEWED' ? null : 'REVIEWED');
              setHighPriorityOnly(false);
            }}
            style={{ cursor: 'pointer' }}
          >
            <Statistic 
              title="Reviewed" 
              value={globalStats.reviewed}
              valueStyle={{ fontSize: 20 }}
              prefix={<CheckCircleOutlined style={{ color: 'var(--success)' }} />}
            />
          </Card>
        </Col>
        <Col flex="1">
          <Card 
            size="small"
            hoverable
            className={`status-tile status-high-priority ${highPriorityOnly ? 'active' : ''}`}
            onClick={() => {
              setPage(1);
              setStatusFilter(null);
              setHighPriorityOnly(!highPriorityOnly);
              setSlaBreachOnly(false);
            }}
            style={{ cursor: 'pointer' }}
          >
            <Statistic 
              title="High Priority" 
              value={globalStats.high_priority}
              valueStyle={{ fontSize: 20 }}
              prefix={<WarningOutlined style={{ color: 'var(--danger)' }} />}
            />
          </Card>
        </Col>
        <Col flex="1">
          <Tooltip title="Articles exceeding SLA time thresholds (NEW > 4h, In Analysis > 24h, Need to Hunt > 8h)">
            <Card 
              size="small"
              hoverable
              className={`status-tile status-sla-breach ${slaBreachOnly ? 'active' : ''}`}
              onClick={() => {
                setPage(1);
                setStatusFilter(null);
                setHighPriorityOnly(false);
                setSlaBreachOnly(!slaBreachOnly);
              }}
              style={{ 
                cursor: 'pointer',
                borderColor: globalStats.sla_breaches > 0 ? 'var(--danger)' : undefined,
                background: globalStats.sla_breaches > 0 ? 'rgba(255, 77, 79, 0.05)' : undefined
              }}
            >
              <Statistic 
                title="SLA Breaches" 
                value={globalStats.sla_breaches}
                valueStyle={{ fontSize: 20, color: globalStats.sla_breaches > 0 ? 'var(--danger)' : undefined }}
                prefix={<FieldTimeOutlined style={{ color: globalStats.sla_breaches > 0 ? 'var(--danger)' : 'var(--text-secondary)' }} />}
              />
            </Card>
          </Tooltip>
        </Col>
        <Col flex="1">
          <Card 
            size="small"
            hoverable
            className="status-tile status-sources"
            onClick={() => setSourcesModalVisible(true)}
            style={{ cursor: 'pointer' }}
          >
            <Statistic 
              title="Sources" 
              value={sources.filter(s => s.is_active).length}
              prefix={<DatabaseOutlined style={{ color: 'var(--text-secondary)' }} />}
              valueStyle={{ fontSize: 20 }}
            />
          </Card>
        </Col>
        
        {/* Archived tile - only visible if user has permission to view archived */}
        {canViewArchived && (
          <Col flex="1">
            <Card 
              size="small"
              hoverable
              className={`status-tile status-archived ${statusFilter === 'ARCHIVED' ? 'active' : ''}`}
              onClick={() => {
                setPage(1);
                setShowArchived(true);
                setStatusFilter(statusFilter === 'ARCHIVED' ? null : 'ARCHIVED');
                setHighPriorityOnly(false);
              }}
              style={{ cursor: 'pointer' }}
            >
              <Statistic 
                title="Archived" 
                value={globalStats.archived}
                valueStyle={{ fontSize: 20 }}
                prefix={<EyeInvisibleOutlined style={{ color: 'var(--text-muted)' }} />}
              />
            </Card>
          </Col>
        )}
      </Row>

      {/* Active Sources Modal */}
      <Modal
        title={<Space><DatabaseOutlined /> Active Feed Sources</Space>}
        open={sourcesModalVisible}
        onCancel={() => setSourcesModalVisible(false)}
        footer={null}
        width={600}
      >
        <List
          dataSource={sources.filter(s => s.is_active)}
          renderItem={(source) => (
            <List.Item>
              <List.Item.Meta
                avatar={<SyncOutlined style={{ fontSize: 20, color: 'var(--success, #22C55E)' }} />}
                title={source.name}
                description={
                  <Space direction="vertical" size={0}>
                    <Text type="secondary">{source.url || source.feed_url}</Text>
                    <Space>
                      <Tag color="green">Active</Tag>
                      <Tag>{source.feed_type || 'RSS'}</Tag>
                      {source.last_fetched && (
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          Last fetched: {new Date(source.last_fetched).toLocaleString()}
                        </Text>
                      )}
                    </Space>
                  </Space>
                }
              />
            </List.Item>
          )}
          locale={{ emptyText: 'No active sources' }}
        />
      </Modal>

{/* Filters */}
      <Card size="small" style={{ marginBottom: 16 }} className="filters-card">
        <Space wrap>
          <Text strong><FilterOutlined /> Additional Filters:</Text>
          <Select
            placeholder="Source"
            allowClear
            style={{ width: 200 }}
            value={sourceFilter}
            onChange={(val) => {
              setPage(1);
              setSourceFilter(val);
            }}
          >
            {sources.map(s => (
              <Option key={s.id} value={s.id}>{s.name}</Option>
            ))}
          </Select>
          <Button 
            onClick={() => {
              setPage(1);
              setStatusFilter(null);
              setSourceFilter(null);
              setHighPriorityOnly(false);
              setShowArchived(false);
              setSlaBreachOnly(false);
            }}
          >
            Clear All Filters
          </Button>
          
          {/* Show Archived Toggle - only visible if user has permission */}
          {canViewArchived && (
            <Tooltip title={showArchived ? "Archived articles are visible" : "Archived articles are hidden"}>
              <Space>
                <Switch
                  size="small"
                  checked={showArchived}
                  onChange={(checked) => {
                    setShowArchived(checked);
                    setPage(1);
                    if (!checked && statusFilter === 'ARCHIVED') {
                      setStatusFilter(null);
                    }
                  }}
                  checkedChildren={<EyeOutlined />}
                  unCheckedChildren={<EyeInvisibleOutlined />}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>Show Archived</Text>
              </Space>
            </Tooltip>
          )}
          
          {/* Show active filters summary */}
          {(statusFilter || sourceFilter || highPriorityOnly || showArchived || slaBreachOnly || processingFilter) && (
            <Space>
              <Text type="secondary">Active:</Text>
              {statusFilter && <Tag color={getStatusColor(statusFilter)} closable onClose={() => setStatusFilter(null)}>{formatStatusDisplay(statusFilter)}</Tag>}
              {highPriorityOnly && <Tag color="red" closable onClose={() => setHighPriorityOnly(false)}>High Priority</Tag>}
              {slaBreachOnly && <Tag color="red" icon={<FieldTimeOutlined />} closable onClose={() => setSlaBreachOnly(false)}>SLA Breaches</Tag>}
              {processingFilter === 'automated' && <Tag color="green" icon={<RobotOutlined />} closable onClose={() => setProcessingFilter(null)}>AI Processed</Tag>}
              {processingFilter === 'manual' && <Tag color="orange" icon={<TeamOutlined />} closable onClose={() => setProcessingFilter(null)}>Manual Review</Tag>}
              {sourceFilter && <Tag color="blue" closable onClose={() => setSourceFilter(null)}>{sources.find(s => s.id === sourceFilter)?.name || 'Source'}</Tag>}
              {showArchived && <Tag color="default" closable onClose={() => setShowArchived(false)}>Including Archived</Tag>}
              <Text type="secondary">({total} results)</Text>
            </Space>
          )}
        </Space>
      </Card>

      {error && (
        <Alert 
          message={error} 
          type="warning" 
          showIcon 
          closable 
          style={{ marginBottom: 16 }}
          action={
            <Button size="small" type="link" onClick={() => window.location.href = '/sources'}>
              Go to Sources
            </Button>
          }
        />
      )}

      <Card>
        <Spin spinning={loading}>
          {articles.length === 0 && !loading ? (
            <Empty 
              description={
                <span>
                  No articles found. 
                  <a href="/sources"> Ingest feeds from Sources page.</a>
                </span>
              }
            />
          ) : (
            <>
            {/* Bulk Actions Bar */}
            {selectedRowKeys.length > 0 && (
              <div style={{ marginBottom: 16, padding: '8px 16px', background: 'var(--info-bg, rgba(59, 130, 246, 0.1))', borderRadius: 4 }}>
                <Space>
                  <Text strong>{selectedRowKeys.length} article(s) selected</Text>
                  <Divider type="vertical" />
                  <Text>Bulk Actions:</Text>
                  <Button 
                    size="small" 
                    onClick={() => handleBulkStatusChange('IN_ANALYSIS')}
                    loading={bulkUpdating}
                  >
                    Mark In Analysis
                  </Button>
                  <Button 
                    size="small" 
                    onClick={() => handleBulkStatusChange('NEED_TO_HUNT')}
                    loading={bulkUpdating}
                  >
                    Mark Need to Hunt
                  </Button>
                  <Button 
                    size="small" 
                    onClick={() => handleBulkStatusChange('REVIEWED')}
                    loading={bulkUpdating}
                  >
                    Mark Reviewed
                  </Button>
                  <Button 
                    size="small" 
                    onClick={() => handleBulkStatusChange('ARCHIVED')}
                    loading={bulkUpdating}
                  >
                    Archive
                  </Button>
                  <Popconfirm
                    title={`Delete ${selectedRowKeys.length} articles?`}
                    description="This action cannot be undone."
                    onConfirm={handleBulkDelete}
                    okText="Delete All"
                    okButtonProps={{ danger: true }}
                  >
                    <Button size="small" danger loading={bulkUpdating}>Delete</Button>
                  </Popconfirm>
                  <Button size="small" onClick={() => setSelectedRowKeys([])}>Clear Selection</Button>
                </Space>
              </div>
            )}
            
            <Table
              columns={columns}
              dataSource={articles}
              rowKey="id"
              rowSelection={rowSelection}
              pagination={{ 
                current: page,
                pageSize: pageSize,
                total, 
                showSizeChanger: true,
                showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} articles`,
                onChange: (p, ps) => {
                  setPage(p);
                  setPageSize(ps);
                }
              }}
              onRow={(record) => ({
                onClick: () => showDetails(record),
                style: { cursor: 'pointer' },
              })}
              size="middle"
            />
            </>
          )}
        </Spin>
      </Card>

      <Drawer
        title={
          <Space>
            <FileTextOutlined />
            Article Details
            {selectedArticle?.is_high_priority && (
              <Tag color="red">High Priority</Tag>
            )}
          </Space>
        }
        placement="right"
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        width={700}
      >
        {selectedArticle && (
          <>
            {/* Assignment & Status Section */}
            <Card size="small" style={{ marginBottom: 16, background: 'var(--bg-elevated)' }}>
              <Row gutter={16}>
                <Col span={12}>
              <Space direction="vertical" style={{ width: '100%' }}>
                    <Text strong>Assignment:</Text>
                    {selectedArticle.assigned_analyst_id ? (
                      <Tag color="blue" icon={<UserOutlined />}>
                        Assigned to: {selectedArticle.assigned_analyst_id === user?.id ? 'You' : `Analyst #${selectedArticle.assigned_analyst_id}`}
                      </Tag>
                    ) : (
                      <Button 
                        type="primary"
                        icon={<UserOutlined />}
                        onClick={async () => {
                          try {
                            await articlesAPI.claimArticle(selectedArticle.id);
                            message.success('Article claimed!');
                            fetchArticles();
                            setDrawerVisible(false);
                          } catch (err) {
                            message.error(err.response?.data?.detail || 'Failed to claim article');
                          }
                        }}
                      >
                        Claim This Article
                      </Button>
                    )}
                  </Space>
                </Col>
                <Col span={12}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Text strong>Change Status:</Text>
                    <Space>
                  <Select 
                    value={statusChange} 
                    onChange={setStatusChange}
                        style={{ width: 150 }}
                    disabled={updatingStatus}
                  >
                    <Option value="NEW">New</Option>
                    <Option value="IN_ANALYSIS">In Analysis</Option>
                    <Option value="NEED_TO_HUNT">Need to Hunt</Option>
                    <Option value="HUNT_GENERATED">Hunt Generated</Option>
                    <Option value="REVIEWED">Reviewed</Option>
                    <Option value="ARCHIVED">Archived</Option>
                  </Select>
                  <Button 
                    type="primary" 
                    icon={<SaveOutlined />}
                    onClick={handleStatusUpdate}
                    loading={updatingStatus}
                    disabled={statusChange === selectedArticle.status}
                  >
                    Update Status
                  </Button>
                </Space>
                  </Space>
                </Col>
              </Row>
                {statusChange !== selectedArticle.status && (
                <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
                    Status will change from <Tag color={getStatusColor(selectedArticle.status)}>{formatStatusDisplay(selectedArticle.status)}</Tag> to <Tag color={getStatusColor(statusChange)}>{formatStatusDisplay(statusChange)}</Tag>
                  </Text>
                )}
                
                {/* Quick Actions for Hunt Analysts */}
                <Divider style={{ margin: '12px 0' }} />
                <Row gutter={8}>
                  <Col span={24}>
                    <Text strong style={{ marginBottom: 8, display: 'block' }}>Quick Actions:</Text>
                    <Space wrap>
                      <Tooltip title="Add a comment and archive this article if no action needed">
                        <Button
                          icon={<CommentOutlined />}
                          onClick={() => {
                            Modal.confirm({
                              title: 'Add Comment & Archive',
                              content: (
                                <div>
                                  <Text>Add a comment explaining why no hunt is needed:</Text>
                                  <TextArea
                                    id="quick-archive-comment"
                                    rows={3}
                                    placeholder="e.g., False positive, already addressed, not applicable..."
                                    style={{ marginTop: 8 }}
                                  />
                                </div>
                              ),
                              okText: 'Comment & Archive',
                              onOk: async () => {
                                const commentText = document.getElementById('quick-archive-comment')?.value;
                                try {
                                  if (commentText?.trim()) {
                                    await articlesAPI.addComment(selectedArticle.id, commentText.trim());
                                  }
                                  await articlesAPI.updateStatus(selectedArticle.id, 'ARCHIVED');
                                  message.success('Article archived');
                                  fetchGlobalStats();
                                  fetchArticles();
                                  setDrawerVisible(false);
                                } catch (err) {
                                  message.error('Failed to archive article');
                                }
                              }
                            });
                          }}
                        >
                          Comment & Archive
                        </Button>
                      </Tooltip>
                      <Tooltip title="Mark as reviewed - no hunt needed">
                        <Button
                          icon={<CheckCircleOutlined />}
                          onClick={async () => {
                            try {
                              await articlesAPI.updateStatus(selectedArticle.id, 'REVIEWED');
                              message.success('Marked as reviewed');
                              fetchGlobalStats();
                              fetchArticles();
                              setDrawerVisible(false);
                            } catch (err) {
                              message.error('Failed to update status');
                            }
                          }}
                        >
                          Mark Reviewed
                        </Button>
                      </Tooltip>
                      <Tooltip title="Archive without comment">
                        <Button
                          icon={<DatabaseOutlined />}
                          onClick={async () => {
                            try {
                              await articlesAPI.updateStatus(selectedArticle.id, 'ARCHIVED');
                              message.success('Article archived');
                              fetchGlobalStats();
                              fetchArticles();
                              setDrawerVisible(false);
                            } catch (err) {
                              message.error('Failed to archive');
                            }
                          }}
                        >
                          Archive
                        </Button>
                      </Tooltip>
                    </Space>
                  </Col>
                </Row>
            </Card>

            <Tabs
            items={[
              {
                key: 'content',
                label: 'Content',
                children: (
                  <div>
                    <Descriptions column={1} bordered size="small">
                      <Descriptions.Item label="Title">
                        <Text strong>{selectedArticle.title}</Text>
                      </Descriptions.Item>
                      <Descriptions.Item label="Source">
                        {selectedArticle.source_name || 'Unknown'}
                      </Descriptions.Item>
                      <Descriptions.Item label="URL">
                        {selectedArticle.url ? (
                          <a href={selectedArticle.url} target="_blank" rel="noopener noreferrer">
                            {selectedArticle.url}
                          </a>
                        ) : 'N/A'}
                      </Descriptions.Item>
<Descriptions.Item label="Published">
                        {(selectedArticle.published_at || selectedArticle.published_date) 
                          ? new Date(selectedArticle.published_at || selectedArticle.published_date).toLocaleString() 
                          : 'Unknown'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Ingested">
                        {(selectedArticle.ingested_at || selectedArticle.created_at) 
                          ? new Date(selectedArticle.ingested_at || selectedArticle.created_at).toLocaleString() 
                          : 'Unknown'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Status">
                        <Tag color={getStatusColor(selectedArticle.status)}>
                          {formatStatusDisplay(selectedArticle.status)}
                        </Tag>
                      </Descriptions.Item>
                      {selectedArticle.watchlist_match_keywords?.length > 0 && (
                        <Descriptions.Item label="Matched Keywords">
                          <Space wrap>
                            {selectedArticle.watchlist_match_keywords.map((kw, i) => (
                              <Tag key={i} color="orange">{kw}</Tag>
                            ))}
                          </Space>
                        </Descriptions.Item>
                      )}
                    </Descriptions>
                    
{/* AI Summary (if available) or Feed Description */}
                    <div style={{ marginTop: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                        <Title level={5} style={{ margin: 0 }}>
                          {selectedArticle.executive_summary ? 'Executive Summary' : 'Feed Description'}
                        </Title>
                        {selectedArticle.executive_summary && (
                          <Tag color="success" style={{ marginLeft: 8 }}>AI Generated</Tag>
                        )}
                      </div>
                      <Card 
                        size="small" 
                        style={{ 
                          marginBottom: 16,
                          background: selectedArticle.executive_summary 
                            ? 'var(--success-bg, rgba(34, 197, 94, 0.1))' 
                            : 'var(--bg-elevated)',
                          border: selectedArticle.executive_summary 
                            ? '1px solid var(--success, #22C55E)' 
                            : '1px solid var(--border-subtle)'
                        }}
                      >
                        {selectedArticle.executive_summary ? (
                          <FormattedContent content={cleanAISummary(selectedArticle.executive_summary)} />
                        ) : selectedArticle.summary ? (
                          <div>
                            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 8 }}>
                              From RSS feed (not AI-generated)
                            </Text>
                            <FormattedContent content={selectedArticle.summary} />
                          </div>
                        ) : (
                          <Text type="secondary" style={{ fontStyle: 'italic' }}>
                            No summary available. Go to the "Analysis" tab to generate AI summaries.
                          </Text>
                        )}
                      </Card>
                    </div>
                  </div>
                ),
              },
              {
                key: 'intelligence',
                label: (
                  <Space>
                    <BugOutlined />
                    Intelligence
                    {selectedArticle.extracted_intelligence?.length > 0 && (
                      <Badge count={selectedArticle.extracted_intelligence.length} size="small" />
                    )}
                  </Space>
                ),
                children: (
                  <div>
{/* Model Selection & Extraction Buttons - Clean Professional Layout */}
                    <Card size="small" style={{ marginBottom: 16, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}>
                      <Row gutter={16} align="middle">
                        <Col flex="auto">
                          <Space direction="vertical" size={8} style={{ width: '100%' }}>
                            <Space wrap>
                              <Text strong>Model:</Text>
                              <Select
                                style={{ width: 220 }}
                                value={selectedModel}
                                onChange={setSelectedModel}
                                placeholder="Select AI model"
                                size="small"
                              >
                                <Select.OptGroup label="Local Models">
                                  {availableModels.filter(m => m.type === 'local').map(m => (
                                    <Option key={m.id} value={m.id}>
                                      <ThunderboltOutlined style={{ color: 'var(--success, #22C55E)' }} /> {m.name}
                                    </Option>
                                  ))}
                                </Select.OptGroup>
                                <Select.OptGroup label="API Models">
                                  {availableModels.filter(m => m.type === 'api').map(m => (
                                    <Option key={m.id} value={m.id}>
                                      <RobotOutlined style={{ color: 'var(--primary, #3B82F6)' }} /> {m.name}
                                    </Option>
                                  ))}
                                </Select.OptGroup>
                              </Select>
                            </Space>
                          </Space>
                        </Col>
                        <Col>
                          <Space>
                            <Button
                              type="primary"
                              icon={extractingArticles[selectedArticle?.id] ? <LoadingOutlined /> : <RobotOutlined />}
                              loading={extractingArticles[selectedArticle?.id]}
                              onClick={async () => {
                                const articleId = selectedArticle.id;
                                setExtractingArticles(prev => ({ ...prev, [articleId]: true }));
                                try {
                                  const response = await articlesAPI.extractIntelligence(articleId, true, selectedModel);
                                  message.success(`Extracted ${response.data.extracted_count || response.data.total} IOCs & TTPs`);
                                  const articleRes = await articlesAPI.getArticle(articleId);
                                  setSelectedArticle(articleRes.data);
                                } catch (err) {
                                  console.error('Extraction failed', err);
                                  message.error(err.response?.data?.detail || 'Extraction failed');
                                } finally {
                                  setExtractingArticles(prev => ({ ...prev, [articleId]: false }));
                                }
                              }}
                            >
                              Extract IOCs & TTPs
                            </Button>
                            <Tooltip title="Compare extraction results from two different models (opt-in)">
                              <Button
                                icon={comparing ? <LoadingOutlined /> : <SyncOutlined />}
                                loading={comparing}
                                onClick={() => setComparisonModalVisible(true)}
                              >
                                Compare Models
                              </Button>
                            </Tooltip>
                          </Space>
                        </Col>
                      </Row>
                    </Card>
                    
                    {selectedArticle.extracted_intelligence?.length > 0 ? (
                      <Table
                        size="small"
                        dataSource={selectedArticle.extracted_intelligence}
                        rowKey="id"
                        columns={[
                          { 
                            title: 'Type', 
                            dataIndex: 'intelligence_type', 
                            key: 'type',
                            width: 70,
                            render: (type) => {
                              const colors = { IOC: 'red', TTP: 'purple', ATLAS: 'geekblue' };
                              return <Tag color={colors[type] || 'default'}>{type}</Tag>;
                            }
                          },
                          { 
                            title: 'Value', 
                            dataIndex: 'value', 
                            key: 'value',
                            width: 280,
                            render: (val) => (
                              <Tooltip title={val}>
                                <Text code copyable style={{ fontSize: 11, wordBreak: 'break-all' }}>
                                  {val && val.length > 50 ? `${val.substring(0, 50)}...` : val}
                                </Text>
                              </Tooltip>
                            )
                          },
                          {
                            title: 'Source',
                            dataIndex: 'source',
                            key: 'source',
                            width: 70,
                            render: (src) => (
                              <Tag color={src === 'genai' ? 'purple' : src === 'regex' ? 'blue' : 'default'}>
                                {src === 'genai' ? 'AI' : src === 'regex' ? 'Regex' : src || 'N/A'}
                              </Tag>
                            )
                          },
                          { 
                            title: 'MITRE ID', 
                            dataIndex: 'mitre_id', 
                            key: 'mitre_id',
                            width: 90,
                            render: (id, record) => id ? (
                              <a href={record.mitre_url} target="_blank" rel="noopener noreferrer">
                                <Tag color="purple">{id}</Tag>
                              </a>
                            ) : '-'
                          },
                          { 
                            title: 'Confidence', 
                            dataIndex: 'confidence', 
                            key: 'confidence',
                            width: 70,
                            render: (conf) => (
                              <Tag color={conf >= 70 ? 'green' : conf >= 40 ? 'orange' : 'red'}>
                                {conf}%
                              </Tag>
                            )
                          },
                          {
                            title: 'Status',
                            key: 'status',
                            width: 90,
                            render: (_, record) => {
                              if (record.is_false_positive) {
                                return <Tag color="red">False Positive</Tag>;
                              }
                              if (record.is_reviewed) {
                                return <Tag color="success" icon={<CheckCircleOutlined />}>Approved</Tag>;
                              }
                              return <Tag color="warning">Pending</Tag>;
                            }
                          },
                          {
                            title: 'Actions',
                            key: 'actions',
                            width: 140,
                            render: (_, record) => (
                              <Space size={4}>
                                {!record.is_reviewed && (
                                  <Tooltip title="Approve as valid intelligence">
                                    <Button 
                                      type="primary" 
                                      size="small" 
                                      icon={<CheckCircleOutlined />}
                                      onClick={async () => {
                                        try {
                                          await articlesAPI.reviewIntelligence(record.id, true, false);
                                          message.success('Intelligence approved');
                                          const articleRes = await articlesAPI.getArticle(selectedArticle.id);
                                          setSelectedArticle(articleRes.data);
                                        } catch (err) {
                                          message.error('Failed to approve');
                                        }
                                      }}
                                    >
                                      Approve
                                    </Button>
                                  </Tooltip>
                                )}
                                {!record.is_false_positive && !record.is_reviewed && (
                                  <Tooltip title="Mark as false positive">
                                    <Button 
                                      size="small" 
                                      danger
                                      onClick={async () => {
                                        try {
                                          await articlesAPI.reviewIntelligence(record.id, true, true);
                                          message.info('Marked as false positive');
                                          const articleRes = await articlesAPI.getArticle(selectedArticle.id);
                                          setSelectedArticle(articleRes.data);
                                        } catch (err) {
                                          message.error('Failed to mark');
                                        }
                                      }}
                                    >
                                      FP
                                    </Button>
                                  </Tooltip>
                                )}
                                <Popconfirm
                                  title="Delete this item?"
                                  onConfirm={async () => {
                                    try {
                                      await articlesAPI.deleteIntelligenceItem(record.id);
                                      message.success('Deleted');
                                      const articleRes = await articlesAPI.getArticle(selectedArticle.id);
                                      setSelectedArticle(articleRes.data);
                                    } catch (err) {
                                      message.error('Failed to delete');
                                    }
                                  }}
                                >
                                  <Button size="small" danger type="text" icon={<DeleteOutlined />} />
                                </Popconfirm>
                              </Space>
                            )
                          },
                        ]}
                        pagination={{ pageSize: 10 }}
                      />
                    ) : (
                      <Empty 
                        description="No intelligence extracted yet" 
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                      >
                        <Text type="secondary">
                          Click "Extract with GenAI" to extract IOCs and TTPs using Ollama
                        </Text>
                      </Empty>
                    )}
                  </div>
                ),
              },
              {
                key: 'analysis',
                label: (
                  <Space>
                    <RobotOutlined />
                    Analysis
                    {selectedArticle.executive_summary && <Badge status="success" />}
                  </Space>
                ),
                children: (
                  <div>
                    {/* Actions Bar: Summarization + Export */}
                    <Card size="small" style={{ marginBottom: 16, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}>
                      <Row gutter={16} align="middle">
                        <Col flex="auto">
                          <Space direction="vertical" size={8} style={{ width: '100%' }}>
                            <Row gutter={8} align="middle">
                              <Col>
                                <Text strong>GenAI Model:</Text>
                              </Col>
                              <Col flex="auto">
                                <Select
                                  style={{ width: '100%', maxWidth: 280 }}
                                  value={selectedModel}
                                  onChange={setSelectedModel}
                                  placeholder="Select AI model"
                                  size="small"
                                >
                                  <Select.OptGroup label="Local Models">
                                    {availableModels.filter(m => m.type === 'local').map(m => (
                                      <Option key={m.id} value={m.id}>
                                        <ThunderboltOutlined style={{ color: 'var(--success, #22C55E)' }} /> {m.name}
                                      </Option>
                                    ))}
                                  </Select.OptGroup>
                                  <Select.OptGroup label="API Models">
                                    {availableModels.filter(m => m.type === 'api').map(m => (
                                      <Option key={m.id} value={m.id}>
                                        <RobotOutlined style={{ color: 'var(--primary, #3B82F6)' }} /> {m.name}
                                      </Option>
                                    ))}
                                  </Select.OptGroup>
                                </Select>
                              </Col>
                            </Row>
                            <Space wrap>
                              <Button
                                type="primary"
                                icon={summarizingArticles[selectedArticle?.id] ? <LoadingOutlined /> : <RobotOutlined />}
                                loading={summarizingArticles[selectedArticle?.id]}
                                onClick={async () => {
                                  const articleId = selectedArticle.id;
                                  setSummarizingArticles(prev => ({ ...prev, [articleId]: true }));
                                  try {
                                    const response = await articlesAPI.summarizeArticle(articleId, selectedModel);
                                    message.success('Summary generated successfully!');
                                    const articleRes = await articlesAPI.getArticle(articleId);
                                    setSelectedArticle(articleRes.data);
                                  } catch (err) {
                                    console.error('Summarization failed', err);
                                    message.error(err.response?.data?.detail || 'Summarization failed');
                                  } finally {
                                    setSummarizingArticles(prev => ({ ...prev, [articleId]: false }));
                                  }
                                }}
                              >
                                Generate Summaries
                              </Button>
                              <Divider type="vertical" />
<Divider type="vertical" />
                              <Button
                                size="small"
                                type="primary"
                                icon={<FilePdfOutlined />}
                                onClick={async () => {
                                  try {
                                    message.loading('Generating PDF...');
                                    const response = await articlesAPI.exportPdf(selectedArticle.id);
                                    const blob = new Blob([response.data], { type: 'application/pdf' });
                                    const url = window.URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `${selectedArticle.title?.slice(0, 40) || 'article'}_${selectedArticle.id}.pdf`;
                                    document.body.appendChild(a);
                                    a.click();
                                    window.URL.revokeObjectURL(url);
                                    a.remove();
                                    message.success('PDF downloaded');
                                  } catch (err) {
                                    console.error('PDF export failed', err);
                                    message.error('Failed to export PDF');
                                  }
                                }}
                              >
                                Download PDF
                              </Button>
                              <Button
                                size="small"
                                icon={<GlobalOutlined />}
                                onClick={async () => {
                                  try {
                                    const response = await articlesAPI.exportHtml(selectedArticle.id);
                                    const blob = new Blob([response.data], { type: 'text/html' });
                                    const url = window.URL.createObjectURL(blob);
                                    window.open(url, '_blank');
                                    setTimeout(() => window.URL.revokeObjectURL(url), 60000);
                                    message.success('Opening in browser');
                                  } catch (err) {
                                    console.error('View in browser failed', err);
                                    message.error('Failed to open in browser');
                                  }
                                }}
                              >
                                View in Browser
                              </Button>
                              <Button
                                size="small"
                                icon={<FileExcelOutlined />}
                                onClick={async () => {
                                  try {
                                    message.loading('Generating CSV...');
                                    const response = await articlesAPI.exportCsv(selectedArticle.id);
                                    const blob = new Blob([response.data], { type: 'text/csv' });
                                    const url = window.URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `${selectedArticle.title?.slice(0, 40) || 'article'}_${selectedArticle.id}_iocs.csv`;
                                    document.body.appendChild(a);
                                    a.click();
                                    window.URL.revokeObjectURL(url);
                                    a.remove();
                                    message.success('CSV downloaded');
                                  } catch (err) {
                                    console.error('CSV export failed', err);
                                    message.error('Failed to export CSV');
                                  }
                                }}
                              >
                                Export IOCs
                              </Button>
                            </Space>
                          </Space>
                        </Col>
                      </Row>
                    </Card>
                    
                    {/* Executive Summary - Polished Card */}
                    <Card 
                      size="small" 
                      className="summary-card executive"
                      style={{ 
                        marginBottom: 16, 
                        background: selectedArticle.executive_summary 
                          ? 'var(--info-bg, rgba(59, 130, 246, 0.1))' 
                          : 'var(--bg-elevated)',
                        border: selectedArticle.executive_summary 
                          ? '1px solid var(--info, #3B82F6)' 
                          : '1px solid var(--border-default)',
                        borderRadius: 8,
                        overflow: 'hidden'
                      }}
                    >
                      <div className="summary-header" style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        marginBottom: 16, 
                        paddingBottom: 12, 
                        borderBottom: '2px solid rgba(24, 144, 255, 0.3)'
                      }}>
                        <div style={{ 
                          background: 'var(--info, #3B82F6)', 
                          borderRadius: '50%', 
                          width: 32, 
                          height: 32, 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          marginRight: 12
                        }}>
                          <FileSearchOutlined style={{ fontSize: 16, color: 'white' }} />
                        </div>
                        <div>
                          <Title level={5} style={{ margin: 0, color: 'var(--info, #3B82F6)' }}>Executive Summary</Title>
                          <Text type="secondary" style={{ fontSize: 11 }}>High-level overview for leadership</Text>
                        </div>
                        {selectedArticle.executive_summary && (
                          <Tag color="green" style={{ marginLeft: 'auto' }} icon={<CheckCircleOutlined />}>Generated</Tag>
                        )}
                      </div>
{selectedArticle.executive_summary ? (
                        <div style={{ padding: '0 4px' }}>
                          <FormattedContent content={cleanAISummary(selectedArticle.executive_summary)} />
                        </div>
                      ) : (
                        <div className="summary-empty" style={{ 
                          textAlign: 'center', 
                          padding: 32, 
                          color: '#999',
                          background: 'rgba(0,0,0,0.02)',
                          borderRadius: 6
                        }}>
                          <RobotOutlined style={{ fontSize: 32, marginBottom: 12, display: 'block', opacity: 0.4 }} />
                          <Text type="secondary">Not yet analyzed</Text>
                          <br />
                          <Text type="secondary" style={{ fontSize: 12 }}>Click "Generate Summaries" above</Text>
                        </div>
                      )}
                    </Card>
                    
                    {/* Technical Summary - Polished Card */}
                    <Card 
                      size="small" 
                      className="summary-card technical"
                      style={{ 
                        marginBottom: 16, 
                        background: selectedArticle.technical_summary 
                          ? 'var(--secondary-light, rgba(139, 92, 246, 0.1))' 
                          : 'var(--bg-elevated)',
                        border: selectedArticle.technical_summary 
                          ? '1px solid var(--secondary, #8B5CF6)' 
                          : '1px solid var(--border-default)',
                        borderRadius: 8,
                        overflow: 'hidden'
                      }}
                    >
                      <div className="summary-header" style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        marginBottom: 16, 
                        paddingBottom: 12, 
                        borderBottom: '2px solid rgba(114, 46, 209, 0.3)'
                      }}>
                        <div style={{ 
                          background: 'var(--secondary, #8B5CF6)', 
                          borderRadius: '50%', 
                          width: 32, 
                          height: 32, 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          marginRight: 12
                        }}>
                          <CodeOutlined style={{ fontSize: 16, color: 'white' }} />
                        </div>
                        <div>
<Title level={5} style={{ margin: 0, color: 'var(--secondary, #8B5CF6)' }}>Technical Report</Title>
                          <Text type="secondary" style={{ fontSize: 11 }}>Detailed IOCs, TTPs, and technical indicators</Text>
                        </div>
                        {selectedArticle.technical_summary && (
                          <Tag color="purple" style={{ marginLeft: 'auto' }} icon={<CheckCircleOutlined />}>Generated</Tag>
                        )}
                      </div>
{selectedArticle.technical_summary ? (
                        <div style={{ padding: '0 4px' }}>
                          <FormattedContent content={cleanAISummary(selectedArticle.technical_summary)} />
                        </div>
                      ) : (
                        <div className="summary-empty" style={{ 
                          textAlign: 'center', 
                          padding: 32, 
                          color: '#999',
                          background: 'rgba(0,0,0,0.02)',
                          borderRadius: 6
                        }}>
                          <RobotOutlined style={{ fontSize: 32, marginBottom: 12, display: 'block', opacity: 0.4 }} />
                          <Text type="secondary">Not yet analyzed</Text>
                          <br />
                          <Text type="secondary" style={{ fontSize: 12 }}>Click "Generate Summaries" above</Text>
                        </div>
                      )}
                    </Card>
                    
                  </div>
                ),
              },
              {
                key: 'hunts',
                label: (
                  <Space>
                    <ThunderboltOutlined />
                    Hunt
                    {selectedArticle.hunt_status?.length > 0 && (
                      <Badge count={selectedArticle.hunt_status.length} size="small" />
                    )}
                  </Space>
                ),
                children: (
                  <div>
                    {/* Launch Hunt Section */}
                    <Card 
                      size="small" 
                      title={<Space><ThunderboltOutlined /> Launch Hunt</Space>}
                      style={{ marginBottom: 16, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}
                    >
                      <Space direction="vertical" style={{ width: '100%' }} size={12}>
                        <Row gutter={16} align="middle">
                          <Col span={8}>
                            <Text strong>Platform:</Text>
                            <Select
                              value={huntPlatform}
                              onChange={setHuntPlatform}
                              style={{ width: '100%', marginTop: 4 }}
                              placeholder="Select platform"
                            >
                              <Option value="defender">Microsoft Defender</Option>
                              <Option value="xsiam">Palo Alto XSIAM</Option>
                              <Option value="splunk">Splunk</Option>
                              <Option value="wiz">Wiz Cloud</Option>
                            </Select>
                          </Col>
                          <Col span={16}>
                            <Space>
                              <Button
                                icon={<CodeOutlined />}
                                onClick={handlePreviewHuntQuery}
                                loading={generatingQuery}
                              >
                                Preview Query
                              </Button>
                              <Button
                                type="primary"
                                icon={<PlayCircleOutlined />}
                                onClick={handleLaunchHunt}
                                loading={launchingHunt}
                              >
                                Generate & Launch Hunt
                              </Button>
                            </Space>
                          </Col>
                        </Row>
                        
                        {/* Query Preview/Edit */}
                        {huntQueryPreview && (
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <Text strong>Generated Query ({huntPlatform?.toUpperCase()}):</Text>
                              <Space>
                                <Button
                                  size="small"
                                  icon={<CopyOutlined />}
                                  onClick={() => {
                                    navigator.clipboard.writeText(huntQueryPreview);
                                    message.success('Query copied');
                                  }}
                                >
                                  Copy
                                </Button>
                                <Button
                                  size="small"
                                  type="primary"
                                  icon={<PlayCircleOutlined />}
                                  onClick={handleLaunchHuntWithQuery}
                                  loading={launchingHunt}
                                >
                                  Launch This Query
                                </Button>
                              </Space>
                            </div>
                            <Input.TextArea
                              value={huntQueryPreview}
                              onChange={(e) => setHuntQueryPreview(e.target.value)}
                              rows={6}
                              style={{ 
                                fontFamily: 'Monaco, Menlo, monospace', 
                                fontSize: 11,
                                background: 'var(--bg-elevated)',
                                color: 'var(--text-secondary)'
                              }}
                            />
                          </div>
                        )}
                      </Space>
                    </Card>
                    
                    {/* Existing Hunts */}
                    <Card 
                      size="small" 
                      title={
                        <Space>
                          <span>Hunt History</span>
                          {selectedArticle.hunt_status?.length > 0 && (
                            <Badge count={selectedArticle.hunt_status?.length} size="small" />
                          )}
                        </Space>
                      }
                      extra={
                        selectedArticle.hunt_status?.length > 0 && (
                          <Select
                            placeholder="Filter by status"
                            allowClear
                            size="small"
                            style={{ width: 140 }}
                            value={huntStatusFilter}
                            onChange={setHuntStatusFilter}
                          >
                            <Option value="PENDING">Pending</Option>
                            <Option value="RUNNING">Running</Option>
                            <Option value="COMPLETED">Completed</Option>
                            <Option value="FAILED">Failed</Option>
                          </Select>
                        )
                      }
                    >
                      {selectedArticle.hunt_status?.length > 0 ? (
                        <List
                          itemLayout="horizontal"
                          dataSource={huntStatusFilter 
                            ? selectedArticle.hunt_status.filter(h => h.status === huntStatusFilter)
                            : selectedArticle.hunt_status
                          }
                          locale={{ emptyText: huntStatusFilter ? `No ${huntStatusFilter} hunts` : 'No hunts' }}
                          renderItem={(hunt) => (
                            <List.Item>
                              <List.Item.Meta
                                avatar={
                                  <Tag 
                                    color={
                                      hunt.status === 'COMPLETED' ? 'success' : 
                                      hunt.status === 'FAILED' ? 'error' : 
                                      hunt.status === 'RUNNING' ? 'processing' : 'default'
                                    }
                                  >
                                    {hunt.platform?.toUpperCase()}
                                  </Tag>
                                }
                                title={
                                  <Space>
                                    <Text strong>Status: {hunt.status}</Text>
                                    {hunt.hits_count > 0 && (
                                      <Tag color="red">{hunt.hits_count} Hits</Tag>
                                    )}
                                    {hunt.email_sent && (
                                      <Tag color="blue">Email Sent</Tag>
                                    )}
                                    {hunt.servicenow_ticket_id && (
                                      <Tag color="purple">Ticket: {hunt.servicenow_ticket_id}</Tag>
                                    )}
                                  </Space>
                                }
                                description={
                                  <Space direction="vertical" size={0}>
                                    {hunt.findings_summary && (
                                      <Text type="secondary">{hunt.findings_summary}</Text>
                                    )}
                                    <Text type="secondary" style={{ fontSize: 11 }}>
                                      Executed: {hunt.executed_at ? new Date(hunt.executed_at).toLocaleString() : 'Not yet'}
                                      {hunt.execution_time_ms && ` (${hunt.execution_time_ms}ms)`}
                                    </Text>
                                  </Space>
                                }
                              />
                            </List.Item>
                          )}
                        />
                      ) : (
                        <Empty 
                          description="No hunts run for this article yet." 
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                        />
                      )}
                    </Card>
                  </div>
                ),
              },
              {
                key: 'comments',
                label: (
                  <Space>
                    <CommentOutlined />
                    Comments
                    {comments.length > 0 && <Badge count={comments.length} size="small" />}
                  </Space>
                ),
                children: (
                  <div>
                    {/* Add Comment Form */}
                    <Card size="small" style={{ marginBottom: 16 }}>
                      <Space direction="vertical" style={{ width: '100%' }}>
                        <TextArea
                          rows={3}
                          placeholder="Add a comment or note about this article..."
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          disabled={submittingComment}
                        />
                        <Button
                          type="primary"
                          icon={<SendOutlined />}
                          onClick={handleAddComment}
                          loading={submittingComment}
                          disabled={!newComment.trim()}
                        >
                          Add Comment
                        </Button>
                      </Space>
                    </Card>
                    
                    {/* Comments List */}
                    {commentsLoading ? (
                      <Spin />
                    ) : comments.length > 0 ? (
                      <List
                        itemLayout="horizontal"
                        dataSource={comments}
                        renderItem={(comment) => (
                          <List.Item
                            actions={
                              user?.id === comment.user_id || user?.role === 'ADMIN' ? [
                                <Popconfirm
                                  title="Delete this comment?"
                                  onConfirm={() => handleDeleteComment(comment.id)}
                                  okText="Yes"
                                  cancelText="No"
                                >
                                  <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                                </Popconfirm>
                              ] : []
                            }
                          >
                            <List.Item.Meta
                              avatar={<Avatar icon={<UserOutlined />} size="small" />}
                              title={
                                <Space>
                                  <Text strong>{comment.username || 'User'}</Text>
                                  <Text type="secondary" style={{ fontSize: 11 }}>
                                    {new Date(comment.created_at).toLocaleString()}
                                  </Text>
                                  {comment.is_internal && <Tag size="small">Internal</Tag>}
                                </Space>
                              }
                              description={<Text>{comment.comment_text}</Text>}
                            />
                          </List.Item>
                        )}
                      />
                    ) : (
                      <Empty description="No comments yet. Be the first to add a note!" />
                    )}
                  </div>
                ),
              },
            ]}
          />
          </>
        )}
      </Drawer>
      
{/* Dual Model Comparison Modal - Opt-In */}
      <Modal
        title={<Space><SyncOutlined /> Compare Extraction Models</Space>}
        open={comparisonModalVisible}
        onCancel={() => setComparisonModalVisible(false)}
        width={1100}
        footer={comparisonResults ? [
          <Button key="close" onClick={() => setComparisonModalVisible(false)}>Close</Button>,
          <Button 
            key="useModel1" 
            type="primary"
            icon={<RobotOutlined />}
            onClick={async () => {
              setComparisonModalVisible(false);
              const articleId = selectedArticle.id;
              setExtractingArticles(prev => ({ ...prev, [articleId]: true }));
              try {
                await articlesAPI.extractIntelligence(articleId, true, comparisonResults.model1?.model_id);
                message.success(`Saved extraction from ${comparisonResults.model1?.model_name || 'Model 1'}`);
                const articleRes = await articlesAPI.getArticle(articleId);
                setSelectedArticle(articleRes.data);
              } catch (err) {
                message.error('Failed to save extraction');
              } finally {
                setExtractingArticles(prev => ({ ...prev, [articleId]: false }));
              }
            }}
          >
            Use {comparisonResults.model1?.model_name || 'Model 1'} Results
          </Button>,
          <Button 
            key="useModel2"
            icon={<RobotOutlined />}
            onClick={async () => {
              setComparisonModalVisible(false);
              const articleId = selectedArticle.id;
              setExtractingArticles(prev => ({ ...prev, [articleId]: true }));
              try {
                await articlesAPI.extractIntelligence(articleId, true, comparisonResults.model2?.model_id);
                message.success(`Saved extraction from ${comparisonResults.model2?.model_name || 'Model 2'}`);
                const articleRes = await articlesAPI.getArticle(articleId);
                setSelectedArticle(articleRes.data);
              } catch (err) {
                message.error('Failed to save extraction');
              } finally {
                setExtractingArticles(prev => ({ ...prev, [articleId]: false }));
              }
            }}
          >
            Use {comparisonResults.model2?.model_name || 'Model 2'} Results
          </Button>
        ] : null}
      >
        {!comparisonResults ? (
          <div>
            <Alert
              message="Dual Model Comparison"
              description="Select two models to extract IOCs and TTPs from this article. You can then compare results and choose which extraction to save."
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Row gutter={16}>
              <Col span={12}>
                <Text strong>Primary Model:</Text>
                <Select
                  style={{ width: '100%', marginTop: 8 }}
                  value={selectedModel}
                  onChange={setSelectedModel}
                  placeholder="Select first model"
                >
                  {availableModels.map(m => (
                    <Option key={m.id} value={m.id}>
                      {m.type === 'local' ? <ThunderboltOutlined style={{ color: 'var(--success, #22C55E)' }} /> : <RobotOutlined style={{ color: 'var(--primary, #3B82F6)' }} />}
                      {' '}{m.name}
                    </Option>
                  ))}
                </Select>
              </Col>
              <Col span={12}>
                <Text strong>Secondary Model:</Text>
                <Select
                  style={{ width: '100%', marginTop: 8 }}
                  placeholder="Select second model"
                  onChange={(val) => {
                    // Store in local state for comparison
                    setComparisonResults(prev => ({ ...prev, secondaryModel: val }));
                  }}
                >
                  {availableModels.filter(m => m.id !== selectedModel).map(m => (
                    <Option key={m.id} value={m.id}>
                      {m.type === 'local' ? <ThunderboltOutlined style={{ color: 'var(--success, #22C55E)' }} /> : <RobotOutlined style={{ color: 'var(--primary, #3B82F6)' }} />}
                      {' '}{m.name}
                    </Option>
                  ))}
                </Select>
              </Col>
            </Row>
            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <Button
                type="primary"
                icon={comparing ? <LoadingOutlined /> : <SyncOutlined />}
                loading={comparing}
                onClick={async () => {
                  if (!selectedModel || !comparisonResults?.secondaryModel) {
                    message.warning('Please select both models');
                    return;
                  }
                  setComparing(true);
                  try {
                    const response = await articlesAPI.compareModelExtraction(
                      selectedArticle.id,
                      selectedModel,
                      comparisonResults.secondaryModel
                    );
                    setComparisonResults(response.data);
                  } catch (err) {
                    console.error('Comparison failed', err);
                    // Fallback: run sequential extractions
                    try {
                      const [res1, res2] = await Promise.all([
                        articlesAPI.extractIntelligence(selectedArticle.id, true, selectedModel, false),
                        articlesAPI.extractIntelligence(selectedArticle.id, true, comparisonResults.secondaryModel, false)
                      ]);
                      setComparisonResults({
                        model1: { 
                          model_id: selectedModel, 
                          model_name: availableModels.find(m => m.id === selectedModel)?.name || selectedModel,
                          iocs: res1.data?.iocs || [], 
                          ttps: res1.data?.ttps || [],
                          totals: { iocs: res1.data?.iocs?.length || 0, ttps: res1.data?.ttps?.length || 0 }
                        },
                        model2: { 
                          model_id: comparisonResults.secondaryModel, 
                          model_name: availableModels.find(m => m.id === comparisonResults.secondaryModel)?.name || comparisonResults.secondaryModel,
                          iocs: res2.data?.iocs || [], 
                          ttps: res2.data?.ttps || [],
                          totals: { iocs: res2.data?.iocs?.length || 0, ttps: res2.data?.ttps?.length || 0 }
                        }
                      });
                    } catch (e) {
                      message.error('Failed to compare models');
                    }
                  } finally {
                    setComparing(false);
                  }
                }}
              >
                Run Comparison
              </Button>
            </div>
          </div>
        ) : (
          <Row gutter={24}>
            {/* Model 1 Results */}
            <Col span={12}>
              <Card 
                title={<Space><RobotOutlined style={{ color: 'var(--secondary, #8B5CF6)' }} /> {comparisonResults.model1?.model_name || 'Model 1'}</Space>}
                size="small"
                style={{ marginBottom: 16 }}
                extra={
                  <Space>
                    <Tag color="purple">IOCs: {comparisonResults.model1?.totals?.iocs || comparisonResults.model1?.iocs?.length || 0}</Tag>
                    <Tag color="orange">TTPs: {comparisonResults.model1?.totals?.ttps || comparisonResults.model1?.ttps?.length || 0}</Tag>
                  </Space>
                }
              >
                <div style={{ maxHeight: 400, overflow: 'auto' }}>
                  {(comparisonResults.model1?.iocs?.length > 0 || comparisonResults.genai?.iocs?.length > 0) && (
                    <div style={{ marginBottom: 12 }}>
                      <Text strong>IOCs ({(comparisonResults.model1?.iocs || comparisonResults.genai?.iocs || []).length})</Text>
                      <List
                        size="small"
                        dataSource={comparisonResults.model1?.iocs || comparisonResults.genai?.iocs || []}
                        renderItem={(item) => (
                          <List.Item style={{ padding: '4px 0' }}>
                            <Space>
                              <Tag color="red" style={{ fontSize: 10 }}>{item.type || 'unknown'}</Tag>
                              <Text code copyable style={{ fontSize: 11, wordBreak: 'break-all' }}>
                                {item.value}
                              </Text>
                            </Space>
                          </List.Item>
                        )}
                      />
                    </div>
                  )}
                  {(comparisonResults.model1?.ttps?.length > 0 || comparisonResults.genai?.ttps?.length > 0) && (
                    <div style={{ marginBottom: 12 }}>
                      <Text strong>TTPs ({(comparisonResults.model1?.ttps || comparisonResults.genai?.ttps || []).length})</Text>
                      <List
                        size="small"
                        dataSource={comparisonResults.model1?.ttps || comparisonResults.genai?.ttps || []}
                        renderItem={(item) => (
                          <List.Item style={{ padding: '4px 0' }}>
                            <Space>
                              <Tag color="purple">{item.mitre_id}</Tag>
                              <Text style={{ fontSize: 11 }}>{item.name}</Text>
                            </Space>
                          </List.Item>
                        )}
                      />
                    </div>
                  )}
                </div>
              </Card>
            </Col>
            
            {/* Model 2 Results */}
            <Col span={12}>
              <Card 
                title={<Space><RobotOutlined style={{ color: 'var(--primary, #3B82F6)' }} /> {comparisonResults.model2?.model_name || 'Model 2'}</Space>}
                size="small"
                style={{ marginBottom: 16 }}
                extra={
                  <Space>
                    <Tag color="purple">IOCs: {comparisonResults.model2?.totals?.iocs || comparisonResults.model2?.iocs?.length || 0}</Tag>
                    <Tag color="orange">TTPs: {comparisonResults.model2?.totals?.ttps || comparisonResults.model2?.ttps?.length || 0}</Tag>
                  </Space>
                }
              >
                <div style={{ maxHeight: 400, overflow: 'auto' }}>
                  {(comparisonResults.model2?.iocs?.length > 0 || comparisonResults.regex?.iocs?.length > 0) && (
                    <div style={{ marginBottom: 12 }}>
                      <Text strong>IOCs ({(comparisonResults.model2?.iocs || comparisonResults.regex?.iocs || []).length})</Text>
                      <List
                        size="small"
                        dataSource={comparisonResults.model2?.iocs || comparisonResults.regex?.iocs || []}
                        renderItem={(item) => (
                          <List.Item style={{ padding: '4px 0' }}>
                            <Space>
                              <Tag color="red" style={{ fontSize: 10 }}>{item.type || 'unknown'}</Tag>
                              <Text code copyable style={{ fontSize: 11, wordBreak: 'break-all' }}>
                                {item.value}
                              </Text>
                            </Space>
                          </List.Item>
                        )}
                      />
                    </div>
                  )}
                  {(comparisonResults.model2?.ttps?.length > 0 || comparisonResults.regex?.ttps?.length > 0) && (
                    <div style={{ marginBottom: 12 }}>
                      <Text strong>TTPs ({(comparisonResults.model2?.ttps || comparisonResults.regex?.ttps || []).length})</Text>
                      <List
                        size="small"
                        dataSource={comparisonResults.model2?.ttps || comparisonResults.regex?.ttps || []}
                        renderItem={(item) => (
                          <List.Item style={{ padding: '4px 0' }}>
                            <Space>
                              <Tag color="purple">{item.mitre_id}</Tag>
                              <Text style={{ fontSize: 11 }}>{item.name}</Text>
                            </Space>
                          </List.Item>
                        )}
                      />
                    </div>
                  )}
                </div>
              </Card>
            </Col>
          </Row>
        )}
      </Modal>
    </div>
  );
}

export default ArticleQueue;
