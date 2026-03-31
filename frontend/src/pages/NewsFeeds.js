import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Layout, Menu, Card, List, Typography, Space, Tag, Button, Input,
  Empty, Spin, Avatar, Tooltip, Badge, Drawer, Checkbox, message,
  Dropdown, Divider, Skeleton, Modal, Form, Select, Tabs, Switch,
  Alert, Progress, Row, Col, Collapse, Popconfirm, InputNumber, Segmented
} from 'antd';
import {
  ReadOutlined, StarOutlined, StarFilled, ClockCircleOutlined,
  FilterOutlined, SearchOutlined, SettingOutlined, PlusOutlined,
  GlobalOutlined, CheckOutlined, EyeOutlined, FireOutlined,
  BookOutlined, TagOutlined, MoreOutlined, ReloadOutlined,
  RightOutlined, LeftOutlined, ExportOutlined, RobotOutlined,
  SafetyOutlined, BulbOutlined, FileTextOutlined, ThunderboltOutlined,
  DeleteOutlined, EditOutlined, LinkOutlined, DatabaseOutlined,
  WarningOutlined, SyncOutlined, EyeInvisibleOutlined, SortAscendingOutlined,
  UnorderedListOutlined, AppstoreOutlined, ReadOutlined as BookViewOutlined,
  PictureOutlined, PlayCircleOutlined, PauseCircleOutlined, FullscreenOutlined,
  CloudDownloadOutlined
} from '@ant-design/icons';
import { sourcesAPI, articlesAPI, adminAPI, userFeedsAPI } from '../api/client';
import { useAuthStore } from '../store';
import { useTheme } from '../context/ThemeContext';
import { useTimezone } from '../context/TimezoneContext';
import './NewsFeeds.css';

const { Sider, Content } = Layout;
const { Title, Text, Paragraph } = Typography;
const { Search } = Input;
const { Panel } = Collapse;

