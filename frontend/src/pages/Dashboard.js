import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Row, Col, Card, Statistic, Table, Tag, 
  Typography, Space, Spin, Alert, Button,
  Badge, message, Select, Tooltip
} from 'antd';
import { 
  ThunderboltOutlined, 
  FileTextOutlined, 
  CheckCircleOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  GlobalOutlined,
  ReloadOutlined,
  SyncOutlined,
  WarningOutlined,
  ApiOutlined,
  BugOutlined,
  SafetyOutlined,
  RobotOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import client, { articlesAPI, huntsAPI, sourcesAPI, connectorsAPI } from '../api/client';
import { useTheme } from '../context/ThemeContext';
import { useTimezone } from '../context/TimezoneContext';
import { useAuthStore } from '../store';
import TimeDisplay, { RelativeTime } from '../components/TimeDisplay';
import { useRefreshSettings } from '../components/SourceRefreshSettings';
import './Dashboard.css';

const { Title, Text } = Typography;

function Dashboard() {
  const { currentTheme, isDark } = useTheme();
  const { getRelativeTime, formatDateTime, getTimezoneAbbr } = useTimezone();
  const { user, isImpersonating, assumedRole } = useAuthStore();
  // Respect impersonation for role-based UI
  const effectiveRole = isImpersonating ? assumedRole : user?.role;
  const isAdmin = effectiveRole === 'ADMIN';
  
  const [loading, setLoading] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [recentArticles, setRecentArticles] = useState([]);
  const [sourceStats, setSourceStats] = useState(null);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [connectors, setConnectors] = useState([]);
  const [intelStats, setIntelStats] = useState(null);
  const [timeRange, setTimeRange] = useState(() => {
    return localStorage.getItem('huntsphere-dashboard-time-range') || '24h';
  });
  
  // Simplified refresh settings from hook
  const refreshSeconds = useRefreshSettings();
  const autoRefreshEnabled = refreshSeconds > 0;
  
  // Ref for interval
  const refreshIntervalRef = useRef(null);
  
  const navigate = useNavigate();

  // Time range options
  const TIME_RANGE_OPTIONS = [
        { value: '1h', label: 'Last 1 hour' },
        { value: '6h', label: 'Last 6 hours' },
        { value: '12h', label: 'Last 12 hours' },
        { value: '24h', label: 'Last 24 hours' },
        { value: '7d', label: 'Last 7 days' },
        { value: '30d', label: 'Last 30 days' },
        { value: 'all', label: 'All time' },
      ];

  // Helper to calculate date range from time range selector
  const getDateRange = useCallback((range) => {
    const now = new Date();
    let startDate = null;
    
    switch (range) {
      case '1h':
        startDate = new Date(now.getTime() - 1 * 60 * 60 * 1000);
        break;
      case '6h':
        startDate = new Date(now.getTime() - 6 * 60 * 60 * 1000);
        break;
      case '12h':
        startDate = new Date(now.getTime() - 12 * 60 * 60 * 1000);
        break;
      case '24h':
      case '1d':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
      default:
        return null; // No date filter
    }
    
    return startDate;
  }, []);

  // Simplified settings loading - just get stored time range
  const loadSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      // Load time range from localStorage
      const savedTimeRange = localStorage.getItem('huntsphere-dashboard-time-range');
      if (savedTimeRange) {
        setTimeRange(savedTimeRange);
      }
    } catch (err) {
      console.error('Failed to load dashboard settings:', err);
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    const startDate = getDateRange(timeRange);
    let articles = [];
    let allArticles = []; // Keep all for unfiltered counts
    let srcStats = null;
    let huntStats = { total: 0, completed: 0, failed: 0, pending: 0 };
    let fetchErrors = [];
    
    // Fetch articles - main data source
    try {
      console.log('Dashboard: Fetching articles...');
      const articlesRes = await articlesAPI.getTriageQueue(1, 500, null, false, null);
      console.log('Dashboard: Articles response:', articlesRes?.status, articlesRes?.data);
      allArticles = articlesRes.data?.articles || articlesRes.data?.items || articlesRes.data || [];
      
      // Ensure it's an array
      if (!Array.isArray(allArticles)) {
        console.warn('Dashboard: Articles response is not an array:', allArticles);
        allArticles = [];
      }
      console.log('Dashboard: Loaded', allArticles.length, 'articles');
      
      articles = [...allArticles];
      
      // Filter articles by time range on the client side
      if (startDate && articles.length > 0) {
        articles = articles.filter(a => {
          const articleDate = new Date(a.created_at || a.published_at);
          return articleDate >= startDate;
        });
      }
    } catch (err) {
      console.error('Dashboard: Failed to fetch articles:', err);
      console.error('Dashboard: Error details:', err.response?.status, err.response?.data, err.message);
      fetchErrors.push('articles');
      // Continue with empty articles instead of failing
    }
    
    const totalArticles = articles.length;
    
    const statusCounts = articles.reduce((acc, a) => {
      acc[a.status] = (acc[a.status] || 0) + 1;
      return acc;
    }, {});
    
    const highPriority = articles.filter(a => a.is_high_priority).length;
    
    // Fetch source stats (optional) - with time range filter
    try {
      const srcRes = await sourcesAPI.getStats(timeRange);
      srcStats = srcRes.data;
    } catch (e) {
      console.log('Sources stats not available');
    }
    
    // Fetch hunt stats (optional)
    try {
      const huntsRes = await huntsAPI.list(1, 500);
      let hunts = huntsRes.data || [];
      
      // Filter hunts by time range
      if (startDate && hunts.length > 0) {
        hunts = hunts.filter(h => {
          const huntDate = new Date(h.created_at);
          return huntDate >= startDate;
        });
      }
      
      huntStats.total = hunts.length;
      huntStats.completed = hunts.filter(h => h.status === 'COMPLETED').length;
      huntStats.failed = hunts.filter(h => h.status === 'FAILED').length;
      huntStats.pending = hunts.filter(h => h.status === 'PENDING' || h.status === 'RUNNING').length;
    } catch (e) {
      console.log('Hunts API not available');
    }
    
    // Fetch connectors (optional)
    try {
      const connectorsRes = await connectorsAPI.list();
      setConnectors(connectorsRes.data?.filter(c => c.is_active) || []);
    } catch (e) {
      console.log('Connectors API not available');
    }
    
    // Fetch intelligence stats (optional) - with time range filter
    try {
      const intelRes = await client.get('/articles/intelligence/summary', {
        params: { time_range: timeRange }
      });
      setIntelStats(intelRes.data);
    } catch (e) {
      console.log('Intelligence API not available');
    }
    
    // Always set stats even if some data is missing
    setStats({
      totalArticles,
      newArticles: statusCounts['NEW'] || 0,
      inAnalysis: statusCounts['IN_ANALYSIS'] || 0,
      reviewed: statusCounts['REVIEWED'] || 0,
      highPriority,
      huntsTotal: huntStats.total,
      huntsCompleted: huntStats.completed,
      huntsFailed: huntStats.failed,
      huntsPending: huntStats.pending
    });
    
    setSourceStats(srcStats);
    setRecentArticles(articles.slice(0, 8));
    setLastUpdated(new Date());
    
    // Show warning if main data failed
    if (fetchErrors.includes('articles') && allArticles.length === 0) {
      setError('Could not load article data. Please check if the backend is running.');
    } else {
      setError(null);
    }
    
    setLoading(false);
  }, [timeRange, getDateRange]);

  const handleRefresh = async () => {
    setLoading(true);
    await fetchDashboardData();
    message.success('Dashboard refreshed!');
  };

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Fetch data after settings are loaded
  useEffect(() => {
    if (!settingsLoading) {
      fetchDashboardData();
    }
  }, [settingsLoading, fetchDashboardData]);

  // Handle auto-refresh with simplified interval from settings hook
  useEffect(() => {
    // Clear any existing interval
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
    
    // Set new interval if auto-refresh is enabled (refreshSeconds > 0)
    if (autoRefreshEnabled && !settingsLoading) {
      refreshIntervalRef.current = setInterval(fetchDashboardData, refreshSeconds * 1000);
    }
    
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [autoRefreshEnabled, refreshSeconds, settingsLoading, fetchDashboardData]);

  // Save user preference when time range changes
  const handleTimeRangeChange = async (value) => {
    setTimeRange(value);
    // Store in localStorage for persistence
    localStorage.setItem('huntsphere-dashboard-time-range', value);
  };

  const getStatusColor = (status) => {
    const colors = { 
      'NEW': 'blue', 
      'IN_ANALYSIS': 'orange', 
      'NEED_TO_HUNT': 'purple',
      'HUNT_GENERATED': 'cyan',
      'REVIEWED': 'green', 
      'ARCHIVED': 'default' 
    };
    return colors[status] || 'default';
  };

  const columns = [
    {
      title: 'ARTICLE',
      dataIndex: 'title',
      key: 'title',
      render: (text, record) => (
        <Space direction="vertical" size={0}>
          <Space>
            {record.is_high_priority && <Badge status="error" />}
            <Text strong style={{ color: 'var(--text-primary)', fontSize: 13 }}>
              {text?.substring(0, 50)}{text?.length > 50 ? '...' : ''}
            </Text>
          </Space>
          <Text style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {record.source_name || 'Unknown'}
          </Text>
        </Space>
      )
    },
    {
      title: 'PUBLISHED',
      key: 'published',
      width: 100,
      render: (_, record) => {
        const pubDate = record.published_at;
        return (
          <Tooltip title={pubDate ? new Date(pubDate).toLocaleString() : 'Unknown'}>
            <Text style={{ fontSize: 12, color: 'var(--text-secondary)', cursor: 'help' }}>
              {getRelativeTime(pubDate) || 'Unknown'}
            </Text>
          </Tooltip>
        );
      }
    },
    {
      title: 'INGESTED',
      key: 'ingested',
      width: 100,
      render: (_, record) => {
        const ingDate = record.ingested_at || record.created_at;
        return (
          <Tooltip title={ingDate ? new Date(ingDate).toLocaleString() : 'Unknown'}>
            <Text style={{ fontSize: 12, color: 'var(--text-muted)', cursor: 'help' }}>
              {getRelativeTime(ingDate) || 'Unknown'}
            </Text>
          </Tooltip>
        );
      }
    },
    {
      title: 'STATUS',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status) => <Tag color={getStatusColor(status)}>{status}</Tag>
    },
    {
      title: 'ACTIONS',
      key: 'actions',
      width: 70,
      render: (_, record) => (
        <Button 
          type="link" 
          size="small" 
          onClick={() => navigate(`/articles?article_id=${record.id}`)}
          style={{ color: 'var(--primary)', fontWeight: 500, fontSize: 13 }}
        >
          View
        </Button>
      )
    }
  ];

  if (loading) {
    return (
      <div className="dashboard-loading">
        <Spin size="large" />
        <Text style={{ marginTop: 16, color: 'var(--text-secondary)' }}>Loading dashboard...</Text>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <Title level={4} className="dashboard-title">
            <ThunderboltOutlined />
            HuntSphere Command Center
          </Title>
          {lastUpdated && (
            <div className="dashboard-subtitle">
              Last updated: {formatDateTime(lastUpdated.toISOString())} {getTimezoneAbbr()}
              {autoRefreshEnabled && (
                <Tag color="blue" style={{ marginLeft: 8 }}>
                  Auto-refresh: {refreshSeconds}s
                </Tag>
              )}
            </div>
          )}
        </div>
        <Space>
          <Select
            value={timeRange}
            onChange={handleTimeRangeChange}
            size="small"
            style={{ width: 150 }}
            options={TIME_RANGE_OPTIONS}
          />
          <Tag color={autoRefreshEnabled ? 'green' : 'default'}>
            {autoRefreshEnabled ? `Auto: ${refreshSeconds}s` : 'Manual'}
          </Tag>
          <Button 
            type="primary" 
            icon={<ReloadOutlined />} 
            onClick={handleRefresh}
            size="small"
          >
            Refresh
          </Button>
        </Space>
      </div>

      {error && (
        <Alert 
          message={error} 
          type="warning" 
          showIcon 
          closable 
          style={{ marginBottom: 16 }} 
        />
      )}

      {/* Stats Row */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={8} md={4}>
          <div className="stat-card" onClick={() => navigate('/articles')}>
            <Statistic 
              title="Total Articles" 
              value={stats?.totalArticles || 0} 
              prefix={<FileTextOutlined />} 
            />
          </div>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <div className="stat-card stat-info" onClick={() => navigate('/articles?status=NEW')}>
            <Statistic 
              title="New" 
              value={stats?.newArticles || 0} 
              prefix={<ClockCircleOutlined />} 
            />
          </div>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <div className="stat-card stat-warning" onClick={() => navigate('/articles?status=IN_ANALYSIS')}>
            <Statistic 
              title="In Analysis" 
              value={stats?.inAnalysis || 0} 
            />
          </div>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <div className="stat-card stat-success" onClick={() => navigate('/articles?status=REVIEWED')}>
            <Statistic 
              title="Reviewed" 
              value={stats?.reviewed || 0} 
              prefix={<CheckCircleOutlined />} 
            />
          </div>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <div className="stat-card stat-danger" onClick={() => navigate('/articles?high_priority=true')}>
            <Statistic 
              title="High Priority" 
              value={stats?.highPriority || 0} 
              prefix={<WarningOutlined />} 
            />
          </div>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <div className="stat-card stat-purple" onClick={() => navigate('/hunts')}>
            <Statistic 
              title="Threat Hunts" 
              value={stats?.huntsTotal || 0} 
              prefix={<ThunderboltOutlined />} 
            />
          </div>
        </Col>
      </Row>

      {/* Source Stats */}
      {sourceStats && (
        <Card 
          className="dashboard-card"
          title={<Space><SyncOutlined style={{ color: 'var(--primary)' }} /> Feed Sources</Space>} 
          style={{ marginBottom: 16 }}
          size="small"
          extra={<Button type="link" onClick={() => navigate('/sources')} style={{ color: 'var(--primary)' }}>Manage Sources</Button>}
        >
          <Row gutter={16}>
            <Col span={4}>
              <div style={{ cursor: 'pointer' }} onClick={() => navigate('/sources')}>
                <Statistic title="Total" value={sourceStats.total_sources || 0} valueStyle={{ fontSize: 20 }} />
              </div>
            </Col>
            <Col span={4}>
              <div style={{ cursor: 'pointer' }} onClick={() => navigate('/sources')}>
                <Statistic title="Active" value={sourceStats.active_sources || 0} valueStyle={{ color: 'var(--success)', fontSize: 20 }} />
              </div>
            </Col>
            <Col span={4}>
              <div style={{ cursor: 'pointer' }} onClick={() => navigate('/articles')}>
                <Statistic title="Articles" value={sourceStats.total_articles || 0} valueStyle={{ fontSize: 20 }} />
              </div>
            </Col>
            <Col span={4}>
              <div style={{ cursor: 'pointer' }} onClick={() => navigate('/articles?status=NEW')}>
                <Statistic title="New" value={sourceStats.new_articles || 0} valueStyle={{ color: 'var(--info)', fontSize: 20 }} />
              </div>
            </Col>
            <Col span={4}>
              <div style={{ cursor: 'pointer' }} onClick={() => navigate('/articles?status=REVIEWED')}>
                <Statistic title="Reviewed" value={sourceStats.reviewed_articles || 0} valueStyle={{ color: 'var(--success)', fontSize: 20 }} />
              </div>
            </Col>
            <Col span={4}>
              <div style={{ cursor: 'pointer' }} onClick={() => navigate('/articles?high_priority=true')}>
                <Statistic title="Priority" value={sourceStats.high_priority_articles || 0} valueStyle={{ color: 'var(--danger)', fontSize: 20 }} />
              </div>
            </Col>
          </Row>
        </Card>
      )}

      {/* Intelligence Stats */}
      <Card 
        className="dashboard-card"
        title={<Space><SafetyOutlined style={{ color: 'var(--primary)' }} /> Extracted Intelligence</Space>} 
        style={{ marginBottom: 16 }} 
        extra={<Button type="link" onClick={() => navigate('/intelligence')} style={{ color: 'var(--primary)' }}>View All</Button>}
        size="small"
      >
        <Row gutter={16}>
          <Col span={4}>
            <div style={{ cursor: 'pointer' }} onClick={() => navigate('/intelligence')}>
              <Statistic title="Total" value={intelStats?.total_intelligence || 0} prefix={<SafetyOutlined />} valueStyle={{ fontSize: 20 }} />
            </div>
          </Col>
          <Col span={4}>
            <div style={{ cursor: 'pointer' }} onClick={() => navigate('/intelligence?type=IOC')}>
              <Statistic title="IOCs" value={intelStats?.intelligence_by_type?.IOC || 0} prefix={<BugOutlined />} valueStyle={{ color: 'var(--danger)', fontSize: 20 }} />
            </div>
          </Col>
          <Col span={5}>
            <div style={{ cursor: 'pointer' }} onClick={() => navigate('/intelligence?type=TTP')}>
              <Statistic title="TTPs" value={intelStats?.intelligence_by_type?.TTP || 0} prefix={<ThunderboltOutlined />} valueStyle={{ color: '#8B5CF6', fontSize: 20 }} />
            </div>
          </Col>
          <Col span={4}>
            <div style={{ cursor: 'pointer' }} onClick={() => navigate('/intelligence?type=ATLAS')}>
              <Statistic title="ATLAS" value={intelStats?.intelligence_by_type?.ATLAS || 0} prefix={<RobotOutlined />} valueStyle={{ color: 'var(--primary)', fontSize: 20 }} />
            </div>
          </Col>
          <Col span={4}>
            <div style={{ cursor: 'pointer' }} onClick={() => navigate('/watchlist')}>
              <Statistic title="Watchlist" value={intelStats?.active_watchlist_keywords?.length || 0} prefix={<EyeOutlined />} valueStyle={{ fontSize: 20 }} />
            </div>
          </Col>
        </Row>
      </Card>

      {/* Main Content */}
      <Row gutter={16}>
        <Col xs={24} lg={16}>
          <Card 
            className="dashboard-card"
            title={
              <Space>
                <FileTextOutlined style={{ color: 'var(--primary)' }} /> 
                Recent Articles 
                <Tag color="blue">{stats?.totalArticles || 0}</Tag>
              </Space>
            } 
            extra={<Button type="link" onClick={() => navigate('/articles')} style={{ color: 'var(--primary)' }}>View All</Button>}
            size="small"
          >
            <Table 
              dataSource={recentArticles} 
              columns={columns} 
              pagination={false} 
              rowKey="id" 
              size="small"
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card 
            className="dashboard-card"
            title={<Space><ThunderboltOutlined style={{ color: '#8B5CF6' }} /> Hunt Status</Space>} 
            style={{ marginBottom: 16 }} 
            extra={<Button type="link" onClick={() => navigate('/hunts')} style={{ color: 'var(--primary)' }}>View All</Button>}
            size="small"
          >
            <div className="hunt-status-item clickable" onClick={() => navigate('/hunts')}>
              <Text style={{ color: 'var(--text-primary)' }}>Total</Text>
              <Text strong style={{ color: 'var(--text-primary)' }}>{stats?.huntsTotal || 0}</Text>
            </div>
            <div className="hunt-status-item clickable" onClick={() => navigate('/hunts?status=COMPLETED')}>
              <Text style={{ color: 'var(--success)' }}>Completed</Text>
              <Text strong style={{ color: 'var(--success)' }}>{stats?.huntsCompleted || 0}</Text>
            </div>
            <div className="hunt-status-item clickable" onClick={() => navigate('/hunts?status=PENDING')}>
              <Text style={{ color: 'var(--warning)' }}>Pending</Text>
              <Text strong style={{ color: 'var(--warning)' }}>{stats?.huntsPending || 0}</Text>
            </div>
            <div className="hunt-status-item clickable" onClick={() => navigate('/hunts?status=FAILED')}>
              <Text style={{ color: 'var(--danger)' }}>Failed</Text>
              <Text strong style={{ color: 'var(--danger)' }}>{stats?.huntsFailed || 0}</Text>
            </div>
          </Card>

        </Col>
      </Row>

      {/* Connected Platforms */}
      {connectors.length > 0 && (
        <Card 
          className="dashboard-card"
          title={<Space><GlobalOutlined style={{ color: 'var(--primary)' }} /> Connected Platforms</Space>} 
          style={{ marginTop: 16 }}
          size="small"
        >
          <Row gutter={16}>
            {connectors.map((c) => (
              <Col xs={12} sm={6} key={c.id}>
                <div className="platform-card">
                  <ApiOutlined className="platform-icon" />
                  <div><Text strong style={{ color: 'var(--text-primary)' }}>{c.name}</Text></div>
                  <Tag color="success" style={{ marginTop: 8 }}>Connected</Tag>
                </div>
              </Col>
            ))}
          </Row>
        </Card>
      )}

    </div>
  );
}


export default Dashboard;
