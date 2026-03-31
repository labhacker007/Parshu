import React, { useState, useEffect } from 'react';
import { 
  Table, Card, Button, Space, Tag, Modal, Form, Input, 
  Select, Switch, Typography, message, Tooltip,
  Badge, Row, Col, Statistic, Alert, Checkbox
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined,
  SyncOutlined,
  LinkOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  CloudDownloadOutlined,
  ReloadOutlined,
  FileTextOutlined,
  EyeOutlined,
  WarningOutlined,
  SettingOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { sourcesAPI } from '../api/client';
import { useAuthStore } from '../store';
import SourceRefreshSettings from '../components/SourceRefreshSettings';
import './Sources.css';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

function Sources() {
  const { user, isImpersonating, assumedRole } = useAuthStore();
  const navigate = useNavigate();
  // Respect impersonation for role-based UI
  const effectiveRole = isImpersonating ? assumedRole : user?.role;
  const isAdmin = effectiveRole === 'ADMIN';
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingSource, setEditingSource] = useState(null);
  const [form] = Form.useForm();
  const [ingesting, setIngesting] = useState({});
  const [ingestingAll, setIngestingAll] = useState(false);
  const [lastIngestResult, setLastIngestResult] = useState(null);
  const [stats, setStats] = useState({
    total_sources: 0,
    active_sources: 0,
    total_articles: 0,
    new_articles: 0,
    reviewed_articles: 0,
    high_priority_articles: 0
  });
  const [refreshSettingsVisible, setRefreshSettingsVisible] = useState(false);
  const [defaultFeeds, setDefaultFeeds] = useState([]);

  useEffect(() => {
    fetchSources();
    fetchStats();
    if (isAdmin) fetchDefaultFeeds();
  }, []);

  const fetchDefaultFeeds = async () => {
    try {
      const response = await sourcesAPI.listDefaultFeeds();
      const ids = (response.data || []).map(d => d.source_id);
      setDefaultFeeds(ids);
    } catch (err) {
      // Default feeds API may not be available
    }
  };

  const handleToggleDefault = async (sourceId, currentlyDefault) => {
    try {
      if (currentlyDefault) {
        await sourcesAPI.removeDefaultFeed(sourceId);
        message.success('Removed from default feeds');
      } else {
        await sourcesAPI.addDefaultFeed(sourceId);
        message.success('Marked as default feed for new users');
      }
      fetchDefaultFeeds();
    } catch (err) {
      message.error(err.response?.data?.detail || 'Failed to update default feed');
    }
  };

  const fetchSources = async () => {
    setLoading(true);
    try {
      const response = await sourcesAPI.list();
      setSources(response.data);
    } catch (err) {
      console.error('Failed to fetch sources', err);
      message.error('Failed to load sources');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await sourcesAPI.getStats();
      setStats(response.data);
    } catch (err) {
      console.error('Failed to fetch stats', err);
    }
  };

  const handleCreate = () => {
    setEditingSource(null);
    form.resetFields();
    form.setFieldsValue({ is_active: true, feed_type: 'rss' });
    setModalVisible(true);
  };

  const handleEdit = (source) => {
    setEditingSource(source);
    form.setFieldsValue(source);
    setModalVisible(true);
  };

  const handleSubmit = async (values) => {
    try {
      if (editingSource) {
        await sourcesAPI.update(editingSource.id, values);
        message.success('Source updated successfully');
      } else {
        await sourcesAPI.create(values);
        message.success('Source created successfully');
      }
      setModalVisible(false);
      fetchSources();
      fetchStats();
    } catch (err) {
      message.error(err.response?.data?.detail || 'Operation failed');
    }
  };

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteSourceId, setDeleteSourceId] = useState(null);
  const [deleteWithArticles, setDeleteWithArticles] = useState(false);

  const showDeleteConfirm = (id) => {
    setDeleteSourceId(id);
    setDeleteWithArticles(false);
    setDeleteModalVisible(true);
  };

  const handleDelete = async () => {
    if (!deleteSourceId) return;
    try {
      const response = await sourcesAPI.delete(deleteSourceId, deleteWithArticles);
      message.success(response.data.message || 'Source deleted');
      setDeleteModalVisible(false);
      setDeleteSourceId(null);
      fetchSources();
      fetchStats();
    } catch (err) {
      message.error(err.response?.data?.detail || 'Failed to delete source');
    }
  };

  const handleIngest = async (id) => {
    setIngesting(prev => ({ ...prev, [id]: true }));
    setLastIngestResult(null);
    try {
      const response = await sourcesAPI.triggerIngest(id);
      const result = response.data;
      
      if (result.status === 'success') {
        message.success(`Fetched ${result.new_articles} new articles (${result.high_priority} high priority)`);
      } else {
        message.error(`Ingestion failed: ${result.error}`);
      }
      
      fetchSources();
      fetchStats();
    } catch (err) {
      message.error(err.response?.data?.detail || 'Failed to trigger ingestion');
    } finally {
      setIngesting(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleIngestAll = async () => {
    setIngestingAll(true);
    setLastIngestResult(null);
    try {
      const response = await sourcesAPI.ingestAll();
      const data = response.data;
      
      setLastIngestResult(data);
      message.success(`Ingested from ${data.results?.length || 0} sources: ${data.total_new_articles} new articles`);
      
      fetchSources();
      fetchStats();
    } catch (err) {
      message.error(err.response?.data?.detail || 'Failed to ingest all sources');
    } finally {
      setIngestingAll(false);
    }
  };

  const columns = [
    {
      title: 'Source',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (name, record) => (
        <Space direction="vertical" size={0}>
          <Space>
            <Badge status={record.is_active ? 'success' : 'default'} />
            <Text strong>{name}</Text>
          </Space>
          {record.description && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.description.substring(0, 50)}...
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'URL',
      dataIndex: 'url',
      key: 'url',
      width: 200,
      ellipsis: true,
      render: (url) => (
        <Tooltip title={url}>
          <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, wordBreak: 'break-all' }}>
            <LinkOutlined /> {url.replace(/https?:\/\/(www\.)?/, '').substring(0, 30)}...
          </a>
        </Tooltip>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'feed_type',
      key: 'type',
      width: 80,
      render: (type) => <Tag>{type?.toUpperCase()}</Tag>,
    },
    {
      title: 'Articles',
      key: 'articles',
      width: 180,
      render: (_, record) => (
        <div style={{ minWidth: 160 }}>
          <div style={{ marginBottom: 4 }}>
            <Space size={4}>
              <FileTextOutlined style={{ color: '#722ed1' }} />
              <Text strong>{record.article_count || 0}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>total</Text>
            </Space>
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap' }}>
            <Tag color="blue" style={{ margin: 0, fontSize: 11, padding: '0 6px' }}>
              {record.new_articles || 0} new
            </Tag>
            <Tag color="green" style={{ margin: 0, fontSize: 11, padding: '0 6px' }}>
              {record.reviewed_articles || 0} rev
            </Tag>
          </div>
        </div>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 100,
      render: (_, record) => (
        <div style={{ minWidth: 80 }}>
          {record.is_active ? (
            <Tag color="success" icon={<CheckCircleOutlined />} style={{ margin: 0 }}>Active</Tag>
          ) : (
            <Tag color="default" icon={<CloseCircleOutlined />} style={{ margin: 0 }}>Inactive</Tag>
          )}
          {record.fetch_error && (
            <Tooltip title={record.fetch_error}>
              <Tag color="error" icon={<WarningOutlined />} style={{ margin: '4px 0 0 0', display: 'block' }}>Error</Tag>
            </Tooltip>
          )}
        </div>
      ),
    },
    ...(isAdmin ? [{
      title: 'Default',
      key: 'is_default',
      width: 80,
      render: (_, record) => (
        <Switch
          size="small"
          checked={defaultFeeds.includes(record.id)}
          onChange={() => handleToggleDefault(record.id, defaultFeeds.includes(record.id))}
          checkedChildren="Yes"
          unCheckedChildren="No"
        />
      ),
    }] : []),
    {
      title: 'Last Fetched',
      dataIndex: 'last_fetched',
      key: 'last_fetched',
      width: 150,
      render: (date) => date ? (
        <Tooltip title={new Date(date).toLocaleString()}>
          <Text style={{ fontSize: 12 }}>{getRelativeTime(date)}</Text>
        </Tooltip>
      ) : (
        <Text type="secondary">Never</Text>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space>
          {isAdmin ? (
            <>
              <Tooltip title="Fetch Articles Now">
                <Button
                  type="primary"
                  icon={<CloudDownloadOutlined />}
                  size="small"
                  loading={ingesting[record.id]}
                  onClick={() => handleIngest(record.id)}
                  disabled={!record.is_active}
                />
              </Tooltip>
              <Tooltip title="Edit">
                <Button
                  icon={<EditOutlined />}
                  size="small"
                  onClick={() => handleEdit(record)}
                />
              </Tooltip>
              <Tooltip title="Delete">
                <Button
                  icon={<DeleteOutlined />}
                  size="small"
                  danger
                  onClick={() => showDeleteConfirm(record.id)}
                />
              </Tooltip>
            </>
          ) : (
            <Tag icon={<EyeOutlined />}>View Only</Tag>
          )}
        </Space>
      ),
    },
  ];

  const getRelativeTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="sources-container">
      {/* Compact Header */}
      <div className="sources-header" style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={3} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: 22 }}>
            <SyncOutlined /> Feed Sources
          </Title>
          <Text type="secondary" style={{ fontSize: 14 }}>
            {isAdmin ? 'Manage RSS/Atom feeds' : 'View feed sources'}
          </Text>
        </div>
        <Space>
          <Tooltip title="Refresh Settings">
            <Button
              size="small"
              icon={<ClockCircleOutlined />}
              onClick={() => setRefreshSettingsVisible(true)}
            >
              Refresh Settings
            </Button>
          </Tooltip>
          {isAdmin && (
            <>
              <Button
                size="small"
                icon={<ReloadOutlined />}
                onClick={handleIngestAll}
                loading={ingestingAll}
              >
                Fetch All
              </Button>
              <Button
                size="small"
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleCreate}
              >
                Add Source
              </Button>
            </>
          )}
        </Space>
      </div>

      {/* Stats Row - Matching Intelligence view style */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col span={4}>
          <Card size="small" className="stat-card-slim" hoverable onClick={() => navigate('/articles')} style={{ cursor: 'pointer' }}>
            <Statistic 
              title="Sources" 
              value={stats.total_sources} 
              prefix={<SyncOutlined />}
              valueStyle={{ fontSize: 24 }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" className="stat-card-slim" style={{ cursor: 'default' }}>
            <Statistic 
              title="Active" 
              value={stats.active_sources} 
              prefix={<CheckCircleOutlined />}
              valueStyle={{ fontSize: 24, color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" className="stat-card-slim" hoverable onClick={() => navigate('/articles')} style={{ cursor: 'pointer' }}>
            <Statistic 
              title="Articles" 
              value={stats.total_articles} 
              prefix={<FileTextOutlined />}
              valueStyle={{ fontSize: 24, color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" className="stat-card-slim" hoverable onClick={() => navigate('/articles?status=NEW')} style={{ cursor: 'pointer' }}>
            <Statistic 
              title="New" 
              value={stats.new_articles} 
              prefix={<Badge status="processing" />}
              valueStyle={{ fontSize: 24, color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" className="stat-card-slim" hoverable onClick={() => navigate('/articles?status=REVIEWED')} style={{ cursor: 'pointer' }}>
            <Statistic 
              title="Reviewed" 
              value={stats.reviewed_articles} 
              prefix={<EyeOutlined />}
              valueStyle={{ fontSize: 24, color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" className="stat-card-slim" hoverable onClick={() => navigate('/articles?high_priority=true')} style={{ cursor: 'pointer' }}>
            <Statistic 
              title="Priority" 
              value={stats.high_priority_articles} 
              prefix={<WarningOutlined />}
              valueStyle={{ fontSize: 24, color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Last Ingestion Result */}
      {lastIngestResult && (
        <Alert
          type="success"
          showIcon
          closable
          onClose={() => setLastIngestResult(null)}
          style={{ marginBottom: 16 }}
          message={`Ingestion Complete: ${lastIngestResult.total_new_articles} new articles (${lastIngestResult.total_high_priority} high priority)`}
          description={
            <Space wrap>
              {lastIngestResult.results?.map((r, i) => (
                <Tag 
                  key={i} 
                  color={r.status === 'success' ? 'green' : 'red'}
                >
                  {r.source_name}: {r.new_articles} new
                </Tag>
              ))}
            </Space>
          }
        />
      )}

      <Card size="small" bodyStyle={{ padding: 0 }}>
        <Table
          columns={columns}
          dataSource={sources}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 15, showSizeChanger: true, size: 'small' }}
          size="small"
          scroll={{ x: 900 }}
        />
      </Card>

      <Modal
        title={editingSource ? 'Edit Source' : 'Add Feed Source'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="name"
            label="Source Name"
            rules={[{ required: true, message: 'Please enter source name' }]}
          >
            <Input placeholder="e.g., CISA Alerts" />
          </Form.Item>

          <Form.Item
            name="url"
            label="Feed URL"
            rules={[
              { required: true, message: 'Please enter feed URL' },
              { type: 'url', message: 'Please enter a valid URL' }
            ]}
          >
            <Input placeholder="https://www.cisa.gov/uscert/ncas/alerts.xml" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="feed_type"
                label="Feed Type"
                initialValue="rss"
              >
                <Select>
                  <Option value="rss">RSS</Option>
                  <Option value="atom">Atom</Option>
                  <Option value="json">JSON Feed</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="is_active"
                label="Active"
                valuePropName="checked"
                initialValue={true}
              >
                <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="description"
            label="Description"
          >
            <TextArea rows={2} placeholder="Brief description of this feed source" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setModalVisible(false)}>
                Cancel
              </Button>
              <Button type="primary" htmlType="submit">
                {editingSource ? 'Update Source' : 'Add Source'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        title="Delete Feed Source"
        open={deleteModalVisible}
        onCancel={() => {
          setDeleteModalVisible(false);
          setDeleteSourceId(null);
        }}
        onOk={handleDelete}
        okText="Delete"
        okType="danger"
        okButtonProps={{ danger: true }}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <p>Are you sure you want to delete this feed source?</p>
          <Checkbox
            checked={deleteWithArticles}
            onChange={(e) => setDeleteWithArticles(e.target.checked)}
          >
            <span style={{ color: '#ff4d4f' }}>
              Also delete all articles from this source
            </span>
          </Checkbox>
          <Alert
            type="warning"
            message={
              deleteWithArticles
                ? "All articles from this source will be permanently deleted!"
                : "Articles will be kept but marked as orphaned (no source)."
            }
            showIcon
          />
        </Space>
      </Modal>

      {/* Refresh Settings Modal */}
      <SourceRefreshSettings 
        visible={refreshSettingsVisible}
        onClose={() => setRefreshSettingsVisible(false)}
      />
    </div>
  );
}

export default Sources;
