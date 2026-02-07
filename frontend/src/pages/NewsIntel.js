import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layout, Typography, Button, Space, Input, Tag, Empty, Spin, Tooltip,
  Dropdown, Menu, List, Avatar, Segmented, Badge, Drawer
} from 'antd';
import {
  ReadOutlined, StarOutlined, StarFilled, LinkOutlined, ClockCircleOutlined,
  FireOutlined, EyeOutlined, FilterOutlined, SearchOutlined, ReloadOutlined,
  MoreOutlined, GlobalOutlined, FileTextOutlined
} from '@ant-design/icons';
import { articlesAPI, sourcesAPI } from '../api/client';
import './NewsIntel.css';

const { Content } = Layout;
const { Title, Text, Paragraph } = Typography;
const { Search } = Input;

/**
 * News & Intel - Professional minimalist design
 * Focused on content discovery and reading with powerful yet simple features
 */
const NewsIntel = () => {
  const navigate = useNavigate();

  // Data
  const [articles, setArticles] = useState([]);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(false);

  // UI
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [readerOpen, setReaderOpen] = useState(false);
  const [starred, setStarred] = useState(new Set());
  const [view, setView] = useState('comfortable'); // compact, comfortable, expanded
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSource, setSelectedSource] = useState(null);
  const [showPriorityOnly, setShowPriorityOnly] = useState(false);
  const [timeRange, setTimeRange] = useState('today');

  useEffect(() => {
    const saved = localStorage.getItem('huntsphere_starred_articles');
    if (saved) setStarred(new Set(JSON.parse(saved)));
    fetchData();
  }, []);

  useEffect(() => {
    fetchArticles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSource, showPriorityOnly, timeRange]);

  const fetchData = async () => {
    try {
      const [sourcesRes] = await Promise.all([sourcesAPI.list()]);
      setSources(sourcesRes.data || []);
    } catch (err) {
      console.error('Failed to fetch sources', err);
    }
  };

  const fetchArticles = async () => {
    setLoading(true);
    try {
      const response = await articlesAPI.getTriageQueue(
        1, 100, null, showPriorityOnly, selectedSource
      );
      let fetched = response.data?.articles || [];

      // Time filtering
      if (timeRange !== 'all') {
        const now = new Date();
        const cutoff = new Date();
        if (timeRange === 'today') cutoff.setHours(0, 0, 0, 0);
        else if (timeRange === 'week') cutoff.setDate(now.getDate() - 7);
        else if (timeRange === 'month') cutoff.setMonth(now.getMonth() - 1);
        
        fetched = fetched.filter(a => new Date(a.published_at || a.created_at) >= cutoff);
      }

      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        fetched = fetched.filter(a =>
          a.title?.toLowerCase().includes(q) ||
          a.summary?.toLowerCase().includes(q)
        );
      }

      setArticles(fetched);
    } catch (err) {
      console.error('Failed to fetch articles', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleStar = (id) => {
    setStarred(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      localStorage.setItem('huntsphere_starred_articles', JSON.stringify([...next]));
      return next;
    });
  };

  const openOriginal = (article) => {
    if (article.url) window.open(article.url, '_blank');
  };

  const openReader = (article) => {
    setSelectedArticle(article);
    setReaderOpen(true);
  };

  const getTimeAgo = (dateStr) => {
    if (!dateStr) return '';
    const ms = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(ms / 60000);
    const hours = Math.floor(ms / 3600000);
    const days = Math.floor(ms / 86400000);
    if (mins < 60) return `${mins}m`;
    if (hours < 24) return `${hours}h`;
    return `${days}d`;
  };

  const getSourceMenu = () => (
    <Menu>
      <Menu.Item key="all" onClick={() => setSelectedSource(null)}>
        All Sources
      </Menu.Item>
      <Menu.Divider />
      {sources.map(s => (
        <Menu.Item key={s.id} onClick={() => setSelectedSource(s.id)}>
          {s.name}
        </Menu.Item>
      ))}
    </Menu>
  );

  const renderArticleItem = (article) => {
    const isStarred = starred.has(article.id);
    
    return (
      <div className={`article-item article-${view}`} key={article.id}>
        <div className="article-item-main" onClick={() => openOriginal(article)}>
          {article.image_url && view !== 'compact' && (
            <div className="article-thumbnail">
              <img src={article.image_url} alt="" />
            </div>
          )}
          <div className="article-content">
            <div className="article-meta-top">
              <Space size={4}>
                {article.source_name && (
                  <Tag className="source-tag">{article.source_name}</Tag>
                )}
                {article.is_high_priority && (
                  <Tag icon={<FireOutlined />} color="red">Priority</Tag>
                )}
                {article.intelligence_count > 0 && (
                  <Tag color="orange">{article.intelligence_count} IOCs</Tag>
                )}
              </Space>
              <Text type="secondary" className="time-ago">
                {getTimeAgo(article.published_at || article.created_at)}
              </Text>
            </div>
            
            <Title level={view === 'compact' ? 5 : 4} className="article-title">
              {article.title}
            </Title>
            
            {view !== 'compact' && article.summary && (
              <Paragraph className="article-summary" ellipsis={{ rows: 2 }}>
                {article.summary}
              </Paragraph>
            )}
          </div>
        </div>
        
        <div className="article-actions">
          <Tooltip title={isStarred ? 'Unstar' : 'Star'}>
            <Button
              type="text"
              size="small"
              icon={isStarred ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
              onClick={(e) => { e.stopPropagation(); toggleStar(article.id); }}
            />
          </Tooltip>
          <Tooltip title="Read">
            <Button
              type="text"
              size="small"
              icon={<ReadOutlined />}
              onClick={(e) => { e.stopPropagation(); openReader(article); }}
            />
          </Tooltip>
          <Tooltip title="Analyze">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={(e) => { e.stopPropagation(); navigate(`/articles?article_id=${article.id}`); }}
            />
          </Tooltip>
        </div>
      </div>
    );
  };

  return (
    <Layout className="news-intel-layout">
      <Content className="news-intel-content">
        {/* Header */}
        <div className="ni-header">
          <div className="ni-header-left">
            <Title level={2} className="ni-title">
              <GlobalOutlined /> News & Intel
            </Title>
            <Text type="secondary">{articles.length} articles</Text>
          </div>
          <Space>
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { label: 'Compact', value: 'compact' },
                { label: 'Comfortable', value: 'comfortable' },
                { label: 'Expanded', value: 'expanded' }
              ]}
              size="small"
            />
            <Button icon={<ReloadOutlined spin={loading} />} onClick={fetchArticles}>
              Refresh
            </Button>
          </Space>
        </div>

        {/* Filters */}
        <div className="ni-filters">
          <Space wrap>
            <Search
              placeholder="Search..."
              allowClear
              style={{ width: 250 }}
              onSearch={fetchArticles}
              onChange={(e) => setSearchQuery(e.target.value)}
              value={searchQuery}
            />
            <Dropdown overlay={getSourceMenu()} trigger={['click']}>
              <Button icon={<FileTextOutlined />}>
                {selectedSource ? sources.find(s => s.id === selectedSource)?.name : 'All Sources'}
              </Button>
            </Dropdown>
            <Segmented
              value={timeRange}
              onChange={setTimeRange}
              options={[
                { label: 'Today', value: 'today' },
                { label: 'Week', value: 'week' },
                { label: 'Month', value: 'month' },
                { label: 'All', value: 'all' }
              ]}
              size="small"
            />
            <Button
              type={showPriorityOnly ? 'primary' : 'default'}
              icon={<FireOutlined />}
              onClick={() => setShowPriorityOnly(!showPriorityOnly)}
            >
              Priority
            </Button>
          </Space>
        </div>

        {/* Articles */}
        <div className="ni-articles">
          {loading ? (
            <div className="ni-loading">
              <Spin size="large" tip="Loading..." />
            </div>
          ) : articles.length === 0 ? (
            <Empty description="No articles found" style={{ padding: '60px 0' }} />
          ) : (
            <div className="article-list">
              {articles.map(renderArticleItem)}
            </div>
          )}
        </div>
      </Content>

      {/* Reader */}
      <Drawer
        title={null}
        placement="right"
        width="60%"
        onClose={() => setReaderOpen(false)}
        open={readerOpen}
        className="ni-reader"
      >
        {selectedArticle && (
          <div className="reader-container">
            {selectedArticle.image_url && (
              <img src={selectedArticle.image_url} alt="" className="reader-hero" />
            )}
            <div className="reader-header">
              <Space size={4}>
                {selectedArticle.source_name && (
                  <Tag>{selectedArticle.source_name}</Tag>
                )}
                {selectedArticle.is_high_priority && (
                  <Tag icon={<FireOutlined />} color="red">Priority</Tag>
                )}
              </Space>
              <Title level={2} style={{ marginTop: 16 }}>
                {selectedArticle.title}
              </Title>
              <Text type="secondary">
                {new Date(selectedArticle.published_at || selectedArticle.created_at).toLocaleString()}
              </Text>
            </div>
            <div className="reader-body">
              {selectedArticle.summary && (
                <Paragraph strong style={{ fontSize: 16, color: '#595959' }}>
                  {selectedArticle.summary}
                </Paragraph>
              )}
              {selectedArticle.normalized_content && (
                <div
                  dangerouslySetInnerHTML={{ __html: selectedArticle.normalized_content }}
                  className="reader-content"
                />
              )}
            </div>
            <div className="reader-footer">
              <Space>
                <Button
                  type="primary"
                  icon={<EyeOutlined />}
                  onClick={() => navigate(`/articles?article_id=${selectedArticle.id}`)}
                >
                  Analyze
                </Button>
                {selectedArticle.url && (
                  <Button
                    icon={<LinkOutlined />}
                    onClick={() => window.open(selectedArticle.url, '_blank')}
                  >
                    Source
                  </Button>
                )}
              </Space>
            </div>
          </div>
        )}
      </Drawer>
    </Layout>
  );
};

export default NewsIntel;
