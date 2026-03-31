import React, { useState, useEffect } from 'react';
import {
  Card, Button, Space, Tag, Input, List, Switch, Tabs,
  Typography, message, Popconfirm, Empty, Alert, Statistic, Row, Col
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EyeOutlined,
  TagOutlined,
  BellOutlined,
  SyncOutlined,
  FireOutlined,
  RightOutlined,
  GlobalOutlined,
  UserOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { watchlistAPI, articlesAPI } from '../api/client';
import client from '../api/client';
import { useAuthStore } from '../store';
import './Watchlist.css';

const { Title, Text } = Typography;

function Watchlist() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';
  const [activeTab, setActiveTab] = useState('personal');
  const [loading, setLoading] = useState(false);
  const [keywords, setKeywords] = useState([]);
  const [personalKeywords, setPersonalKeywords] = useState([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [newPersonalKeyword, setNewPersonalKeyword] = useState('');
  const [adding, setAdding] = useState(false);
  const [addingPersonal, setAddingPersonal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [highPriorityCount, setHighPriorityCount] = useState(0);

  // Navigate to article queue filtered by high priority
  const handleViewHighPriorityArticles = () => {
    navigate('/news?high_priority=true');
  };

  useEffect(() => {
    fetchKeywords();
    fetchPersonalKeywords();
    fetchHighPriorityCount();
  }, []);

  // Personal watchlist CRUD
  const fetchPersonalKeywords = async () => {
    try {
      const response = await client.get('/users/watchlist/');
      setPersonalKeywords(response.data);
    } catch (err) {
      console.error('Failed to fetch personal watchlist', err);
    }
  };

  const handleAddPersonal = async () => {
    if (!newPersonalKeyword.trim()) {
      message.warning('Please enter a keyword');
      return;
    }
    setAddingPersonal(true);
    try {
      await client.post('/users/watchlist/', { keyword: newPersonalKeyword.trim() });
      message.success('Keyword added to your personal watchlist');
      setNewPersonalKeyword('');
      fetchPersonalKeywords();
    } catch (err) {
      message.error(err.response?.data?.detail || 'Failed to add keyword');
    } finally {
      setAddingPersonal(false);
    }
  };

  const handleDeletePersonal = async (id) => {
    try {
      await client.delete(`/users/watchlist/${id}`);
      message.success('Keyword removed from personal watchlist');
      fetchPersonalKeywords();
    } catch (err) {
      message.error('Failed to remove keyword');
    }
  };

  const handleTogglePersonal = async (id) => {
    try {
      await client.patch(`/users/watchlist/${id}/toggle`);
      fetchPersonalKeywords();
    } catch (err) {
      message.error('Failed to toggle keyword');
    }
  };

  // Fetch high priority count on load
  const fetchHighPriorityCount = async () => {
    try {
      const response = await articlesAPI.getTriageQueue(1, 1, null, true, null);
      setHighPriorityCount(response.data?.total || 0);
    } catch (err) {
      console.error('Failed to fetch high priority count', err);
    }
  };

  const fetchKeywords = async () => {
    setLoading(true);
    try {
      const response = await watchlistAPI.list();
      setKeywords(response.data);
    } catch (err) {
      console.error('Failed to fetch keywords', err);
      // Demo data
      setKeywords([
        { id: 1, keyword: 'ransomware', is_active: true, created_at: new Date().toISOString() },
        { id: 2, keyword: 'APT29', is_active: true, created_at: new Date().toISOString() },
        { id: 3, keyword: 'zero-day', is_active: true, created_at: new Date().toISOString() },
        { id: 4, keyword: 'Lazarus', is_active: true, created_at: new Date().toISOString() },
        { id: 5, keyword: 'phishing', is_active: false, created_at: new Date().toISOString() },
        { id: 6, keyword: 'CVE-2024', is_active: true, created_at: new Date().toISOString() },
        { id: 7, keyword: 'data breach', is_active: true, created_at: new Date().toISOString() },
        { id: 8, keyword: 'supply chain', is_active: true, created_at: new Date().toISOString() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newKeyword.trim()) {
      message.warning('Please enter a keyword');
      return;
    }

    setAdding(true);
    try {
      await watchlistAPI.create(newKeyword.trim());
      message.success('Keyword added to watchlist');
      setNewKeyword('');
      fetchKeywords();
    } catch (err) {
      message.error(err.response?.data?.detail || 'Failed to add keyword');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await watchlistAPI.delete(id);
      message.success('Keyword removed from watchlist');
      fetchKeywords();
    } catch (err) {
      message.error('Failed to remove keyword');
    }
  };

  const handleToggle = async (id, isActive) => {
    try {
      await watchlistAPI.toggle(id, isActive);
      setKeywords(keywords.map(k => 
        k.id === id ? { ...k, is_active: isActive } : k
      ));
      message.success(`Keyword ${isActive ? 'activated' : 'deactivated'} - articles updated`);
      // Refresh to get new count
      handleRefresh();
    } catch (err) {
      message.error('Failed to update keyword');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const response = await watchlistAPI.refresh();
      const data = response.data;
      setHighPriorityCount(data.high_priority_articles || 0);
      message.success(`Watchlist refreshed: ${data.articles_updated} articles updated, ${data.high_priority_articles} high priority`);
    } catch (err) {
      console.error('Failed to refresh watchlist', err);
      message.error('Failed to refresh watchlist matches');
    } finally {
      setRefreshing(false);
    }
  };

  const activeCount = keywords.filter(k => k.is_active).length;

  const personalActiveCount = personalKeywords.filter(k => k.is_active).length;

  // Personal Watchlist Tab Content
  const PersonalTab = () => (
    <>
      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card size="small" bodyStyle={{ padding: '12px 16px' }}>
            <Statistic
              title="My Keywords"
              value={personalKeywords.length}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#1890ff', fontSize: 24 }}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small" bodyStyle={{ padding: '12px 16px' }}>
            <Statistic
              title="Active"
              value={personalActiveCount}
              prefix={<BellOutlined />}
              valueStyle={{ color: '#52c41a', fontSize: 24 }}
            />
          </Card>
        </Col>
      </Row>

      <Card size="small" className="add-keyword-card" style={{ marginBottom: 12 }}>
        <Space.Compact style={{ width: '100%' }}>
          <Input
            placeholder="Add a personal keyword (e.g., AI, cloud security, GDPR)"
            value={newPersonalKeyword}
            onChange={(e) => setNewPersonalKeyword(e.target.value)}
            onPressEnter={handleAddPersonal}
            prefix={<TagOutlined />}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAddPersonal} loading={addingPersonal}>
            Add
          </Button>
        </Space.Compact>
      </Card>

      <Card size="small" loading={loading} style={{ marginBottom: 12 }}>
        {personalKeywords.length === 0 ? (
          <Empty description="No personal watchlist keywords yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <List
            grid={{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 4, xl: 4 }}
            dataSource={personalKeywords}
            renderItem={(item) => (
              <List.Item>
                <Card
                  className={`keyword-card ${item.is_active ? 'active' : 'inactive'}`}
                  size="small"
                  actions={[
                    <Switch
                      checked={item.is_active}
                      onChange={() => handleTogglePersonal(item.id)}
                      checkedChildren="Active"
                      unCheckedChildren="Off"
                    />,
                    <Popconfirm title="Remove this keyword?" onConfirm={() => handleDeletePersonal(item.id)}>
                      <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  ]}
                >
                  <div className="keyword-content">
                    <Tag color={item.is_active ? 'green' : 'default'} style={{ fontSize: 14, padding: '4px 12px' }}>
                      {item.keyword}
                    </Tag>
                    <Text type="secondary" style={{ fontSize: 11, marginTop: 8, display: 'block' }}>
                      Added: {new Date(item.created_at).toLocaleDateString()}
                    </Text>
                  </div>
                </Card>
              </List.Item>
            )}
          />
        )}
      </Card>
    </>
  );

  // Global Watchlist Tab Content (admin only)
  const GlobalTab = () => (
    <>
      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card size="small" bodyStyle={{ padding: '12px 16px' }}>
            <Statistic title="Global Keywords" value={activeCount} prefix={<BellOutlined />}
              valueStyle={{ color: '#1890ff', fontSize: 24 }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" hoverable onClick={handleViewHighPriorityArticles}
            style={{ cursor: 'pointer' }} bodyStyle={{ padding: '12px 16px' }}>
            <Statistic title={<Space>High Priority <RightOutlined style={{ fontSize: 10, color: '#999' }} /></Space>}
              value={highPriorityCount} prefix={<FireOutlined />}
              valueStyle={{ color: '#f5222d', fontSize: 24 }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" bodyStyle={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 74 }}>
            <Button type="primary" icon={<SyncOutlined spin={refreshing} />}
              onClick={handleRefresh} loading={refreshing} block>
              Refresh Matches
            </Button>
          </Card>
        </Col>
      </Row>

      <Card size="small" className="add-keyword-card" style={{ marginBottom: 12 }}>
        <Space.Compact style={{ width: '100%' }}>
          <Input
            placeholder="Enter global keyword (affects all users)"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onPressEnter={handleAdd}
            prefix={<TagOutlined />}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} loading={adding}>
            Add Global Keyword
          </Button>
        </Space.Compact>
      </Card>

      <Card size="small" loading={loading} style={{ marginBottom: 12 }}>
        {keywords.length === 0 ? (
          <Empty description="No global watchlist keywords" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <List
            grid={{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 4, xl: 4 }}
            dataSource={keywords}
            renderItem={(item) => (
              <List.Item>
                <Card
                  className={`keyword-card ${item.is_active ? 'active' : 'inactive'}`}
                  size="small"
                  actions={[
                    <Switch checked={item.is_active} onChange={(checked) => handleToggle(item.id, checked)}
                      checkedChildren="Active" unCheckedChildren="Inactive" />,
                    <Popconfirm title="Remove this keyword?" onConfirm={() => handleDelete(item.id)}>
                      <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  ]}
                >
                  <div className="keyword-content">
                    <Tag color={item.is_active ? 'blue' : 'default'} style={{ fontSize: 14, padding: '4px 12px' }}>
                      {item.keyword}
                    </Tag>
                    <Text type="secondary" style={{ fontSize: 11, marginTop: 8, display: 'block' }}>
                      Added: {new Date(item.created_at).toLocaleDateString()}
                    </Text>
                  </div>
                </Card>
              </List.Item>
            )}
          />
        )}
      </Card>
    </>
  );

  const tabItems = [
    {
      key: 'personal',
      label: <span><UserOutlined /> My Watchlist ({personalKeywords.length})</span>,
      children: <PersonalTab />
    },
    ...(isAdmin ? [{
      key: 'global',
      label: <span><GlobalOutlined /> Global Watchlist ({keywords.length})</span>,
      children: <GlobalTab />
    }] : [])
  ];

  return (
    <div className="watchlist-container">
      <div className="watchlist-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            <EyeOutlined /> Watchlist Keywords
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Monitor keywords across news feeds
          </Text>
        </div>
        <Tag color="blue" style={{ fontSize: 13, padding: '4px 12px' }}>
          <BellOutlined /> {activeCount + personalActiveCount} Active
        </Tag>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
      />

      <Card size="small" title="Suggested Keywords" style={{ marginTop: 12 }}>
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
          Click to add common keywords:
        </Text>
        <Space wrap size={[6, 6]}>
          {['AI', 'cybersecurity', 'cloud', 'data breach', 'zero-day',
            'ransomware', 'compliance', 'GDPR', 'supply chain', 'phishing',
            'machine learning', 'blockchain'].map(kw => (
            <Tag
              key={kw}
              style={{ cursor: 'pointer', margin: 0 }}
              onClick={() => activeTab === 'personal' ? setNewPersonalKeyword(kw) : setNewKeyword(kw)}
            >
              + {kw}
            </Tag>
          ))}
        </Space>
      </Card>
    </div>
  );
}

export default Watchlist;
