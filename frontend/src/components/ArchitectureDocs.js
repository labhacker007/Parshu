import React, { useState } from 'react';
import {
  Card, Row, Col, Typography, Space, Tag, Button, Tabs, Collapse,
  Tree, Tooltip, Badge, Divider, Progress, Alert, List, Timeline
} from 'antd';
import {
  AppstoreOutlined, DatabaseOutlined, ApiOutlined, SecurityScanOutlined,
  CloudServerOutlined, RobotOutlined, FileTextOutlined, UserOutlined,
  SettingOutlined, BranchesOutlined, ThunderboltOutlined, GlobalOutlined,
  SearchOutlined, BulbOutlined, ClusterOutlined, NodeIndexOutlined,
  PlayCircleOutlined, SyncOutlined, SafetyOutlined, AuditOutlined,
  TeamOutlined, LockOutlined, EyeOutlined, RocketOutlined,
  ExpandOutlined, FullscreenOutlined, ZoomInOutlined, ZoomOutOutlined,
  PlusOutlined, MinusOutlined, HomeOutlined
} from '@ant-design/icons';
import './ArchitectureDocs.css';

const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;

/**
 * Interactive Architecture Documentation Component
 * Provides multi-level views of the HuntSphere platform architecture
 */
const ArchitectureDocs = () => {
  const [activeView, setActiveView] = useState('high-level');
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(100);

  // High-level architecture data
  const architectureLayers = [
    {
      id: 'presentation',
      name: 'Presentation Layer',
      icon: <AppstoreOutlined />,
      color: '#1890ff',
      description: 'React Frontend with Ant Design components',
      components: [
        { name: 'Dashboard', path: '/dashboard', description: 'Main overview with stats and quick actions' },
        { name: 'News & Feeds', path: '/news', description: 'RSS feed aggregation and article reader' },
        { name: 'Article Queue', path: '/articles', description: 'Triage queue for article analysis' },
        { name: 'Intelligence', path: '/intelligence', description: 'IOC and TTP management' },
        { name: 'Hunts', path: '/hunts', description: 'Threat hunting campaigns' },
        { name: 'Reports', path: '/reports', description: 'Report generation and management' },
        { name: 'Admin', path: '/admin', description: 'System configuration and user management' },
      ]
    },
    {
      id: 'api',
      name: 'API Layer',
      icon: <ApiOutlined />,
      color: '#52c41a',
      description: 'FastAPI REST endpoints with authentication',
      components: [
        { name: 'Auth Routes', path: '/api/auth', description: 'JWT authentication and user management' },
        { name: 'Articles Routes', path: '/api/articles', description: 'Article CRUD and triage operations' },
        { name: 'Intelligence Routes', path: '/api/intelligence', description: 'IOC/TTP extraction and management' },
        { name: 'Hunts Routes', path: '/api/hunts', description: 'Hunt campaign management' },
        { name: 'Sources Routes', path: '/api/sources', description: 'RSS source configuration' },
        { name: 'Reports Routes', path: '/api/reports', description: 'Report generation endpoints' },
        { name: 'Admin Routes', path: '/api/admin', description: 'Administrative operations' },
        { name: 'Knowledge Routes', path: '/api/knowledge', description: 'RAG knowledge base operations' },
      ]
    },
    {
      id: 'services',
      name: 'Service Layer',
      icon: <ClusterOutlined />,
      color: '#722ed1',
      description: 'Core business logic and processing',
      components: [
        { name: 'Article Service', description: 'Article ingestion and processing pipeline' },
        { name: 'Intelligence Extractor', description: 'IOC/TTP extraction with regex and GenAI' },
        { name: 'GenAI Provider', description: 'Ollama/OpenAI/Anthropic integration' },
        { name: 'Hunt Scheduler', description: 'Automated hunt job scheduling' },
        { name: 'RSS Fetcher', description: 'Feed aggregation and parsing' },
        { name: 'Report Generator', description: 'PDF/HTML report generation' },
        { name: 'Knowledge Service', description: 'RAG document processing and retrieval' },
      ]
    },
    {
      id: 'data',
      name: 'Data Layer',
      icon: <DatabaseOutlined />,
      color: '#fa8c16',
      description: 'PostgreSQL database with Redis caching',
      components: [
        { name: 'PostgreSQL', description: 'Primary data store for all entities' },
        { name: 'Redis', description: 'Caching and job queue management' },
        { name: 'Vector Store', description: 'Embeddings for RAG similarity search' },
        { name: 'File Storage', description: 'Document and report file storage' },
      ]
    },
    {
      id: 'integrations',
      name: 'External Integrations',
      icon: <GlobalOutlined />,
      color: '#eb2f96',
      description: 'Third-party platform connectors',
      components: [
        { name: 'XSIAM', description: 'Palo Alto Cortex XSIAM integration' },
        { name: 'Microsoft Defender', description: 'Microsoft security platform' },
        { name: 'Splunk', description: 'Splunk SIEM integration' },
        { name: 'Wiz', description: 'Cloud security posture management' },
        { name: 'RSS Feeds', description: 'External threat intel feeds' },
      ]
    },
  ];

  // Data flow definitions
  const dataFlows = [
    {
      id: 'ingestion',
      name: 'Article Ingestion Flow',
      icon: <SyncOutlined />,
      steps: [
        { step: 1, name: 'RSS Fetch', description: 'Scheduler triggers RSS source fetch', component: 'RSS Fetcher' },
        { step: 2, name: 'Parse Articles', description: 'Extract article content and metadata', component: 'Article Service' },
        { step: 3, name: 'Store to DB', description: 'Save articles with NEW status', component: 'PostgreSQL' },
        { step: 4, name: 'Generate Summary', description: 'Auto-generate executive/technical summaries', component: 'GenAI Provider' },
        { step: 5, name: 'Extract IOCs', description: 'Extract indicators using AI', component: 'Intelligence Extractor' },
        { step: 6, name: 'Index for RAG', description: 'Create embeddings for knowledge base', component: 'Vector Store' },
      ]
    },
    {
      id: 'triage',
      name: 'Article Triage Flow',
      icon: <FileTextOutlined />,
      steps: [
        { step: 1, name: 'View Article', description: 'User opens article in queue', component: 'Article Queue' },
        { step: 2, name: 'Auto-Analyze', description: 'Trigger summary/IOC generation if missing', component: 'GenAI Provider' },
        { step: 3, name: 'Review Content', description: 'User reviews executive/technical summaries', component: 'Article Queue' },
        { step: 4, name: 'Validate IOCs', description: 'Review and confirm extracted indicators', component: 'Intelligence' },
        { step: 5, name: 'Update Status', description: 'Move to appropriate status (Reviewed, Hunt, etc)', component: 'Article Service' },
        { step: 6, name: 'Create Hunt', description: 'Optionally create threat hunt from IOCs', component: 'Hunts' },
      ]
    },
    {
      id: 'hunt',
      name: 'Threat Hunt Flow',
      icon: <SecurityScanOutlined />,
      steps: [
        { step: 1, name: 'Create Hunt', description: 'User creates hunt from IOCs or manual input', component: 'Hunts' },
        { step: 2, name: 'Generate Query', description: 'AI generates platform-specific query', component: 'GenAI Provider' },
        { step: 3, name: 'Execute Hunt', description: 'Run query against target platform', component: 'Platform Connector' },
        { step: 4, name: 'Collect Results', description: 'Gather hunt results and hits', component: 'Hunt Scheduler' },
        { step: 5, name: 'Update Intelligence', description: 'Mark IOCs with hunt status', component: 'Intelligence' },
        { step: 6, name: 'Generate Report', description: 'Create hunt findings report', component: 'Report Generator' },
      ]
    },
    {
      id: 'rag',
      name: 'RAG Knowledge Flow',
      icon: <RobotOutlined />,
      steps: [
        { step: 1, name: 'Upload Document', description: 'Admin uploads file or URL', component: 'Knowledge Routes' },
        { step: 2, name: 'Extract Content', description: 'Parse document content', component: 'Knowledge Service' },
        { step: 3, name: 'Chunk Content', description: 'Split into semantic chunks', component: 'Knowledge Service' },
        { step: 4, name: 'Generate Embeddings', description: 'Create vector embeddings', component: 'GenAI Provider' },
        { step: 5, name: 'Store in Vector DB', description: 'Index for similarity search', component: 'Vector Store' },
        { step: 6, name: 'Retrieve for Context', description: 'Provide context for AI responses', component: 'Chatbot' },
      ]
    },
  ];

  // Database entities
  const databaseEntities = [
    {
      name: 'users',
      description: 'User accounts and authentication',
      fields: ['id', 'email', 'hashed_password', 'full_name', 'role', 'is_active', 'created_at'],
      relations: ['articles (created_by)', 'reports (created_by)', 'hunts (created_by)']
    },
    {
      name: 'articles',
      description: 'Ingested news and threat intel articles',
      fields: ['id', 'title', 'content', 'url', 'source_id', 'status', 'is_high_priority', 'executive_summary', 'technical_summary', 'published_date'],
      relations: ['source', 'extracted_intelligence', 'hunts']
    },
    {
      name: 'sources',
      description: 'RSS feed sources',
      fields: ['id', 'name', 'url', 'source_type', 'is_active', 'fetch_interval', 'last_fetched'],
      relations: ['articles']
    },
    {
      name: 'extracted_intelligence',
      description: 'IOCs and TTPs extracted from articles',
      fields: ['id', 'article_id', 'intelligence_type', 'value', 'ioc_type', 'confidence', 'mitre_id', 'hunt_status'],
      relations: ['article', 'hunt_results']
    },
    {
      name: 'hunts',
      description: 'Threat hunting campaigns',
      fields: ['id', 'name', 'description', 'target_platform', 'query', 'status', 'created_by', 'scheduled_at'],
      relations: ['intelligence_items', 'hunt_results']
    },
    {
      name: 'reports',
      description: 'Generated threat reports',
      fields: ['id', 'title', 'report_type', 'content', 'file_path', 'created_by', 'is_published'],
      relations: ['user']
    },
    {
      name: 'knowledge_documents',
      description: 'RAG knowledge base documents',
      fields: ['id', 'title', 'source_type', 'doc_type', 'status', 'chunk_count', 'priority'],
      relations: ['knowledge_chunks', 'uploaded_by']
    },
    {
      name: 'knowledge_chunks',
      description: 'Document chunks with embeddings',
      fields: ['id', 'document_id', 'content', 'chunk_index', 'embedding', 'token_count'],
      relations: ['document']
    },
  ];

  // Page-level feature breakdown
  const pageFeatures = {
    dashboard: {
      name: 'Dashboard',
      icon: <HomeOutlined />,
      features: [
        { name: 'Stats Overview', description: 'Real-time counts of articles, IOCs, hunts, reports' },
        { name: 'Recent Activity', description: 'Timeline of latest system events' },
        { name: 'Quick Actions', description: 'Shortcuts to common workflows' },
        { name: 'Status Cards', description: 'Health indicators for integrations' },
      ]
    },
    newsFeeds: {
      name: 'News & Feeds',
      icon: <FileTextOutlined />,
      features: [
        { name: 'Source Sidebar', description: 'Filter by RSS source or saved articles' },
        { name: 'Article List', description: 'Sortable, filterable article listing' },
        { name: 'Auto-Refresh', description: 'Configurable automatic feed updates (30s-5m)' },
        { name: 'View Modes', description: 'List, Card, or Compact views' },
        { name: 'Article Reader', description: 'Side panel with summaries and IOCs' },
        { name: 'AI Summaries', description: 'Auto-generated executive and technical summaries' },
      ]
    },
    articleQueue: {
      name: 'Article Queue',
      icon: <AppstoreOutlined />,
      features: [
        { name: 'Status Tiles', description: 'Filter by New, In Analysis, Need to Hunt, Reviewed' },
        { name: 'Bulk Actions', description: 'Multi-select for batch operations' },
        { name: 'Article Detail', description: 'Full analysis view with tabs' },
        { name: 'IOC Extraction', description: 'AI-powered indicator extraction' },
        { name: 'Hunt Creation', description: 'Create hunts directly from article IOCs' },
      ]
    },
    intelligence: {
      name: 'Intelligence',
      icon: <SafetyOutlined />,
      features: [
        { name: 'Summary Tiles', description: 'Total IOCs, TTPs, ATLAS by type' },
        { name: 'Status Filters', description: 'Filter by article status' },
        { name: 'Hunt Status', description: 'Filter by hunt execution status' },
        { name: 'Intelligence Table', description: 'Searchable, sortable IOC/TTP list' },
        { name: 'Export Options', description: 'Export to CSV, STIX, JSON' },
      ]
    },
    hunts: {
      name: 'Hunts',
      icon: <SecurityScanOutlined />,
      features: [
        { name: 'Hunt List', description: 'All hunting campaigns with status' },
        { name: 'Query Builder', description: 'AI-assisted query generation' },
        { name: 'Platform Selection', description: 'Target XSIAM, Defender, Splunk' },
        { name: 'Scheduling', description: 'One-time or recurring hunt execution' },
        { name: 'Results Viewer', description: 'Hunt hits and findings display' },
      ]
    },
    admin: {
      name: 'Admin',
      icon: <SettingOutlined />,
      features: [
        { name: 'User Management', description: 'Create, edit, deactivate users' },
        { name: 'RBAC', description: 'Role-based access control configuration' },
        { name: 'Sources', description: 'RSS feed source management' },
        { name: 'Connectors', description: 'Platform integration setup' },
        { name: 'GenAI', description: 'AI provider configuration' },
        { name: 'Knowledge Base', description: 'RAG document management' },
        { name: 'Themes', description: 'UI theme customization' },
        { name: 'Architecture', description: 'This documentation view' },
      ]
    },
  };

  // Render high-level architecture view
  const renderHighLevelView = () => (
    <div className="architecture-high-level" style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top left' }}>
      <Row gutter={[24, 24]}>
        {architectureLayers.map((layer, idx) => (
          <Col span={24} key={layer.id}>
            <Card 
              className={`layer-card ${selectedComponent === layer.id ? 'selected' : ''}`}
              style={{ borderLeft: `4px solid ${layer.color}` }}
              onClick={() => setSelectedComponent(selectedComponent === layer.id ? null : layer.id)}
            >
              <div className="layer-header">
                <Space>
                  <span style={{ fontSize: 24, color: layer.color }}>{layer.icon}</span>
                  <div>
                    <Title level={5} style={{ margin: 0 }}>{layer.name}</Title>
                    <Text type="secondary">{layer.description}</Text>
                  </div>
                </Space>
                <Tag color={layer.color}>{layer.components.length} components</Tag>
              </div>
              
              {selectedComponent === layer.id && (
                <div className="layer-components">
                  <Divider style={{ margin: '16px 0' }} />
                  <Row gutter={[12, 12]}>
                    {layer.components.map((comp, i) => (
                      <Col span={8} key={i}>
                        <Card size="small" className="component-card" hoverable>
                          <Text strong>{comp.name}</Text>
                          {comp.path && <Text type="secondary" style={{ display: 'block', fontSize: 11 }}>{comp.path}</Text>}
                          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                            {comp.description}
                          </Text>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                </div>
              )}
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );

  // Render data flow view
  const renderDataFlowView = () => (
    <div className="architecture-data-flow">
      <Collapse accordion defaultActiveKey={['ingestion']}>
        {dataFlows.map(flow => (
          <Panel 
            key={flow.id}
            header={
              <Space>
                {flow.icon}
                <Text strong>{flow.name}</Text>
                <Tag>{flow.steps.length} steps</Tag>
              </Space>
            }
          >
            <Timeline mode="left">
              {flow.steps.map((step, idx) => (
                <Timeline.Item 
                  key={idx}
                  color={idx === flow.steps.length - 1 ? 'green' : 'blue'}
                  label={<Tag color="blue">Step {step.step}</Tag>}
                >
                  <Card size="small" className="flow-step-card">
                    <Text strong>{step.name}</Text>
                    <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>{step.description}</Text>
                    <Tag style={{ marginTop: 8 }} color="purple">{step.component}</Tag>
                  </Card>
                </Timeline.Item>
              ))}
            </Timeline>
          </Panel>
        ))}
      </Collapse>
    </div>
  );

  // Render database schema view
  const renderDatabaseView = () => (
    <div className="architecture-database">
      <Row gutter={[16, 16]}>
        {databaseEntities.map((entity, idx) => (
          <Col span={12} key={idx}>
            <Card 
              className="entity-card"
              title={
                <Space>
                  <DatabaseOutlined style={{ color: '#fa8c16' }} />
                  <Text strong>{entity.name}</Text>
                </Space>
              }
              extra={<Tag color="orange">{entity.fields.length} fields</Tag>}
              size="small"
            >
              <Paragraph type="secondary" style={{ marginBottom: 12 }}>{entity.description}</Paragraph>
              
              <div style={{ marginBottom: 12 }}>
                <Text strong style={{ fontSize: 12 }}>Fields:</Text>
                <div style={{ marginTop: 4 }}>
                  {entity.fields.map((field, i) => (
                    <Tag key={i} style={{ marginBottom: 4 }}>{field}</Tag>
                  ))}
                </div>
              </div>
              
              <div>
                <Text strong style={{ fontSize: 12 }}>Relations:</Text>
                <div style={{ marginTop: 4 }}>
                  {entity.relations.map((rel, i) => (
                    <Tag key={i} color="geekblue" style={{ marginBottom: 4 }}>{rel}</Tag>
                  ))}
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );

  // Render page features view
  const renderPageFeaturesView = () => (
    <div className="architecture-pages">
      <Row gutter={[16, 16]}>
        {Object.entries(pageFeatures).map(([key, page]) => (
          <Col span={8} key={key}>
            <Card 
              className="page-card"
              title={
                <Space>
                  {page.icon}
                  <Text strong>{page.name}</Text>
                </Space>
              }
              size="small"
            >
              <List
                size="small"
                dataSource={page.features}
                renderItem={feature => (
                  <List.Item style={{ padding: '8px 0' }}>
                    <List.Item.Meta
                      title={<Text style={{ fontSize: 13 }}>{feature.name}</Text>}
                      description={<Text type="secondary" style={{ fontSize: 11 }}>{feature.description}</Text>}
                    />
                  </List.Item>
                )}
              />
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );

  const viewTabs = [
    {
      key: 'high-level',
      label: <span><ClusterOutlined /> System Architecture</span>,
      children: renderHighLevelView()
    },
    {
      key: 'data-flow',
      label: <span><BranchesOutlined /> Data Flows</span>,
      children: renderDataFlowView()
    },
    {
      key: 'database',
      label: <span><DatabaseOutlined /> Database Schema</span>,
      children: renderDatabaseView()
    },
    {
      key: 'pages',
      label: <span><AppstoreOutlined /> Page Features</span>,
      children: renderPageFeaturesView()
    },
  ];

  return (
    <div className="architecture-docs">
      <div className="architecture-header">
        <div>
          <Title level={4} style={{ margin: 0 }}>
            <BulbOutlined /> HuntSphere Platform Architecture
          </Title>
          <Text type="secondary">Interactive documentation and system overview</Text>
        </div>
        <Space>
          <Button.Group>
            <Button 
              icon={<MinusOutlined />} 
              onClick={() => setZoomLevel(Math.max(50, zoomLevel - 10))}
              disabled={zoomLevel <= 50}
            />
            <Button disabled style={{ minWidth: 60 }}>{zoomLevel}%</Button>
            <Button 
              icon={<PlusOutlined />} 
              onClick={() => setZoomLevel(Math.min(150, zoomLevel + 10))}
              disabled={zoomLevel >= 150}
            />
          </Button.Group>
        </Space>
      </div>
      
      <Alert
        message="Interactive Architecture Documentation"
        description="Click on components to expand details. Use the tabs to switch between different views: System Architecture, Data Flows, Database Schema, and Page Features."
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />
      
      <Tabs 
        activeKey={activeView}
        onChange={setActiveView}
        items={viewTabs}
        className="architecture-tabs"
      />
    </div>
  );
};

export default ArchitectureDocs;
