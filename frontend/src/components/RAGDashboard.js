import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Row, Col, Statistic, Button, Table, Tag, Space, Typography,
  Input, Tabs, Alert, Progress, message, Modal, Collapse, Spin,
  Upload, Form, Select, InputNumber, Switch, Tooltip, Badge, Divider
} from 'antd';
import {
  DatabaseOutlined, CloudUploadOutlined, LinkOutlined, SearchOutlined,
  ReloadOutlined, PlayCircleOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ClockCircleOutlined, BookOutlined, QuestionCircleOutlined, RocketOutlined,
  ExperimentOutlined, SettingOutlined, FileTextOutlined, GlobalOutlined,
  ThunderboltOutlined, InfoCircleOutlined, SyncOutlined, DeleteOutlined
} from '@ant-design/icons';
import { adminAPI } from '../api/client';
import './RAGDashboard.css';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Panel } = Collapse;
const { Option } = Select;
const { Dragger } = Upload;

// Fallback guide content in case API fails
const DEFAULT_GUIDE = {
  title: "HuntSphere RAG (Retrieval-Augmented Generation) Guide",
  version: "1.0",
  quick_start: [
    "Navigate to the Upload tab",
    "Upload a document (PDF, Word, Excel, Text) or add a URL",
    "Fill in title, description, and metadata",
    "Wait for processing (status changes to READY)",
    "Test RAG with a question in the Test tab",
    "Use the chatbot - it now uses your knowledge base!"
  ],
  sections: [
    {
      title: "1. What is RAG?",
      content: `RAG (Retrieval-Augmented Generation) enhances AI responses by grounding them in your organization's knowledge base. Instead of relying solely on the AI model's training data, RAG:

1. Retrieves relevant documents from your knowledge base based on the query
2. Augments the AI prompt with this contextual information
3. Generates responses that are grounded in your specific data

This reduces hallucinations and ensures answers are relevant to your security context.`
    },
    {
      title: "2. Setting Up Your Knowledge Base",
      content: `To build an effective RAG knowledge base:

Step 1: Add Documents
• Upload PDFs, Word docs, Excel files, or text files
• Add URLs for web pages or documentation
• Use the crawl feature to ingest entire documentation sites

Step 2: Configure Document Metadata
• Set document type (Product Documentation, Runbook, Policy, Custom)
• Assign target platforms (XSIAM, Defender, Splunk, Wiz)
• Add relevant tags for organization
• Set priority (1-10, higher = more important in search results)

Step 3: Process Documents
• Documents are automatically chunked into smaller pieces
• Each chunk gets an embedding (vector representation)
• Embeddings enable semantic similarity search`
    },
    {
      title: "3. Document Types & Best Practices",
      content: `Product Documentation: Platform-specific docs (XQL syntax, KQL reference)
• Set target_platforms to help with query generation
• High priority (7-10) recommended

Runbooks: Incident response procedures
• Tag with relevant IOC types or attack categories
• Medium-high priority (6-8)

Security Policies: Organizational guidelines
• Lower priority (3-5) unless directly relevant

Custom: Anything else
• Threat reports, research papers, internal notes
• Adjust priority based on relevance`
    },
    {
      title: "4. Testing Your RAG Setup",
      content: `Use the Test RAG tab to verify your setup:

1. Ask a question relevant to your uploaded documents
2. Check the returned sources to verify retrieval is working
3. Verify the answer uses information from your knowledge base
4. Adjust document priorities if wrong documents are being retrieved

Test Questions to Try:
• "How do I write an XQL query to find suspicious PowerShell?"
• "What is our incident response procedure for ransomware?"
• "Explain the authentication flow in our security platform"`
    }
  ],
  api_endpoints: {
    "Upload File": "POST /api/knowledge/upload/file",
    "Upload URL": "POST /api/knowledge/upload/url",
    "List Documents": "GET /api/knowledge/",
    "Search": "POST /api/knowledge/search",
    "Test RAG": "POST /api/knowledge/test"
  }
};

/**
 * RAG Dashboard - Complete RAG workflow management
 */
const RAGDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [workflowStatus, setWorkflowStatus] = useState(null);
  const [guide, setGuide] = useState(DEFAULT_GUIDE);
  
  // Test RAG state
  const [testQuestion, setTestQuestion] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [testLoading, setTestLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, docsRes] = await Promise.all([
        adminAPI.get('/knowledge/stats'),
        adminAPI.get('/knowledge/')
      ]);
      setStats(statsRes.data);
      setDocuments(docsRes.data || []);
    } catch (error) {
      console.error('Failed to load RAG data:', error);
    }
    setLoading(false);
  }, []);

  const loadWorkflowStatus = useCallback(async () => {
    try {
      const res = await adminAPI.get('/knowledge/workflow/status');
      setWorkflowStatus(res.data);
    } catch (error) {
      console.error('Failed to load workflow status:', error);
    }
  }, []);

  const loadGuide = useCallback(async () => {
    try {
      const res = await adminAPI.get('/knowledge/guide');
      if (res.data && res.data.quick_start) {
        setGuide(res.data);
      }
    } catch (error) {
      console.error('Failed to load guide, using fallback:', error);
      // Keep using DEFAULT_GUIDE
    }
  }, []);

  useEffect(() => {
    loadData();
    loadWorkflowStatus();
    loadGuide();
  }, [loadData, loadWorkflowStatus, loadGuide]);

  const handleTestRAG = async () => {
    if (!testQuestion.trim()) {
      message.warning('Please enter a question');
      return;
    }
    
    setTestLoading(true);
    setTestResult(null);
    
    try {
      const res = await adminAPI.post('/knowledge/test', {
        question: testQuestion,
        include_sources: true
      });
      setTestResult(res.data);
      
      if (res.data.success) {
        message.success('RAG test completed successfully');
      } else {
        message.warning('RAG test completed with issues');
      }
    } catch (error) {
      message.error('RAG test failed: ' + (error.response?.data?.detail || error.message));
      setTestResult({ success: false, error: error.message });
    }
    
    setTestLoading(false);
  };

  const handleTriggerWorkflow = async (action) => {
    try {
      const res = await adminAPI.post(`/knowledge/workflow/trigger?action=${action}`);
      message.success(res.data.message);
      loadData();
      loadWorkflowStatus();
    } catch (error) {
      message.error('Failed to trigger workflow: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleDeleteDocument = async (docId, title) => {
    Modal.confirm({
      title: 'Delete Document',
      content: `Are you sure you want to delete "${title}"? This will also delete all associated chunks.`,
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await adminAPI.delete(`/knowledge/${docId}`);
          message.success('Document deleted');
          loadData();
        } catch (error) {
          message.error('Failed to delete: ' + (error.response?.data?.detail || error.message));
        }
      }
    });
  };

  const handleProcessDocument = async (docId) => {
    try {
      await adminAPI.post(`/knowledge/${docId}/process`);
      message.success('Document processing started');
      loadData();
    } catch (error) {
      message.error('Failed to process: ' + (error.response?.data?.detail || error.message));
    }
  };

  const getStatusTag = (status) => {
    const statusConfig = {
      READY: { color: 'success', icon: <CheckCircleOutlined /> },
      PENDING: { color: 'warning', icon: <ClockCircleOutlined /> },
      PROCESSING: { color: 'processing', icon: <SyncOutlined spin /> },
      CRAWLING: { color: 'processing', icon: <GlobalOutlined /> },
      FAILED: { color: 'error', icon: <CloseCircleOutlined /> }
    };
    const config = statusConfig[status] || { color: 'default', icon: null };
    return <Tag color={config.color} icon={config.icon}>{status}</Tag>;
  };

  const documentColumns = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      render: (title, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{title}</Text>
          {record.description && (
            <Text type="secondary" style={{ fontSize: 12 }}>{record.description.substring(0, 50)}...</Text>
          )}
        </Space>
      )
    },
    {
      title: 'Type',
      dataIndex: 'doc_type',
      key: 'doc_type',
      render: (type) => <Tag>{type}</Tag>,
      width: 120
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: getStatusTag,
      width: 120
    },
    {
      title: 'Chunks',
      dataIndex: 'chunk_count',
      key: 'chunk_count',
      width: 80
    },
    {
      title: 'Usage',
      dataIndex: 'usage_count',
      key: 'usage_count',
      render: (count) => (
        <Badge count={count} showZero style={{ backgroundColor: count > 10 ? '#52c41a' : '#1890ff' }} />
      ),
      width: 80
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      render: (p) => (
        <Progress 
          percent={p * 10} 
          size="small" 
          format={() => p}
          strokeColor={p >= 8 ? '#52c41a' : p >= 5 ? '#1890ff' : '#faad14'}
        />
      ),
      width: 100
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          {(record.status === 'PENDING' || record.status === 'FAILED') && (
            <Tooltip title="Process document">
              <Button 
                size="small" 
                icon={<PlayCircleOutlined />}
                onClick={() => handleProcessDocument(record.id)}
              />
            </Tooltip>
          )}
          <Tooltip title="Delete">
            <Button 
              size="small" 
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteDocument(record.id, record.title)}
            />
          </Tooltip>
        </Space>
      ),
      width: 100
    }
  ];

  const tabs = [
    {
      key: 'overview',
      label: <span><DatabaseOutlined /> Overview</span>,
      children: (
        <div className="rag-overview">
          {/* Stats Cards */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={12} md={6}>
              <Card className="stat-card">
                <Statistic
                  title="Total Documents"
                  value={stats?.total_documents || 0}
                  prefix={<FileTextOutlined />}
                />
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card className="stat-card stat-success">
                <Statistic
                  title="Ready"
                  value={stats?.ready_documents || 0}
                  prefix={<CheckCircleOutlined />}
                />
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card className="stat-card stat-info">
                <Statistic
                  title="Total Chunks"
                  value={stats?.total_chunks || 0}
                  prefix={<DatabaseOutlined />}
                />
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card className="stat-card stat-purple">
                <Statistic
                  title="Total Retrievals"
                  value={stats?.total_usage || 0}
                  prefix={<SearchOutlined />}
                />
              </Card>
            </Col>
          </Row>

          {/* Workflow Status */}
          {workflowStatus && (
            <Card title="Workflow Status" style={{ marginBottom: 24 }}>
              <Row gutter={16}>
                <Col span={12}>
                  <div className="workflow-stat">
                    <Text type="secondary">Embedding Coverage</Text>
                    <Progress 
                      percent={parseFloat(workflowStatus.chunks?.embedding_coverage) || 0}
                      status="active"
                    />
                  </div>
                </Col>
                <Col span={12}>
                  <div className="workflow-actions">
                    <Space>
                      <Button
                        icon={<PlayCircleOutlined />}
                        onClick={() => handleTriggerWorkflow('process_pending')}
                      >
                        Process Pending
                      </Button>
                      <Button
                        icon={<SyncOutlined />}
                        onClick={() => handleTriggerWorkflow('refresh_embeddings')}
                      >
                        Refresh Embeddings
                      </Button>
                      <Button
                        icon={<ReloadOutlined />}
                        onClick={() => handleTriggerWorkflow('reprocess_failed')}
                      >
                        Retry Failed
                      </Button>
                    </Space>
                  </div>
                </Col>
              </Row>
            </Card>
          )}

          {/* Documents Table */}
          <Card 
            title="Knowledge Documents" 
            extra={<Button icon={<ReloadOutlined />} onClick={loadData}>Refresh</Button>}
          >
            <Table
              dataSource={documents}
              columns={documentColumns}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10 }}
              size="small"
            />
          </Card>
        </div>
      )
    },
    {
      key: 'test',
      label: <span><ExperimentOutlined /> Test RAG</span>,
      children: (
        <div className="rag-test">
          <Alert
            message="Test Your RAG Setup"
            description="Ask a question to verify RAG is retrieving relevant context and generating accurate responses from your knowledge base."
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />

          <Card title="Ask a Question">
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <TextArea
                placeholder="e.g., How do I write an XQL query to detect suspicious PowerShell activity?"
                value={testQuestion}
                onChange={(e) => setTestQuestion(e.target.value)}
                rows={3}
              />
              <Button
                type="primary"
                icon={<ThunderboltOutlined />}
                onClick={handleTestRAG}
                loading={testLoading}
                size="large"
              >
                Test RAG
              </Button>
            </Space>
          </Card>

          {testResult && (
            <Card 
              title={
                <Space>
                  <span>RAG Response</span>
                  {testResult.success ? (
                    <Tag color="success">Success</Tag>
                  ) : (
                    <Tag color="error">Issues Found</Tag>
                  )}
                </Space>
              }
              style={{ marginTop: 24 }}
            >
              {testResult.model_used && (
                <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                  Model: {testResult.model_used}
                </Text>
              )}
              
              <div className="rag-answer">
                <Paragraph>{testResult.answer}</Paragraph>
              </div>

              {testResult.sources && testResult.sources.length > 0 && (
                <>
                  <Divider>Sources Used ({testResult.sources.length})</Divider>
                  <Space wrap>
                    {testResult.sources.map((source, idx) => (
                      <Tag key={idx} color="blue">
                        {source.title} (Relevance: {(source.similarity * 100).toFixed(0)}%)
                      </Tag>
                    ))}
                  </Space>
                </>
              )}

              {testResult.context_used && testResult.context_used !== '[hidden]' && (
                <Collapse style={{ marginTop: 16 }}>
                  <Panel header="View Retrieved Context" key="context">
                    <pre style={{ 
                      maxHeight: 300, 
                      overflow: 'auto',
                      background: 'var(--bg-body)',
                      padding: 12,
                      borderRadius: 6,
                      fontSize: 12
                    }}>
                      {testResult.context_used}
                    </pre>
                  </Panel>
                </Collapse>
              )}
            </Card>
          )}
        </div>
      )
    },
    {
      key: 'guide',
      label: <span><BookOutlined /> Setup Guide</span>,
      children: (
        <div className="rag-guide">
          <Title level={4}>
            <RocketOutlined /> {guide?.title || 'RAG Setup Guide'}
          </Title>
          
          {/* Quick Start */}
          <Card 
            title={<><ThunderboltOutlined /> Quick Start</>}
            style={{ marginBottom: 24 }}
            className="quick-start-card"
          >
            <ol className="quick-start-list">
              {(guide?.quick_start || DEFAULT_GUIDE.quick_start).map((step, idx) => (
                <li key={idx}>{step}</li>
              ))}
            </ol>
          </Card>

          {/* Detailed Guide */}
          <Collapse defaultActiveKey={['0']} accordion>
            {(guide?.sections || DEFAULT_GUIDE.sections).map((section, idx) => (
              <Panel 
                header={<Text strong>{section.title}</Text>} 
                key={String(idx)}
              >
                <Paragraph style={{ whiteSpace: 'pre-wrap' }}>
                  {section.content}
                </Paragraph>
              </Panel>
            ))}
          </Collapse>

          {/* API Reference */}
          {guide?.api_endpoints && (
            <Card 
              title={<><InfoCircleOutlined /> API Endpoints</>}
              style={{ marginTop: 24 }}
            >
              <Table
                dataSource={Object.entries(guide.api_endpoints).map(([name, endpoint]) => ({
                  key: name,
                  name: name.replace(/_/g, ' '),
                  endpoint
                }))}
                columns={[
                  { title: 'Action', dataIndex: 'name', key: 'name' },
                  { 
                    title: 'Endpoint', 
                    dataIndex: 'endpoint', 
                    key: 'endpoint',
                    render: (ep) => <Text code>{ep}</Text>
                  }
                ]}
                pagination={false}
                size="small"
              />
            </Card>
          )}
        </div>
      )
    },
    {
      key: 'upload',
      label: <span><CloudUploadOutlined /> Upload</span>,
      children: <UploadSection onUploadComplete={loadData} />
    },
    {
      key: 'chunks',
      label: <span><DatabaseOutlined /> View Chunks</span>,
      children: <ChunksViewer documents={documents} />
    }
  ];

  return (
    <div className="rag-dashboard">
      <Tabs 
        activeKey={activeTab} 
        onChange={setActiveTab}
        items={tabs}
      />
    </div>
  );
};

