import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layout, Typography, Button, Space, Input, Tag, Empty, Spin, Tooltip,
  Card, Row, Col, Drawer, Badge, Dropdown, Menu, message, Segmented, Alert,
  Select, DatePicker, Divider, Modal, Form, Switch
} from 'antd';
import {
  ReadOutlined, StarOutlined, StarFilled, LinkOutlined, ClockCircleOutlined,
  FireOutlined, EyeOutlined, FilterOutlined, SearchOutlined, ReloadOutlined,
  SettingOutlined, AppstoreOutlined, UnorderedListOutlined, PlusOutlined,
  GlobalOutlined, FileTextOutlined, MenuOutlined, ThunderboltOutlined,
  TagOutlined, CalendarOutlined
} from '@ant-design/icons';
import { articlesAPI, sourcesAPI } from '../api/client';
import { useAuthStore } from '../store';
import './NewsIntel.css';

const { Content, Sider } = Layout;
const { Title, Text, Paragraph } = Typography;
const { Search } = Input;
const { RangePicker } = DatePicker;

/**
 * Redesigned News & Intel - Intuitive, feature-rich, with source management
 */
const NewsIntelImproved = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  // Data
  const [articles, setArticles] = useState([]);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, today: 0, priority: 0, duplicates: 0 });

  // UI State
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [readerOpen, setReaderOpen] = useState(false);
  const [starred, setStarred] = useState(new Set());
  const [viewMode, setViewMode] = useState('cards'); // cards, list, magazine
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSource, setSelectedSource] = useState(null);
  const [showPriorityOnly, setShowPriorityOnly] = useState(false);
  const [timeRange, setTimeRange] = useState('today');
  const [selectedTags, setSelectedTags] = useState([]);

  // Source Management Modal
  const [sourceModalVisible, setSourceModalVisible] = useState(false);
  const [sourceForm] = Form.useForm();

  useEffect(() => {
    const saved = localStorage.getItem('huntsphere_starred_articles');
    if (saved) setStarred(new Set(JSON.parse(saved)));
    fetchData();
  }, []);

  useEffect(() => {
    fetchArticles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSource, showPriorityOnly, timeRange, selectedTags]);

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
        1, 200, null, showPriorityOnly, selectedSource
      );
      let fetched = response.data?.articles || [];

      // Time filtering
      const now = new Date();
      const cutoff = new Date();
      if (timeRange === 'today') cutoff.setHours(0, 0, 0, 0);
      else if (timeRange === 'week') cutoff.setDate(now.getDate() - 7);
      else if (timeRange === 'month') cutoff.setMonth(now.getMonth() - 1);
      
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayArticles = fetched.filter(a => new Date(a.published_at || a.created_at) >= todayStart);
      
      if (timeRange !== 'all') {
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

      // Calculate stats
      const priorityCount = fetched.filter(a => a.is_high_priority).length;
      const duplicateCount = 0; // TODO: Implement duplicate detection

      setStats({
        total: fetched.length,
        today: todayArticles.length,
        priority: priorityCount,
        duplicates: duplicateCount
      });

      setArticles(fetched);
    } catch (err) {
      console.error('Failed to fetch articles', err);
      message.error('Failed to load articles');
    } finally {
      setLoading(false);
    }
  };

  const toggleStar = (id) => {
    setStarred(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem('huntsphere_starred_articles', JSON.stringify([...next]));
      return next;
    });
  };

  const openReader = (article) => {
    setSelectedArticle(article);
    setReaderOpen(true);
  };

  const openInQueue = (articleId) => {
    navigate(`/articles/${articleId}`);
  };

  const getReadingTime = (content) => {
    if (!content) return 0;
    const words = content.split(' ').length;
    return Math.ceil(words / 200);
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffHours < 48) return 'Yesterday';
    return date.toLocaleDateString();
  };

  const handleAddSource = async (values) => {
    try {
      await sourcesAPI.create(values);
      message.success('Source added successfully');
      setSourceModalVisible(false);
      sourceForm.resetFields();
      fetchData();
      fetchArticles();
    } catch (error) {
      message.error(error.response?.data?.detail || 'Failed to add source');
    }
  };

  const renderArticleCard = (article) => (
    <Card
      key={article.id}
      className="article-card"
      hoverable
      onClick={() => window.open(article.url, '_blank')}
      cover={
        article.image_url ? (
          <div className="article-cover">
            <img alt={article.title} src={article.image_url} onError={(e) => e.target.style.display = 'none'} />
            {article.is_high_priority && (
              <Tag color="red" icon={<FireOutlined />} className="priority-badge">
                High Priority
              </Tag>
            )}
            {article.is_duplicate && (
              <Tag color="orange" className="duplicate-badge">
                Duplicate
              </Tag>
            )}
          </div>
        ) : (
          <div className="article-cover" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileTextOutlined style={{ fontSize: 48, color: 'rgba(255,255,255,0.6)' }} />
            {article.is_high_priority && (
              <Tag color="red" icon={<FireOutlined />} className="priority-badge">
                High Priority
              </Tag>
            )}
            {article.is_duplicate && (
              <Tag color="orange" className="duplicate-badge">
                Duplicate
              </Tag>
            )}
          </div>
        )
      }
      actions={[
        <Tooltip title={starred.has(article.id) ? 'Unstar' : 'Star'} key="star">
          <Button 
            type="text" 
            icon={starred.has(article.id) ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
            onClick={(e) => { e.stopPropagation(); toggleStar(article.id); }}
            style={{ fontSize: 16 }}
          />
        </Tooltip>,
        <Tooltip title="Read Article" key="open">
          <Button 
            type="text" 
            icon={<EyeOutlined />}
            onClick={(e) => { e.stopPropagation(); openReader(article); }}
            style={{ fontSize: 16 }}
          />
        </Tooltip>,
        <Tooltip title="Deep Analysis" key="analyze">
          <Button 
            type="primary" 
            size="small"
            icon={<ThunderboltOutlined />}
            onClick={(e) => { e.stopPropagation(); openInQueue(article.id); }}
          >
            Analyze
          </Button>
        </Tooltip>,
      ]}
    >
      <div className="article-card-content">
        <Title level={5} className="article-title" ellipsis={{ rows: 2 }}>
          {article.title}
        </Title>
        
        <Paragraph className="article-summary" ellipsis={{ rows: 3 }}>
          {article.summary || article.normalized_content?.substring(0, 200)}
        </Paragraph>
        
        <div className="article-meta">
          <Space split={<Divider type="vertical" />} size="small">
            <Text type="secondary" className="meta-item">
              <GlobalOutlined /> {article.feed_source?.name || 'Unknown'}
            </Text>
            <Text type="secondary" className="meta-item">
              <ClockCircleOutlined /> {formatDate(article.published_at || article.created_at)}
            </Text>
            {getReadingTime(article.normalized_content) > 0 && (
              <Text type="secondary" className="meta-item">
                <ReadOutlined /> {getReadingTime(article.normalized_content)} min read
              </Text>
            )}
          </Space>
        </div>
        
        {article.matched_keywords?.length > 0 && (
          <div className="article-tags">
            {article.matched_keywords.slice(0, 3).map((keyword, idx) => (
              <Tag key={idx} color="blue" icon={<TagOutlined />}>
                {keyword}
              </Tag>
            ))}
          </div>
        )}
      </div>
    </Card>
  );

  const renderArticleList = (article) => (
    <Card
      key={article.id}
      className="article-list-item"
      size="small"
      hoverable
      onClick={() => window.open(article.url, '_blank')}
    >
      <Row gutter={16} align="middle">
        <Col flex="auto">
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <Space>
              {article.is_high_priority && <FireOutlined style={{ color: '#ff4d4f' }} />}
              {article.is_duplicate && <Tag color="orange" size="small">Duplicate</Tag>}
              <Title level={5} style={{ margin: 0 }}>
                {article.title}
              </Title>
            </Space>
            
            <Text type="secondary" ellipsis style={{ fontSize: 12 }}>
              {article.summary?.substring(0, 150)}
            </Text>
            
            <Space size="small" split={<Divider type="vertical" />}>
              <Text type="secondary" style={{ fontSize: 11 }}>
                <GlobalOutlined /> {article.feed_source?.name || 'Unknown'}
              </Text>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {formatDate(article.published_at || article.created_at)}
              </Text>
            </Space>
          </Space>
        </Col>
        
        <Col>
          <Space>
            <Button
              type="text"
              icon={starred.has(article.id) ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
              onClick={(e) => { e.stopPropagation(); toggleStar(article.id); }}
            />
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={(e) => { e.stopPropagation(); openReader(article); }}
            />
            <Button
              type="primary"
              size="small"
              onClick={(e) => { e.stopPropagation(); openInQueue(article.id); }}
            >
              Analyze
            </Button>
          </Space>
        </Col>
      </Row>
    </Card>
  );

  const filterMenu = (
    <Menu>
      <Menu.Item key="priority">
        <Switch
          checked={showPriorityOnly}
          onChange={setShowPriorityOnly}
          size="small"
        />
        <span style={{ marginLeft: 8 }}>High Priority Only</span>
      </Menu.Item>
      <Menu.Divider />
      <Menu.SubMenu key="time" title="Time Range">
        <Menu.Item key="today" onClick={() => setTimeRange('today')}>Today</Menu.Item>
        <Menu.Item key="week" onClick={() => setTimeRange('week')}>This Week</Menu.Item>
        <Menu.Item key="month" onClick={() => setTimeRange('month')}>This Month</Menu.Item>
        <Menu.Item key="all" onClick={() => setTimeRange('all')}>All Time</Menu.Item>
      </Menu.SubMenu>
    </Menu>
  );

  return (
    <Layout className="news-intel-layout" style={{ background: '#f0f2f5', minHeight: '100vh' }}>
      {/* Sidebar - Sources */}
      {!sidebarCollapsed && (
        <Sider 
          width={260} 
          className="news-intel-sidebar"
          style={{ background: '#fff', padding: '16px', overflowY: 'auto' }}
        >
          <div style={{ marginBottom: 16 }}>
            <Title level={5}>Sources</Title>
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              <Button
                block
                type={selectedSource === null ? 'primary' : 'default'}
                onClick={() => setSelectedSource(null)}
                icon={<GlobalOutlined />}
              >
                All Sources ({sources.length})
              </Button>
              
              {sources.filter(s => s.is_active).map(source => (
                <Button
                  key={source.id}
                  block
                  type={selectedSource === source.id ? 'primary' : 'default'}
                  onClick={() => setSelectedSource(source.id)}
                  style={{ textAlign: 'left' }}
                >
                  {source.name}
                </Button>
              ))}
              
              <Divider style={{ margin: '8px 0' }} />
              
              <Button
                block
                icon={<PlusOutlined />}
                onClick={() => setSourceModalVisible(true)}
              >
                Add Source
              </Button>
              
              {isAdmin && (
                <Button
                  block
                  icon={<SettingOutlined />}
                  onClick={() => navigate('/sources')}
                >
                  Manage All Sources
                </Button>
              )}
            </Space>
          </div>
        </Sider>
      )}

      {/* Main Content */}
      <Layout>
        <Content style={{ padding: '16px 24px' }}>
          {/* Header with Stats */}
          <div className="content-header" style={{ background: '#fff', padding: '20px 24px', borderRadius: 8, marginBottom: 16 }}>
            <Row justify="space-between" align="middle" gutter={[16, 16]}>
              <Col>
                <Space>
                  <Button
                    icon={<MenuOutlined />}
                    onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  />
                  <Title level={3} style={{ margin: 0 }}>
                    News & Intelligence Feed
                  </Title>
                </Space>
              </Col>
              
              <Col>
                <Space>
                  <Badge count={stats.today} showZero>
                    <Button icon={<CalendarOutlined />}>Today</Button>
                  </Badge>
                  <Badge count={stats.priority} showZero>
                    <Button icon={<FireOutlined />} danger={stats.priority > 0}>Priority</Button>
                  </Badge>
                  {stats.duplicates > 0 && (
                    <Badge count={stats.duplicates}>
                      <Button>Duplicates</Button>
                    </Badge>
                  )}
                </Space>
              </Col>
            </Row>
            
            {/* Filters */}
            <Row gutter={16} style={{ marginTop: 16 }}>
              <Col flex="auto">
                <Search
                  placeholder="Search articles by title, content, or keywords..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onSearch={fetchArticles}
                  enterButton={<SearchOutlined />}
                  size="large"
                  allowClear
                />
              </Col>
              
              <Col>
                <Space>
                  <Segmented
                    value={viewMode}
                    onChange={setViewMode}
                    options={[
                      { label: 'Cards', value: 'cards', icon: <AppstoreOutlined /> },
                      { label: 'List', value: 'list', icon: <UnorderedListOutlined /> },
                    ]}
                  />
                  <Dropdown overlay={filterMenu} trigger={['click']}>
                    <Button icon={<FilterOutlined />}>Filters</Button>
                  </Dropdown>
                  <Button icon={<ReloadOutlined />} onClick={fetchArticles} loading={loading}>
                    Refresh
                  </Button>
                </Space>
              </Col>
            </Row>

            {/* Active Filters Display */}
            {(showPriorityOnly || timeRange !== 'today' || selectedSource) && (
              <Row style={{ marginTop: 12 }}>
                <Space wrap>
                  <Text type="secondary">Active filters:</Text>
                  {showPriorityOnly && <Tag closable onClose={() => setShowPriorityOnly(false)}>High Priority</Tag>}
                  {timeRange !== 'today' && <Tag closable onClose={() => setTimeRange('today')}>Time: {timeRange}</Tag>}
                  {selectedSource && (
                    <Tag closable onClose={() => setSelectedSource(null)}>
                      Source: {sources.find(s => s.id === selectedSource)?.name}
                    </Tag>
                  )}
                  <Button type="link" size="small" onClick={() => {
                    setShowPriorityOnly(false);
                    setTimeRange('today');
                    setSelectedSource(null);
                    setSearchQuery('');
                  }}>
                    Clear All
                  </Button>
                </Space>
              </Row>
            )}
          </div>

          {/* Articles Grid/List */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <Spin size="large" />
              <div style={{ marginTop: 16 }}>
                <Text type="secondary">Loading articles...</Text>
              </div>
            </div>
          ) : articles.length === 0 ? (
            <Empty
              description="No articles found. Try adjusting your filters or add more sources."
              style={{ marginTop: 60 }}
            >
              <Space>
                <Button type="primary" onClick={() => setSourceModalVisible(true)}>
                  Add Source
                </Button>
                <Button onClick={() => {
                  setShowPriorityOnly(false);
                  setTimeRange('all');
                  setSelectedSource(null);
                  setSearchQuery('');
                }}>
                  Clear Filters
                </Button>
              </Space>
            </Empty>
          ) : (
            <>
              <div style={{ marginBottom: 16 }}>
                <Text type="secondary">
                  Showing {articles.length} articles {timeRange !== 'all' && `from ${timeRange}`}
                </Text>
              </div>
              
              {viewMode === 'cards' ? (
                <Row gutter={[16, 16]}>
                  {articles.map(article => (
                    <Col xs={24} sm={12} lg={8} xl={6} key={article.id}>
                      {renderArticleCard(article)}
                    </Col>
                  ))}
                </Row>
              ) : (
                <Space direction="vertical" style={{ width: '100%' }} size="small">
                  {articles.map(renderArticleList)}
                </Space>
              )}
            </>
          )}
        </Content>
      </Layout>

      {/* Reader Drawer */}
      <Drawer
        title={selectedArticle?.title}
        placement="right"
        width="60%"
        open={readerOpen}
        onClose={() => setReaderOpen(false)}
        extra={
          <Space>
            <Button
              icon={starred.has(selectedArticle?.id) ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
              onClick={() => toggleStar(selectedArticle?.id)}
            >
              {starred.has(selectedArticle?.id) ? 'Starred' : 'Star'}
            </Button>
            <Button type="primary" icon={<LinkOutlined />} onClick={() => window.open(selectedArticle?.url, '_blank')}>
              Open Original
            </Button>
            <Button onClick={() => openInQueue(selectedArticle?.id)}>
              Analyze in Queue
            </Button>
          </Space>
        }
      >
        {selectedArticle && (
          <div className="reader-content" style={{ background: '#fff', padding: 24 }}>
            {selectedArticle.summary && (
              <Alert
                message="Summary"
                description={selectedArticle.summary}
                type="info"
                showIcon
                style={{ marginBottom: 24 }}
              />
            )}
            
            <div style={{ marginBottom: 16 }}>
              <Space>
                <Text type="secondary">
                  <GlobalOutlined /> {selectedArticle.feed_source?.name || 'Unknown Source'}
                </Text>
                <Text type="secondary">
                  <ClockCircleOutlined /> {new Date(selectedArticle.published_at || selectedArticle.created_at).toLocaleString()}
                </Text>
              </Space>
            </div>
            
            <Divider />
            
            <div 
              style={{ fontSize: 16, lineHeight: 1.8 }}
              dangerouslySetInnerHTML={{ __html: selectedArticle.normalized_content || selectedArticle.raw_content }}
            />
          </div>
        )}
      </Drawer>

      {/* Add Source Modal */}
      <Modal
        title="Add New Source"
        open={sourceModalVisible}
        onCancel={() => {
          setSourceModalVisible(false);
          sourceForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={sourceForm}
          layout="vertical"
          onFinish={handleAddSource}
        >
          <Form.Item
            name="name"
            label="Source Name"
            rules={[{ required: true, message: 'Please enter source name' }]}
          >
            <Input placeholder="e.g., Krebs on Security" />
          </Form.Item>
          
          <Form.Item
            name="url"
            label="Feed URL"
            rules={[
              { required: true, message: 'Please enter feed URL' },
              { type: 'url', message: 'Please enter a valid URL' }
            ]}
          >
            <Input placeholder="https://krebsonsecurity.com/feed/" addonBefore={<LinkOutlined />} />
          </Form.Item>
          
          <Form.Item
            name="feed_type"
            label="Feed Type"
            initialValue="rss"
          >
            <Select>
              <Select.Option value="rss">RSS</Select.Option>
              <Select.Option value="atom">Atom</Select.Option>
              <Select.Option value="json">JSON Feed</Select.Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            name="description"
            label="Description (Optional)"
          >
            <Input.TextArea rows={3} placeholder="Brief description of this source..." />
          </Form.Item>
          
          <Form.Item
            name="is_active"
            label="Activate Immediately"
            valuePropName="checked"
            initialValue={true}
          >
            <Switch />
          </Form.Item>
          
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Add Source
              </Button>
              <Button onClick={() => {
                setSourceModalVisible(false);
                sourceForm.resetFields();
              }}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
};

export default NewsIntelImproved;
