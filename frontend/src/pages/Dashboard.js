import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Row, Col, Card, Statistic, Table, Tag,
  Typography, Space, Spin, Alert, Button,
  Badge, message, Select, Tooltip
} from 'antd';
import {
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  ReloadOutlined,
  SyncOutlined,
  WarningOutlined,
  StarOutlined,
  ReadOutlined,
  RocketOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { articlesAPI, sourcesAPI, watchlistAPI } from '../api/client';
import { useTheme } from '../context/ThemeContext';
import { useTimezone } from '../context/TimezoneContext';
import { useAuthStore } from '../store';
import { useRefreshSettings } from '../components/SourceRefreshSettings';
import './Dashboard.css';

const { Title, Text } = Typography;

function Dashboard() {
  const { currentTheme, isDark } = useTheme();
  const { getRelativeTime, formatDateTime, getTimezoneAbbr } = useTimezone();
  const { user, isImpersonating, assumedRole } = useAuthStore();
  const effectiveRole = isImpersonating ? assumedRole : user?.role;
  const isAdmin = effectiveRole === 'ADMIN';

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [recentArticles, setRecentArticles] = useState([]);
  const [sourceStats, setSourceStats] = useState(null);
  const [watchlistCount, setWatchlistCount] = useState(0);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [timeRange, setTimeRange] = useState(() => {
    return localStorage.getItem('jyoti-dashboard-time-range') || '24h';
  });

  const refreshSeconds = useRefreshSettings();
  const autoRefreshEnabled = refreshSeconds > 0;
  const refreshIntervalRef = useRef(null);
  const navigate = useNavigate();

  const TIME_RANGE_OPTIONS = [
    { value: '1h', label: 'Last 1 hour' },
    { value: '6h', label: 'Last 6 hours' },
    { value: '12h', label: 'Last 12 hours' },
    { value: '24h', label: 'Last 24 hours' },
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: 'all', label: 'All time' },
  ];

  const getDateRange = useCallback((range) => {
    const now = new Date();
    const hours = { '1h': 1, '6h': 6, '12h': 12, '24h': 24 };
    const days = { '7d': 7, '30d': 30 };

    if (hours[range]) return new Date(now.getTime() - hours[range] * 60 * 60 * 1000);
    if (days[range]) return new Date(now.getTime() - days[range] * 24 * 60 * 60 * 1000);
    return null;
  }, []);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const startDate = getDateRange(timeRange);
    let allArticles = [];
    let srcStats = null;

    // Fetch articles
    try {
      const articlesRes = await articlesAPI.getTriageQueue(1, 500, null, false, null);
      allArticles = articlesRes.data?.articles || articlesRes.data?.items || articlesRes.data || [];
      if (!Array.isArray(allArticles)) allArticles = [];

      // Filter by time range
      if (startDate && allArticles.length > 0) {
        allArticles = allArticles.filter(a => {
          const d = new Date(a.created_at || a.published_at);
          return d >= startDate;
        });
      }
    } catch (err) {
      console.error('Dashboard: Failed to fetch articles:', err);
    }

    // Fetch source stats
    try {
      const srcRes = await sourcesAPI.getStats(timeRange);
      srcStats = srcRes.data;
    } catch (e) {
      // Sources stats optional
    }

    // Fetch watchlist count
    try {
      const wlRes = await watchlistAPI.list();
      const keywords = wlRes.data || [];
      setWatchlistCount(Array.isArray(keywords) ? keywords.filter(k => k.is_active).length : 0);
    } catch (e) {
      // Watchlist optional
    }

    const statusCounts = allArticles.reduce((acc, a) => {
      acc[a.status] = (acc[a.status] || 0) + 1;
      return acc;
    }, {});

    setStats({
      totalArticles: allArticles.length,
      newArticles: statusCounts['NEW'] || 0,
      readArticles: statusCounts['READ'] || 0,
      starred: statusCounts['STARRED'] || 0,
      highPriority: allArticles.filter(a => a.is_high_priority).length,
    });

    setSourceStats(srcStats);
    setRecentArticles(allArticles.slice(0, 10));
    setLastUpdated(new Date());

    if (allArticles.length === 0) {
      setError('No articles found. Make sure feed sources are configured and ingested.');
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

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }

    if (autoRefreshEnabled) {
      refreshIntervalRef.current = setInterval(fetchDashboardData, refreshSeconds * 1000);
    }

    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, [autoRefreshEnabled, refreshSeconds, fetchDashboardData]);

  const handleTimeRangeChange = (value) => {
    setTimeRange(value);
    localStorage.setItem('jyoti-dashboard-time-range', value);
  };

  const getStatusColor = (status) => {
    const colors = { 'NEW': 'blue', 'READ': 'green', 'STARRED': 'gold', 'ARCHIVED': 'default' };
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
              {text?.substring(0, 60)}{text?.length > 60 ? '...' : ''}
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
      width: 120,
      render: (_, record) => (
        <Tooltip title={record.published_at ? new Date(record.published_at).toLocaleString() : 'Unknown'}>
          <Text style={{ fontSize: 12, color: 'var(--text-secondary)', cursor: 'help' }}>
            {getRelativeTime(record.published_at) || 'Unknown'}
          </Text>
        </Tooltip>
      )
    },
    {
      title: 'STATUS',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => <Tag color={getStatusColor(status)}>{status}</Tag>
    },
    {
      title: '',
      key: 'actions',
      width: 60,
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          onClick={() => navigate(`/news?article_id=${record.id}`)}
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
            <RocketOutlined /> Jyoti Dashboard
          </Title>
          {lastUpdated && (
            <div className="dashboard-subtitle">
              Last updated: {formatDateTime(lastUpdated.toISOString())} {getTimezoneAbbr()}
              {autoRefreshEnabled && (
                <Tag color="blue" style={{ marginLeft: 8 }}>Auto-refresh: {refreshSeconds}s</Tag>
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
          <Button type="primary" icon={<ReloadOutlined />} onClick={handleRefresh} size="small">
            Refresh
          </Button>
        </Space>
      </div>

      {error && (
        <Alert message={error} type="info" showIcon closable style={{ marginBottom: 16 }} />
      )}

      {/* Stats Row */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={8} md={4}>
          <div className="stat-card" onClick={() => navigate('/news')}>
            <Statistic title="Total Articles" value={stats?.totalArticles || 0} prefix={<FileTextOutlined />} />
          </div>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <div className="stat-card stat-info" onClick={() => navigate('/news')}>
            <Statistic title="New" value={stats?.newArticles || 0} prefix={<ClockCircleOutlined />} />
          </div>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <div className="stat-card stat-success" onClick={() => navigate('/news')}>
            <Statistic title="Read" value={stats?.readArticles || 0} prefix={<CheckCircleOutlined />} />
          </div>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <div className="stat-card stat-warning" onClick={() => navigate('/news')}>
            <Statistic title="Starred" value={stats?.starred || 0} prefix={<StarOutlined />} />
          </div>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <div className="stat-card stat-danger" onClick={() => navigate('/news')}>
            <Statistic title="High Priority" value={stats?.highPriority || 0} prefix={<WarningOutlined />} />
          </div>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <div className="stat-card stat-purple" onClick={() => navigate('/watchlist')}>
            <Statistic title="Watchlist" value={watchlistCount} prefix={<EyeOutlined />} />
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
          extra={isAdmin && <Button type="link" onClick={() => navigate('/sources')} style={{ color: 'var(--primary)' }}>Manage Sources</Button>}
        >
          <Row gutter={16}>
            <Col span={4}>
              <Statistic title="Total" value={sourceStats.total_sources || 0} valueStyle={{ fontSize: 20 }} />
            </Col>
            <Col span={4}>
              <Statistic title="Active" value={sourceStats.active_sources || 0} valueStyle={{ color: 'var(--success)', fontSize: 20 }} />
            </Col>
            <Col span={4}>
              <Statistic title="Articles" value={sourceStats.total_articles || 0} valueStyle={{ fontSize: 20 }} />
            </Col>
            <Col span={4}>
              <Statistic title="New" value={sourceStats.new_articles || 0} valueStyle={{ color: 'var(--info)', fontSize: 20 }} />
            </Col>
            <Col span={4}>
              <Statistic title="Priority" value={sourceStats.high_priority_articles || 0} valueStyle={{ color: 'var(--danger)', fontSize: 20 }} />
            </Col>
          </Row>
        </Card>
      )}

      {/* Recent Articles */}
      <Card
        className="dashboard-card"
        title={
          <Space>
            <ReadOutlined style={{ color: 'var(--primary)' }} />
            Recent Articles
            <Tag color="blue">{stats?.totalArticles || 0}</Tag>
          </Space>
        }
        extra={<Button type="link" onClick={() => navigate('/news')} style={{ color: 'var(--primary)' }}>View All</Button>}
        size="small"
      >
        <Table
          dataSource={recentArticles}
          columns={columns}
          pagination={false}
          rowKey="id"
          size="small"
          locale={{ emptyText: 'No articles yet. Configure sources and run ingestion.' }}
        />
      </Card>
    </div>
  );
}

export default Dashboard;