/**
 * Upload Section Component - Toggle between File and URL upload
 */
const UploadSection = ({ onUploadComplete }) => {
  const [form] = Form.useForm();
  const [uploading, setUploading] = useState(false);
  const [uploadMode, setUploadMode] = useState('file');

  const handleFileUpload = async (values) => {
    setUploading(true);
    try {
      // Extract the actual file from the upload component
      const fileObj = values.file?.fileList?.[0]?.originFileObj || values.file?.file?.originFileObj || values.file?.file;
      
      if (!fileObj) {
        message.error('Please select a file first');
        setUploading(false);
        return;
      }
      
      const formData = new FormData();
      formData.append('file', fileObj);
      formData.append('title', values.title);
      formData.append('description', values.description || '');
      formData.append('doc_type', values.doc_type || 'custom');
      formData.append('priority', values.priority || 5);
      formData.append('auto_process', 'true');
      
      if (values.target_platforms && values.target_platforms.length > 0) {
        formData.append('target_platforms', JSON.stringify(values.target_platforms));
      }
      if (values.tags) {
        formData.append('tags', JSON.stringify(values.tags.split(',').map(t => t.trim())));
      }

      await adminAPI.post('/knowledge/upload/file', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      message.success('Document uploaded and processing started');
      form.resetFields();
      onUploadComplete?.();
    } catch (error) {
      console.error('Upload error:', error);
      message.error('Upload failed: ' + (error.response?.data?.detail || error.message));
    }
    setUploading(false);
  };

  const handleUrlUpload = async (values) => {
    setUploading(true);
    try {
      await adminAPI.post('/knowledge/upload/url', {
        title: values.title,
        source_url: values.url,
        description: values.description,
        doc_type: values.doc_type || 'custom',
        priority: values.priority || 5,
        crawl_depth: values.crawl_depth || 0,
        max_pages: values.max_pages || 20,
        target_platforms: values.target_platforms,
        tags: values.tags ? values.tags.split(',').map(t => t.trim()) : undefined
      });
      
      message.success('URL added and processing started');
      form.resetFields();
      onUploadComplete?.();
    } catch (error) {
      message.error('Failed to add URL: ' + (error.response?.data?.detail || error.message));
    }
    setUploading(false);
  };

  const switchMode = (mode) => {
    form.resetFields();
    setUploadMode(mode);
  };

  return (
    <div className="upload-section">
      {/* Mode Selection */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <Card 
            size="small"
            hoverable
            className={`upload-mode-card ${uploadMode === 'file' ? 'active' : ''}`}
            onClick={() => switchMode('file')}
            style={{ 
              cursor: 'pointer',
              borderColor: uploadMode === 'file' ? 'var(--primary)' : undefined,
              background: uploadMode === 'file' ? 'var(--primary-light)' : undefined
            }}
          >
            <Space>
              <FileTextOutlined style={{ fontSize: 24, color: uploadMode === 'file' ? 'var(--primary)' : 'var(--text-muted)' }} />
              <div>
                <Text strong style={{ display: 'block' }}>Upload File</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>PDF, Word, Excel, Text files</Text>
              </div>
            </Space>
          </Card>
        </Col>
        <Col span={12}>
          <Card 
            size="small"
            hoverable
            className={`upload-mode-card ${uploadMode === 'url' ? 'active' : ''}`}
            onClick={() => switchMode('url')}
            style={{ 
              cursor: 'pointer',
              borderColor: uploadMode === 'url' ? 'var(--primary)' : undefined,
              background: uploadMode === 'url' ? 'var(--primary-light)' : undefined
            }}
          >
            <Space>
              <LinkOutlined style={{ fontSize: 24, color: uploadMode === 'url' ? 'var(--primary)' : 'var(--text-muted)' }} />
              <div>
                <Text strong style={{ display: 'block' }}>Add URL</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>Web pages, documentation sites</Text>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* File Upload Form */}
      {uploadMode === 'file' && (
        <Card title={<><FileTextOutlined /> Upload Document File</>}>
          <Form form={form} layout="vertical" onFinish={handleFileUpload}>
            <Form.Item 
              name="file" 
              rules={[{ required: true, message: 'Please select a file' }]}
            >
              <Dragger 
                beforeUpload={() => false}
                maxCount={1}
                accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.md,.json"
              >
                <p className="ant-upload-drag-icon">
                  <CloudUploadOutlined />
                </p>
                <p className="ant-upload-text">Click or drag file to upload</p>
                <p className="ant-upload-hint">
                  Supported: PDF, Word (.docx), Excel (.xlsx), CSV, Text, Markdown, JSON (max 50MB)
                </p>
              </Dragger>
            </Form.Item>

            <Row gutter={16}>
              <Col span={16}>
                <Form.Item 
                  name="title" 
                  label="Title"
                  rules={[{ required: true, message: 'Enter a title' }]}
                >
                  <Input placeholder="e.g., XSIAM XQL Reference Guide" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="priority" label="Priority" initialValue={5}>
                  <InputNumber min={1} max={10} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="description" label="Description">
              <TextArea rows={2} placeholder="Brief description of the document content" />
            </Form.Item>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="doc_type" label="Document Type" initialValue="custom">
                  <Select>
                    <Option value="product_documentation">Product Documentation</Option>
                    <Option value="runbook">Runbook</Option>
                    <Option value="policy">Policy</Option>
                    <Option value="custom">Custom</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="target_platforms" label="Target Platforms">
                  <Select mode="multiple" placeholder="Select platforms">
                    <Option value="xsiam">XSIAM</Option>
                    <Option value="defender">Defender</Option>
                    <Option value="splunk">Splunk</Option>
                    <Option value="wiz">Wiz</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="tags" label="Tags">
              <Input placeholder="Comma-separated tags (e.g., xql, queries, detection)" />
            </Form.Item>

            <Button 
              type="primary" 
              htmlType="submit" 
              loading={uploading}
              icon={<CloudUploadOutlined />}
              size="large"
              block
            >
              Upload Document
            </Button>
          </Form>
        </Card>
      )}

      {/* URL Upload Form */}
      {uploadMode === 'url' && (
        <Card title={<><LinkOutlined /> Add URL to Knowledge Base</>}>
          <Form form={form} layout="vertical" onFinish={handleUrlUpload}>
            <Form.Item 
              name="url" 
              label="URL"
              rules={[
                { required: true, message: 'Enter a URL' },
                { type: 'url', message: 'Enter a valid URL' }
              ]}
            >
              <Input placeholder="https://docs.paloaltonetworks.com/cortex-xsiam/..." />
            </Form.Item>

            <Row gutter={16}>
              <Col span={16}>
                <Form.Item 
                  name="title" 
                  label="Title"
                  rules={[{ required: true, message: 'Enter a title' }]}
                >
                  <Input placeholder="e.g., Cortex XSIAM Documentation" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="priority" label="Priority" initialValue={5}>
                  <InputNumber min={1} max={10} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="description" label="Description">
              <TextArea rows={2} placeholder="Brief description of the content" />
            </Form.Item>

            <Alert
              message="Crawl Settings"
              description="Set crawl depth > 0 to follow links and ingest multiple pages from a documentation site."
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Row gutter={16}>
              <Col span={8}>
                <Form.Item 
                  name="crawl_depth" 
                  label={<Tooltip title="0 = single page, 1 = page + linked pages, 2 = deeper crawl">Crawl Depth</Tooltip>}
                  initialValue={0}
                >
                  <InputNumber min={0} max={3} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="max_pages" label="Max Pages" initialValue={20}>
                  <InputNumber min={1} max={100} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="doc_type" label="Document Type" initialValue="product_documentation">
                  <Select>
                    <Option value="product_documentation">Product Docs</Option>
                    <Option value="runbook">Runbook</Option>
                    <Option value="policy">Policy</Option>
                    <Option value="custom">Custom</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="target_platforms" label="Target Platforms">
              <Select mode="multiple" placeholder="Select platforms this documentation relates to">
                <Option value="xsiam">XSIAM</Option>
                <Option value="defender">Defender</Option>
                <Option value="splunk">Splunk</Option>
                <Option value="wiz">Wiz</Option>
              </Select>
            </Form.Item>

            <Button 
              type="primary" 
              htmlType="submit" 
              loading={uploading}
              icon={<GlobalOutlined />}
              size="large"
              block
            >
              Add URL to Knowledge Base
            </Button>
          </Form>
        </Card>
      )}
    </div>
  );
};

/**
 * ChunksViewer Component - View and manage knowledge base chunks
 */
const ChunksViewer = ({ documents }) => {
  const [loading, setLoading] = useState(false);
  const [chunks, setChunks] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [documentFilter, setDocumentFilter] = useState(null);
  const [expandedChunk, setExpandedChunk] = useState(null);

  const loadChunks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminAPI.get('/knowledge/chunks/all', {
        params: {
          page,
          page_size: pageSize,
          document_id: documentFilter,
          search: search || undefined
        }
      });
      setChunks(res.data?.chunks || []);
      setTotal(res.data?.total || 0);
    } catch (error) {
      console.error('Failed to load chunks:', error);
      message.error('Failed to load chunks');
    }
    setLoading(false);
  }, [page, pageSize, documentFilter, search]);

  useEffect(() => {
    loadChunks();
  }, [loadChunks]);

  const handleDeleteChunk = async (chunkId) => {
    try {
      await adminAPI.delete(`/knowledge/chunks/${chunkId}`);
      message.success('Chunk deleted');
      loadChunks();
    } catch (error) {
      message.error('Failed to delete chunk');
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      render: (id) => <Text code>#{id}</Text>
    },
    {
      title: 'Document',
      dataIndex: 'document_title',
      key: 'document_title',
      width: 200,
      ellipsis: true,
      render: (title, record) => (
        <Tooltip title={title || `Document #${record.document_id}`}>
          <Text ellipsis style={{ maxWidth: 180 }}>
            {title || `Document #${record.document_id}`}
          </Text>
        </Tooltip>
      )
    },
    {
      title: 'Content Preview',
      dataIndex: 'content',
      key: 'content',
      render: (content, record) => {
        const preview = content?.substring(0, 150) + (content?.length > 150 ? '...' : '');
        return (
          <div>
            <Paragraph 
              ellipsis={{ rows: 2 }}
              style={{ 
                marginBottom: 4, 
                fontSize: 12, 
                color: 'var(--text-secondary)',
                cursor: 'pointer'
              }}
              onClick={() => setExpandedChunk(expandedChunk === record.id ? null : record.id)}
            >
              {preview}
            </Paragraph>
            {expandedChunk === record.id && (
              <div style={{
                background: 'var(--bg-body)',
                padding: 12,
                borderRadius: 6,
                marginTop: 8,
                border: '1px solid var(--border-color)',
                maxHeight: 300,
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                fontSize: 12
              }}>
                {content}
              </div>
            )}
          </div>
        );
      }
    },
    {
      title: 'Tokens',
      dataIndex: 'token_count',
      key: 'token_count',
      width: 80,
      render: (count) => <Tag>{count || '?'}</Tag>
    },
    {
      title: 'Embedding',
      dataIndex: 'has_embedding',
      key: 'has_embedding',
      width: 100,
      render: (has) => has ? (
        <Tag color="green" icon={<CheckCircleOutlined />}>Yes</Tag>
      ) : (
        <Tag color="orange" icon={<ClockCircleOutlined />}>Pending</Tag>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 80,
      render: (_, record) => (
        <Tooltip title="Delete chunk">
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => {
              Modal.confirm({
                title: 'Delete Chunk',
                content: 'Are you sure you want to delete this chunk? This action cannot be undone.',
                okText: 'Delete',
                okType: 'danger',
                onOk: () => handleDeleteChunk(record.id)
              });
            }}
          />
        </Tooltip>
      )
    }
  ];

  return (
    <div className="chunks-viewer">
      <Card 
        title={
          <Space>
            <DatabaseOutlined />
            <span>Knowledge Base Chunks</span>
            <Badge count={total} showZero style={{ backgroundColor: 'var(--primary)' }} />
          </Space>
        }
        extra={
          <Button icon={<ReloadOutlined />} onClick={loadChunks} loading={loading}>
            Refresh
          </Button>
        }
      >
        <Alert
          message="Chunks are the building blocks of RAG"
          description="Documents are split into chunks for efficient retrieval. Each chunk is embedded as a vector for semantic search."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        {/* Filters */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={8}>
            <Input
              placeholder="Search chunk content..."
              prefix={<SearchOutlined />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onPressEnter={loadChunks}
              allowClear
            />
          </Col>
          <Col span={8}>
            <Select
              placeholder="Filter by document"
              allowClear
              style={{ width: '100%' }}
              value={documentFilter}
              onChange={(val) => {
                setDocumentFilter(val);
                setPage(1);
              }}
            >
              {documents.map(doc => (
                <Option key={doc.id} value={doc.id}>
                  {doc.title || `Document #${doc.id}`}
                </Option>
              ))}
            </Select>
          </Col>
          <Col span={8}>
            <Space>
              <Select
                value={pageSize}
                onChange={(val) => {
                  setPageSize(val);
                  setPage(1);
                }}
                style={{ width: 100 }}
              >
                <Option value={10}>10 / page</Option>
                <Option value={20}>20 / page</Option>
                <Option value={50}>50 / page</Option>
              </Select>
            </Space>
          </Col>
        </Row>

        {/* Chunks Table */}
        <Table
          dataSource={chunks}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: false,
            showTotal: (total) => `${total} chunks`,
            onChange: (p) => setPage(p)
          }}
          size="small"
          scroll={{ x: 800 }}
        />
      </Card>
    </div>
  );
};

export default RAGDashboard;
