import React, { useState, useEffect } from 'react';
import {
  Card, Table, Button, Space, Tag, Modal, Form, Input, Select, Switch,
  Upload, Typography, Alert, Spin, message, Popconfirm, Tooltip, Progress,
  Row, Col, Statistic, Badge, Tabs, Collapse, Empty, Drawer, List, Divider
} from 'antd';
import {
  CloudUploadOutlined, LinkOutlined, DeleteOutlined, ReloadOutlined,
  FileTextOutlined, FilePdfOutlined, FileExcelOutlined, FileWordOutlined,
  GlobalOutlined, SearchOutlined, EyeOutlined, CheckCircleOutlined,
  ClockCircleOutlined, WarningOutlined, BookOutlined, DatabaseOutlined,
  InboxOutlined, SyncOutlined, EditOutlined, QuestionCircleOutlined,
  LinkOutlined as CrawlLinkOutlined, BlockOutlined
} from '@ant-design/icons';
import { knowledgeAPI } from '../api/client';
import './KnowledgeBaseManager.css';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;
const { Panel } = Collapse;
const { Dragger } = Upload;

const DOC_TYPE_OPTIONS = [
  { value: 'product_documentation', label: 'Product Documentation', color: 'blue' },
  { value: 'query_syntax', label: 'Query Syntax Guide', color: 'purple' },
  { value: 'threat_intel', label: 'Threat Intelligence', color: 'red' },
  { value: 'playbook', label: 'Playbook', color: 'green' },
  { value: 'policy', label: 'Policy/Procedure', color: 'orange' },
  { value: 'custom', label: 'Custom Document', color: 'default' },
];

const PLATFORM_OPTIONS = [
  'xsiam', 'defender', 'splunk', 'wiz', 'virustotal', 'vmray'
];

const FUNCTION_OPTIONS = [
  'ioc_extraction', 'ttp_extraction', 'hunt_query_xsiam', 'hunt_query_defender',
  'hunt_query_splunk', 'hunt_query_wiz', 'executive_summary', 'technical_summary'
];

const STATUS_ICONS = {
  PENDING: <ClockCircleOutlined style={{ color: '#faad14' }} />,
  CRAWLING: <SyncOutlined spin style={{ color: '#1890ff' }} />,
  PROCESSING: <Spin size="small" />,
  READY: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
  FAILED: <WarningOutlined style={{ color: '#ff4d4f' }} />,
};

const STATUS_LABELS = {
  PENDING: 'Waiting to process',
  CRAWLING: 'Crawling website...',
  PROCESSING: 'Processing content...',
  READY: 'Ready for use',
  FAILED: 'Processing failed',
};