function NewsFeeds() {
  const { user } = useAuthStore();
  const { currentTheme, isDark } = useTheme();
  const { formatDateTime, getRelativeTime } = useTimezone();
  
  // State
  const [loading, setLoading] = useState(true);
  const [sources, setSources] = useState([]);
  const [articles, setArticles] = useState([]);
  const [selectedSource, setSelectedSource] = useState('all');
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUnreadOnly, setShowUnreadOnly] = useState(() => {
    // Default to unread only for each user
    const saved = localStorage.getItem(`jyoti-unread-only-${user?.id}`);
    return saved !== 'false'; // Default true
  });
  const [showHighPriorityOnly, setShowHighPriorityOnly] = useState(false);
  const [savedArticles, setSavedArticles] = useState([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addFeedOpen, setAddFeedOpen] = useState(false);
  const [userFeeds, setUserFeeds] = useState([]);
  const [userFeedsLoading, setUserFeedsLoading] = useState(false);
  const [editingFeed, setEditingFeed] = useState(null);
  const [sourcesCollapsed, setSourcesCollapsed] = useState(false);
  const [customFeedsCollapsed, setCustomFeedsCollapsed] = useState(false);
  const [viewMode, setViewMode] = useState('cards'); // 'list' | 'cards' | 'magazine' - default to cards
  const [sortBy, setSortBy] = useState('date'); // 'date' | 'priority' | 'source'
  const [timeRange, setTimeRange] = useState('1d'); // '1d' | '7d' | '30d' | '90d' | 'all' - default to last 24h
  
  const TIME_RANGE_OPTIONS = [
    { value: '1d', label: 'Last 24h' },
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: 'all', label: 'All time' },
  ];

  // Helper to calculate date range
  const getDateRange = useCallback((range) => {
    const now = new Date();
    switch (range) {
      case '1d':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case '90d':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      case 'all':
      default:
        return null;
    }
  }, []);
  
  // GenAI summary states - track per-article generation status
  const [generatingArticles, setGeneratingArticles] = useState({}); // { articleId: true/false }
  const [extractingArticles, setExtractingArticles] = useState({}); // { articleId: true/false }
  const [articleSummaries, setArticleSummaries] = useState({});
  const [articleIOCs, setArticleIOCs] = useState({});
  
  // Auto-refresh state
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(60); // seconds
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const refreshTimerRef = useRef(null);
  
  // Feed ingestion state
  const [fetchingFeeds, setFetchingFeeds] = useState(false);
  
  // Summary browser modal
  const [summaryBrowserOpen, setSummaryBrowserOpen] = useState(false);
  const [summaryBrowserContent, setSummaryBrowserContent] = useState({ type: '', content: '', title: '' });
  
  // User preferences
  const [userPreferences, setUserPreferences] = useState(() => {
    const saved = localStorage.getItem(`jyoti-feed-prefs-${user?.id}`);
    const prefs = saved ? JSON.parse(saved) : {
      showSourceIcons: true,
      compactView: false,
      autoMarkRead: true,
      defaultTab: 'executive',
      autoRefresh: true,
      refreshInterval: 60
    };
    // Migrate old 'original' setting to 'executive'
    if (prefs.defaultTab === 'original') {
      prefs.defaultTab = 'executive';
    }
    return prefs;
  });

  // Fetch sources and articles
  const fetchData = useCallback(async (showErrors = true) => {
    setLoading(true);
    try {
      // Fetch sources first, then articles
      // Use separate try/catch to allow partial success
      let sourcesData = [];
      let articlesData = [];
      
      try {
        const sourcesRes = await sourcesAPI.list();
        sourcesData = sourcesRes.data || [];
      } catch (srcErr) {
        console.error('Failed to fetch sources:', srcErr);
        // Continue with empty sources
      }
      
      try {
        console.log('NewsFeeds: Fetching articles...');
        const articlesRes = await articlesAPI.getTriageQueue(1, 200, null, false, null);
        console.log('NewsFeeds: Articles response:', articlesRes?.status, articlesRes?.data);
        // Handle various response formats
        articlesData = articlesRes.data?.articles || articlesRes.data?.items || [];
        if (!Array.isArray(articlesData)) {
          console.warn('NewsFeeds: Articles response is not an array:', articlesRes.data);
          articlesData = [];
        }
        console.log('NewsFeeds: Loaded', articlesData.length, 'articles');
      } catch (artErr) {
        console.error('NewsFeeds: Failed to fetch articles:', artErr);
        console.error('NewsFeeds: Error details:', artErr.response?.status, artErr.response?.data, artErr.message);
        // Continue with empty articles
      }
      
      setSources(sourcesData);
      setArticles(articlesData);
      
      // Load user's custom feeds from backend
      try {
        const feedsRes = await userFeedsAPI.list(true); // Include inactive
        setUserFeeds(feedsRes.data?.feeds || []);
      } catch (feedErr) {
        console.error('Failed to fetch user feeds:', feedErr);
        // Fallback to localStorage for backwards compatibility
        const savedFeeds = localStorage.getItem(`jyoti-user-feeds-${user?.id}`);
        if (savedFeeds) {
          try {
            setUserFeeds(JSON.parse(savedFeeds));
          } catch (e) {
            console.error('Failed to parse saved feeds:', e);
          }
        }
      }
      
      // Load saved articles
      const savedArts = localStorage.getItem(`jyoti-saved-articles-${user?.id}`);
      if (savedArts) {
        try {
          setSavedArticles(JSON.parse(savedArts));
        } catch (e) {
          console.error('Failed to parse saved articles:', e);
        }
      }
      
      // Only show error if both sources and articles are empty and we should show errors
      if (showErrors && sourcesData.length === 0 && articlesData.length === 0) {
        message.info('No feeds configured yet. Add sources to get started.');
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
      // Show more specific error message
      if (showErrors) {
        if (err.response?.status === 401) {
          message.error('Session expired. Please log in again.');
        } else if (err.response?.status === 403) {
          message.error('Access denied. You may not have permission to view feeds.');
        } else if (err.message === 'Network Error') {
          message.error('Cannot connect to server. Please check if the backend is running.');
        } else {
          message.error('Failed to load feeds. Please try refreshing the page.');
        }
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchData(true); // Show errors on initial load
  }, [fetchData]);

  // Fetch all feeds from sources
  const handleFetchAllFeeds = async () => {
    setFetchingFeeds(true);
    try {
      const response = await sourcesAPI.ingestAll();
      const data = response.data;
      
      message.success(`Fetched ${data.total_new_articles} new articles from ${data.results?.length || 0} sources`);
      
      // Refresh the article list
      fetchData(false); // Don't show errors on refresh after action
    } catch (err) {
      console.error('Failed to fetch feeds:', err);
      message.error(err.response?.data?.detail || 'Failed to fetch feeds');
    } finally {
      setFetchingFeeds(false);
    }
  };
  
  // Mark all articles as read (optionally for a specific source)
  const [markingAsRead, setMarkingAsRead] = useState(false);
  
  const handleMarkAllAsRead = async (sourceId = null) => {
    setMarkingAsRead(true);
    try {
      const response = await articlesAPI.markAllAsRead(sourceId);
      const data = response.data;
      
      message.success(`Marked ${data.marked_count} articles as read`);
      
      // Update local state - mark all matching articles as read
      setArticles(prev => prev.map(article => {
        if (sourceId === null || article.source_id === sourceId) {
          return { ...article, status: 'IN_ANALYSIS', is_read: true };
        }
        return article;
      }));
    } catch (err) {
      console.error('Failed to mark as read:', err);
      message.error(err.response?.data?.detail || 'Failed to mark as read');
    } finally {
      setMarkingAsRead(false);
    }
  };
  
  // Auto-refresh timer
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      refreshTimerRef.current = setInterval(() => {
        fetchData(false); // Don't show errors on auto-refresh
        setLastRefresh(new Date());
      }, refreshInterval * 1000);
    }
    
    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [autoRefresh, refreshInterval, fetchData]);
  
  // Save preferences when they change
  useEffect(() => {
    localStorage.setItem(`jyoti-unread-only-${user?.id}`, showUnreadOnly.toString());
    localStorage.setItem(`jyoti-feed-prefs-${user?.id}`, JSON.stringify(userPreferences));
  }, [showUnreadOnly, userPreferences, user?.id]);
  
  // Refetch articles when unread filter changes to ensure we have all articles when showing "All"
  useEffect(() => {
    if (!showUnreadOnly) {
      // When switching to "All", refetch to get read articles too
      fetchData();
    }
  }, [showUnreadOnly]);
  
  // Auto-generate summaries when article is selected
  // Auto-generate summaries and extract IOCs when article is selected
  useEffect(() => {
    if (selectedArticle) {
      const articleId = selectedArticle.id;
      // Check if we need to generate summary (not already done and not in progress)
      if (!selectedArticle.executive_summary && !articleSummaries[articleId] && !generatingArticles[articleId]) {
        generateSummary(selectedArticle);
      }
      // Check if we need to extract IOCs (not already done and not in progress)
      if (!selectedArticle.extracted_intelligence?.length && !articleIOCs[articleId] && !extractingArticles[articleId]) {
        extractIOCs(selectedArticle);
      }
    }
  }, [selectedArticle?.id]);

  // Filter and sort articles
  // Note: When showUnreadOnly is true, we still show the currently selected article
  // so it doesn't disappear when clicked/marked as read
  const filteredArticles = articles
    .filter(article => {
      // Time range filter
      const startDate = getDateRange(timeRange);
      if (startDate) {
        const articleDate = new Date(article.created_at || article.published_at);
        if (articleDate < startDate) return false;
      }
      
      if (selectedSource !== 'all' && selectedSource !== 'saved' && selectedSource !== 'high-priority') {
        if (article.source_id?.toString() !== selectedSource) return false;
      }
      if (selectedSource === 'saved') {
        if (!savedArticles.includes(article.id)) return false;
      }
      if (selectedSource === 'high-priority' || showHighPriorityOnly) {
        if (!article.is_high_priority) return false;
      }
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!article.title?.toLowerCase().includes(query) && 
            !article.content?.toLowerCase().includes(query)) return false;
      }
      // Keep currently selected article visible even if it's been marked as read
      // This prevents the jarring UX of the article disappearing when you click it
      // Check both status === 'NEW' and is_read === false for unread articles
      const isUnread = article.status === 'NEW' || article.is_read === false;
      if (showUnreadOnly && !isUnread && article.id !== selectedArticle?.id) return false;
      return true;
    })
    .sort((a, b) => {
      // ALWAYS sort by date (newest first) as the PRIMARY sort criteria
      // This ensures latest articles always appear at the top regardless of other filters
      const dateA = new Date(b.published_at || b.published_date || b.created_at);
      const dateB = new Date(a.published_at || a.published_date || a.created_at);
      const dateDiff = dateA - dateB;
      
      // If dates are different, sort by date (newest first)
      if (dateDiff !== 0) {
        // Apply secondary criteria only within same-day articles if sortBy is set
        const sameDay = Math.abs(dateDiff) < 24 * 60 * 60 * 1000; // Within 24 hours
        
        if (sameDay) {
          // Within same day, apply secondary sort criteria
          if (sortBy === 'priority') {
            if (a.is_high_priority && !b.is_high_priority) return -1;
            if (b.is_high_priority && !a.is_high_priority) return 1;
          }
          // Unread items appear before read items within same day
          if (a.status === 'NEW' && b.status !== 'NEW') return -1;
          if (b.status === 'NEW' && a.status !== 'NEW') return 1;
        }
        
        return dateDiff;
      }
      
      // If exact same timestamp, use secondary sort
      if (sortBy === 'priority') {
        if (a.is_high_priority && !b.is_high_priority) return -1;
        if (b.is_high_priority && !a.is_high_priority) return 1;
      }
      if (sortBy === 'source') {
        return (a.source_name || '').localeCompare(b.source_name || '');
      }
      
      // Unread before read as final tiebreaker
      if (a.status === 'NEW' && b.status !== 'NEW') return -1;
      if (b.status === 'NEW' && a.status !== 'NEW') return 1;
      
      return 0;
    });

  // Toggle save article
  const toggleSaveArticle = (articleId) => {
    setSavedArticles(prev => {
      const newSaved = prev.includes(articleId) 
        ? prev.filter(id => id !== articleId)
        : [...prev, articleId];
      localStorage.setItem(`jyoti-saved-articles-${user?.id}`, JSON.stringify(newSaved));
      return newSaved;
    });
  };

  // Mark article as read
  const markAsRead = async (article) => {
    if (article.status === 'NEW' && userPreferences.autoMarkRead) {
      try {
        await articlesAPI.updateStatus(article.id, 'IN_ANALYSIS');
        setArticles(prev => prev.map(a => 
          a.id === article.id ? { ...a, status: 'IN_ANALYSIS' } : a
        ));
      } catch (err) {
        console.error('Failed to mark as read:', err);
      }
    }
  };
  
  // Generate GenAI summaries - supports parallel generation for multiple articles
  const generateSummary = async (article, forceRegenerate = false) => {
    if (articleSummaries[article.id] && !forceRegenerate) return; // Already generated
    if (generatingArticles[article.id]) return; // Already in progress for this article
    
    setGeneratingArticles(prev => ({ ...prev, [article.id]: true }));
    try {
      const response = await articlesAPI.summarizeArticle(article.id);
      if (response.data) {
        setArticleSummaries(prev => ({
          ...prev,
          [article.id]: {
            executive: response.data.executive_summary,
            technical: response.data.technical_summary,
            model_used: response.data.model_used
          }
        }));
        // Also update the article in the list so it persists
        setArticles(prev => prev.map(a => 
          a.id === article.id ? { 
            ...a, 
            executive_summary: response.data.executive_summary,
            technical_summary: response.data.technical_summary,
            genai_model_used: response.data.model_used
          } : a
        ));
        message.success('Summary generated');
      }
    } catch (err) {
      console.error('Failed to generate summary:', err);
      message.error('Failed to generate summary. GenAI may not be configured.');
    } finally {
      setGeneratingArticles(prev => ({ ...prev, [article.id]: false }));
    }
  };
  
  // Extract IOCs with GenAI - supports parallel extraction for multiple articles
  const extractIOCs = async (article, forceReextract = false) => {
    if (articleIOCs[article.id] && !forceReextract) return; // Already extracted
    if (extractingArticles[article.id]) return; // Already in progress for this article
    
    setExtractingArticles(prev => ({ ...prev, [article.id]: true }));
    try {
      // Call extraction API with GenAI enabled and save results
      const response = await articlesAPI.extractIntelligence(article.id, true, null, true);
      
      if (response.data) {
        // The API might return in different formats, handle both:
        // Format 1: { iocs: [], ttps: [] } - direct extraction response
        // Format 2: { extracted_count: N, items: [] } - saved extraction response
        // Format 3: We need to re-fetch the article to get extracted_intelligence
        
        let iocs = [];
        let ttps = [];
        
        if (response.data.iocs || response.data.ttps) {
          // Direct format from GenAI
          iocs = response.data.iocs || [];
          ttps = response.data.ttps || [];
        } else if (response.data.items) {
          // Items array format
          iocs = response.data.items.filter(i => i.intelligence_type === 'IOC');
          ttps = response.data.items.filter(i => i.intelligence_type === 'TTP');
        } else {
          // Need to re-fetch article to get saved intelligence
          try {
            const articleRes = await articlesAPI.getArticle(article.id);
            if (articleRes.data?.extracted_intelligence) {
              iocs = articleRes.data.extracted_intelligence.filter(i => i.intelligence_type === 'IOC');
              ttps = articleRes.data.extracted_intelligence.filter(i => i.intelligence_type === 'TTP');
              
              // Also update the article in the list
              setArticles(prev => prev.map(a => 
                a.id === article.id ? { ...a, extracted_intelligence: articleRes.data.extracted_intelligence } : a
              ));
            }
          } catch (fetchErr) {
            console.error('Failed to fetch updated article:', fetchErr);
          }
        }
        
        const total = iocs.length + ttps.length;
        
        setArticleIOCs(prev => ({
          ...prev,
          [article.id]: {
            iocs: iocs.map(i => ({ 
              type: i.ioc_type || i.type || 'unknown', 
              value: i.value,
              confidence: i.confidence
            })),
            ttps: ttps.map(t => ({ 
              mitre_id: t.mitre_id || t.id, 
              name: t.name || t.value || t.mitre_id,
              confidence: t.confidence
            })),
            total
          }
        }));
        
        if (total > 0) {
          message.success(`Extracted ${iocs.length} IOCs and ${ttps.length} TTPs with GenAI`);
        } else {
          message.info('No IOCs or TTPs found in this article');
        }
      }
    } catch (err) {
      console.error('Failed to extract IOCs:', err);
      const errorMsg = err.response?.data?.detail || 'Failed to extract intelligence. Check GenAI configuration.';
      message.error(errorMsg);
    } finally {
      setExtractingArticles(prev => ({ ...prev, [article.id]: false }));
    }
  };
  
  // URL validation state
  const [validatingUrl, setValidatingUrl] = useState(false);
  const [urlValidation, setUrlValidation] = useState(null);
  
  // Validate feed URL
  const handleValidateUrl = async (url) => {
    if (!url || url.length < 10) {
      setUrlValidation(null);
      return;
    }
    
    setValidatingUrl(true);
    setUrlValidation(null);
    try {
      const response = await userFeedsAPI.validateUrl(url);
      setUrlValidation(response.data);
    } catch (err) {
      setUrlValidation({ 
        valid: false, 
        error: err.response?.data?.detail || 'Failed to validate URL' 
      });
    } finally {
      setValidatingUrl(false);
    }
  };
  
  // Add or update user feed
  const handleAddFeed = async (values) => {
    setUserFeedsLoading(true);
    try {
      if (editingFeed) {
        // Update existing feed
        await userFeedsAPI.update(editingFeed.id, {
          name: values.name,
          description: values.description,
          category: values.category || 'custom',
        });
        message.success('Feed updated successfully');
      } else {
        // Validate URL first if not already validated
        if (!urlValidation?.valid) {
          const validateRes = await userFeedsAPI.validateUrl(values.url);
          if (!validateRes.data?.valid) {
            message.error(`Invalid feed URL: ${validateRes.data?.error}. ${validateRes.data?.suggestion || ''}`);
            setUserFeedsLoading(false);
            return;
          }
        }
        
        // Create new feed - backend validates too
        await userFeedsAPI.create({
          name: values.name,
          url: values.url,
          description: values.description,
          category: values.category || 'custom',
          feed_type: urlValidation?.feed_type || 'rss',
          auto_ingest: true
        });
        message.success('Feed added successfully');
      }
      
      // Refresh feeds list
      const feedsRes = await userFeedsAPI.list(true);
      setUserFeeds(feedsRes.data?.feeds || []);
      setAddFeedOpen(false);
      setEditingFeed(null);
      setUrlValidation(null);
    } catch (err) {
      console.error('Failed to save feed:', err);
      message.error(err.response?.data?.detail || 'Failed to save feed');
    } finally {
      setUserFeedsLoading(false);
    }
  };
  
  // Delete user feed
  const handleDeleteFeed = async (feedId) => {
    try {
      await userFeedsAPI.delete(feedId);
      setUserFeeds(prev => prev.filter(f => f.id !== feedId));
      message.success('Feed removed');
    } catch (err) {
      console.error('Failed to delete feed:', err);
      message.error(err.response?.data?.detail || 'Failed to delete feed');
    }
  };
  
  // Toggle feed active status
  const handleToggleFeed = async (feedId) => {
    try {
      const response = await userFeedsAPI.toggle(feedId);
      setUserFeeds(prev => prev.map(f => 
        f.id === feedId ? { ...f, is_active: response.data.is_active } : f
      ));
      message.success(response.data.is_active ? 'Feed activated' : 'Feed paused');
    } catch (err) {
      console.error('Failed to toggle feed:', err);
      message.error('Failed to toggle feed');
    }
  };
  
  // Edit user feed
  const handleEditFeed = (feed) => {
    setEditingFeed(feed);
    setAddFeedOpen(true);
  };
  
  // Ingest user feed
  const handleIngestFeed = async (feedId) => {
    try {
      message.loading({ content: 'Fetching articles...', key: 'ingest' });
      const response = await userFeedsAPI.ingest(feedId);
      message.success({ 
        content: response.data?.message || 'Feed ingested', 
        key: 'ingest' 
      });
      // Refresh feeds to get updated article count
      const feedsRes = await userFeedsAPI.list(true);
      setUserFeeds(feedsRes.data?.feeds || []);
    } catch (err) {
      console.error('Failed to ingest feed:', err);
      message.error({ 
        content: err.response?.data?.detail || 'Failed to ingest feed', 
        key: 'ingest' 
      });
    }
  };

  // Source icon mapping
  const getSourceIcon = (source) => {
    const name = (source?.name || '').toLowerCase();
    if (name.includes('bleeping') || name.includes('security')) return <SafetyOutlined />;
    if (name.includes('hacker') || name.includes('threat')) return <ThunderboltOutlined />;
    if (name.includes('cyber')) return <DatabaseOutlined />;
    if (name.includes('record') || name.includes('news')) return <FileTextOutlined />;
    return <GlobalOutlined />;
  };

  // Calculate unread counts
  const totalUnreadCount = articles.filter(a => a.status === 'NEW' || a.is_read === false).length;
  const highPriorityUnreadCount = articles.filter(a => a.is_high_priority && (a.status === 'NEW' || a.is_read === false)).length;
  
  // Quick filter menu items (always visible at top)
  const quickFilterItems = [
    {
      key: 'all',
      icon: <GlobalOutlined style={{ color: 'var(--primary)' }} />,
      label: (
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <span>All Sources</span>
          {totalUnreadCount > 0 && (
            <Badge count={totalUnreadCount} style={{ backgroundColor: 'var(--primary)' }} />
          )}
        </Space>
      ),
    },
    {
      key: 'high-priority',
      icon: <FireOutlined style={{ color: 'var(--danger)' }} />,
      label: (
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <span>High Priority</span>
          {highPriorityUnreadCount > 0 && (
            <Badge 
              count={highPriorityUnreadCount} 
              style={{ backgroundColor: 'var(--danger)' }} 
            />
          )}
        </Space>
      ),
    },
    {
      key: 'saved',
      icon: <StarFilled style={{ color: '#FBBF24' }} />,
      label: (
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <span>Saved</span>
          {savedArticles.length > 0 && (
            <Badge count={savedArticles.length} style={{ backgroundColor: '#FBBF24' }} />
          )}
        </Space>
      ),
    },
  ];
  
  // Default sources menu items - only show unread count
  const defaultSourceItems = sources.filter(s => s.is_active).map(source => {
    const unreadCount = articles.filter(a => a.source_id === source.id && (a.status === 'NEW' || a.is_read === false)).length;
    
    return {
      key: source.id.toString(),
      icon: getSourceIcon(source),
      label: (
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Text ellipsis style={{ maxWidth: 140 }}>{source.name}</Text>
          {unreadCount > 0 && (
            <Badge 
              count={unreadCount}
              style={{ backgroundColor: 'var(--primary)' }}
              size="small"
            />
          )}
        </Space>
      ),
    };
  });
  
  // Custom user feeds menu items
  const customFeedItems = userFeeds.map(feed => ({
    key: `user-${feed.id}`,
    icon: <LinkOutlined style={{ color: feed.is_active ? 'var(--success)' : 'var(--text-muted)' }} />,
    label: (
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Text ellipsis style={{ maxWidth: 100, opacity: feed.is_active ? 1 : 0.6 }}>
          {feed.name}
        </Text>
        <Space size={2}>
          {feed.article_count > 0 && (
            <Badge count={feed.article_count} size="small" style={{ backgroundColor: 'var(--text-muted)' }} />
          )}
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                { key: 'edit', icon: <EditOutlined />, label: 'Edit', onClick: () => handleEditFeed(feed) },
                { key: 'toggle', icon: feed.is_active ? <PauseCircleOutlined /> : <PlayCircleOutlined />, label: feed.is_active ? 'Pause' : 'Activate', onClick: () => handleToggleFeed(feed.id) },
                { key: 'ingest', icon: <CloudDownloadOutlined />, label: 'Fetch Now', onClick: () => handleIngestFeed(feed.id) },
                { type: 'divider' },
                { key: 'delete', icon: <DeleteOutlined />, label: 'Delete', danger: true, onClick: () => handleDeleteFeed(feed.id) },
              ]
            }}
          >
            <span onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}>
              <MoreOutlined style={{ fontSize: 12 }} />
            </span>
          </Dropdown>
        </Space>
      </Space>
    ),
  }));

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  // Render dual date display (published + ingested)
  const renderDualDate = (article, compact = false) => {
    const publishedAt = article.published_at;
    const ingestedAt = article.ingested_at || article.created_at;
    
    // Check if dates are different (more than 1 minute apart)
    const pubDate = publishedAt ? new Date(publishedAt) : null;
    const ingDate = ingestedAt ? new Date(ingestedAt) : null;
    const showBoth = pubDate && ingDate && Math.abs(pubDate - ingDate) > 60000;
    
    if (compact) {
      return (
        <Tooltip 
          title={
            <div>
              <div><strong>Published:</strong> {pubDate ? pubDate.toLocaleString() : 'Unknown'}</div>
              <div><strong>Ingested:</strong> {ingDate ? ingDate.toLocaleString() : 'Unknown'}</div>
            </div>
          }
        >
          <Text className="article-time" style={{ cursor: 'help' }}>
            <ClockCircleOutlined style={{ marginRight: 4 }} />
            {formatDate(publishedAt || ingestedAt)}
          </Text>
        </Tooltip>
      );
    }
    
    return (
      <Space direction="vertical" size={0}>
        <Text style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          <ClockCircleOutlined style={{ marginRight: 4 }} />
          Published: {formatDate(publishedAt) || 'Unknown'}
        </Text>
        {showBoth && (
          <Text style={{ fontSize: 10, color: 'var(--text-muted)', opacity: 0.7 }}>
            <CloudDownloadOutlined style={{ marginRight: 4 }} />
            Ingested: {formatDate(ingestedAt)}
          </Text>
        )}
      </Space>
    );
  };

  // Article actions dropdown - Note: Antd menu onClick receives ({key, domEvent}) not just event
  const articleActions = (article) => ({
    items: [
      {
        key: 'save',
        icon: savedArticles.includes(article.id) ? <StarFilled /> : <StarOutlined />,
        label: savedArticles.includes(article.id) ? 'Unsave' : 'Save for later',
      },
      {
        key: 'summary',
        icon: <RobotOutlined />,
        label: 'Generate AI Summary',
        disabled: generatingArticles[article?.id],
      },
      {
        key: 'extract',
        icon: <SafetyOutlined />,
        label: 'Extract IOCs & TTPs',
        disabled: extractingArticles[article?.id],
      },
      { type: 'divider' },
      {
        key: 'open',
        icon: <ExportOutlined />,
        label: 'Open original',
      },
      {
        key: 'triage',
        icon: <TagOutlined />,
        label: 'Full triage view',
      },
    ],
    onClick: ({ key, domEvent }) => {
      domEvent?.stopPropagation?.();
      switch (key) {
        case 'save':
          toggleSaveArticle(article.id);
          break;
        case 'summary':
          generateSummary(article);
          break;
        case 'extract':
          extractIOCs(article);
          break;
        case 'open':
          if (article.url) window.open(article.url, '_blank');
          break;
        case 'triage':
          window.location.href = `/articles?article_id=${article.id}`;
          break;
        default:
          break;
      }
    },
  });

