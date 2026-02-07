import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layout, Card, Typography, Button, Space, Select, Input, Tag, Avatar,
  Drawer, Divider, Empty, Spin, Badge, Tooltip, Segmented, message, Row, Col
} from 'antd';
import {
  ReadOutlined, BookOutlined, StarOutlined, StarFilled, ShareAltOutlined,
  LinkOutlined, ClockCircleOutlined, FireOutlined, EyeOutlined,
  AppstoreOutlined, UnorderedListOutlined, FilterOutlined, SearchOutlined,
  ReloadOutlined, PlusOutlined
} from '@ant-design/icons';
import { articlesAPI, sourcesAPI } from '../api/client';
import './IntelNews.css';

const { Content, Sider } = Layout;
const { Title, Text, Paragraph } = Typography;
const { Search } = Input;

/**
 * News & Intel - Modern Feedly-like reader
 * Clean, minimalist interface for consuming threat intelligence and news
 */
const IntelNews = () => {
  const navigate = useNavigate();

  // Data state
  const [articles, setArticles] = useState([]);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  // UI state
  const [viewMode, setViewMode] = useState('cards'); // cards, list, magazine
  const [selectedSource, setSelectedSource] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [readerOpen, setReaderOpen] = useState(false);
  const [starred, setStarred] = useState(new Set());

  // Filters
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [showHighPriority, setShowHighPriority] = useState(false);
  const [dateRange, setDateRange] = useState('today'); // today, week, month, all

  // Load starred from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('huntsphere_starred_articles');
      if (saved) {
        setStarred(new Set(JSON.parse(saved)));
      }
    } catch (e) {
      console.error('Failed to load starred articles', e);
    }
  }, []);

  // Fetch sources on mount
  useEffect(() => {
    fetchSources();
  }, []);

  // Fetch articles when filters change
  useEffect(() => {
    fetchArticles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSource, showHighPriority, dateRange]);

  const fetchSources = async () => {
    try {
      const response = await sourcesAPI.list();
      setSources(response.data || []);
    } catch (err) {
      console.error('Failed to fetch sources', err);
    }
  };

  const fetchArticles = async () => {
    setLoading(true);
    try {
      const response = await articlesAPI.getTriageQueue(
        1,
        100,
        null,
        showHighPriority,
        selectedSource
      );

      let fetchedArticles = response.data?.articles || [];

      // Apply date filter
      if (dateRange !== 'all') {
        const now = new Date();
        const filterDate = new Date();
        if (dateRange === 'today') {
          filterDate.setHours(0, 0, 0, 0);
        } else if (dateRange === 'week') {
          filterDate.setDate(now.getDate() - 7);
        } else if (dateRange === 'month') {
          filterDate.setMonth(now.getMonth() - 1);
        }

        fetchedArticles = fetchedArticles.filter(a => {
          try {
            const articleDate = new Date(a.published_at || a.created_at);
            return articleDate >= filterDate;
          } catch {
            return true;
          }
        });
      }

      // Apply search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        fetchedArticles = fetchedArticles.filter(a =>
          a.title?.toLowerCase().includes(query) ||
          a.summary?.toLowerCase().includes(query) ||
          a.normalized_content?.toLowerCase().includes(query)
        );
      }

      setArticles(fetchedArticles);
      setTotal(fetchedArticles.length);
    } catch (err) {
      console.error('Failed to fetch articles', err);
      message.error('Failed to load articles');
    } finally {
      setLoading(false);
    }
  };

  const toggleStar = (articleId) => {
    setStarred(prev => {
      const newSet = new Set(prev);
      if (newSet.has(articleId)) {
        newSet.delete(articleId);
      } else {
        newSet.add(articleId);
      }
      try {
        localStorage.setItem('huntsphere_starred_articles', JSON.stringify([...newSet]));
      } catch (e) {
        console.error('Failed to save starred', e);
      }
      return newSet;
    });
  };

  const openReader = (article) => {
    setSelectedArticle(article);
    setReaderOpen(true);
  };

  const openInQueue = (articleId) => {
    navigate(`/articles?article_id=${articleId}`);
  };

  const getReadingTime = (content) => {
    if (!content) return null;
    const words = content.split(/\s+/).length;
    const minutes = Math.ceil(words / 200); // Average reading speed
    return minutes;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Render article card
  const renderArticleCard = (article) => {
    const isStarred = starred.has(article.id);
    const readingTime = getReadingTime(article.normalized_content);

    // Open original URL when card is clicked
    const handleCardClick = () => {
      if (article.url) {
        window.open(article.url, '_blank');
      } else {
        message.info('No source URL available');
      }
    };

    return (
      <Card
        key={article.id}
        className="article-card"
        hoverable
        onClick={handleCardClick}
        style={{ cursor: 'pointer' }}
        cover={
          article.image_url && (
            <div className="article-cover">
              <img alt={article.title} src={article.image_url} />
              {article.is_high_priority && (
                <Badge 
                  count={<FireOutlined style={{ color: '#fff' }} />}
                  className="priority-badge"
                />
              )}
            </div>
          )
        }
      >
        <div className="article-header">
          <Space size={4}>
            {article.source_name && (
              <Tag color="blue" style={{ fontSize: 11 }}>
                {article.source_name}
              </Tag>
            )}
            {article.is_high_priority && (
              <Tag icon={<FireOutlined />} color="red" style={{ fontSize: 11 }}>
                High Priority
              </Tag>
            )}
            {article.intelligence_count > 0 && (
              <Tag color="orange" style={{ fontSize: 11 }}>
                {article.intelligence_count} IOCs
              </Tag>
            )}
          </Space>
        </div>

        <Title 
          level={5} 
          className="article-title"
          style={{ marginTop: 8, marginBottom: 8 }}
        >
          {article.title}
        </Title>

        {article.summary && (
          <Paragraph 
            className="article-summary"
            ellipsis={{ rows: 3 }}
          >
            {article.summary}
          </Paragraph>
        )}

        <div className="article-meta">
          <Space split={<Divider type="vertical" />} size="small">
            <Text type="secondary" style={{ fontSize: 12 }}>
              <ClockCircleOutlined /> {formatDate(article.published_at || article.created_at)}
            </Text>
            {readingTime && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {readingTime} min read
              </Text>
            )}
          </Space>
        </div>

        <div className="article-actions" onClick={(e) => e.stopPropagation()}>
          <Space>
            <Tooltip title={isStarred ? 'Remove star' : 'Star article'}>
              <Button
                type="text"
                size="small"
                icon={isStarred ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleStar(article.id);
                }}
              />
            </Tooltip>
            <Tooltip title="Open in reader">
              <Button
                type="text"
                size="small"
                icon={<ReadOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  openReader(article);
                }}
              />
            </Tooltip>
            <Tooltip title="Open in article queue">
              <Button
                type="text"
                size="small"
                icon={<EyeOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  openInQueue(article.id);
                }}
              />
            </Tooltip>
          </Space>
        </div>
      </Card>
    );
  };

  // Render article list item
  const renderArticleListItem = (article) => {
    const isStarred = starred.has(article.id);

    const handleCardClick = () => {
      if (article.url) {
        window.open(article.url, '_blank');
      } else {
        message.info('No source URL available');
      }
    };

    return (
      <Card
        key={article.id}
        className="article-list-item"
        size="small"
        hoverable
        onClick={handleCardClick}
        style={{ cursor: 'pointer' }}
      >
        <Row gutter={16} align="middle">
          {article.image_url && (
            <Col span={4}>
              <img 
                src={article.image_url} 
                alt={article.title}
                style={{ width: '100%', borderRadius: 4, objectFit: 'cover', height: 80 }}
              />
            </Col>
          )}
          <Col span={article.image_url ? 20 : 24}>
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <div>
                <Space size={4} wrap>
                  {article.source_name && (
                    <Tag color="blue" style={{ fontSize: 10 }}>
                      {article.source_name}
                    </Tag>
                  )}
                  {article.is_high_priority && (
                    <Tag icon={<FireOutlined />} color="red" style={{ fontSize: 10 }}>
                      Priority
                    </Tag>
                  )}
                </Space>
              </div>
              <Title level={5} style={{ margin: 0 }}>
                {isStarred && <StarFilled style={{ color: '#faad14', marginRight: 8 }} />}
                {article.title}
              </Title>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {formatDate(article.published_at || article.created_at)}
              </Text>
            </Space>
          </Col>
        </Row>
      </Card>
    );
  };

  // Render based on view mode
  const renderArticles = () => {
    if (loading) {
      return (
        <div style={{ textAlign: 'center', padding: 50 }}>
          <Spin size="large" tip="Loading articles..." />
        </div>
      );
    }

    if (articles.length === 0) {
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No articles found"
          style={{ padding: 50 }}
        >
          <Button type="primary" icon={<ReloadOutlined />} onClick={fetchArticles}>
            Refresh
          </Button>
        </Empty>
      );
    }

    if (viewMode === 'list') {
      return (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {articles.map(renderArticleListItem)}
        </Space>
      );
    }

    // Cards and magazine view
    return (
      <Row gutter={[16, 16]}>
        {articles.map(article => (
          <Col 
            key={article.id}
            xs={24} 
            sm={24} 
            md={viewMode === 'magazine' ? 24 : 12}
            lg={viewMode === 'magazine' ? 12 : 8}
            xl={viewMode === 'magazine' ? 12 : 6}
          >
            {renderArticleCard(article)}
          </Col>
        ))}
      </Row>
    );
  };

  return (
    <Layout className="intel-news-layout">
      {/* Sidebar with sources */}
      <Sider 
        width={250} 
        theme="light"
        className="intel-news-sidebar"
        breakpoint="lg"
        collapsedWidth="0"
      >
        <div className="sidebar-content">
          <div className="sidebar-header">
            <Title level={4} style={{ margin: 0 }}>
              <BookOutlined /> Sources
            </Title>
            <Button 
              type="text" 
              icon={<PlusOutlined />}
              size="small"
              onClick={() => navigate('/sources')}
            >
              Add
            </Button>
          </div>
          <Divider style={{ margin: '12px 0' }} />
          <div className="source-list">
            <div
              className={`source-item ${selectedSource === null ? 'active' : ''}`}
              onClick={() => setSelectedSource(null)}
            >
              <Text>All Sources</Text>
              <Badge count={total} showZero style={{ backgroundColor: '#52c41a' }} />
            </div>
            {sources.map(source => (
              <div
                key={source.id}
                className={`source-item ${selectedSource === source.id ? 'active' : ''}`}
                onClick={() => setSelectedSource(source.id)}
              >
                <Text ellipsis>{source.name}</Text>
              </div>
            ))}
          </div>
        </div>
      </Sider>

      {/* Main content */}
      <Content className="intel-news-content">
        {/* Header toolbar */}
        <div className="content-header">
          <div className="header-left">
            <Title level={2} style={{ margin: 0 }}>
              <ReadOutlined /> News & Intel
            </Title>
            <Text type="secondary">{total} articles</Text>
          </div>
          <Space size="middle">
            <Segmented
              value={viewMode}
              onChange={setViewMode}
              options={[
                { label: 'Cards', value: 'cards', icon: <AppstoreOutlined /> },
                { label: 'List', value: 'list', icon: <UnorderedListOutlined /> },
                { label: 'Magazine', value: 'magazine', icon: <ReadOutlined /> }
              ]}
            />
            <Button
              icon={<ReloadOutlined spin={loading} />}
              onClick={fetchArticles}
            >
              Refresh
            </Button>
          </Space>
        </div>

        {/* Filters */}
        <Card className="filters-card" size="small">
          <Space wrap>
            <Search
              placeholder="Search articles..."
              allowClear
              style={{ width: 300 }}
              onSearch={(value) => {
                setSearchQuery(value);
                fetchArticles();
              }}
              onChange={(e) => {
                if (!e.target.value) {
                  setSearchQuery('');
                  fetchArticles();
                }
              }}
            />
            <Select
              value={dateRange}
              onChange={setDateRange}
              style={{ width: 150 }}
              options={[
                { label: 'Today', value: 'today' },
                { label: 'This Week', value: 'week' },
                { label: 'This Month', value: 'month' },
                { label: 'All Time', value: 'all' }
              ]}
            />
            <Button
              type={showHighPriority ? 'primary' : 'default'}
              icon={<FireOutlined />}
              onClick={() => setShowHighPriority(!showHighPriority)}
            >
              High Priority
            </Button>
            <Button
              icon={<FilterOutlined />}
              onClick={() => message.info('Advanced filters coming soon')}
            >
              More Filters
            </Button>
          </Space>
        </Card>

        {/* Articles grid/list */}
        <div className="articles-container">
          {renderArticles()}
        </div>
      </Content>

      {/* Reader drawer */}
      <Drawer
        title={null}
        placement="right"
        width="60%"
        onClose={() => setReaderOpen(false)}
        open={readerOpen}
        className="reader-drawer"
      >
        {selectedArticle && (
          <div className="reader-content">
            {selectedArticle.image_url && (
              <img 
                src={selectedArticle.image_url} 
                alt={selectedArticle.title}
                className="reader-image"
              />
            )}
            <div className="reader-header">
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <Space wrap>
                  {selectedArticle.source_name && (
                    <Tag color="blue">{selectedArticle.source_name}</Tag>
                  )}
                  {selectedArticle.is_high_priority && (
                    <Tag icon={<FireOutlined />} color="red">High Priority</Tag>
                  )}
                </Space>
                <Title level={2}>{selectedArticle.title}</Title>
                <Text type="secondary">
                  {formatDate(selectedArticle.published_at || selectedArticle.created_at)}
                </Text>
              </Space>
            </div>
            <Divider />
            <div className="reader-body">
              {selectedArticle.summary && (
                <Paragraph strong style={{ fontSize: 16, color: '#595959' }}>
                  {selectedArticle.summary}
                </Paragraph>
              )}
              {selectedArticle.normalized_content && (
                <div 
                  dangerouslySetInnerHTML={{ __html: selectedArticle.normalized_content }}
                  className="article-content"
                />
              )}
            </div>
            <div className="reader-actions">
              <Space>
                <Button
                  type="primary"
                  icon={<EyeOutlined />}
                  onClick={() => openInQueue(selectedArticle.id)}
                >
                  Open in Article Queue
                </Button>
                {selectedArticle.url && (
                  <Button
                    icon={<LinkOutlined />}
                    onClick={() => window.open(selectedArticle.url, '_blank')}
                  >
                    View Source
                  </Button>
                )}
                <Button
                  icon={starred.has(selectedArticle.id) ? <StarFilled /> : <StarOutlined />}
                  onClick={() => toggleStar(selectedArticle.id)}
                >
                  {starred.has(selectedArticle.id) ? 'Starred' : 'Star'}
                </Button>
              </Space>
            </div>
          </div>
        )}
      </Drawer>
    </Layout>
  );
};

export default IntelNews;