function KnowledgeBaseManager() {
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState([]);
  const [stats, setStats] = useState(null);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploadMode, setUploadMode] = useState('file'); // 'file' or 'url'
  const [uploading, setUploading] = useState(false);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [contentDrawerVisible, setContentDrawerVisible] = useState(false);
  const [docContent, setDocContent] = useState(null);
  const [filterStatus, setFilterStatus] = useState(null);
  const [filterType, setFilterType] = useState(null);
  
  // Edit modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // Crawled URLs modal state
  const [crawledUrlsModalVisible, setCrawledUrlsModalVisible] = useState(false);
  const [crawledUrls, setCrawledUrls] = useState([]);
  const [crawledUrlsLoading, setCrawledUrlsLoading] = useState(false);
  const [crawledDocTitle, setCrawledDocTitle] = useState('');
  
  // All Chunks drawer state
  const [chunksDrawerVisible, setChunksDrawerVisible] = useState(false);
  const [allChunks, setAllChunks] = useState([]);
  const [chunksLoading, setChunksLoading] = useState(false);
  const [chunksPage, setChunksPage] = useState(1);
  const [chunksTotalPages, setChunksTotalPages] = useState(1);
  const [chunksTotal, setChunksTotal] = useState(0);
  const [chunksSearch, setChunksSearch] = useState('');
  const [chunksDocFilter, setChunksDocFilter] = useState(null);

  useEffect(() => {
    loadDocuments();
    loadStats();
  }, [filterStatus, filterType]);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const response = await knowledgeAPI.list(filterType, filterStatus);
      setDocuments(response.data || []);
    } catch (error) {
      message.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await knowledgeAPI.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleUpload = async (values) => {
    setUploading(true);
    try {
      if (uploadMode === 'file' && values.file) {
        const formData = new FormData();
        formData.append('file', values.file.file.originFileObj);
        formData.append('title', values.title);
        formData.append('description', values.description || '');
        formData.append('doc_type', values.doc_type || 'custom');
        formData.append('priority', values.priority || 5);
        formData.append('target_functions', JSON.stringify(values.target_functions || []));
        formData.append('target_platforms', JSON.stringify(values.target_platforms || []));
        formData.append('tags', JSON.stringify(values.tags || []));
        formData.append('auto_process', 'true');
        
        await knowledgeAPI.uploadFile(formData);
        message.success('Document uploaded and processing started');
      } else if (uploadMode === 'url') {
        // Use crawl endpoint for URLs with depth, or regular upload for single pages
        const crawlDepth = values.crawl_depth || 0;
        const maxPages = values.max_pages || 20;
        
        if (crawlDepth > 0) {
          // Use crawl endpoint for deep crawling
          await knowledgeAPI.crawl(
            values.source_url,
            values.title,
            crawlDepth,
            maxPages,
            {
              docType: values.doc_type || 'product_documentation',
              targetFunctions: values.target_functions,
              targetPlatforms: values.target_platforms,
              tags: values.tags,
              priority: values.priority || 5
            }
          );
          message.success(`Crawl started! Fetching up to ${maxPages} pages with depth ${crawlDepth}`);
        } else {
          // Single page - use upload URL endpoint
          await knowledgeAPI.uploadUrl({
            title: values.title,
            source_url: values.source_url,
            description: values.description,
            doc_type: values.doc_type || 'custom',
            target_functions: values.target_functions,
            target_platforms: values.target_platforms,
            tags: values.tags,
            priority: values.priority || 5,
            crawl_depth: 0,
            max_pages: 1
          });
          message.success('URL added and processing started');
        }
      }
      
      setUploadModalVisible(false);
      form.resetFields();
      loadDocuments();
      loadStats();
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Upload failed';
      if (errorMsg.includes('already exists')) {
        message.error(`Duplicate detected: ${errorMsg}`);
      } else {
        message.error(errorMsg);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc) => {
    try {
      message.loading({ content: 'Deleting document...', key: 'delete' });
      await knowledgeAPI.delete(doc.id);
      message.success({ content: 'Document deleted', key: 'delete' });
      loadDocuments();
      loadStats();
    } catch (error) {
      console.error('Delete failed:', error);
      const errorMsg = error.response?.data?.detail || 'Failed to delete document';
      message.error({ content: errorMsg, key: 'delete' });
    }
  };

  // Fix stuck documents (reset PROCESSING/CRAWLING to PENDING or FAILED)
  const handleFixStuck = async (doc) => {
    try {
      message.loading({ content: 'Resetting document status...', key: 'fix' });
      await knowledgeAPI.update(doc.id, { status: 'FAILED' });
      message.success({ content: 'Document status reset. You can reprocess it now.', key: 'fix' });
      loadDocuments();
    } catch (error) {
      message.error({ content: 'Failed to fix document status', key: 'fix' });
    }
  };

  const handleReprocess = async (doc) => {
    try {
      await knowledgeAPI.process(doc.id);
      message.success('Reprocessing started');
      loadDocuments();
    } catch (error) {
      message.error('Failed to reprocess');
    }
  };

  const handleViewContent = async (doc) => {
    setSelectedDoc(doc);
    try {
      const response = await knowledgeAPI.getContent(doc.id);
      setDocContent(response.data);
      setContentDrawerVisible(true);
    } catch (error) {
      message.error('Failed to load content');
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setSearching(true);
    try {
      const response = await knowledgeAPI.search(searchQuery, null, null, 10);
      setSearchResults(response.data || []);
    } catch (error) {
      message.error('Search failed');
    } finally {
      setSearching(false);
    }
  };

  // Handle GitHub repository crawl
  const handleGitHubCrawl = async (values) => {
    setUploading(true);
    try {
      await knowledgeAPI.crawlGitHub(values.github_url, values.title, {
        description: values.description,
        includeCode: values.include_code ?? true,
        includeDocs: values.include_docs ?? true,
        maxFiles: values.max_files || 100,
        docType: values.doc_type,
        targetPlatforms: values.target_platforms,
        tags: values.tags || ['github', 'code'],
        priority: values.priority || 5
      });
      
      message.success('GitHub crawl started! The repository will be processed in the background.');
      form.resetFields();
      setUploadModalVisible(false);
      loadDocuments();
      loadStats();
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'GitHub crawl failed';
      message.error(errorMsg);
    } finally {
      setUploading(false);
    }
  };

  const handleToggleActive = async (doc, isActive) => {
    try {
      await knowledgeAPI.update(doc.id, { is_active: isActive });
      loadDocuments();
    } catch (error) {
      message.error('Failed to update');
    }
  };

  // Edit document handler
  const handleEdit = (doc) => {
    setEditingDoc(doc);
    editForm.setFieldsValue({
      title: doc.title,
      description: doc.description,
      doc_type: doc.doc_type,
      priority: doc.priority,
      target_platforms: doc.target_platforms || [],
      target_functions: doc.target_functions || [],
      tags: doc.tags || [],
      is_active: doc.is_active
    });
    setEditModalVisible(true);
  };

  const handleSaveEdit = async (values) => {
    if (!editingDoc) return;
    setSaving(true);
    try {
      await knowledgeAPI.update(editingDoc.id, {
        title: values.title,
        description: values.description,
        target_platforms: values.target_platforms,
        target_functions: values.target_functions,
        tags: values.tags,
        priority: values.priority,
        is_active: values.is_active
      });
      message.success('Document updated successfully');
      setEditModalVisible(false);
      setEditingDoc(null);
      editForm.resetFields();
      loadDocuments();
    } catch (error) {
      message.error(error.response?.data?.detail || 'Failed to update document');
    } finally {
      setSaving(false);
    }
  };

  // Crawled URLs handler
  const handleViewCrawledUrls = async (doc) => {
    setCrawledDocTitle(doc.title);
    setCrawledUrlsLoading(true);
    setCrawledUrlsModalVisible(true);
    try {
      const response = await knowledgeAPI.getContent(doc.id);
      setCrawledUrls(response.data?.crawled_urls || []);
    } catch (error) {
      message.error('Failed to load crawled URLs');
      setCrawledUrls([]);
    } finally {
      setCrawledUrlsLoading(false);
    }
  };

  // All chunks management
  const loadAllChunks = async (page = 1, search = '', docFilter = null) => {
    setChunksLoading(true);
    try {
      const response = await knowledgeAPI.getAllChunks(page, 50, docFilter, search || null);
      setAllChunks(response.data?.chunks || []);
      setChunksTotalPages(response.data?.total_pages || 1);
      setChunksTotal(response.data?.total || 0);
      setChunksPage(page);
    } catch (error) {
      message.error('Failed to load chunks');
      setAllChunks([]);
    } finally {
      setChunksLoading(false);
    }
  };

  const handleOpenChunksDrawer = () => {
    setChunksDrawerVisible(true);
    loadAllChunks(1, '', null);
  };

  const handleDeleteChunk = async (chunkId) => {
    try {
      await knowledgeAPI.deleteChunk(chunkId);
      message.success('Chunk deleted');
      loadAllChunks(chunksPage, chunksSearch, chunksDocFilter);
      loadStats();
    } catch (error) {
      message.error('Failed to delete chunk');
    }
  };

  const getFileIcon = (fileName) => {
    if (!fileName) return <FileTextOutlined />;
    const ext = fileName.split('.').pop().toLowerCase();
    switch (ext) {
      case 'pdf': return <FilePdfOutlined style={{ color: '#ff4d4f' }} />;
      case 'docx':
      case 'doc': return <FileWordOutlined style={{ color: '#1890ff' }} />;
      case 'xlsx':
      case 'xls':
      case 'csv': return <FileExcelOutlined style={{ color: '#52c41a' }} />;
      default: return <FileTextOutlined />;
    }
  };

  const columns = [
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status) => (
        <Tooltip title={STATUS_LABELS[status] || status}>
          <Space size={4}>
            {STATUS_ICONS[status] || <ClockCircleOutlined />}
            {status === 'CRAWLING' && <Text style={{ fontSize: 10 }}>Crawling</Text>}
          </Space>
        </Tooltip>
      )
    },
    {
      title: 'Scope',
      key: 'scope',
      width: 80,
      render: (_, record) => (
        <Tooltip title={record.is_admin_managed ? 'Admin-managed global knowledge' : 'User-uploaded personal knowledge'}>
          <Tag color={record.is_admin_managed ? 'blue' : 'green'}>
            {record.is_admin_managed ? 'Global' : 'User'}
          </Tag>
        </Tooltip>
      )
    },
    {
      title: 'Document',
      key: 'document',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Space>
            {record.source_type === 'url' ? 
              <GlobalOutlined style={{ color: '#1890ff' }} /> : 
              getFileIcon(record.file_name)
            }
            <Text strong style={{ maxWidth: 280 }} ellipsis>
              {record.title}
            </Text>
            {record.crawl_depth > 0 && (
              <Tooltip title="Click to see crawled URLs">
                <Tag 
                  size="small" 
                  color="cyan" 
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleViewCrawledUrls(record)}
                >
                  <CrawlLinkOutlined /> Depth: {record.crawl_depth}
                </Tag>
              </Tooltip>
            )}
          </Space>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {record.file_name || record.source_url?.substring(0, 40)}
            {record.pages_crawled > 0 && ` (${record.pages_crawled} pages crawled)`}
          </Text>
        </Space>
      )
    },
    {
      title: 'Type',
      dataIndex: 'doc_type',
      key: 'doc_type',
      width: 130,
      render: (type) => {
        const option = DOC_TYPE_OPTIONS.find(o => o.value === type);
        return <Tag color={option?.color || 'default'}>{option?.label || type}</Tag>;
      }
    },
    {
      title: (
        <Space>
          Chunks
          <Tooltip 
            title={
              <div>
                <strong>What are Chunks?</strong>
                <p style={{ margin: '4px 0' }}>
                  Documents are split into smaller pieces called "chunks" for AI processing. 
                  Each chunk contains a portion of the document that can be efficiently 
                  searched and used by GenAI for context-aware responses.
                </p>
                <p style={{ margin: '4px 0' }}>
                  More chunks = more granular retrieval = better AI responses.
                </p>
              </div>
            }
          >
            <QuestionCircleOutlined style={{ color: '#8c8c8c', cursor: 'help' }} />
          </Tooltip>
        </Space>
      ),
      dataIndex: 'chunk_count',
      key: 'chunks',
      width: 80,
      render: (count) => (
        <Tooltip title={`${count} searchable text segments`}>
          <Badge count={count} showZero style={{ backgroundColor: count > 0 ? '#52c41a' : '#d9d9d9' }} />
        </Tooltip>
      )
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      width: 60,
      render: (p) => (
        <Tag color={p >= 8 ? 'red' : p >= 5 ? 'orange' : 'default'}>{p}/10</Tag>
      )
    },
    {
      title: 'Usage',
      dataIndex: 'usage_count',
      key: 'usage',
      width: 60,
      render: (count) => <Text type="secondary">{count || 0}</Text>
    },
    {
      title: 'Active',
      dataIndex: 'is_active',
      key: 'active',
      width: 60,
      render: (active, record) => (
        <Switch 
          checked={active} 
          size="small"
          onChange={(val) => handleToggleActive(record, val)}
        />
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 180,
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="View Content">
            <Button size="small" icon={<EyeOutlined />} onClick={() => handleViewContent(record)} />
          </Tooltip>
          <Tooltip title="Edit">
            <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          </Tooltip>
          <Tooltip title="Reprocess">
            <Button 
              size="small" 
              icon={<ReloadOutlined />} 
              onClick={() => handleReprocess(record)}
              disabled={record.status === 'PROCESSING' || record.status === 'CRAWLING'}
            />
          </Tooltip>
          {(record.status === 'PROCESSING' || record.status === 'CRAWLING') && (
            <Tooltip title="Reset stuck status">
              <Button 
                size="small" 
                icon={<WarningOutlined />}
                onClick={() => handleFixStuck(record)}
                style={{ color: '#fa8c16' }}
              />
            </Tooltip>
          )}
          <Popconfirm 
            title="Delete this document?" 
            description="This will also delete all associated chunks."
            onConfirm={() => handleDelete(record)}
            okText="Delete"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="Delete">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      )
    },
  ];

  return (
    <div>
      {/* Stats Cards */}
      {stats && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="Total Documents"
                value={stats.total_documents}
                prefix={<BookOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="Ready for RAG"
                value={stats.ready_documents}
                prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="Total Chunks"
                value={stats.total_chunks}
                prefix={<DatabaseOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="Total Usage"
                value={stats.total_usage}
                prefix={<SearchOutlined />}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Info Alert */}
      <Alert
        type="info"
        showIcon
        icon={<BookOutlined />}
        message="Knowledge Base for Agentic AI (RAG)"
        description="Upload product documentation, query syntax guides, and reference materials. GenAI will use this knowledge base alongside its training to generate more accurate and customized queries, summaries, and analysis."
        style={{ marginBottom: 16 }}
        action={
          <Button type="primary" onClick={() => setUploadModalVisible(true)}>
            Upload Document
          </Button>
        }
      />

      {/* Search Section */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={16}>
            <Input.Search
              placeholder="Test RAG search: Enter a query to see what knowledge will be retrieved..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onSearch={handleSearch}
              loading={searching}
              enterButton={<><SearchOutlined /> Test Search</>}
            />
          </Col>
          <Col span={4}>
            <Select
              placeholder="Filter by Status"
              allowClear
              style={{ width: '100%' }}
              value={filterStatus}
              onChange={setFilterStatus}
            >
              <Option value="READY">Ready</Option>
              <Option value="PENDING">Pending</Option>
              <Option value="PROCESSING">Processing</Option>
              <Option value="FAILED">Failed</Option>
            </Select>
          </Col>
          <Col span={4}>
            <Select
              placeholder="Filter by Type"
              allowClear
              style={{ width: '100%' }}
              value={filterType}
              onChange={setFilterType}
            >
              {DOC_TYPE_OPTIONS.map(opt => (
                <Option key={opt.value} value={opt.value}>{opt.label}</Option>
              ))}
            </Select>
          </Col>
        </Row>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Text strong>Search Results ({searchResults.length}):</Text>
            <Collapse style={{ marginTop: 8 }}>
              {searchResults.map((result, idx) => (
                <Panel 
                  key={idx}
                  header={
                    <Space>
                      <Tag color="blue">{Math.round(result.similarity * 100)}% match</Tag>
                      <Text>{result.document_title}</Text>
                    </Space>
                  }
                >
                  <Text style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>
                    {result.content}
                  </Text>
                </Panel>
              ))}
            </Collapse>
          </div>
        )}
      </Card>

      {/* Documents Table */}
      <Card 
        title={<Space><BookOutlined /> Knowledge Documents</Space>}
        extra={
          <Space>
            <Tooltip title="View and manage all text chunks across documents">
              <Button icon={<BlockOutlined />} onClick={handleOpenChunksDrawer}>
                View Chunks
              </Button>
            </Tooltip>
            {documents.some(d => d.status === 'PROCESSING' || d.status === 'CRAWLING') && (
              <Tooltip title="Reset all stuck documents (Processing/Crawling) to Failed status">
                <Button 
                  icon={<WarningOutlined />} 
                  onClick={async () => {
                    const stuckDocs = documents.filter(d => d.status === 'PROCESSING' || d.status === 'CRAWLING');
                    message.loading({ content: `Resetting ${stuckDocs.length} stuck documents...`, key: 'fix-all' });
                    for (const doc of stuckDocs) {
                      try {
                        await knowledgeAPI.update(doc.id, { status: 'FAILED' });
                      } catch (e) {
                        console.error(`Failed to reset doc ${doc.id}`, e);
                      }
                    }
                    message.success({ content: `Reset ${stuckDocs.length} documents`, key: 'fix-all' });
                    loadDocuments();
                  }}
                  style={{ color: '#fa8c16' }}
                >
                  Fix Stuck ({documents.filter(d => d.status === 'PROCESSING' || d.status === 'CRAWLING').length})
                </Button>
              </Tooltip>
            )}
            <Button icon={<ReloadOutlined />} onClick={loadDocuments}>Refresh</Button>
            <Button type="primary" icon={<CloudUploadOutlined />} onClick={() => setUploadModalVisible(true)}>
              Add Document
            </Button>
          </Space>
        }
      >
        <Table
          loading={loading}
          dataSource={documents}
          columns={columns}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 20, showSizeChanger: true }}
        />
      </Card>

      {/* Upload Modal */}
      <Modal
        title={<Space><CloudUploadOutlined /> Add Knowledge Document</Space>}
        open={uploadModalVisible}
        onCancel={() => {
          setUploadModalVisible(false);
          form.resetFields();
        }}
        footer={null}
        width={700}
      >
        <Tabs
          activeKey={uploadMode}
          onChange={setUploadMode}
          items={[
            {
              key: 'file',
              label: <span><InboxOutlined /> Upload File</span>,
              children: (
                <Form form={form} layout="vertical" onFinish={handleUpload}>
                  <Form.Item
                    name="file"
                    label="Document File"
                    rules={[{ required: uploadMode === 'file', message: 'Please upload a file' }]}
                  >
                    <Dragger
                      maxCount={1}
                      beforeUpload={() => false}
                      accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.md,.json"
                    >
                      <p className="ant-upload-drag-icon"><InboxOutlined /></p>
                      <p className="ant-upload-text">Click or drag file to upload</p>
                      <p className="ant-upload-hint">
                        Supports PDF, Word, Excel, CSV, Text, Markdown, JSON
                      </p>
                    </Dragger>
                  </Form.Item>
                  
                  <Form.Item
                    name="title"
                    label="Title"
                    rules={[{ required: true, message: 'Title is required' }]}
                  >
                    <Input placeholder="e.g., Microsoft Defender KQL Syntax Guide" />
                  </Form.Item>
                  
                  <Form.Item name="description" label="Description">
                    <TextArea rows={2} placeholder="Brief description of this document..." />
                  </Form.Item>
                  
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item name="doc_type" label="Document Type" initialValue="custom">
                        <Select>
                          {DOC_TYPE_OPTIONS.map(opt => (
                            <Option key={opt.value} value={opt.value}>{opt.label}</Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="priority" label="Priority (1-10)" initialValue={5}>
                        <Select>
                          {[1,2,3,4,5,6,7,8,9,10].map(n => (
                            <Option key={n} value={n}>{n} {n >= 8 ? '(High)' : n <= 3 ? '(Low)' : ''}</Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>
                  
                  <Form.Item name="target_platforms" label="Target Platforms (optional)">
                    <Select mode="multiple" placeholder="Select platforms this document applies to">
                      {PLATFORM_OPTIONS.map(p => (
                        <Option key={p} value={p}>{p.toUpperCase()}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                  
                  <Form.Item name="target_functions" label="Target Functions (optional)">
                    <Select mode="multiple" placeholder="Select GenAI functions this document supports">
                      {FUNCTION_OPTIONS.map(f => (
                        <Option key={f} value={f}>{f.replace(/_/g, ' ').toUpperCase()}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                  
                  <Form.Item name="tags" label="Tags">
                    <Select mode="tags" placeholder="Add tags for better retrieval">
                      <Option value="kql">KQL</Option>
                      <Option value="xql">XQL</Option>
                      <Option value="spl">SPL</Option>
                      <Option value="detection">Detection</Option>
                      <Option value="hunting">Hunting</Option>
                    </Select>
                  </Form.Item>
                  
                  <Form.Item>
                    <Button type="primary" htmlType="submit" loading={uploading} block>
                      Upload & Process
                    </Button>
                  </Form.Item>
                </Form>
              )
            },
            {
              key: 'url',
              label: <span><LinkOutlined /> Add URL / Crawl</span>,
              children: (
                <Form form={form} layout="vertical" onFinish={handleUpload}>
                  <Form.Item
                    name="source_url"
                    label="URL"
                    rules={[
                      { required: uploadMode === 'url', message: 'URL is required' },
                      { type: 'url', message: 'Please enter a valid URL' }
                    ]}
                  >
                    <Input placeholder="https://docs.microsoft.com/en-us/..." />
                  </Form.Item>
                  
                  <Form.Item
                    name="title"
                    label="Title"
                    rules={[{ required: true, message: 'Title is required' }]}
                  >
                    <Input placeholder="e.g., Microsoft Defender Advanced Hunting Reference" />
                  </Form.Item>
                  
                  <Form.Item name="description" label="Description">
                    <TextArea rows={2} placeholder="Brief description of this content..." />
                  </Form.Item>
                  
                  {/* Crawl Options */}
                  <Card size="small" style={{ marginBottom: 16, background: '#f6ffed' }}>
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item 
                          name="crawl_depth" 
                          label="Crawl Depth" 
                          initialValue={0}
                          tooltip="0 = Single page only, 1 = Page + linked pages, 2 = Deeper crawl"
                        >
                          <Select>
                            <Option value={0}>0 - Single Page Only</Option>
                            <Option value={1}>1 - Page + Links</Option>
                            <Option value={2}>2 - Deep Crawl</Option>
                            <Option value={3}>3 - Very Deep</Option>
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item 
                          name="max_pages" 
                          label="Max Pages" 
                          initialValue={20}
                          tooltip="Maximum number of pages to crawl"
                        >
                          <Select>
                            <Option value={10}>10 pages</Option>
                            <Option value={20}>20 pages</Option>
                            <Option value={50}>50 pages</Option>
                            <Option value={100}>100 pages</Option>
                          </Select>
                        </Form.Item>
                      </Col>
                    </Row>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      💡 With depth &gt; 0, the crawler will follow links on the page and add all content to the knowledge base.
                    </Text>
                  </Card>
                  
                  {/* Authentication Options for Protected Sites */}
                  <Collapse size="small" style={{ marginBottom: 16 }}>
                    <Panel 
                      header={
                        <Space>
                          <span>🔐 Authentication (for protected sites)</span>
                          <Tag color="orange">Optional</Tag>
                        </Space>
                      } 
                      key="auth"
                    >
                      <Alert
                        type="info"
                        message="For sites requiring login"
                        description="Enter credentials or use browser session to authenticate before crawling."
                        style={{ marginBottom: 12 }}
                        showIcon
                      />
                      
                      <Form.Item name="auth_type" label="Authentication Method">
                        <Select placeholder="Select authentication method" allowClear>
                          <Option value="none">None (Public URL)</Option>
                          <Option value="basic">Basic Auth (Username/Password)</Option>
                          <Option value="bearer">Bearer Token</Option>
                          <Option value="session">Browser Session (Manual Login)</Option>
                        </Select>
                      </Form.Item>
                      
                      <Form.Item 
                        noStyle 
                        shouldUpdate={(prev, curr) => prev.auth_type !== curr.auth_type}
                      >
                        {({ getFieldValue }) => {
                          const authType = getFieldValue('auth_type');
                          
                          if (authType === 'basic') {
                            return (
                              <Row gutter={16}>
                                <Col span={12}>
                                  <Form.Item name="auth_username" label="Username">
                                    <Input placeholder="Username" autoComplete="off" />
                                  </Form.Item>
                                </Col>
                                <Col span={12}>
                                  <Form.Item name="auth_password" label="Password">
                                    <Input.Password placeholder="Password" autoComplete="off" />
                                  </Form.Item>
                                </Col>
                              </Row>
                            );
                          }
                          
                          if (authType === 'bearer') {
                            return (
                              <Form.Item name="auth_token" label="Bearer Token">
                                <Input.Password placeholder="Enter bearer token" autoComplete="off" />
                              </Form.Item>
                            );
                          }
                          
                          if (authType === 'session') {
                            return (
                              <Space direction="vertical" style={{ width: '100%' }}>
                                <Alert
                                  type="warning"
                                  message="Browser Session Authentication"
                                  description={
                                    <div>
                                      <p>For sites requiring MFA or complex login:</p>
                                      <ol style={{ marginBottom: 0, paddingLeft: 20 }}>
                                        <li>Click "Open Login Page" to open the URL in a new tab</li>
                                        <li>Complete the login process (including MFA if required)</li>
                                        <li>Once logged in, return here and click "Crawl Now"</li>
                                      </ol>
                                      <Text type="secondary" style={{ fontSize: 11 }}>
                                        Note: Session-based crawling works best with cookies stored in your browser.
                                      </Text>
                                    </div>
                                  }
                                />
                                <Button 
                                  type="primary"
                                  ghost
                                  onClick={() => {
                                    const url = form.getFieldValue('source_url');
                                    if (url) {
                                      window.open(url, '_blank');
                                      message.info('Complete login in the new tab, then return here to crawl.');
                                    } else {
                                      message.warning('Please enter a URL first');
                                    }
                                  }}
                                >
                                  Open Login Page
                                </Button>
                              </Space>
                            );
                          }
                          
                          return null;
                        }}
                      </Form.Item>
                    </Panel>
                  </Collapse>
                  
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item name="doc_type" label="Document Type" initialValue="product_documentation">
                        <Select>
                          {DOC_TYPE_OPTIONS.map(opt => (
                            <Option key={opt.value} value={opt.value}>{opt.label}</Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="priority" label="Priority (1-10)" initialValue={5}>
                        <Select>
                          {[1,2,3,4,5,6,7,8,9,10].map(n => (
                            <Option key={n} value={n}>{n}</Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>
                  
                  <Form.Item name="target_platforms" label="Target Platforms (optional)">
                    <Select mode="multiple" placeholder="Select platforms">
                      {PLATFORM_OPTIONS.map(p => (
                        <Option key={p} value={p}>{p.toUpperCase()}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                  
                  <Form.Item>
                    <Button type="primary" htmlType="submit" loading={uploading} block>
                      Add URL & Process
                    </Button>
                  </Form.Item>
                </Form>
              )
            },
            {
              key: 'github',
              label: <span><DatabaseOutlined /> GitHub Repo</span>,
              children: (
                <Form form={form} layout="vertical" onFinish={handleGitHubCrawl}>
                  <Alert
                    message="GitHub Repository Crawler"
                    description="Crawl a GitHub repository to add its code and documentation to the knowledge base. Perfect for adding your organization's internal tools, security projects, or HuntSphere customizations."
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                  />
                  
                  <Form.Item
                    name="github_url"
                    label="GitHub Repository URL"
                    rules={[
                      { required: uploadMode === 'github', message: 'GitHub URL is required' },
                      { 
                        pattern: /github\.com\/[^/]+\/[^/]+/,
                        message: 'Please enter a valid GitHub repository URL'
                      }
                    ]}
                  >
                    <Input placeholder="https://github.com/org/repo or https://github.com/org/repo/tree/main/path" />
                  </Form.Item>
                  
                  <Form.Item
                    name="title"
                    label="Title"
                    rules={[{ required: true, message: 'Title is required' }]}
                  >
                    <Input placeholder="e.g., HuntSphere Threat Intelligence Platform" />
                  </Form.Item>
                  
                  <Form.Item name="description" label="Description">
                    <TextArea rows={2} placeholder="Brief description of this repository..." />
                  </Form.Item>
                  
                  <Card size="small" style={{ marginBottom: 16, background: '#f0f5ff' }}>
                    <Row gutter={16}>
                      <Col span={8}>
                        <Form.Item 
                          name="include_code" 
                          label="Include Code"
                          valuePropName="checked"
                          initialValue={true}
                        >
                          <Switch defaultChecked />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item 
                          name="include_docs" 
                          label="Include Docs"
                          valuePropName="checked"
                          initialValue={true}
                        >
                          <Switch defaultChecked />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item 
                          name="max_files" 
                          label="Max Files" 
                          initialValue={100}
                        >
                          <Select>
                            <Option value={50}>50 files</Option>
                            <Option value={100}>100 files</Option>
                            <Option value={200}>200 files</Option>
                            <Option value={300}>300 files</Option>
                          </Select>
                        </Form.Item>
                      </Col>
                    </Row>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      💡 The crawler will extract .py, .js, .ts, .md, .json, .yaml and other common files, skipping node_modules and __pycache__.
                    </Text>
                  </Card>
                  
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item name="doc_type" label="Document Type" initialValue="custom">
                        <Select>
                          {DOC_TYPE_OPTIONS.map(opt => (
                            <Option key={opt.value} value={opt.value}>{opt.label}</Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="priority" label="Priority (1-10)" initialValue={5}>
                        <Select>
                          {[1,2,3,4,5,6,7,8,9,10].map(n => (
                            <Option key={n} value={n}>{n} {n >= 8 ? '(High)' : n <= 3 ? '(Low)' : ''}</Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>
                  
                  <Form.Item name="target_platforms" label="Target Platforms (optional)">
                    <Select mode="multiple" placeholder="Select platforms this applies to">
                      {PLATFORM_OPTIONS.map(p => (
                        <Option key={p} value={p}>{p.toUpperCase()}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                  
                  <Form.Item name="tags" label="Tags">
                    <Select mode="tags" placeholder="Add tags" defaultValue={['github', 'code']}>
                      <Option value="github">github</Option>
                      <Option value="code">code</Option>
                      <Option value="internal">internal</Option>
                      <Option value="huntsphere">huntsphere</Option>
                    </Select>
                  </Form.Item>
                  
                  <Form.Item>
                    <Button type="primary" htmlType="submit" loading={uploading} block>
                      Crawl GitHub Repository
                    </Button>
                  </Form.Item>
                </Form>
              )
            }
          ]}
        />
      </Modal>

      {/* Content Drawer */}
      <Drawer
        title={<Space><EyeOutlined /> {selectedDoc?.title}</Space>}
        open={contentDrawerVisible}
        onClose={() => setContentDrawerVisible(false)}
        width={800}
      >
        {docContent && (
          <div>
            <Collapse defaultActiveKey={['info', 'chunks']}>
              <Panel header="Document Info" key="info">
                <Descriptions column={2} size="small">
                  <Descriptions.Item label="Status">
                    <Tag color={docContent.status === 'READY' ? 'green' : 'orange'}>
                      {selectedDoc?.status}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Chunks">{docContent.chunks?.length || 0}</Descriptions.Item>
                  <Descriptions.Item label="Content Length">
                    {docContent.raw_content_length?.toLocaleString()} chars
                  </Descriptions.Item>
                  {docContent.crawl_depth > 0 && (
                    <>
                      <Descriptions.Item label="Crawl Depth">{docContent.crawl_depth}</Descriptions.Item>
                      <Descriptions.Item label="Pages Crawled">{docContent.pages_crawled}</Descriptions.Item>
                    </>
                  )}
                </Descriptions>
              </Panel>
              
              {/* Crawled URLs Panel - only show for crawled documents */}
              {docContent.crawled_urls?.length > 0 && (
                <Panel header={`Crawled URLs (${docContent.crawled_urls.length})`} key="urls">
                  <List
                    size="small"
                    dataSource={docContent.crawled_urls}
                    renderItem={(url, idx) => (
                      <List.Item>
                        <a href={url} target="_blank" rel="noopener noreferrer">
                          {idx + 1}. {url}
                        </a>
                      </List.Item>
                    )}
                  />
                </Panel>
              )}
              
              <Panel header={`Raw Content (first 10,000 chars)`} key="content">
                <pre style={{ 
                  maxHeight: 300, 
                  overflow: 'auto', 
                  fontSize: 11,
                  background: '#f5f5f5',
                  padding: 12,
                  borderRadius: 4
                }}>
                  {docContent.raw_content || 'No content extracted'}
                </pre>
              </Panel>
              
              <Panel header={`Chunks (${docContent.chunks?.length || 0})`} key="chunks">
                {docContent.chunks?.map((chunk, idx) => (
                  <Card 
                    key={chunk.id || idx} 
                    size="small" 
                    style={{ marginBottom: 8 }}
                    title={
                      <Space>
                        <Tag>Chunk #{chunk.index + 1}</Tag>
                        <Text type="secondary">{chunk.token_count} tokens</Text>
                        {chunk.has_embedding && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
                      </Space>
                    }
                  >
                    <Text style={{ fontSize: 11, whiteSpace: 'pre-wrap' }}>
                      {chunk.content?.substring(0, 500)}
                      {chunk.content?.length > 500 ? '...' : ''}
                    </Text>
                  </Card>
                ))}
              </Panel>
            </Collapse>
          </div>
        )}
      </Drawer>

      {/* Edit Document Modal */}
      <Modal
        title={<Space><EditOutlined /> Edit Document</Space>}
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingDoc(null);
          editForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form form={editForm} layout="vertical" onFinish={handleSaveEdit}>
          <Form.Item
            name="title"
            label="Title"
            rules={[{ required: true, message: 'Title is required' }]}
          >
            <Input />
          </Form.Item>
          
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} />
          </Form.Item>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="priority" label="Priority (1-10)">
                <Select>
                  {[1,2,3,4,5,6,7,8,9,10].map(n => (
                    <Option key={n} value={n}>{n} {n >= 8 ? '(High)' : n <= 3 ? '(Low)' : ''}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="is_active" label="Active" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item name="target_platforms" label="Target Platforms">
            <Select mode="multiple" placeholder="Select platforms">
              {PLATFORM_OPTIONS.map(p => (
                <Option key={p} value={p}>{p.toUpperCase()}</Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item name="target_functions" label="Target Functions">
            <Select mode="multiple" placeholder="Select functions">
              {FUNCTION_OPTIONS.map(f => (
                <Option key={f} value={f}>{f.replace(/_/g, ' ').toUpperCase()}</Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item name="tags" label="Tags">
            <Select mode="tags" placeholder="Add tags">
              <Option value="kql">KQL</Option>
              <Option value="xql">XQL</Option>
              <Option value="spl">SPL</Option>
              <Option value="detection">Detection</Option>
              <Option value="hunting">Hunting</Option>
            </Select>
          </Form.Item>
          
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={saving}>
                Save Changes
              </Button>
              <Button onClick={() => {
                setEditModalVisible(false);
                setEditingDoc(null);
                editForm.resetFields();
              }}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Crawled URLs Modal */}
      <Modal
        title={<Space><CrawlLinkOutlined /> Crawled URLs for: {crawledDocTitle}</Space>}
        open={crawledUrlsModalVisible}
        onCancel={() => {
          setCrawledUrlsModalVisible(false);
          setCrawledUrls([]);
          setCrawledDocTitle('');
        }}
        footer={<Button onClick={() => setCrawledUrlsModalVisible(false)}>Close</Button>}
        width={700}
      >
        {crawledUrlsLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        ) : crawledUrls.length > 0 ? (
          <div>
            <Alert
              type="info"
              message={`${crawledUrls.length} pages were crawled and combined into this document`}
              style={{ marginBottom: 16 }}
            />
            <List
              size="small"
              bordered
              dataSource={crawledUrls}
              renderItem={(url, idx) => (
                <List.Item>
                  <Space>
                    <Tag>{idx + 1}</Tag>
                    <a href={url} target="_blank" rel="noopener noreferrer" style={{ wordBreak: 'break-all' }}>
                      {url}
                    </a>
                  </Space>
                </List.Item>
              )}
              style={{ maxHeight: 400, overflow: 'auto' }}
            />
          </div>
        ) : (
          <Empty description="No crawled URLs found. This might be a single-page document." />
        )}
      </Modal>

      {/* All Chunks Drawer */}
      <Drawer
        title={
          <Space>
            <BlockOutlined />
            All Chunks
            <Badge count={chunksTotal} style={{ backgroundColor: '#1890ff' }} />
          </Space>
        }
        open={chunksDrawerVisible}
        onClose={() => setChunksDrawerVisible(false)}
        width={900}
        extra={
          <Space>
            <Input.Search
              placeholder="Search chunk content..."
              allowClear
              style={{ width: 200 }}
              value={chunksSearch}
              onChange={(e) => setChunksSearch(e.target.value)}
              onSearch={(val) => loadAllChunks(1, val, chunksDocFilter)}
            />
            <Select
              placeholder="Filter by document"
              allowClear
              style={{ width: 200 }}
              value={chunksDocFilter}
              onChange={(val) => {
                setChunksDocFilter(val);
                loadAllChunks(1, chunksSearch, val);
              }}
            >
              {documents.map(doc => (
                <Option key={doc.id} value={doc.id}>{doc.title}</Option>
              ))}
            </Select>
          </Space>
        }
      >
        <Alert
          type="info"
          icon={<QuestionCircleOutlined />}
          message="What are chunks?"
          description="Documents are split into smaller pieces called 'chunks' for efficient AI processing. Each chunk can be individually searched and retrieved to provide context-aware responses. You can delete individual chunks if they contain incorrect or unwanted content."
          style={{ marginBottom: 16 }}
        />
        
        {chunksLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>
        ) : allChunks.length > 0 ? (
          <>
            <List
              dataSource={allChunks}
              renderItem={(chunk) => (
                <Card 
                  size="small" 
                  style={{ marginBottom: 12 }}
                  title={
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Space>
                        <Tag color="blue">Doc #{chunk.document_id}</Tag>
                        <Text strong>{chunk.document_title}</Text>
                        <Tag>Chunk #{chunk.chunk_index + 1}</Tag>
                        <Text type="secondary">{chunk.token_count} tokens</Text>
                        {chunk.has_embedding && (
                          <Tooltip title="Has embedding vector for semantic search">
                            <CheckCircleOutlined style={{ color: '#52c41a' }} />
                          </Tooltip>
                        )}
                      </Space>
                      <Popconfirm
                        title="Delete this chunk?"
                        description="This will remove this chunk from the knowledge base."
                        onConfirm={() => handleDeleteChunk(chunk.id)}
                        okText="Delete"
                        okButtonProps={{ danger: true }}
                      >
                        <Button size="small" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    </Space>
                  }
                >
                  <pre style={{ 
                    fontSize: 11, 
                    whiteSpace: 'pre-wrap', 
                    margin: 0,
                    background: '#f9f9f9',
                    padding: 8,
                    borderRadius: 4,
                    maxHeight: 200,
                    overflow: 'auto'
                  }}>
                    {chunk.content}
                  </pre>
                </Card>
              )}
            />
            
            {/* Pagination */}
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <Space>
                <Button 
                  disabled={chunksPage <= 1}
                  onClick={() => loadAllChunks(chunksPage - 1, chunksSearch, chunksDocFilter)}
                >
                  Previous
                </Button>
                <Text>Page {chunksPage} of {chunksTotalPages}</Text>
                <Button 
                  disabled={chunksPage >= chunksTotalPages}
                  onClick={() => loadAllChunks(chunksPage + 1, chunksSearch, chunksDocFilter)}
                >
                  Next
                </Button>
              </Space>
            </div>
          </>
        ) : (
          <Empty description="No chunks found" />
        )}
      </Drawer>
    </div>
  );
}

// Import Descriptions for the drawer
const { Descriptions } = require('antd');

export default KnowledgeBaseManager;