// Clean AI summary by removing common prefixes
  const cleanAISummary = (text) => {
    if (!text) return text;
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
  
  // Open summary in browser modal
  const openSummaryInBrowser = (type, content, title) => {
    setSummaryBrowserContent({ type, content, title });
    setSummaryBrowserOpen(true);
  };
  
  // Format summary as HTML for professional display
  const formatSummaryAsHTML = (text, type) => {
    if (!text) return '';
    
    // Clean the text first
    const cleaned = cleanAISummary(text);
    
    // Convert markdown-like formatting to HTML
    let html = cleaned
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^- (.*)/gm, '<li>$1</li>')
      .replace(/^• (.*)/gm, '<li>$1</li>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br/>');
    
    // Wrap in paragraphs if not already
    if (!html.startsWith('<')) {
      html = '<p>' + html + '</p>';
    }
    
    // Wrap lists
    html = html.replace(/(<li>.*<\/li>)+/g, '<ul>$&</ul>');
    
    return html;
  };

  // Render article reader with summaries - use saved data from article if available
  const renderArticleReader = () => {
    if (!selectedArticle) return null;
    
    // First check if article has saved summaries/IOCs, then fall back to local cache
    const savedSummary = selectedArticle.executive_summary || selectedArticle.technical_summary;
    const summary = savedSummary ? {
      executive: selectedArticle.executive_summary,
      technical: selectedArticle.technical_summary,
      model_used: selectedArticle.genai_model_used || 'AI'
    } : articleSummaries[selectedArticle.id];
    
    const savedIOCs = selectedArticle.extracted_intelligence?.length > 0;
    const iocs = savedIOCs ? {
      iocs: selectedArticle.extracted_intelligence?.filter(i => i.intelligence_type === 'IOC') || [],
      ttps: selectedArticle.extracted_intelligence?.filter(i => i.intelligence_type === 'TTP') || [],
      total: selectedArticle.extracted_intelligence?.length || 0
    } : articleIOCs[selectedArticle.id];
    
    // Check if this specific article is being generated
    const isGenerating = generatingArticles[selectedArticle.id];
    const isExtracting = extractingArticles[selectedArticle.id];
    
    const summaryTabs = [
      {
        key: 'executive',
        label: <span><BulbOutlined /> Executive Summary</span>,
        children: (
          <div className="summary-content">
            {summary?.executive ? (
              <Card 
                className="summary-card executive"
                bordered={false}
                style={{ 
                  background: 'linear-gradient(135deg, rgba(24, 144, 255, 0.08) 0%, rgba(24, 144, 255, 0.02) 100%)',
                  borderLeft: '4px solid var(--primary)'
                }}
              >
                <div 
                  className="formatted-summary"
                  dangerouslySetInnerHTML={{ __html: formatSummaryAsHTML(summary.executive, 'executive') }}
                  style={{ fontSize: 'var(--font-size-md)', lineHeight: 1.8, color: 'var(--text-primary)' }}
                />
                <Divider style={{ margin: '16px 0' }} />
                <Space>
                  <Button 
                    icon={<FullscreenOutlined />}
                    onClick={() => openSummaryInBrowser('Executive Summary', summary.executive, selectedArticle.title)}
                  >
                    View in Browser
                  </Button>
                  <Button 
                    size="small" 
                    icon={<RobotOutlined />}
                    onClick={() => generateSummary(selectedArticle, true)}
                    loading={isGenerating}
                  >
                    Regenerate
                  </Button>
                </Space>
              </Card>
            ) : isGenerating ? (
              <Card bordered={false} style={{ background: 'var(--bg-elevated)' }}>
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <Spin size="large" />
                  <Text style={{ display: 'block', marginTop: 16 }}>Generating executive summary...</Text>
                </div>
              </Card>
            ) : (
              <div className="generate-prompt" style={{ textAlign: 'center', padding: 40 }}>
                <RobotOutlined style={{ fontSize: 64, color: 'var(--primary)', opacity: 0.5 }} />
                <Title level={5} style={{ marginTop: 16 }}>Executive Summary</Title>
                <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                  AI-powered summary will be generated automatically
                </Text>
                <Button 
                  type="primary" 
                  size="large"
                  icon={<RobotOutlined />}
                  onClick={() => generateSummary(selectedArticle)}
                  loading={isGenerating}
                >
                  Generate Now
                </Button>
              </div>
            )}
          </div>
        ),
      },
      {
        key: 'technical',
        label: <span><ThunderboltOutlined /> Technical Report</span>,
        children: (
          <div className="summary-content">
            {summary?.technical ? (
              <Card 
                className="summary-card technical"
                bordered={false}
                style={{ 
                  background: 'linear-gradient(135deg, rgba(114, 46, 209, 0.08) 0%, rgba(114, 46, 209, 0.02) 100%)',
                  borderLeft: '4px solid #722ed1'
                }}
              >
                <div 
                  className="formatted-summary"
                  dangerouslySetInnerHTML={{ __html: formatSummaryAsHTML(summary.technical, 'technical') }}
                  style={{ fontSize: 'var(--font-size-md)', lineHeight: 1.8, color: 'var(--text-primary)' }}
                />
                <Divider style={{ margin: '16px 0' }} />
                <Space>
                  <Button 
                    icon={<FullscreenOutlined />}
                    onClick={() => openSummaryInBrowser('Technical Report', summary.technical, selectedArticle.title)}
                  >
                    View in Browser
                  </Button>
                  <Button 
                    size="small" 
                    icon={<RobotOutlined />}
                    onClick={() => generateSummary(selectedArticle, true)}
                    loading={isGenerating}
                  >
                    Regenerate
                  </Button>
                </Space>
              </Card>
            ) : isGenerating ? (
              <Card bordered={false} style={{ background: 'var(--bg-elevated)' }}>
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <Spin size="large" />
                  <Text style={{ display: 'block', marginTop: 16 }}>Generating technical report...</Text>
                </div>
              </Card>
            ) : (
              <div className="generate-prompt" style={{ textAlign: 'center', padding: 40 }}>
                <ThunderboltOutlined style={{ fontSize: 64, color: '#722ed1', opacity: 0.5 }} />
                <Title level={5} style={{ marginTop: 16 }}>Technical Report</Title>
                <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                  Detailed technical analysis will be generated automatically
                </Text>
                <Button 
                  type="primary" 
                  size="large"
                  icon={<ThunderboltOutlined />}
                  onClick={() => generateSummary(selectedArticle)}
                  loading={isGenerating}
                  style={{ background: '#722ed1', borderColor: '#722ed1' }}
                >
                  Generate Now
                </Button>
              </div>
            )}
          </div>
        ),
      },
      {
        key: 'iocs',
        label: (
          <span>
            <SafetyOutlined /> IOCs & TTPs
            {iocs?.total > 0 && <Badge count={iocs.total} style={{ marginLeft: 8 }} />}
          </span>
        ),
        children: (
          <div className="iocs-content">
            {iocs ? (
              <>
                {iocs?.iocs?.length > 0 && (
                  <Card size="small" title={`Indicators of Compromise (${iocs.iocs.length})`} style={{ marginBottom: 16 }}>
                    <div className="ioc-tags" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {iocs.iocs.map((ioc, idx) => (
                        <Tag key={idx} color={
                          ioc.type === 'ip' ? 'red' :
                          ioc.type === 'domain' ? 'orange' :
                          ioc.type === 'hash' ? 'purple' :
                          ioc.type === 'cve' ? 'magenta' :
                          'blue'
                        } style={{ margin: 0 }}>
                          <Tooltip title={ioc.type?.toUpperCase()}>
                            {ioc.value?.length > 50 ? `${ioc.value.substring(0, 50)}...` : ioc.value}
                          </Tooltip>
                        </Tag>
                      ))}
                    </div>
                  </Card>
                )}
                
                {iocs?.ttps?.length > 0 && (
                  <Card size="small" title={`MITRE ATT&CK TTPs (${iocs.ttps.length})`} style={{ marginBottom: 16 }}>
                    <div className="ttp-tags" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {iocs.ttps.map((ttp, idx) => (
                        <Tag key={idx} color="geekblue" style={{ margin: 0 }}>
                          <Tooltip title={ttp.name}>
                            {ttp.mitre_id}: {ttp.name?.length > 30 ? `${ttp.name.substring(0, 30)}...` : ttp.name}
                          </Tooltip>
                        </Tag>
                      ))}
                    </div>
                  </Card>
                )}
                
                {iocs?.iocs?.length === 0 && iocs?.ttps?.length === 0 && (
                  <Empty description="No indicators found in this article" />
                )}
                
                <Button 
                  size="small" 
                  icon={<SafetyOutlined />}
                  onClick={() => extractIOCs(selectedArticle, true)}
                  loading={isExtracting}
                  style={{ marginTop: 8 }}
                >
                  Re-extract
                </Button>
              </>
            ) : isExtracting ? (
              <Card bordered={false} style={{ background: 'var(--bg-elevated)' }}>
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <Spin size="large" />
                  <Text style={{ display: 'block', marginTop: 16 }}>Extracting IOCs and TTPs...</Text>
                </div>
              </Card>
            ) : (
              <div className="generate-prompt" style={{ textAlign: 'center', padding: 40 }}>
                <SafetyOutlined style={{ fontSize: 64, color: 'var(--danger)', opacity: 0.5 }} />
                <Title level={5} style={{ marginTop: 16 }}>IOCs & TTPs</Title>
                <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                  Indicators will be extracted automatically
                </Text>
                <Button 
                  type="primary" 
                  size="large"
                  danger
                  icon={<SafetyOutlined />}
                  onClick={() => extractIOCs(selectedArticle)}
                  loading={isExtracting}
                >
                  Extract Now
                </Button>
              </div>
            )}
          </div>
        ),
      },
    ];
    
    return (
      <div className="article-reader">
        <div className="reader-header">
          <Button 
            type="text" 
            icon={<LeftOutlined />} 
            onClick={() => setSelectedArticle(null)}
          >
            Back to list
          </Button>
          <Space>
            <Button 
              icon={savedArticles.includes(selectedArticle.id) ? <StarFilled style={{ color: '#FBBF24' }} /> : <StarOutlined />}
              onClick={() => toggleSaveArticle(selectedArticle.id)}
            >
              {savedArticles.includes(selectedArticle.id) ? 'Saved' : 'Save'}
            </Button>
            {selectedArticle.url && (
              <Button 
                icon={<ExportOutlined />} 
                onClick={() => window.open(selectedArticle.url, '_blank')}
              >
                Original
              </Button>
            )}
            <Button 
              type="primary"
              icon={<TagOutlined />}
              onClick={() => window.location.href = `/articles?article_id=${selectedArticle.id}`}
            >
              Triage
            </Button>
          </Space>
        </div>
        
        <div className="reader-content">
          <div className="reader-meta">
            <Tag color="blue">{selectedArticle.source_name || 'Unknown'}</Tag>
            <Tooltip 
              title={
                <div>
                  <div><strong>Published:</strong> {selectedArticle.published_at ? new Date(selectedArticle.published_at).toLocaleString() : 'Unknown'}</div>
                  <div><strong>Ingested:</strong> {new Date(selectedArticle.ingested_at || selectedArticle.created_at).toLocaleString()}</div>
                </div>
              }
            >
              <Space size={4} style={{ cursor: 'help' }}>
                <Text type="secondary">
                  <ClockCircleOutlined style={{ marginRight: 4 }} />
                  Published: {formatDate(selectedArticle.published_at || selectedArticle.published_date)}
                </Text>
                {selectedArticle.ingested_at && (
                  <Text type="secondary" style={{ opacity: 0.7, fontSize: 11 }}>
                    | Ingested: {formatDate(selectedArticle.ingested_at || selectedArticle.created_at)}
                  </Text>
                )}
              </Space>
            </Tooltip>
            {selectedArticle.is_high_priority && (
              <Tag color="red" icon={<FireOutlined />}>HIGH PRIORITY</Tag>
            )}
            {summary?.model_used && (
              <Tag color="purple" icon={<RobotOutlined />}>
                AI: {summary.model_used}
              </Tag>
            )}
          </div>
          
{/* Article image if available */}
          {selectedArticle.image_url && (
            <div className="reader-image" style={{ marginBottom: 16 }}>
              <img 
                src={selectedArticle.image_url} 
                alt={selectedArticle.title}
                style={{ 
                  maxWidth: '100%', 
                  maxHeight: 200, 
                  borderRadius: 'var(--radius-md)',
                  objectFit: 'cover'
                }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </div>
          )}
          
          <Title level={3} className={`reader-title ${selectedArticle.status !== 'NEW' ? 'read' : ''}`}>
            {selectedArticle.title}
          </Title>
          
          <Divider style={{ margin: '16px 0' }} />
          
          <Tabs 
            defaultActiveKey={userPreferences.defaultTab}
            items={summaryTabs}
            className="summary-tabs"
          />
        </div>
      </div>
    );
  };

  return (
    <Layout className="news-feeds-layout">
      {/* Sidebar */}
      <Sider 
        width={280} 
        collapsedWidth={0}
        collapsed={sidebarCollapsed}
        className="news-feeds-sidebar"
        theme={isDark ? 'dark' : 'light'}
      >
        <div className="sidebar-header">
          <Title level={5} style={{ margin: 0, color: 'var(--text-primary)' }}>
            <ReadOutlined style={{ marginRight: 8 }} />
            News & Feeds
          </Title>
          <Space size={4}>
            <Tooltip title="Add Custom Feed">
              <Button 
                type="text" 
                icon={<PlusOutlined />} 
                onClick={() => { setEditingFeed(null); setAddFeedOpen(true); }}
                size="small"
              />
            </Tooltip>
            <Button 
              type="text" 
              icon={<LeftOutlined />} 
              onClick={() => setSidebarCollapsed(true)}
              size="small"
            />
          </Space>
        </div>
        
        <div className="sidebar-search">
          <Search
            placeholder="Search articles..."
            prefix={<SearchOutlined />}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            allowClear
          />
        </div>
        
        {/* Scrollable sources container */}
        <div className="sidebar-sources-scroll">
          {/* Quick Filters - Always visible */}
          <div className="sidebar-section">
            <div className="sidebar-section-header">
              <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                Quick Filters
              </Text>
            </div>
            <Menu
              mode="inline"
              selectedKeys={[selectedSource]}
              items={quickFilterItems}
              onClick={({ key }) => setSelectedSource(key)}
              className="sources-menu compact"
            />
          </div>
          
          <Divider style={{ margin: '8px 0' }} />
          
          {/* Default Sources - Collapsible */}
          <Collapse
            ghost
            activeKey={sourcesCollapsed ? [] : ['sources']}
            onChange={(keys) => setSourcesCollapsed(!keys.includes('sources'))}
            className="sidebar-collapse"
          >
            <Panel 
              key="sources"
              header={
                <Text strong style={{ fontSize: 12 }}>
                  <DatabaseOutlined style={{ marginRight: 6 }} />
                  Default Sources ({sources.filter(s => s.is_active).length})
                </Text>
              }
            >
              <Menu
                mode="inline"
                selectedKeys={[selectedSource]}
                items={defaultSourceItems}
                onClick={({ key }) => setSelectedSource(key)}
                className="sources-menu compact nested"
              />
            </Panel>
          </Collapse>
          
          {/* Custom Feeds - Collapsible */}
          <Collapse
            ghost
            activeKey={customFeedsCollapsed ? [] : ['custom']}
            onChange={(keys) => setCustomFeedsCollapsed(!keys.includes('custom'))}
            className="sidebar-collapse"
          >
            <Panel 
              key="custom"
              header={
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Text strong style={{ fontSize: 12 }}>
                    <LinkOutlined style={{ marginRight: 6, color: 'var(--success)' }} />
                    My Custom Feeds ({userFeeds.length})
                  </Text>
                  <Tooltip title="Add Custom Feed">
                    <Button 
                      type="text" 
                      size="small" 
                      icon={<PlusOutlined style={{ fontSize: 12 }} />} 
                      onClick={(e) => { e.stopPropagation(); setEditingFeed(null); setAddFeedOpen(true); }} 
                    />
                  </Tooltip>
                </Space>
              }
            >
              {userFeeds.length === 0 ? (
                <Empty 
                  image={Empty.PRESENTED_IMAGE_SIMPLE} 
                  description="No custom feeds yet"
                  style={{ padding: '16px 0' }}
                >
                  <Button 
                    type="primary" 
                    size="small" 
                    icon={<PlusOutlined />}
                    onClick={() => { setEditingFeed(null); setAddFeedOpen(true); }}
                  >
                    Add Feed
                  </Button>
                </Empty>
              ) : (
                <Menu
                  mode="inline"
                  selectedKeys={[selectedSource]}
                  items={customFeedItems}
                  onClick={({ key }) => !key.includes('header') && setSelectedSource(key)}
                  className="sources-menu compact nested"
                />
              )}
            </Panel>
          </Collapse>
        </div>
      </Sider>

      {/* Main Content */}
      <Layout>
        {/* Collapsed sidebar toggle */}
        {sidebarCollapsed && (
          <Button
            type="primary"
            icon={<RightOutlined />}
            onClick={() => setSidebarCollapsed(false)}
            className="sidebar-toggle-btn"
          />
        )}
        
        <Content className="news-feeds-content">
{/* Header with Read/Unread Toggle */}
          <div className="feeds-header">
            <div className="feeds-header-left">
              <Title level={4} style={{ margin: 0, color: 'var(--text-primary)' }}>
                {selectedSource === 'all' ? 'All Sources' : 
                 selectedSource === 'saved' ? 'Saved Articles' :
                 selectedSource === 'high-priority' ? 'High Priority' :
                 sources.find(s => s.id.toString() === selectedSource)?.name || 'Articles'}
              </Title>
              <Text type="secondary">{filteredArticles.length} articles</Text>
            </div>
            
            {/* Quick Filters - Read/Unread at top for easy navigation */}
            <Space className="feeds-quick-filters">
              <Button.Group>
                <Tooltip title="Show unread only">
                  <Button 
                    type={showUnreadOnly ? 'primary' : 'default'}
                    icon={<EyeInvisibleOutlined />}
                    onClick={() => setShowUnreadOnly(true)}
                  >
                    Unread
                  </Button>
                </Tooltip>
                <Tooltip title="Show all articles">
                  <Button 
                    type={!showUnreadOnly ? 'primary' : 'default'}
                    icon={<EyeOutlined />}
                    onClick={() => setShowUnreadOnly(false)}
                  >
                    All
                  </Button>
                </Tooltip>
              </Button.Group>
              
              <Tooltip title={showHighPriorityOnly ? 'Showing high priority only' : 'Show high priority'}>
                <Button 
                  type={showHighPriorityOnly ? 'primary' : 'default'}
                  danger={showHighPriorityOnly}
                  icon={<FireOutlined />}
                  onClick={() => setShowHighPriorityOnly(!showHighPriorityOnly)}
                >
                  Priority
                </Button>
              </Tooltip>
              
              <Divider type="vertical" />
              
              {/* View Mode Toggle */}
              <Button.Group className="view-mode-toggle">
                <Tooltip title="List View">
                  <Button 
                    type={viewMode === 'list' ? 'primary' : 'default'}
                    icon={<UnorderedListOutlined />}
                    onClick={() => setViewMode('list')}
                  />
                </Tooltip>
                <Tooltip title="Card View">
                  <Button 
                    type={viewMode === 'cards' ? 'primary' : 'default'}
                    icon={<AppstoreOutlined />}
                    onClick={() => setViewMode('cards')}
                  />
                </Tooltip>
                <Tooltip title="Magazine View">
                  <Button 
                    type={viewMode === 'magazine' ? 'primary' : 'default'}
                    icon={<PictureOutlined />}
                    onClick={() => setViewMode('magazine')}
                  />
                </Tooltip>
              </Button.Group>
            </Space>
            
            <Space>
              {/* Time Range & Sort - Simplified */}
              <Select
                value={timeRange}
                onChange={setTimeRange}
                style={{ width: 110 }}
                size="small"
                options={TIME_RANGE_OPTIONS}
              />
              <Select 
                value={sortBy} 
                onChange={setSortBy}
                style={{ width: 100 }}
                size="small"
                options={[
                  { value: 'date', label: 'By Date' },
                  { value: 'priority', label: 'Priority' },
                  { value: 'source', label: 'Source' },
                ]}
              />
              
              {/* Add Custom Feed Button */}
              <Tooltip title="Add Custom Feed">
                <Button 
                  icon={<PlusOutlined />} 
                  size="small"
                  onClick={() => { setEditingFeed(null); setAddFeedOpen(true); }}
                />
              </Tooltip>
              
              {/* Auto-refresh Toggle */}
              <Tooltip title={autoRefresh ? `Auto-refresh: ${refreshInterval}s (click to pause)` : 'Auto-refresh paused (click to enable)'}>
                <Button 
                  icon={autoRefresh ? <SyncOutlined spin /> : <PauseCircleOutlined />}
                  size="small"
                  type={autoRefresh ? 'primary' : 'default'}
                  onClick={() => setAutoRefresh(!autoRefresh)}
                />
              </Tooltip>
              
              {/* Fetch & Refresh */}
              <Tooltip title="Fetch new articles from all RSS/Atom sources">
                <Button 
                  icon={<CloudDownloadOutlined />}
                  onClick={handleFetchAllFeeds}
                  loading={fetchingFeeds}
                  size="small"
                />
              </Tooltip>
              <Button icon={<ReloadOutlined />} size="small" onClick={() => { fetchData(); setLastRefresh(new Date()); }} />
            </Space>
          </div>

          {/* Articles List + Reader Split View */}
          <div className="feeds-main">
            {/* Article List */}
            <div className={`article-list ${selectedArticle ? 'narrow' : ''}`}>
              {loading ? (
                <div style={{ padding: 20 }}>
                  {[1, 2, 3, 4, 5].map(i => (
                    <Skeleton key={i} active avatar paragraph={{ rows: 2 }} style={{ marginBottom: 16 }} />
                  ))}
                </div>
              ) : filteredArticles.length === 0 ? (
                <Empty 
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    showUnreadOnly 
                      ? "All caught up! No unread articles" 
                      : "No articles found"
                  }
                  style={{ padding: 40 }}
                >
                  {showUnreadOnly && (
                    <Button onClick={() => setShowUnreadOnly(false)}>
                      Show all articles
                    </Button>
                  )}
                </Empty>
              ) : (
                <>
                {/* List View */}
                {viewMode === 'list' && (
                  <List
                    dataSource={filteredArticles}
                    renderItem={article => (
                      <div
                        className={`article-item ${selectedArticle?.id === article.id ? 'selected' : ''} ${article.status === 'NEW' ? 'unread' : 'read'} ${article.image_url ? 'has-image' : ''}`}
                        onClick={() => {
                          setSelectedArticle(article);
                          markAsRead(article);
                        }}
                      >
                        <div className="article-item-content">
                          {/* Article Thumbnail - Show image or source icon fallback */}
                          <div 
                            className="article-thumbnail"
                            style={article.image_url ? { backgroundImage: `url(${article.image_url})` } : {}}
                          >
                            {/* Show fallback icon if no image */}
                            {!article.image_url && (
                              <div className="thumbnail-fallback-icon">
                                {getSourceIcon({ feed_type: 'rss' })}
                              </div>
                            )}
                          </div>
                          
                          <div className="article-item-text">
                            <div className="article-item-header">
                              <Space size={8}>
                                {article.is_high_priority && (
                                  <Tag color="red" icon={<FireOutlined />} className="priority-tag">URGENT</Tag>
                                )}
                                <Tag>{article.source_name || 'Unknown'}</Tag>
                                {renderDualDate(article, true)}
                              </Space>
                              <Dropdown menu={articleActions(article)} trigger={['click']} placement="bottomRight">
                                <Button type="text" size="small" icon={<MoreOutlined />} onClick={(e) => e?.stopPropagation?.()} />
                              </Dropdown>
                            </div>
                            <Title level={5} className={`article-title ${article.status !== 'NEW' ? 'read' : ''}`} ellipsis={{ rows: 2 }}>
                              {article.status === 'NEW' && <Badge status="processing" />}
                              {article.title}
                            </Title>
                            <Paragraph className="article-preview" ellipsis={{ rows: 2 }}>
                              {article.summary || article.content?.substring(0, 200)}
                            </Paragraph>
                            <div className="article-item-footer">
                              <Space size={8}>
                                <Tag color={article.status === 'NEW' ? 'blue' : article.status === 'IN_ANALYSIS' ? 'orange' : 'green'}>
                                  {article.status}
                                </Tag>
                                {(article.executive_summary || articleSummaries[article.id]) && (
                                  <Tag icon={<RobotOutlined />} color="purple">AI Summary</Tag>
                                )}
                                {(article.extracted_intelligence?.length > 0 || articleIOCs[article.id]?.total > 0) && (
                                  <Tag icon={<SafetyOutlined />} color="red">
                                    {article.extracted_intelligence?.length || articleIOCs[article.id]?.total} IOCs
                                  </Tag>
                                )}
                              </Space>
                              <Button 
                                type="text" 
                                size="small"
                                icon={savedArticles.includes(article.id) ? <StarFilled style={{ color: '#FBBF24' }} /> : <StarOutlined />}
                                onClick={(e) => {
                                  e?.stopPropagation?.();
                                  toggleSaveArticle(article.id);
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  />
                )}
                
                {/* Card View */}
                {viewMode === 'cards' && (
                  <div className="article-cards-grid">
                    {filteredArticles.map(article => (
                      <Card
                        key={article.id}
                        className={`article-card ${selectedArticle?.id === article.id ? 'selected' : ''} ${article.status === 'NEW' ? 'unread' : 'read'}`}
                        onClick={() => {
                          setSelectedArticle(article);
                          markAsRead(article);
                        }}
                        hoverable
                        size="small"
                        cover={article.image_url && (
                          <div className="card-image" style={{ backgroundImage: `url(${article.image_url})` }} />
                        )}
                        actions={[
                          <Button 
                            type="text" 
                            size="small"
                            icon={savedArticles.includes(article.id) ? <StarFilled style={{ color: '#FBBF24' }} /> : <StarOutlined />}
                            onClick={(e) => {
                              e?.stopPropagation?.();
                              toggleSaveArticle(article.id);
                            }}
                          />,
                          article.url && (
                            <Button 
                              type="text" 
                              size="small"
                              icon={<ExportOutlined />}
                              onClick={(e) => {
                                e?.stopPropagation?.();
                                window.open(article.url, '_blank');
                              }}
                            />
                          ),
                        ].filter(Boolean)}
                      >
                        <div className="card-meta">
                          <Tag size="small">{article.source_name || 'Unknown'}</Tag>
                          {article.is_high_priority && <Tag color="red" size="small">URGENT</Tag>}
                        </div>
                        <Title level={5} className={`article-title ${article.status !== 'NEW' ? 'read' : ''}`} ellipsis={{ rows: 2 }}>
                          {article.title}
                        </Title>
                        <div className="card-date">
                          {renderDualDate(article, true)}
                        </div>
                        <div className="card-tags" style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          <Tag color={article.status === 'NEW' ? 'blue' : article.status === 'IN_ANALYSIS' ? 'orange' : 'green'} size="small">
                            {article.status}
                          </Tag>
                          {(article.executive_summary || articleSummaries[article.id]) && (
                            <Tag icon={<RobotOutlined />} color="purple" size="small">AI</Tag>
                          )}
                          {(article.extracted_intelligence?.length > 0 || articleIOCs[article.id]?.total > 0) && (
                            <Tag icon={<SafetyOutlined />} color="red" size="small">
                              {article.extracted_intelligence?.length || articleIOCs[article.id]?.total} IOCs
                            </Tag>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
                
                {/* Magazine View - Visual grid with featured images */}
                {viewMode === 'magazine' && (
                  <Row gutter={[16, 16]} style={{ padding: '8px 0' }}>
                    {filteredArticles.map((article, index) => {
                      const isLarge = index === 0; // First article is featured
                      return (
                        <Col key={article.id} span={isLarge ? 24 : 12}>
                          <Card
                            hoverable
                            className={`magazine-card ${selectedArticle?.id === article.id ? 'selected' : ''} ${article.status !== 'NEW' && article.is_read !== false ? 'read' : 'unread'}`}
                            onClick={() => {
                              setSelectedArticle(article);
                              markAsRead(article);
                            }}
                            cover={article.image_url && (
                              <div 
                                style={{ 
                                  height: isLarge ? 200 : 120, 
                                  backgroundImage: `url(${article.image_url})`,
                                  backgroundSize: 'cover',
                                  backgroundPosition: 'center',
                                  position: 'relative'
                                }}
                              >
                                <div style={{ 
                                  position: 'absolute', 
                                  bottom: 0, 
                                  left: 0, 
                                  right: 0, 
                                  background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                                  padding: '24px 12px 8px'
                                }}>
                                  <Tag color="blue" style={{ marginBottom: 4 }}>{article.source_name}</Tag>
                                </div>
                              </div>
                            )}
                            bodyStyle={{ padding: isLarge ? 16 : 12 }}
                          >
                            <Space direction="vertical" size={4} style={{ width: '100%' }}>
                              <Space wrap size={4}>
                                {article.status === 'NEW' && <Badge status="processing" />}
                                {article.is_high_priority && <Tag color="red" size="small" icon={<FireOutlined />}>URGENT</Tag>}
                                {!article.image_url && <Tag size="small">{article.source_name}</Tag>}
                                <Tag color={article.status === 'NEW' ? 'blue' : article.status === 'IN_ANALYSIS' ? 'orange' : 'green'} size="small">
                                  {article.status}
                                </Tag>
                              </Space>
                              <Text strong style={{ 
                                fontSize: isLarge ? 16 : 14,
                                display: '-webkit-box',
                                WebkitLineClamp: isLarge ? 2 : 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                opacity: article.status !== 'NEW' && article.is_read !== false ? 0.7 : 1
                              }}>
                                {article.title}
                              </Text>
                              {isLarge && article.summary && (
                                <Text type="secondary" style={{ fontSize: 13 }} ellipsis={{ rows: 2 }}>
                                  {article.summary?.substring(0, 150)}...
                                </Text>
                              )}
                              <Space size={4} style={{ marginTop: 4 }} wrap>
                                {renderDualDate(article, true)}
                                {(article.executive_summary || articleSummaries[article.id]) && (
                                  <Tag icon={<RobotOutlined />} color="purple" size="small">AI</Tag>
                                )}
                                {(article.extracted_intelligence?.length > 0 || articleIOCs[article.id]?.total > 0) && (
                                  <Tag icon={<SafetyOutlined />} color="red" size="small">
                                    {article.extracted_intelligence?.length || articleIOCs[article.id]?.total} IOCs
                                  </Tag>
                                )}
                              </Space>
                            </Space>
                          </Card>
                        </Col>
                      );
                    })}
                  </Row>
                )}
                </>
              )}
            </div>

            {/* Article Reader */}
            {renderArticleReader()}
          </div>
        </Content>
      </Layout>

      {/* Source Settings Drawer */}
      <Drawer
        title="Feed Settings"
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        width={420}
      >
        <div className="feed-settings">
          <Title level={5}>Display Preferences</Title>
          
          <Space direction="vertical" style={{ width: '100%', marginBottom: 24 }}>
            <div className="pref-item">
              <Text>Auto-mark articles as read</Text>
              <Switch 
                checked={userPreferences.autoMarkRead}
                onChange={v => setUserPreferences(p => ({ ...p, autoMarkRead: v }))}
              />
            </div>
            <div className="pref-item">
              <Text>Default summary tab</Text>
              <Select 
                value={userPreferences.defaultTab}
                onChange={v => setUserPreferences(p => ({ ...p, defaultTab: v }))}
                options={[
                  { value: 'executive', label: 'Executive Summary' },
                  { value: 'technical', label: 'Technical Report' },
                  { value: 'iocs', label: 'IOCs & TTPs' },
                ]}
                style={{ width: 160 }}
              />
            </div>
          </Space>
          
          <Divider />
          
          <Title level={5}>Admin Sources</Title>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            Managed by administrators. Available to all users.
          </Text>
          <List
            dataSource={sources.filter(s => s.is_active)}
            renderItem={source => (
              <List.Item>
                <List.Item.Meta
                  avatar={<Avatar icon={getSourceIcon(source)} style={{ backgroundColor: 'var(--primary)' }} />}
                  title={source.name}
                  description={source.url}
                />
                <Tag color="green">Active</Tag>
              </List.Item>
            )}
          />
          
          <Divider />
          
          <Title level={5}>Your Custom Feeds</Title>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            Personal RSS feeds and news sources.
          </Text>
          
          {userFeeds.length === 0 ? (
            <Empty 
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="No custom feeds yet"
            />
          ) : (
            <List
              dataSource={userFeeds}
              renderItem={feed => (
                <List.Item
                  actions={[
                    <Popconfirm 
                      title="Remove this feed?" 
                      onConfirm={() => handleDeleteFeed(feed.id)}
                    >
                      <Button type="text" danger icon={<DeleteOutlined />} size="small" />
                    </Popconfirm>
                  ]}
                >
                  <List.Item.Meta
                    avatar={<Avatar icon={<LinkOutlined />} style={{ backgroundColor: 'var(--success)' }} />}
                    title={feed.name}
                    description={feed.url}
                  />
                </List.Item>
              )}
            />
          )}
          
{/* Add Feed moved to main Options dropdown for consolidated access */}
        </div>
      </Drawer>
      
      {/* Add/Edit Feed Modal */}
      <Modal
        title={
          <Space>
            {editingFeed ? <EditOutlined /> : <PlusOutlined />}
            {editingFeed ? 'Edit Custom Feed' : 'Add Custom Feed'}
          </Space>
        }
        open={addFeedOpen}
        onCancel={() => { setAddFeedOpen(false); setEditingFeed(null); }}
        footer={null}
        destroyOnClose
      >
        <Form 
          layout="vertical" 
          onFinish={handleAddFeed}
          initialValues={editingFeed ? {
            name: editingFeed.name,
            url: editingFeed.url,
            description: editingFeed.description,
            category: editingFeed.category || 'custom'
          } : { category: 'custom' }}
          key={editingFeed?.id || 'new'}
        >
          <Form.Item 
            name="name" 
            label="Feed Name" 
            rules={[{ required: true, message: 'Please enter a name' }]}
          >
            <Input placeholder="e.g., Dark Reading" />
          </Form.Item>
          
          <Form.Item 
            name="url" 
            label="Feed URL (RSS/Atom/JSON)" 
            rules={[
              { required: true, message: 'Please enter the feed URL' },
              { type: 'url', message: 'Please enter a valid URL' }
            ]}
            validateStatus={validatingUrl ? 'validating' : urlValidation ? (urlValidation.valid ? 'success' : 'error') : undefined}
            help={
              validatingUrl ? 'Validating feed URL...' :
              urlValidation?.valid ? (
                <span style={{ color: 'var(--success)' }}>
                  Valid {urlValidation.feed_type?.toUpperCase()} feed: "{urlValidation.title}" ({urlValidation.item_count} items)
                </span>
              ) :
              urlValidation?.error ? (
                <span style={{ color: 'var(--danger)' }}>
                  {urlValidation.error}. {urlValidation.suggestion || ''}
                </span>
              ) : undefined
            }
          >
            <Input 
              placeholder="https://example.com/feed.xml" 
              disabled={!!editingFeed}
              onBlur={(e) => !editingFeed && handleValidateUrl(e.target.value)}
              suffix={validatingUrl ? <Spin size="small" /> : null}
            />
          </Form.Item>
          
          <Form.Item name="description" label="Description (optional)">
            <Input.TextArea 
              placeholder="Brief description of this feed" 
              rows={2}
            />
          </Form.Item>
          
          <Form.Item name="category" label="Category">
            <Select placeholder="Select category">
              <Select.Option value="security">Security News</Select.Option>
              <Select.Option value="threat">Threat Intelligence</Select.Option>
              <Select.Option value="vendor">Vendor Blog</Select.Option>
              <Select.Option value="research">Research</Select.Option>
              <Select.Option value="custom">Custom</Select.Option>
            </Select>
          </Form.Item>
          
          <Alert 
            message="Your Personal Feeds" 
            description="Custom feeds are saved to your account and won't affect other users. You can fetch articles from your feeds manually or enable auto-ingestion."
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={userFeedsLoading}>
                {editingFeed ? 'Save Changes' : 'Add Feed'}
              </Button>
              <Button onClick={() => { setAddFeedOpen(false); setEditingFeed(null); }}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
      
      {/* Summary Browser Modal - Full screen professional view */}
      <Modal
        title={
          <Space>
            <FullscreenOutlined />
            {summaryBrowserContent.type}
          </Space>
        }
        open={summaryBrowserOpen}
        onCancel={() => setSummaryBrowserOpen(false)}
        width="80%"
        style={{ top: 20 }}
        footer={[
          <Button key="close" onClick={() => setSummaryBrowserOpen(false)}>Close</Button>,
          <Button 
            key="print" 
            type="primary" 
            icon={<ExportOutlined />}
            onClick={() => window.print()}
          >
            Print / Save as PDF
          </Button>
        ]}
      >
        <div className="summary-browser-content">
          <div className="summary-browser-header">
            <Title level={3}>{summaryBrowserContent.title}</Title>
            <Tag color={summaryBrowserContent.type === 'Executive Summary' ? 'blue' : 'purple'}>
              {summaryBrowserContent.type}
            </Tag>
          </div>
          <Divider />
          <div 
            className="summary-browser-body"
            dangerouslySetInnerHTML={{ __html: formatSummaryAsHTML(summaryBrowserContent.content, summaryBrowserContent.type) }}
            style={{ 
              fontSize: 16, 
              lineHeight: 1.9, 
              color: 'var(--text-primary)',
              maxHeight: '60vh',
              overflowY: 'auto',
              padding: '0 16px'
            }}
          />
        </div>
      </Modal>
    </Layout>
  );
}

export default NewsFeeds;
