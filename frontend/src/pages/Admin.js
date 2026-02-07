import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Card, Tabs, Row, Col, Statistic, Tag, Space, Button, 
  Table, Spin, Alert, Descriptions, Badge, List, message, Switch, Select, Divider, Input,
  InputNumber, Modal, Form, Collapse, Steps, Tooltip, Typography, Popconfirm
} from 'antd';
import {
  UserOutlined, ApiOutlined, SettingOutlined, DashboardOutlined,
  CheckCircleOutlined, CloseCircleOutlined, SyncOutlined,
  ClockCircleOutlined, RobotOutlined, ScheduleOutlined,
  PlayCircleOutlined, PauseCircleOutlined,
  ToolOutlined, ThunderboltOutlined, ExperimentOutlined, DatabaseOutlined,
  EditOutlined, SaveOutlined, InfoCircleOutlined,
  SafetyOutlined, ClusterOutlined, PlusOutlined, DeleteOutlined,
  FileTextOutlined, BugOutlined, AimOutlined, BarChartOutlined, AuditOutlined,
  HistoryOutlined, BookOutlined, QuestionCircleOutlined, SendOutlined,
  BgColorsOutlined
} from '@ant-design/icons';
import ConnectorsManager from '../components/ConnectorsManager';
import ConfigurationManager from '../components/ConfigurationManager';
import GenAITester from '../components/GenAITester';
import ComprehensiveGenAILab from '../components/ComprehensiveGenAILab';
// GenAIModelConfig removed - model settings are now in GenAI Testing Lab
import GuardrailsManager from '../components/GuardrailsManager';
import RAGDashboard from '../components/RAGDashboard';
import UnifiedUserManagement from '../components/UnifiedUserManagement';
import SimpleAccessManager from '../components/SimpleAccessManager';
import ArchitectureDocs from '../components/ArchitectureDocs';
import SchedulerManager from '../components/SchedulerManager';
import ThemeManager from '../components/ThemeManager';
import { useTimezone } from '../context/TimezoneContext';
import { adminAPI } from '../api/client';
import './Admin.css';

const { Title, Text, Paragraph } = Typography;
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// Unified Documentation Component - combines Help, Docs, and Architecture
function ParshuDocumentation({ setActiveTab, availableModels }) {
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [docTab, setDocTab] = useState('help');
  const [selectedModel, setSelectedModel] = useState(null);
  
  // Get installed models for the assistant
  const installedModels = availableModels?.filter(m => m.installed) || [];
  
  const handleAskAI = async () => {
    if (!aiQuestion.trim()) {
      message.warning('Please enter a question');
      return;
    }
    
    setAiLoading(true);
    setAiResponse('');
    
    try {
      // Use the chatbot/help API with knowledge base
      const response = await fetch(`${API_URL}/genai/help`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({ 
          question: aiQuestion,
          model: selectedModel 
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setAiResponse(data.answer || data.response || 'No response received.');
      } else {
        // Provide helpful fallback response based on question
        const fallbackResponses = {
          'ollama': 'To set up Ollama:\n1. Install Ollama: brew install ollama (Mac) or follow docs.ollama.ai\n2. Start Ollama: ollama serve\n3. Pull a model: ollama pull llama3\n4. In Parshu Admin → Configuration, set Ollama URL to http://host.docker.internal:11434 (if using Docker)',
          'servicenow': 'To configure ServiceNow:\n1. Go to Admin → Configuration → Notifications\n2. Enter your ServiceNow instance URL\n3. Add username and password for API access\n4. Test the connection\n5. Enable "Create tickets on hunt failure" in Automation settings',
          'hunt': 'Hunt query troubleshooting:\n1. Check if platform connector is configured (Admin → Configuration)\n2. Verify API credentials are valid\n3. Ensure article has extracted IOCs\n4. Review Audit Logs for specific errors\n5. Try Preview Query first before executing',
          'feed': 'Feed/RSS troubleshooting:\n1. Verify feed URL is valid (test in browser)\n2. Check Sources page - is the feed active?\n3. Manually click "Fetch Feeds" to test\n4. Check Scheduler is running in Admin → Scheduler\n5. Review backend logs for parsing errors',
          'default': 'I can help with:\n• GenAI/Ollama setup\n• Platform connector configuration\n• Feed source management\n• Hunt query generation\n• Report creation\n• RBAC and permissions\n\nTry asking about a specific feature or issue!'
        };
        
        const lowerQ = aiQuestion.toLowerCase();
        let matchedResponse = fallbackResponses.default;
        for (const [key, value] of Object.entries(fallbackResponses)) {
          if (lowerQ.includes(key)) {
            matchedResponse = value;
            break;
          }
        }
        setAiResponse(matchedResponse);
      }
    } catch (err) {
      console.error('AI help error:', err);
      setAiResponse('Unable to connect to AI assistant. Please check that GenAI is configured in Admin → Configuration → GenAI.');
    } finally {
      setAiLoading(false);
    }
  };
  
  const helpTopics = [
    { 
      key: 'getting-started',
      title: 'Getting Started', 
      desc: 'Initial setup and configuration',
      content: 'Welcome to Parshu! Start by:\n1. Setting up GenAI (Admin → Configuration → GenAI)\n2. Adding RSS feed sources (Sources page)\n3. Configuring hunt platform connectors\n4. Creating user accounts with appropriate roles'
    },
    { 
      key: 'genai',
      title: 'GenAI Setup', 
      desc: 'Configure Ollama or API providers',
      content: 'GenAI Configuration:\n• For local: Use Ollama at http://host.docker.internal:11434\n• For cloud: Enter OpenAI/Anthropic API keys\n• Select primary and fallback models\n• Test connection with GenAI Lab'
    },
    { 
      key: 'feeds',
      title: 'Feed Sources', 
      desc: 'Add RSS/Atom feeds for ingestion',
      content: 'Adding Feeds:\n1. Go to Sources page\n2. Click "Add Source"\n3. Enter RSS/Atom feed URL\n4. Set priority and active status\n5. Scheduler auto-fetches on interval'
    },
    { 
      key: 'hunts',
      title: 'Hunt Platforms', 
      desc: 'Connect to Defender, XSIAM, Splunk',
      content: 'Hunt Connectors:\n• Microsoft Defender: Tenant ID, Client ID, Secret\n• Palo Alto XSIAM: API Key and Base URL\n• Splunk: Host, Token, Port\n• Wiz: API Key and Base URL\n\nConfigure in Admin → Configuration → Platform Connectors'
    },
    { 
      key: 'reports',
      title: 'Report Generation', 
      desc: 'Create and schedule reports',
      content: 'Reports:\n• Create from Articles or Intelligence\n• Use GenAI for auto-generation\n• Export to PDF, Word, CSV\n• Schedule daily/weekly reports in Scheduler'
    },
    { 
      key: 'rbac',
      title: 'RBAC & Permissions', 
      desc: 'User roles and access control',
      content: 'Roles:\n• ADMIN: Full access\n• EXECUTIVE: Reports and dashboards\n• MANAGER: Team oversight\n• TI: Threat intelligence analysis\n• TH: Hunt execution\n• IR: Incident response\n• VIEWER: Read-only'
    },
  ];
  
  const commonIssues = [
    {
      title: 'GenAI not responding',
      solution: [
        'Check if Ollama is running: docker ps | grep ollama',
        'Verify URL in Admin → GenAI (use host.docker.internal for local)',
        'Ensure model is pulled: docker exec ollama ollama pull llama3',
        'Check backend logs for connection errors'
      ]
    },
    {
      title: 'Hunt queries not executing',
      solution: [
        'Verify platform connector is configured in Admin → Configuration',
        'Check API credentials are valid and not expired',
        'Ensure connector is enabled (toggle switch)',
        'Review audit logs for specific errors'
      ]
    },
    {
      title: 'RSS feeds not updating',
      solution: [
        'Check if source is active in Sources page',
        'Verify the feed URL is accessible (try in browser)',
        'Check scheduler status in Admin → Scheduler',
        'Manually trigger ingestion with "Fetch Feeds" button'
      ]
    },
    {
      title: 'Reports not generating',
      solution: [
        'Ensure GenAI is configured and working',
        'Check if there are articles with extracted intelligence',
        'Verify user has REPORTS_WRITE permission',
        'Check backend logs for template errors'
      ]
    },
    {
      title: 'Images not showing in feeds',
      solution: [
        'Backend tries to fetch og:image from article URL',
        'If source doesn\'t provide images, placeholder is shown',
        'Check if article URL is accessible',
        'Some sites block image scraping - this is expected'
      ]
    }
  ];

  return (
    <Tabs
      activeKey={docTab}
      onChange={setDocTab}
      type="card"
      items={[
        {
          key: 'help',
          label: <span><QuestionCircleOutlined /> Help & Troubleshooting</span>,
          children: (
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <Row gutter={[16, 16]}>
                <Col span={16}>
                  {/* AI Troubleshooting Assistant */}
                  <Card 
                    title={<Space><RobotOutlined /> AI Troubleshooting Assistant</Space>}
                    extra={
                      <Space>
                        {installedModels.length > 0 && (
                          <Select
                            placeholder="Select model"
                            value={selectedModel}
                            onChange={setSelectedModel}
                            style={{ width: 180 }}
                            size="small"
                          >
                            {installedModels.map(m => (
                              <Select.Option key={m.id} value={m.id}>{m.name}</Select.Option>
                            ))}
                          </Select>
                        )}
                        <Tag color="purple">Powered by GenAI</Tag>
                      </Space>
                    }
                  >
                    <Paragraph type="secondary">
                      Ask questions about Parshu configuration, troubleshooting, or how to use features.
                    </Paragraph>
                    
                    <Input.TextArea 
                      rows={3}
                      value={aiQuestion}
                      onChange={e => setAiQuestion(e.target.value)}
                      placeholder="E.g., How do I configure ServiceNow integration? Why is my hunt query failing? How do I set up Ollama?"
                      style={{ marginBottom: 12 }}
                      onPressEnter={e => { if (e.ctrlKey) handleAskAI(); }}
                    />
                    
                    <Button 
                      type="primary" 
                      icon={<SendOutlined />}
                      onClick={handleAskAI}
                      loading={aiLoading}
                    >
                      Ask AI Assistant
                    </Button>
                    <Text type="secondary" style={{ marginLeft: 12, fontSize: 11 }}>Ctrl+Enter to send</Text>
                    
                    {aiResponse && (
                      <Card 
                        size="small" 
                        style={{ marginTop: 16, background: 'var(--bg-body)' }}
                        title={<Space><RobotOutlined /> AI Response</Space>}
                      >
                        <pre style={{ 
                          whiteSpace: 'pre-wrap', 
                          fontFamily: 'inherit', 
                          margin: 0,
                          fontSize: 13,
                          lineHeight: 1.6
                        }}>
                          {aiResponse}
                        </pre>
                      </Card>
                    )}
                  </Card>
                </Col>
                
                <Col span={8}>
                  {/* Quick Help Topics */}
                  <Card title={<Space><BookOutlined /> Quick Help Topics</Space>} size="small">
                    <List
                      size="small"
                      dataSource={helpTopics}
                      renderItem={item => (
                        <List.Item 
                          style={{ cursor: 'pointer' }} 
                          onClick={() => {
                            Modal.info({
                              title: item.title,
                              content: <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{item.content}</pre>,
                              width: 600
                            });
                          }}
                        >
                          <List.Item.Meta 
                            title={<Text style={{ fontSize: 12 }}>{item.title}</Text>}
                            description={<Text type="secondary" style={{ fontSize: 11 }}>{item.desc}</Text>}
                          />
                        </List.Item>
                      )}
                    />
                  </Card>
                </Col>
              </Row>
              
              {/* Common Issues & Solutions */}
              <Card title="Common Issues & Solutions" size="small">
                <Collapse size="small" accordion>
                  {commonIssues.map((issue, idx) => (
                    <Collapse.Panel header={issue.title} key={idx}>
                      <ol style={{ margin: 0, paddingLeft: 20 }}>
                        {issue.solution.map((step, i) => (
                          <li key={i} style={{ marginBottom: 4 }}>{step}</li>
                        ))}
                      </ol>
                    </Collapse.Panel>
                  ))}
                </Collapse>
              </Card>
            </Space>
          )
        },
        {
          key: 'architecture',
          label: <span><ClusterOutlined /> Architecture</span>,
          children: <ArchitectureDocs />
        },
        {
          key: 'metrics',
          label: <span><BarChartOutlined /> Metrics Reference</span>,
          children: (
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <Alert 
                type="info"
                message="Metric Definitions" 
                description="Reference for all analytics and reporting metrics. Use this to understand what each KPI measures and how it's calculated."
                showIcon
              />
              
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Card title="Time & SLA Metrics" size="small">
                    <Descriptions column={1} size="small" bordered>
                      <Descriptions.Item label="MTTD">
                        <strong>Mean Time to Detect</strong> - Average time from article publication to when it's flagged for hunting. Calculated as: (hunt_generated_at - published_at) averaged across articles.
                      </Descriptions.Item>
                      <Descriptions.Item label="MTTR">
                        <strong>Mean Time to Respond</strong> - Average time from detection to hunt completion. Calculated as: (hunt_completed_at - hunt_started_at) averaged.
                      </Descriptions.Item>
                      <Descriptions.Item label="SLA Compliance">
                        Percentage of articles processed within defined SLA thresholds (configurable per organization).
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>
                </Col>
                
                <Col span={12}>
                  <Card title="Intel Metrics" size="small">
                    <Descriptions column={1} size="small" bordered>
                      <Descriptions.Item label="IOCs Extracted">
                        Total Indicators of Compromise extracted using GenAI and regex patterns. Includes IPs, domains, hashes, CVEs, etc.
                      </Descriptions.Item>
                      <Descriptions.Item label="TTPs Mapped">
                        MITRE ATT&CK techniques identified and mapped. Confidence scored based on keyword matching and GenAI analysis.
                      </Descriptions.Item>
                      <Descriptions.Item label="Coverage Score">
                        Percentage of high-priority articles that have been fully processed (IOC extraction + hunt generated).
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>
                </Col>
                
                <Col span={12}>
                  <Card title="Hunt Metrics" size="small">
                    <Descriptions column={1} size="small" bordered>
                      <Descriptions.Item label="Hunt Success Rate">
                        (Completed Hunts / Total Executed) × 100. Higher is better.
                      </Descriptions.Item>
                      <Descriptions.Item label="Detection Rate">
                        Percentage of hunts that returned positive hits/results.
                      </Descriptions.Item>
                      <Descriptions.Item label="Articles to Hunts Ratio">
                        Number of articles generating hunts vs total articles. Indicates hunt coverage.
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>
                </Col>
                
                <Col span={12}>
                  <Card title="Efficiency Metrics" size="small">
                    <Descriptions column={1} size="small" bordered>
                      <Descriptions.Item label="Automation Hours Saved">
                        Estimated time saved through automated IOC extraction and hunt generation vs manual processing.
                      </Descriptions.Item>
                      <Descriptions.Item label="GenAI Utilization">
                        Percentage of articles processed using GenAI for summaries/extraction.
                      </Descriptions.Item>
                      <Descriptions.Item label="Team Productivity">
                        Composite score based on articles processed, hunts completed, and quality metrics.
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>
                </Col>
              </Row>
            </Space>
          )
        }
      ]}
    />
  );
}

function Admin() {
  const navigate = useNavigate();
  const { formatDateTime, getRelativeTime, getTimezoneAbbr } = useTimezone();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [stats, setStats] = useState(null);
  const [genaiStatus, setGenaiStatus] = useState(null);
  const [schedulerStatus, setSchedulerStatus] = useState(null);
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);
  const [availableModels, setAvailableModels] = useState([]);
  const [primaryModel, setPrimaryModel] = useState(null);
  const [secondaryModel, setSecondaryModel] = useState(null);
  const [savingPreferences, setSavingPreferences] = useState(false);
  
  // Quick Ollama setup state
  const [ollamaUrl, setOllamaUrl] = useState('http://host.docker.internal:11434');
  const [ollamaModel, setOllamaModel] = useState('llama3:latest');
  const [setupingOllama, setSetupingOllama] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState(null);
  const [checkingOllama, setCheckingOllama] = useState(false);
  
  // API provider configuration state
  const [apiKeys, setApiKeys] = useState({ openai: '', anthropic: '', gemini: '' });
  const [apiModels, setApiModels] = useState({ 
    openai: 'gpt-4-turbo-preview', 
    anthropic: 'claude-3-5-sonnet-20241022', 
    gemini: 'gemini-1.5-pro' 
  });
  
  // Data retention editing state - inline editing (no modal)
  const [retentionEditing, setRetentionEditing] = useState(false);
  const [savingRetention, setSavingRetention] = useState(false);
  const [retentionValues, setRetentionValues] = useState({
    article_retention_days: 90,
    audit_retention_days: 365,
    hunt_retention_days: 90,
    ioc_retention_days: 180,
    ttp_retention_days: 365,
    report_retention_days: 730,
  });
  
  // Active tab state (controlled to prevent reset on data refresh)
  const [activeTab, setActiveTab] = useState('overview');
  
  // Model pull tracking
  const [pullingModels, setPullingModels] = useState({});
  
  // Ollama Library modal state
  const [libraryModalVisible, setLibraryModalVisible] = useState(false);
  const [ollamaLibrary, setOllamaLibrary] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryCategory, setLibraryCategory] = useState('All');
  
  // Scheduler management state
  const [schedulerModalVisible, setSchedulerModalVisible] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [savingJob, setSavingJob] = useState(false);
  const [schedulerForm] = Form.useForm();
  
  // Database modal state
  const [databaseModalVisible, setDatabaseModalVisible] = useState(false);
  
  // Company branding settings for reports
  const [companyBranding, setCompanyBranding] = useState(() => {
    const saved = localStorage.getItem('orion-company-branding');
    return saved ? JSON.parse(saved) : {
      company_name: '',
      company_logo_url: '',
      confidentiality_notice: 'CONFIDENTIAL - For internal use only. Do not distribute.',
      report_footer: '',
    };
  });
  const [brandingModalVisible, setBrandingModalVisible] = useState(false);
  const [brandingForm] = Form.useForm();

  useEffect(() => {
    fetchAdminData(true);
    // Auto-check Ollama status on mount
    checkOllamaStatus();
  }, []);

  const fetchAdminData = async (isInitialLoad = false) => {
    // Only show full loading spinner on initial load
    if (isInitialLoad) {
      setLoading(true);
    }
    try {
      const token = localStorage.getItem('accessToken');
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const [settingsRes, statsRes, genaiRes, schedulerRes, healthRes, modelsRes] = await Promise.all([
        fetch(`${API_URL}/admin/settings`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/admin/stats`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/admin/genai/status`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/admin/scheduler/status`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/admin/health`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/admin/genai/models`, { headers }).then(r => r.json()).catch(() => ({ models: [] })),
      ]);
      
      setSettings(settingsRes);
      setStats(statsRes);
      setGenaiStatus(genaiRes);
      setSchedulerStatus(schedulerRes);
      setHealth(healthRes);
      setAvailableModels(modelsRes.models || []);
      
      // Only update model preferences on initial load to preserve user selections
      if (isInitialLoad) {
        setPrimaryModel(modelsRes.primary_model);
        setSecondaryModel(modelsRes.secondary_model);
        
        // Initialize retention values from settings
        setRetentionValues({
          article_retention_days: settingsRes?.article_retention_days || 90,
          audit_retention_days: settingsRes?.audit_retention_days || 365,
          hunt_retention_days: settingsRes?.hunt_retention_days || 90,
          ioc_retention_days: settingsRes?.ioc_retention_days || 180,
          ttp_retention_days: settingsRes?.ttp_retention_days || 365,
          report_retention_days: settingsRes?.report_retention_days || 730,
        });
      }
      
      setError(null);
    } catch (err) {
      setError('Failed to load admin data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const saveModelPreferences = async () => {
    if (!primaryModel) {
      message.warning('Please select a primary model');
      return;
    }
    
    setSavingPreferences(true);
    try {
      await adminAPI.setModelPreferences({ primary_model: primaryModel, secondary_model: secondaryModel });
      message.success('Model preferences saved successfully');
      // Don't call fetchAdminData here to avoid resetting the UI
    } catch (err) {
      message.error(err.response?.data?.detail || 'Failed to save model preferences');
      console.error(err);
    } finally {
      setSavingPreferences(false);
    }
  };

  // Save API key for a provider
  const saveApiKey = async (provider) => {
    const key = apiKeys[provider];
    const modelName = apiModels[provider];
    
    if (!key) {
      message.warning('Please enter an API key');
      return;
    }
    
    try {
      message.loading({ content: `Saving ${provider} configuration...`, key: `save-${provider}` });
      
      // Save API key to configuration
      await adminAPI.updateConfiguration({
        category: 'genai',
        key: `${provider}_api_key`,
        value: key,
        is_sensitive: true
      });
      
      // Save model preference if specified
      if (modelName) {
        await adminAPI.updateConfiguration({
          category: 'genai',
          key: `${provider}_model`,
          value: modelName
        });
      }
      
      message.success({ content: `${provider.charAt(0).toUpperCase() + provider.slice(1)} configured successfully!`, key: `save-${provider}` });
      
      // Refresh to show updated status
      fetchAdminData();
    } catch (err) {
      message.error({ content: `Failed to save ${provider} configuration: ${err.response?.data?.detail || err.message}`, key: `save-${provider}` });
      console.error(err);
    }
  };

  const checkOllamaStatus = async () => {
    if (checkingOllama) return; // Prevent multiple concurrent calls
    setCheckingOllama(true);
    try {
      const response = await adminAPI.getOllamaStatus();
      setOllamaStatus(response.data);
      if (response.data.connected) {
        setOllamaUrl(response.data.connected_url);
        message.success({ content: `Connected to Ollama at ${response.data.connected_url}`, key: 'ollama-status', duration: 3 });
      } else {
        message.warning({ content: 'Ollama not connected', key: 'ollama-status', duration: 3 });
      }
    } catch (err) {
      message.error({ content: 'Failed to check Ollama status', key: 'ollama-status' });
      console.error(err);
    } finally {
      setCheckingOllama(false);
    }
  };

  const pullOllamaModel = async (modelName) => {
    // First check if Ollama is connected
    if (!ollamaStatus?.connected) {
      message.warning({ 
        content: 'Ollama is not connected. Click "Check Status" first, or run Ollama with the Docker command above.', 
        key: `pull-${modelName}`,
        duration: 5
      });
      return;
    }
    
    try {
      // Mark model as pulling
      setPullingModels(prev => ({ ...prev, [modelName]: true }));
      message.loading({ 
        content: `Downloading ${modelName}... This may take 5-15 minutes depending on model size and connection speed.`, 
        key: `pull-${modelName}`, 
        duration: 0 
      });
      
      const response = await adminAPI.pullOllamaModel(modelName);
      
      if (response.data?.success) {
        message.info({ 
          content: `${modelName} download started! Checking progress every 10 seconds...`, 
          key: `pull-${modelName}`, 
          duration: 5 
        });
      }
      
      // Poll for completion
      let pollCount = 0;
      const maxPolls = 60; // 10 minutes at 10 second intervals
      
      const pollInterval = setInterval(async () => {
        pollCount++;
        try {
          const statusResponse = await adminAPI.getOllamaStatus();
          
          if (statusResponse.data.available_models?.includes(modelName)) {
            clearInterval(pollInterval);
            setPullingModels(prev => ({ ...prev, [modelName]: false }));
            message.success({ content: `✅ ${modelName} is now installed and ready!`, key: `pull-${modelName}` });
            setOllamaStatus(statusResponse.data);
          } else if (pollCount >= maxPolls) {
            clearInterval(pollInterval);
            setPullingModels(prev => ({ ...prev, [modelName]: false }));
            message.warning({ 
              content: `${modelName} is still downloading. Check back in a few minutes.`, 
              key: `pull-${modelName}` 
            });
          } else {
            // Update progress message
            message.loading({ 
              content: `Downloading ${modelName}... (${pollCount * 10}s elapsed, checking...)`, 
              key: `pull-${modelName}`, 
              duration: 0 
            });
          }
        } catch (e) {
          // Keep polling on error
          console.log('Poll check failed, continuing...', e);
        }
      }, 10000); // Check every 10 seconds
      
      // Store interval for cleanup
      return () => clearInterval(pollInterval);
      
    } catch (err) {
      setPullingModels(prev => ({ ...prev, [modelName]: false }));
      const errorDetail = err.response?.data?.detail || err.message || 'Failed to pull model';
      message.error({ 
        content: `Failed to pull ${modelName}: ${errorDetail}`, 
        key: `pull-${modelName}`,
        duration: 8
      });
      console.error('Model pull error:', err);
    }
  };

  // Fetch Ollama model library
  const fetchOllamaLibrary = async () => {
    setLibraryLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_URL}/admin/genai/ollama/library`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setOllamaLibrary(data.models || []);
      setLibraryModalVisible(true);
    } catch (err) {
      message.error('Failed to fetch Ollama library');
      console.error(err);
    } finally {
      setLibraryLoading(false);
    }
  };
  
  const quickSetupOllama = async () => {
    if (!ollamaUrl || !ollamaModel) {
      message.warning('Please enter Ollama URL and model name');
      return;
    }
    
    setSetupingOllama(true);
    try {
      const response = await adminAPI.setupOllama(ollamaUrl, ollamaModel, true);
      
      if (response.data.success) {
        message.success(response.data.message);
        if (response.data.pull_suggestion) {
          message.info(response.data.pull_suggestion, 10);
        }
        // Refresh models list
        fetchAdminData();
      } else {
        message.warning(response.data.message);
      }
    } catch (err) {
      message.error(err.response?.data?.detail || 'Failed to setup Ollama');
      console.error(err);
    } finally {
      setSetupingOllama(false);
    }
  };

  const deleteOllamaModel = async (modelName) => {
    try {
      message.loading({ content: `Deleting ${modelName}...`, key: `delete-${modelName}` });
      
      const response = await adminAPI.deleteOllamaModel(modelName);
      
      if (response.data?.success) {
        message.success({ content: `✅ ${modelName} has been deleted`, key: `delete-${modelName}` });
        // Refresh status to update model list
        checkOllamaStatus();
        fetchAdminData();
      }
    } catch (err) {
      const errorDetail = err.response?.data?.detail || err.message || 'Failed to delete model';
      message.error({ content: `Failed to delete ${modelName}: ${errorDetail}`, key: `delete-${modelName}` });
      console.error('Model delete error:', err);
    }
  };

  const handleRetentionChange = (key, value) => {
    setRetentionValues(prev => ({ ...prev, [key]: value }));
    setRetentionEditing(true);
  };

  const handleSaveRetention = async () => {
    setSavingRetention(true);
    try {
      const configurations = Object.entries(retentionValues).map(([key, value]) => ({
        category: 'data_retention',
        key,
        value: String(value),
        value_type: 'int'
      }));
      
      await adminAPI.saveConfigurations({ configurations });
      message.success('Data retention policies saved');
      setRetentionEditing(false);
      fetchAdminData();
    } catch (err) {
      message.error(err.response?.data?.detail || 'Failed to save retention policy');
      console.error(err);
    } finally {
      setSavingRetention(false);
    }
  };

  const handleCancelRetention = () => {
    // Reset to original values from settings
    setRetentionValues({
      article_retention_days: settings?.article_retention_days || 90,
      audit_retention_days: settings?.audit_retention_days || 365,
      hunt_retention_days: settings?.hunt_retention_days || 90,
      ioc_retention_days: settings?.ioc_retention_days || 180,
      ttp_retention_days: settings?.ttp_retention_days || 365,
      report_retention_days: settings?.report_retention_days || 730,
    });
    setRetentionEditing(false);
  };

  const handleRunJob = async (jobId) => {
    try {
      const token = localStorage.getItem('accessToken');
      await fetch(`${API_URL}/automation/scheduler/jobs/${jobId}/run`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      message.success(`Job ${jobId} triggered`);
      fetchAdminData();
    } catch (err) {
      message.error('Failed to run job');
    }
  };

  const handlePauseJob = async (jobId) => {
    try {
      const token = localStorage.getItem('accessToken');
      await fetch(`${API_URL}/automation/scheduler/jobs/${jobId}/pause`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      message.success(`Job ${jobId} paused`);
      fetchAdminData();
    } catch (err) {
      message.error('Failed to pause job');
    }
  };

  const handleResumeJob = async (jobId) => {
    try {
      const token = localStorage.getItem('accessToken');
      await fetch(`${API_URL}/automation/scheduler/jobs/${jobId}/resume`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      message.success(`Job ${jobId} resumed`);
      fetchAdminData();
    } catch (err) {
      message.error('Failed to resume job');
    }
  };

  const handleDeleteJob = async (jobId) => {
    try {
      const token = localStorage.getItem('accessToken');
      await fetch(`${API_URL}/automation/scheduler/jobs/${jobId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      message.success(`Job ${jobId} deleted`);
      fetchAdminData();
    } catch (err) {
      message.error('Failed to delete job');
    }
  };

  const handleAddJob = () => {
    setEditingJob(null);
    schedulerForm.resetFields();
    schedulerForm.setFieldsValue({
      trigger_type: 'interval',
      interval_minutes: 30,
      enabled: true
    });
    setSchedulerModalVisible(true);
  };

  const handleEditJob = (job) => {
    setEditingJob(job);
    // Parse trigger info
    let triggerType = 'interval';
    let intervalMinutes = 30;
    let cronExpression = '';
    
    if (job.trigger) {
      if (job.trigger.includes('cron')) {
        triggerType = 'cron';
        // Extract cron expression
        const cronMatch = job.trigger.match(/cron\[(.*?)\]/);
        if (cronMatch) cronExpression = cronMatch[1];
      } else if (job.trigger.includes('interval')) {
        triggerType = 'interval';
        // Extract interval
        const minMatch = job.trigger.match(/(\d+)\s*min/i);
        if (minMatch) intervalMinutes = parseInt(minMatch[1]);
      }
    }
    
    schedulerForm.setFieldsValue({
      name: job.name,
      job_id: job.id,
      trigger_type: triggerType,
      interval_minutes: intervalMinutes,
      cron_expression: cronExpression,
      enabled: !job.paused
    });
    setSchedulerModalVisible(true);
  };

  const handleSaveJob = async () => {
    try {
      const values = await schedulerForm.validateFields();
      setSavingJob(true);
      
      const token = localStorage.getItem('accessToken');
      const payload = {
        name: values.name,
        job_id: values.job_id || values.name.toLowerCase().replace(/\s+/g, '_'),
        trigger_type: values.trigger_type,
        interval_minutes: values.trigger_type === 'interval' ? values.interval_minutes : null,
        cron_expression: values.trigger_type === 'cron' ? values.cron_expression : null,
        enabled: values.enabled
      };
      
      const method = editingJob ? 'PUT' : 'POST';
      const url = editingJob 
        ? `${API_URL}/automation/scheduler/jobs/${editingJob.id}`
        : `${API_URL}/automation/scheduler/jobs`;
      
      const response = await fetch(url, {
        method,
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to save job');
      }
      
      message.success(editingJob ? 'Job updated' : 'Job created');
      setSchedulerModalVisible(false);
      fetchAdminData();
    } catch (err) {
      message.error(err.message || 'Failed to save job');
    } finally {
      setSavingJob(false);
    }
  };

  // Save company branding settings
  const handleSaveBranding = async (values) => {
    try {
      const brandingData = {
        company_name: values.company_name || '',
        company_logo_url: values.company_logo_url || '',
        confidentiality_notice: values.confidentiality_notice || 'CONFIDENTIAL - For internal use only.',
        report_footer: values.report_footer || '',
      };
      
      // Save to localStorage for now (could also save to backend)
      localStorage.setItem('orion-company-branding', JSON.stringify(brandingData));
      setCompanyBranding(brandingData);
      
      // Also save to backend SystemConfiguration if available
      try {
        const token = localStorage.getItem('accessToken');
        await fetch(`${API_URL}/admin/configurations`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            configurations: [
              { category: 'branding', key: 'company_name', value: brandingData.company_name },
              { category: 'branding', key: 'company_logo_url', value: brandingData.company_logo_url },
              { category: 'branding', key: 'confidentiality_notice', value: brandingData.confidentiality_notice },
              { category: 'branding', key: 'report_footer', value: brandingData.report_footer },
            ]
          })
        });
      } catch (err) {
        console.log('Backend branding save optional:', err);
      }
      
      message.success('Company branding settings saved');
      setBrandingModalVisible(false);
    } catch (err) {
      message.error('Failed to save branding settings');
    }
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'healthy': return <Badge status="success" text="Healthy" />;
      case 'degraded': return <Badge status="warning" text="Degraded" />;
      case 'unhealthy': return <Badge status="error" text="Unhealthy" />;
      case 'configured': return <Badge status="success" text="Configured" />;
      case 'not_configured': return <Badge status="default" text="Not Configured" />;
      case 'stopped': return <Badge status="warning" text="Stopped" />;
      default: return <Badge status="default" text={status} />;
    }
  };

  const items = [
    {
      key: 'overview',
      label: <span><DashboardOutlined /> Overview</span>,
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {/* System Stats - All Clickable */}
          <Card title={<Space><ThunderboltOutlined /> System Statistics</Space>} size="small">
            <Row gutter={[16, 16]}>
              <Col span={4}>
                <div className="stat-tile" onClick={() => setActiveTab('users')} style={{ cursor: 'pointer' }}>
                  <Statistic title="Users" value={stats?.total_users || 0} prefix={<UserOutlined />} />
                </div>
              </Col>
              <Col span={4}>
                <div className="stat-tile" onClick={() => navigate('/sources')} style={{ cursor: 'pointer' }}>
                  <Statistic title="Feed Sources" value={stats?.total_sources || 0} />
                </div>
              </Col>
              <Col span={4}>
                <div className="stat-tile" onClick={() => navigate('/articles')} style={{ cursor: 'pointer' }}>
                  <Statistic title="Articles" value={stats?.total_articles || 0} />
                </div>
              </Col>
              <Col span={4}>
                <div className="stat-tile" onClick={() => navigate('/hunts')} style={{ cursor: 'pointer' }}>
                  <Statistic title="Hunts" value={stats?.total_hunts || 0} />
                </div>
              </Col>
              <Col span={4}>
                <div className="stat-tile" onClick={() => setActiveTab('configuration')} style={{ cursor: 'pointer' }}>
                  <Statistic title="Active Connectors" value={stats?.active_connectors || 0} suffix={`/ ${stats?.total_connectors || 0}`} />
                </div>
              </Col>
              <Col span={4}>
                <div className="stat-tile" onClick={() => navigate('/reports')} style={{ cursor: 'pointer' }}>
                  <Statistic title="Reports" value={stats?.total_reports || 0} prefix={<BarChartOutlined />} />
                </div>
              </Col>
            </Row>
          </Card>

          {/* System Health */}
          <Card title={<Space><CheckCircleOutlined /> System Health</Space>} size="small" extra={getStatusBadge(health?.status)}>
            <Row gutter={[16, 16]}>
              {/* Database Status - Prominent tile */}
              <Col span={8}>
                <Card 
                  size="small" 
                  hoverable
                  onClick={() => setDatabaseModalVisible(true)}
                  style={{ cursor: 'pointer', height: '100%' }}
                  className="system-health-card"
                >
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Space>
                      <DatabaseOutlined style={{ fontSize: 24, color: '#1890ff' }} />
                      <div>
                        <Text strong style={{ fontSize: 16 }}>Database</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {settings?.database_name || 'PostgreSQL'}
                        </Text>
                      </div>
                    </Space>
                    <div style={{ marginTop: 8 }}>
                      <Tooltip title="Click for database details">
                        {health?.checks?.database?.status === 'healthy' ? (
                          <Tag 
                            color="success" 
                            icon={<CheckCircleOutlined />}
                            style={{ cursor: 'pointer' }}
                            onClick={(e) => { e.stopPropagation(); setDatabaseModalVisible(true); }}
                          >
                            Connected
                          </Tag>
                        ) : (
                          <Tag 
                            color="error" 
                            icon={<CloseCircleOutlined />}
                            style={{ cursor: 'pointer' }}
                            onClick={(e) => { e.stopPropagation(); setDatabaseModalVisible(true); }}
                          >
                            {health?.checks?.database?.status === 'unhealthy' ? 'Disconnected' : 'Error'}
                          </Tag>
                        )}
                      </Tooltip>
                      {health?.checks?.database?.error && (
                        <Text type="danger" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                          {health.checks.database.error.substring(0, 50)}...
                        </Text>
                      )}
                    </div>
                  </Space>
                </Card>
              </Col>
              
              {/* GenAI Status - Prominent tile */}
              <Col span={8}>
                <Card 
                  size="small" 
                  hoverable 
                  onClick={() => setActiveTab('genai')}
                  style={{ cursor: 'pointer', height: '100%' }}
                  className="system-health-card"
                >
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Space>
                      <RobotOutlined style={{ fontSize: 24, color: '#722ed1' }} />
                      <div>
                        <Text strong style={{ fontSize: 16 }}>GenAI</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {availableModels.length} model(s) available
                        </Text>
                      </div>
                    </Space>
                    <div style={{ marginTop: 8 }}>
                      <Tooltip title="Click for GenAI configuration">
                        {genaiStatus?.active_provider ? (
                          <Tag 
                            color="success" 
                            icon={<CheckCircleOutlined />}
                            style={{ cursor: 'pointer' }}
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              Modal.info({
                                title: 'GenAI Status',
                                content: (
                                  <div>
                                    <p><strong>Status:</strong> <Tag color="success">Active</Tag></p>
                                    <p><strong>Active Provider:</strong> {genaiStatus.active_provider}</p>
                                    <p><strong>Available Models:</strong> {availableModels.length}</p>
                                    {availableModels.length > 0 && (
                                      <ul style={{ marginTop: 8 }}>
                                        {availableModels.slice(0, 5).map((m, i) => (
                                          <li key={i}>{m.name || m.id || m}</li>
                                        ))}
                                        {availableModels.length > 5 && <li>...and {availableModels.length - 5} more</li>}
                                      </ul>
                                    )}
                                    <p style={{ marginTop: 16, color: '#888', fontSize: 12 }}>
                                      Click the GenAI tab for full configuration options.
                                    </p>
                                  </div>
                                )
                              });
                            }}
                          >
                            {genaiStatus.active_provider}
                          </Tag>
                        ) : (
                          <Tag 
                            color="warning"
                            style={{ cursor: 'pointer' }}
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              Modal.warning({
                                title: 'GenAI Not Configured',
                                content: (
                                  <div>
                                    <p><strong>Status:</strong> <Tag color="warning">Not Configured</Tag></p>
                                    <p>No GenAI provider is currently active.</p>
                                    <p style={{ marginTop: 16 }}><strong>To configure:</strong></p>
                                    <ol>
                                      <li>Go to the GenAI tab</li>
                                      <li>Set API keys for OpenAI, Gemini, Anthropic, or Ollama</li>
                                      <li>Select a primary model for each function</li>
                                    </ol>
                                  </div>
                                )
                              });
                            }}
                          >
                            Not Configured
                          </Tag>
                        )}
                      </Tooltip>
                    </div>
                  </Space>
                </Card>
              </Col>
              
              {/* Scheduler Status - Prominent tile */}
              <Col span={8}>
                <Card 
                  size="small" 
                  hoverable 
                  onClick={() => setActiveTab('scheduler')}
                  style={{ cursor: 'pointer', height: '100%' }}
                  className="system-health-card"
                >
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Space>
                      <ScheduleOutlined style={{ fontSize: 24, color: '#13c2c2' }} />
                      <div>
                        <Text strong style={{ fontSize: 16 }}>Scheduler</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {schedulerStatus?.job_count || 0} jobs configured
                        </Text>
                      </div>
                    </Space>
                    <div style={{ marginTop: 8 }}>
                      <Tooltip title="Click for scheduler details">
                        {schedulerStatus?.running ? (
                          <Tag 
                            color="success" 
                            icon={<CheckCircleOutlined />}
                            style={{ cursor: 'pointer' }}
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              Modal.info({
                                title: 'Scheduler Status',
                                width: 500,
                                content: (
                                  <div>
                                    <p><strong>Status:</strong> <Tag color="success">Running</Tag></p>
                                    <p><strong>Jobs Configured:</strong> {schedulerStatus?.job_count || 0}</p>
                                    {schedulerStatus?.jobs && schedulerStatus.jobs.length > 0 && (
                                      <div style={{ marginTop: 16 }}>
                                        <p><strong>Active Jobs:</strong></p>
                                        <ul>
                                          {schedulerStatus.jobs.slice(0, 5).map((job, i) => (
                                            <li key={i}>
                                              {job.name || job.id} - {job.next_run || 'Pending'}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                    <p style={{ marginTop: 16, color: '#888', fontSize: 12 }}>
                                      Click the Scheduler tab for full job management.
                                    </p>
                                  </div>
                                )
                              });
                            }}
                          >
                            Running
                          </Tag>
                        ) : (
                          <Tag 
                            color="warning" 
                            icon={<PauseCircleOutlined />}
                            style={{ cursor: 'pointer' }}
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              Modal.warning({
                                title: 'Scheduler Stopped',
                                content: (
                                  <div>
                                    <p><strong>Status:</strong> <Tag color="warning">Stopped</Tag></p>
                                    <p>The scheduler is currently not running.</p>
                                    <p><strong>Jobs Configured:</strong> {schedulerStatus?.job_count || 0}</p>
                                    <p style={{ marginTop: 16 }}><strong>To start:</strong></p>
                                    <ol>
                                      <li>Go to the Scheduler tab</li>
                                      <li>Click "Start Scheduler" button</li>
                                      <li>Verify jobs are executing on schedule</li>
                                    </ol>
                                  </div>
                                )
                              });
                            }}
                          >
                            Stopped
                          </Tag>
                        )}
                      </Tooltip>
                    </div>
                  </Space>
                </Card>
              </Col>
            </Row>
          </Card>

          {/* Settings - Merged from Settings tab */}
          {settings && (
            <Card title={<Space><SettingOutlined /> System Settings</Space>} size="small">
              <Row gutter={[16, 16]}>
                <Col span={8}>
                  <Card 
                    title={<Text strong style={{ color: 'var(--text-primary)' }}>Authentication</Text>} 
                    size="small" 
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
                  >
                    <Descriptions column={1} size="small" style={{ marginTop: 8 }}>
                      <Descriptions.Item label={<Text style={{ color: 'var(--text-secondary)' }}>SAML/SSO</Text>}>
                        <Tooltip title="Click for SAML/SSO details">
                          <Tag 
                            color={settings.saml_enabled ? "green" : "default"}
                            style={{ cursor: 'pointer' }}
                            onClick={() => Modal.info({
                              title: 'SAML/SSO Authentication',
                              content: (
                                <div>
                                  <p><strong>Status:</strong> {settings.saml_enabled ? <Tag color="green">Enabled</Tag> : <Tag>Disabled</Tag>}</p>
                                  <p><strong>Description:</strong> Security Assertion Markup Language (SAML) enables Single Sign-On (SSO) with enterprise identity providers.</p>
                                  {settings.saml_enabled ? (
                                    <p style={{ marginTop: 16 }}>Users can authenticate using your organization's identity provider (e.g., Okta, Azure AD, OneLogin).</p>
                                  ) : (
                                    <div style={{ marginTop: 16 }}>
                                      <p><strong>To enable:</strong></p>
                                      <ol>
                                        <li>Configure SAML settings in environment variables</li>
                                        <li>Set up IdP metadata URL</li>
                                        <li>Configure SP entity ID and ACS URL</li>
                                      </ol>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          >
                            {settings.saml_enabled ? 'Enabled' : 'Disabled'}
                          </Tag>
                        </Tooltip>
                      </Descriptions.Item>
                      <Descriptions.Item label={<Text style={{ color: 'var(--text-secondary)' }}>MFA/OTP</Text>}>
                        <Tooltip title="Click for MFA details">
                          <Tag 
                            color={settings.otp_enabled ? "green" : "default"}
                            style={{ cursor: 'pointer' }}
                            onClick={() => Modal.info({
                              title: 'Multi-Factor Authentication (MFA)',
                              content: (
                                <div>
                                  <p><strong>Status:</strong> {settings.otp_enabled ? <Tag color="green">Enabled</Tag> : <Tag>Disabled</Tag>}</p>
                                  <p><strong>Description:</strong> One-Time Password (OTP) adds an extra layer of security by requiring a time-based code during login.</p>
                                  {settings.otp_enabled ? (
                                    <p style={{ marginTop: 16 }}>Users must provide a TOTP code from their authenticator app (Google Authenticator, Authy, etc.).</p>
                                  ) : (
                                    <div style={{ marginTop: 16 }}>
                                      <p><strong>To enable:</strong></p>
                                      <ol>
                                        <li>Set OTP_ENABLED=true in environment</li>
                                        <li>Users will be prompted to set up MFA on next login</li>
                                      </ol>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          >
                            {settings.otp_enabled ? 'Enabled' : 'Disabled'}
                          </Tag>
                        </Tooltip>
                      </Descriptions.Item>
                      <Descriptions.Item label={<Text style={{ color: 'var(--text-secondary)' }}>JWT Expiry</Text>}>
                        <Tooltip title="Click for JWT details">
                          <Tag 
                            color="blue"
                            style={{ cursor: 'pointer' }}
                            onClick={() => Modal.info({
                              title: 'JWT Token Expiry',
                              content: (
                                <div>
                                  <p><strong>Current Setting:</strong> {settings.jwt_expiry_minutes} minutes</p>
                                  <p><strong>Description:</strong> Access tokens expire after this duration. Users will need to re-authenticate or use refresh tokens.</p>
                                  <p style={{ marginTop: 16 }}><strong>Recommendations:</strong></p>
                                  <ul>
                                    <li>30-60 min for high-security environments</li>
                                    <li>120-480 min for standard use</li>
                                    <li>Use refresh tokens for seamless re-authentication</li>
                                  </ul>
                                </div>
                              )
                            })}
                          >
                            {settings.jwt_expiry_minutes} min
                          </Tag>
                        </Tooltip>
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card 
                    title={<Text strong style={{ color: 'var(--text-primary)' }}>Notifications</Text>} 
                    size="small" 
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
                  >
                    <Descriptions column={1} size="small" style={{ marginTop: 8 }}>
                      <Descriptions.Item label={<Text style={{ color: 'var(--text-secondary)' }}>Email (SMTP)</Text>}>
                        <Tooltip title="Click for email configuration details">
                          <Tag 
                            color={settings.smtp_configured ? "green" : "orange"}
                            style={{ cursor: 'pointer' }}
                            onClick={() => Modal.info({
                              title: 'Email Notifications (SMTP)',
                              content: (
                                <div>
                                  <p><strong>Status:</strong> {settings.smtp_configured ? <Tag color="green">Configured</Tag> : <Tag color="orange">Not Configured</Tag>}</p>
                                  <p><strong>Description:</strong> Send email notifications for alerts, reports, and user invitations.</p>
                                  {!settings.smtp_configured && (
                                    <div style={{ marginTop: 16 }}>
                                      <p><strong>To configure:</strong></p>
                                      <ol>
                                        <li>Set SMTP_HOST, SMTP_PORT environment variables</li>
                                        <li>Set SMTP_USER and SMTP_PASSWORD</li>
                                        <li>Set EMAIL_FROM address</li>
                                      </ol>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          >
                            {settings.smtp_configured ? 'On' : 'Off'}
                          </Tag>
                        </Tooltip>
                      </Descriptions.Item>
                      <Descriptions.Item label={<Text style={{ color: 'var(--text-secondary)' }}>Slack</Text>}>
                        <Tooltip title="Click for Slack configuration details">
                          <Tag 
                            color={settings.slack_configured ? "green" : "orange"}
                            style={{ cursor: 'pointer' }}
                            onClick={() => Modal.info({
                              title: 'Slack Notifications',
                              content: (
                                <div>
                                  <p><strong>Status:</strong> {settings.slack_configured ? <Tag color="green">Configured</Tag> : <Tag color="orange">Not Configured</Tag>}</p>
                                  <p><strong>Description:</strong> Send alerts and notifications to Slack channels.</p>
                                  {!settings.slack_configured && (
                                    <div style={{ marginTop: 16 }}>
                                      <p><strong>To configure:</strong></p>
                                      <ol>
                                        <li>Create a Slack App and get Bot Token</li>
                                        <li>Set SLACK_BOT_TOKEN environment variable</li>
                                        <li>Configure channel IDs for notifications</li>
                                      </ol>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          >
                            {settings.slack_configured ? 'On' : 'Off'}
                          </Tag>
                        </Tooltip>
                      </Descriptions.Item>
                      <Descriptions.Item label={<Text style={{ color: 'var(--text-secondary)' }}>ServiceNow</Text>}>
                        <Tooltip title="Click for ServiceNow configuration details">
                          <Tag 
                            color={settings.servicenow_configured ? "green" : "orange"}
                            style={{ cursor: 'pointer' }}
                            onClick={() => Modal.info({
                              title: 'ServiceNow Integration',
                              content: (
                                <div>
                                  <p><strong>Status:</strong> {settings.servicenow_configured ? <Tag color="green">Configured</Tag> : <Tag color="orange">Not Configured</Tag>}</p>
                                  <p><strong>Description:</strong> Create incidents and tickets in ServiceNow from threat intelligence.</p>
                                  {!settings.servicenow_configured && (
                                    <div style={{ marginTop: 16 }}>
                                      <p><strong>To configure:</strong></p>
                                      <ol>
                                        <li>Set SERVICENOW_INSTANCE_URL</li>
                                        <li>Set SERVICENOW_USER and SERVICENOW_PASSWORD</li>
                                        <li>Configure table mappings for incidents</li>
                                      </ol>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          >
                            {settings.servicenow_configured ? 'On' : 'Off'}
                          </Tag>
                        </Tooltip>
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card 
                    title={<Text strong style={{ color: 'var(--text-primary)' }}>Feature Flags</Text>} 
                    size="small" 
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
                  >
                    <Descriptions column={1} size="small" style={{ marginTop: 8 }}>
                      <Descriptions.Item label={<Text style={{ color: 'var(--text-secondary)' }}>Watchlists</Text>}>
                        <Tooltip title="Click for watchlist feature details">
                          <Tag 
                            color={settings.watchlists_enabled ? "green" : "default"}
                            style={{ cursor: 'pointer' }}
                            onClick={() => Modal.info({
                              title: 'Watchlists Feature',
                              content: (
                                <div>
                                  <p><strong>Status:</strong> {settings.watchlists_enabled ? <Tag color="green">Enabled</Tag> : <Tag>Disabled</Tag>}</p>
                                  <p><strong>Description:</strong> Allow users to create and manage watchlists for tracking specific keywords, IOCs, or threat actors.</p>
                                  <p style={{ marginTop: 16 }}>When enabled, the Watchlist page allows monitoring for specific terms across ingested articles.</p>
                                </div>
                              )
                            })}
                          >
                            {settings.watchlists_enabled ? 'On' : 'Off'}
                          </Tag>
                        </Tooltip>
                      </Descriptions.Item>
                      <Descriptions.Item label={<Text style={{ color: 'var(--text-secondary)' }}>Debug Mode</Text>}>
                        <Tooltip title="Click for debug mode details">
                          <Tag 
                            color={settings.debug ? "orange" : "green"}
                            style={{ cursor: 'pointer' }}
                            onClick={() => Modal.info({
                              title: 'Debug Mode',
                              content: (
                                <div>
                                  <p><strong>Status:</strong> {settings.debug ? <Tag color="orange">Enabled</Tag> : <Tag color="green">Disabled</Tag>}</p>
                                  <p><strong>Description:</strong> Debug mode enables verbose logging and additional error details.</p>
                                  <p style={{ marginTop: 16, color: settings.debug ? 'red' : 'green' }}>
                                    {settings.debug 
                                      ? '⚠️ Warning: Debug mode should be disabled in production for security and performance.' 
                                      : '✓ Debug mode is properly disabled for production.'}
                                  </p>
                                </div>
                              )
                            })}
                          >
                            {settings.debug ? 'On' : 'Off'}
                          </Tag>
                        </Tooltip>
                      </Descriptions.Item>
                      <Descriptions.Item label={<Text style={{ color: 'var(--text-secondary)' }}>Version</Text>}>
                        <Tooltip title="Click for version info">
                          <Tag 
                            color="blue"
                            style={{ cursor: 'pointer' }}
                            onClick={() => Modal.info({
                              title: 'Application Version',
                              content: (
                                <div>
                                  <p><strong>Current Version:</strong> {settings.app_version}</p>
                                  <p><strong>Application:</strong> Parshu Threat Intelligence Platform</p>
                                  <p style={{ marginTop: 16 }}>Check the repository for the latest releases and changelog.</p>
                                </div>
                              )
                            })}
                          >
                            {settings.app_version}
                          </Tag>
                        </Tooltip>
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>
                </Col>
              </Row>
            </Card>
          )}

          {/* Company Branding for Reports */}
          <Card 
            className="branding-section"
            title={<Space><FileTextOutlined /> Company Branding for Reports</Space>} 
            size="small"
            extra={
              <Button 
                size="small" 
                icon={<EditOutlined />}
                onClick={() => {
                  brandingForm.setFieldsValue(companyBranding);
                  setBrandingModalVisible(true);
                }}
              >
                Configure
              </Button>
            }
          >
            <Row gutter={[16, 8]}>
              <Col span={12}>
                <Text type="secondary">Company Name:</Text>
                <div><Text strong>{companyBranding.company_name || <Text type="secondary" italic>Not configured</Text>}</Text></div>
              </Col>
              <Col span={12}>
                <Text type="secondary">Logo URL:</Text>
                <div>
                  {companyBranding.company_logo_url ? (
                    <Space>
                      <img 
                        src={companyBranding.company_logo_url} 
                        alt="Company Logo" 
                        style={{ maxHeight: 30, maxWidth: 100 }} 
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                      <Text code style={{ fontSize: 11 }}>{companyBranding.company_logo_url.substring(0, 30)}...</Text>
                    </Space>
                  ) : (
                    <Text type="secondary" italic>Not configured</Text>
                  )}
                </div>
              </Col>
              <Col span={24}>
                <Text type="secondary">Confidentiality Notice:</Text>
                <div><Text>{companyBranding.confidentiality_notice || <Text type="secondary" italic>Not configured</Text>}</Text></div>
              </Col>
            </Row>
            <Alert 
              message="Branding appears on all generated reports" 
              type="info" 
              showIcon 
              style={{ marginTop: 12 }}
              description="Configure your company name, logo, and confidentiality notice to be embedded in Intelligence Reports and exported documents."
            />
          </Card>

          {/* Data Retention - Inline Editable */}
          <Card 
            className="retention-section"
            title={<Space><HistoryOutlined /> Data Retention Policies</Space>} 
            size="small"
            extra={
              retentionEditing ? (
                <Space>
                  <Button size="small" onClick={handleCancelRetention}>Cancel</Button>
                  <Button 
                    type="primary" 
                    size="small" 
                    icon={<SaveOutlined />} 
                    onClick={handleSaveRetention}
                    loading={savingRetention}
                  >
                    Save All
                  </Button>
                </Space>
              ) : (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  <InfoCircleOutlined /> Click any value to edit
                </Text>
              )
            }
          >
            <Row gutter={[12, 12]} style={{ margin: 0 }}>
              {/* Articles */}
              <Col xs={12} sm={8} md={4}>
                <div className="retention-item">
                  <div className="retention-header">
                    <FileTextOutlined style={{ color: '#1890ff' }} />
                    <Text strong style={{ marginLeft: 8 }}>Articles</Text>
                  </div>
                  <div className="retention-value">
                    <InputNumber
                      min={7}
                      max={3650}
                      value={retentionValues.article_retention_days}
                      onChange={(v) => handleRetentionChange('article_retention_days', v)}
                      addonAfter="days"
                      size="small"
                    />
                  </div>
                  <Text type="secondary" style={{ fontSize: 10 }}>
                    Reviewed → Archived
                  </Text>
                </div>
              </Col>
              
              {/* IOCs */}
              <Col xs={12} sm={8} md={4}>
                <div className="retention-item">
                  <div className="retention-header">
                    <BugOutlined style={{ color: '#f5222d' }} />
                    <Text strong style={{ marginLeft: 8 }}>IOCs</Text>
                  </div>
                  <div className="retention-value">
                    <InputNumber
                      min={7}
                      max={3650}
                      value={retentionValues.ioc_retention_days}
                      onChange={(v) => handleRetentionChange('ioc_retention_days', v)}
                      addonAfter="days"
                      size="small"
                    />
                  </div>
                  <Text type="secondary" style={{ fontSize: 10 }}>
                    Archive unlinked IOCs
                  </Text>
                </div>
              </Col>
              
              {/* TTPs */}
              <Col xs={12} sm={8} md={4}>
                <div className="retention-item">
                  <div className="retention-header">
                    <AimOutlined style={{ color: '#722ed1' }} />
                    <Text strong style={{ marginLeft: 8 }}>TTPs</Text>
                  </div>
                  <div className="retention-value">
                    <InputNumber
                      min={7}
                      max={3650}
                      value={retentionValues.ttp_retention_days}
                      onChange={(v) => handleRetentionChange('ttp_retention_days', v)}
                      addonAfter="days"
                      size="small"
                    />
                  </div>
                  <Text type="secondary" style={{ fontSize: 10 }}>
                    Keep TTP mappings
                  </Text>
                </div>
              </Col>
              
              {/* Hunts */}
              <Col xs={12} sm={8} md={4}>
                <div className="retention-item">
                  <div className="retention-header">
                    <ThunderboltOutlined style={{ color: '#52c41a' }} />
                    <Text strong style={{ marginLeft: 8 }}>Hunts</Text>
                  </div>
                  <div className="retention-value">
                    <InputNumber
                      min={7}
                      max={3650}
                      value={retentionValues.hunt_retention_days}
                      onChange={(v) => handleRetentionChange('hunt_retention_days', v)}
                      addonAfter="days"
                      size="small"
                    />
                  </div>
                  <Text type="secondary" style={{ fontSize: 10 }}>
                    Hunt execution logs
                  </Text>
                </div>
              </Col>
              
              {/* Reports */}
              <Col xs={12} sm={8} md={4}>
                <div className="retention-item">
                  <div className="retention-header">
                    <BarChartOutlined style={{ color: '#fa8c16' }} />
                    <Text strong style={{ marginLeft: 8 }}>Reports</Text>
                  </div>
                  <div className="retention-value">
                    <InputNumber
                      min={30}
                      max={3650}
                      value={retentionValues.report_retention_days}
                      onChange={(v) => handleRetentionChange('report_retention_days', v)}
                      addonAfter="days"
                      size="small"
                    />
                  </div>
                  <Text type="secondary" style={{ fontSize: 10 }}>
                    Generated reports
                  </Text>
                </div>
              </Col>
              
              {/* Audit Logs */}
              <Col xs={12} sm={8} md={4}>
                <div className="retention-item">
                  <div className="retention-header">
                    <AuditOutlined style={{ color: '#13c2c2' }} />
                    <Text strong style={{ marginLeft: 8 }}>Audit Logs</Text>
                  </div>
                  <div className="retention-value">
                    <InputNumber
                      min={30}
                      max={3650}
                      value={retentionValues.audit_retention_days}
                      onChange={(v) => handleRetentionChange('audit_retention_days', v)}
                      addonAfter="days"
                      size="small"
                    />
                  </div>
                  <Text type="secondary" style={{ fontSize: 10 }}>
                    User activity logs
                  </Text>
                </div>
              </Col>
            </Row>
            
            {retentionEditing && (
              <Alert
                type="info"
                message="Changes detected"
                description="Click 'Save All' to apply your retention policy changes. The Weekly Cleanup job will use these values."
                style={{ marginTop: 16 }}
                showIcon
              />
            )}
          </Card>

        </Space>
      ),
    },
    {
      key: 'genai',
      label: <span><RobotOutlined /> GenAI</span>,
      children: genaiStatus && (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Alert 
            message={`Active Provider: ${genaiStatus.active_provider?.toUpperCase() || 'None'}`}
            type="info"
            showIcon
          />
          
          {/* Model Preferences */}
          <Card title="Model Preferences" size="small" extra={
            <Button 
              type="primary" 
              size="small" 
              onClick={saveModelPreferences}
              loading={savingPreferences}
            >
              Save Preferences
            </Button>
          }>
            <Row gutter={16}>
              <Col span={12}>
                <label style={{ display: 'block', marginBottom: 8 }}>Primary Model</label>
                <Select 
                  style={{ width: '100%' }}
                  value={primaryModel}
                  onChange={setPrimaryModel}
                  placeholder="Select primary model"
                >
                  <Select.OptGroup label="Local Models (Ollama)">
                    {availableModels.filter(m => m.type === 'local').map(m => (
                      <Select.Option key={m.id} value={m.id}>
                        <ThunderboltOutlined style={{ color: '#52c41a' }} /> {m.name}
                      </Select.Option>
                    ))}
                  </Select.OptGroup>
                  <Select.OptGroup label="API Models">
                    {availableModels.filter(m => m.type === 'api').map(m => (
                      <Select.Option key={m.id} value={m.id}>
                        <ApiOutlined style={{ color: '#1890ff' }} /> {m.name}
                      </Select.Option>
                    ))}
                  </Select.OptGroup>
                </Select>
                <div style={{ color: '#888', fontSize: 12, marginTop: 4 }}>
                  This model will be used for all GenAI operations by default
                </div>
              </Col>
              <Col span={12}>
                <label style={{ display: 'block', marginBottom: 8 }}>Secondary Model (Fallback)</label>
                <Select 
                  style={{ width: '100%' }}
                  value={secondaryModel}
                  onChange={setSecondaryModel}
                  placeholder="Select secondary model"
                  allowClear
                >
                  <Select.OptGroup label="Local Models (Ollama)">
                    {availableModels.filter(m => m.type === 'local').map(m => (
                      <Select.Option key={m.id} value={m.id}>
                        <ThunderboltOutlined style={{ color: '#52c41a' }} /> {m.name}
                      </Select.Option>
                    ))}
                  </Select.OptGroup>
                  <Select.OptGroup label="API Models">
                    {availableModels.filter(m => m.type === 'api').map(m => (
                      <Select.Option key={m.id} value={m.id}>
                        <ApiOutlined style={{ color: '#1890ff' }} /> {m.name}
                      </Select.Option>
                    ))}
                  </Select.OptGroup>
                </Select>
                <div style={{ color: '#888', fontSize: 12, marginTop: 4 }}>
                  Used when primary model fails or is unavailable
                </div>
              </Col>
            </Row>
          </Card>
          
          {/* Quick Ollama Setup - Enhanced with detailed admin guidance */}
          <Card 
            title={<Space><ThunderboltOutlined style={{ color: '#722ed1' }} /> Ollama Local AI Setup</Space>}
            size="small"
            extra={
              <Space>
                <Button 
                  type="primary"
                  size="small" 
                  onClick={fetchOllamaLibrary} 
                  loading={libraryLoading}
                  icon={<DatabaseOutlined />}
                >
                  Browse Model Library
                </Button>
                <Button 
                  size="small" 
                  onClick={checkOllamaStatus} 
                  loading={checkingOllama}
                  icon={<SyncOutlined />}
                >
                  Check Status
                </Button>
                <Tooltip title="Ollama is a free, local AI that runs on your machine - no API costs!">
                  <Tag color="purple">Free Local AI</Tag>
                </Tooltip>
              </Space>
            }
          >
            {/* Admin Guide Collapsible */}
            <Collapse 
              size="small" 
              style={{ marginBottom: 16, background: '#f6ffed', border: '1px solid #b7eb8f' }}
              items={[{
                key: 'admin-guide',
                label: <span style={{ fontWeight: 600 }}>📖 Admin Setup Guide - Read Before Setup</span>,
                children: (
                  <div style={{ fontSize: 13 }}>
                    <Title level={5} style={{ marginTop: 0, color: '#1890ff' }}>What is Ollama?</Title>
                    <Paragraph>
                      <strong>Ollama</strong> is a free, open-source tool that runs AI models locally on your machine.
                      No API keys needed, no usage costs, and your data stays private.
                    </Paragraph>
                    
                    <Divider style={{ margin: '12px 0' }} />
                    
                    <Title level={5} style={{ color: '#fa8c16' }}>⚠️ Important: Docker Networking</Title>
                    <Paragraph>
                      <strong>Parshu runs in Docker.</strong> This means "localhost" inside Parshu refers to the container itself,
                      NOT your host machine where Ollama runs. Use the correct URL:
                    </Paragraph>
                    
                    <Table 
                      size="small" 
                      pagination={false}
                      dataSource={[
                        { key: 1, scenario: 'Ollama on your Mac/Windows host', url: 'http://host.docker.internal:11434', notes: 'Docker Desktop special hostname' },
                        { key: 2, scenario: 'Ollama in Docker (same network)', url: 'http://ollama:11434', notes: 'Container service name' },
                        { key: 3, scenario: 'Ollama on another machine', url: 'http://192.168.x.x:11434', notes: 'Use actual IP address' },
                      ]}
                      columns={[
                        { title: 'Scenario', dataIndex: 'scenario', key: 'scenario' },
                        { title: 'URL to Use', dataIndex: 'url', key: 'url', render: (t) => <Text code copyable>{t}</Text> },
                        { title: 'Notes', dataIndex: 'notes', key: 'notes' },
                      ]}
                      style={{ marginBottom: 16 }}
                    />
                    
                    <Divider style={{ margin: '12px 0' }} />
                    
                    <Title level={5} style={{ color: '#52c41a' }}>Quick Start (Recommended)</Title>
                    <Steps 
                      direction="vertical" 
                      size="small"
                      items={[
                        {
                          title: 'Install Ollama on your machine',
                          description: (
                            <div>
                              <Text>Mac/Linux:</Text> <Text code>curl -fsSL https://ollama.com/install.sh | sh</Text>
                              <br />
                              <Text>Windows:</Text> Download from <a href="https://ollama.com/download" target="_blank" rel="noopener noreferrer">ollama.com/download</a>
                            </div>
                          )
                        },
                        {
                          title: 'Start Ollama service',
                          description: <Text code>ollama serve</Text>
                        },
                        {
                          title: 'Pull a model',
                          description: <Text code>ollama pull llama3:latest</Text>
                        },
                        {
                          title: 'Configure in Parshu',
                          description: (
                            <div>
                              URL: <Text code>http://host.docker.internal:11434</Text>
                              <br />
                              Model: Select from dropdown after clicking "Check Status"
                            </div>
                          )
                        }
                      ]}
                    />
                    
                    <Divider style={{ margin: '12px 0' }} />
                    
                    <Title level={5}>How Parshu Uses Ollama</Title>
                    <List 
                      size="small"
                      dataSource={[
                        'IOC & TTP Extraction - Identifies indicators and techniques from articles',
                        'Executive & Technical Summaries - AI-generated article analysis',
                        'Hunt Query Generation - Creates platform-specific search queries',
                        'Chatbot - Interactive AI assistant for threat intel',
                        'Report Generation - Synthesizes intelligence into reports',
                      ]}
                      renderItem={(item) => <List.Item><CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />{item}</List.Item>}
                    />
                  </div>
                )
              }]}
            />

            {/* Status Alert */}
            {ollamaStatus && (
              <Alert
                message={ollamaStatus.connected ? 
                  <Space><CheckCircleOutlined /> Connected to Ollama</Space> : 
                  <Space><CloseCircleOutlined /> Ollama Not Connected</Space>
                }
                description={
                  ollamaStatus.connected ? (
                    <div>
                      <Row gutter={16}>
                        <Col span={12}>
                          <Text strong>URL:</Text> <Text code>{ollamaStatus.connected_url}</Text>
                        </Col>
                        <Col span={12}>
                          <Text strong>Models Installed:</Text> {ollamaStatus.available_models?.length || 0}
                        </Col>
                      </Row>
                      {ollamaStatus.available_models?.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <Space wrap>
                            {ollamaStatus.available_models.map(m => (
                              <Tag key={m} color="green">{m}</Tag>
                            ))}
                          </Space>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <Paragraph type="danger" style={{ marginBottom: 8 }}>
                        {ollamaStatus.error || 'Cannot connect to Ollama'}
                      </Paragraph>
                      <Paragraph style={{ marginBottom: 0 }}>
                        <strong>💡 Quick Fix:</strong> If Ollama is running on your host machine, 
                        use URL: <Text code copyable>http://host.docker.internal:11434</Text>
                      </Paragraph>
                    </div>
                  )
                }
                type={ollamaStatus.connected ? "success" : "error"}
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}

            {!ollamaStatus && (
              <Alert
                message="Ollama: Free Local AI for Threat Intelligence"
                description={
                  <div>
                    <Paragraph style={{ marginBottom: 8 }}>
                      Ollama runs AI models locally on your machine with <strong>zero API costs</strong>. 
                      Perfect for sensitive threat intel work where data privacy matters.
                    </Paragraph>
                    <Text type="secondary">
                      👆 Click "Check Status" to auto-detect Ollama, or expand the Admin Guide above for setup instructions.
                    </Text>
                  </div>
                }
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}

            {/* Setup Form */}
            <Card size="small" style={{ background: '#fafafa', marginBottom: 16 }}>
              <Row gutter={16} align="bottom">
                <Col span={9}>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
                    Ollama URL
                    <Tooltip title="For Docker: use host.docker.internal to reach your host machine">
                      <InfoCircleOutlined style={{ marginLeft: 4, color: '#1890ff' }} />
                    </Tooltip>
                  </label>
                  <Input
                    value={ollamaUrl}
                    onChange={(e) => setOllamaUrl(e.target.value)}
                    placeholder="http://host.docker.internal:11434"
                    addonBefore={<ApiOutlined />}
                  />
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    Auto-detects correct URL if localhost doesn't work
                  </Text>
                </Col>
                <Col span={9}>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
                    Model Name
                    <Tooltip title="Select an installed model or enter a new one to pull">
                      <InfoCircleOutlined style={{ marginLeft: 4, color: '#1890ff' }} />
                    </Tooltip>
                  </label>
                  <Select
                    style={{ width: '100%' }}
                    value={ollamaModel}
                    onChange={setOllamaModel}
                    placeholder="Select or type model name"
                    showSearch
                    allowClear
                  >
                    {ollamaStatus?.available_models?.length > 0 && (
                      <Select.OptGroup label="✅ Installed Models">
                        {ollamaStatus.available_models.map(m => (
                          <Select.Option key={m} value={m}>
                            <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 4 }} />{m}
                          </Select.Option>
                        ))}
                      </Select.OptGroup>
                    )}
                    <Select.OptGroup label="📥 Popular Models (will be pulled)">
                      <Select.Option value="llama3:latest">llama3:latest (Best overall)</Select.Option>
                      <Select.Option value="llama3:8b">llama3:8b (Smaller, faster)</Select.Option>
                      <Select.Option value="mistral:latest">mistral:latest (Fast)</Select.Option>
                      <Select.Option value="mixtral:latest">mixtral:latest (Advanced)</Select.Option>
                      <Select.Option value="codellama:latest">codellama:latest (Code analysis)</Select.Option>
                    </Select.OptGroup>
                  </Select>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    Models not installed will be pulled automatically
                  </Text>
                </Col>
                <Col span={6}>
                  <Button
                    type="primary"
                    size="large"
                    block
                    onClick={quickSetupOllama}
                    loading={setupingOllama}
                    icon={<ThunderboltOutlined />}
                  >
                    Setup & Activate
                  </Button>
                </Col>
              </Row>
            </Card>

            {/* Installed Models Summary */}
            {ollamaStatus?.available_models?.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <Divider orientation="left" style={{ marginBottom: 12 }}>
                  <Space>
                    <CheckCircleOutlined style={{ color: '#52c41a' }} />
                    Installed Models ({ollamaStatus.available_models.length})
                  </Space>
                </Divider>
                <Row gutter={[12, 12]}>
                  {ollamaStatus.available_models.map(modelName => (
                    <Col xs={12} sm={8} md={6} key={modelName}>
                      <Card 
                        size="small" 
                        style={{ background: '#f6ffed', borderColor: '#b7eb8f' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Space>
                            <CheckCircleOutlined style={{ color: '#52c41a' }} />
                            <Text strong style={{ fontSize: 13 }}>{modelName}</Text>
                          </Space>
                        </div>
                        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                          <Button 
                            size="small" 
                            type="primary"
                            onClick={() => {
                              setOllamaModel(modelName);
                              quickSetupOllama();
                            }}
                          >
                            Use
                          </Button>
                          <Popconfirm
                            title="Delete Model"
                            description={`Delete ${modelName} from Ollama? This will free up disk space.`}
                            onConfirm={() => deleteOllamaModel(modelName)}
                            okText="Delete"
                            cancelText="Cancel"
                            okButtonProps={{ danger: true }}
                          >
                            <Button 
                              size="small" 
                              danger
                              icon={<DeleteOutlined />}
                            />
                          </Popconfirm>
                        </div>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </div>
            )}
              
            {/* One-click Docker Install Section */}
            {!ollamaStatus?.connected && (
              <Card 
                size="small" 
                style={{ marginTop: 16, background: '#fff7e6', borderColor: '#ffd591' }}
                title={<Space><ThunderboltOutlined style={{ color: '#fa8c16' }} /> Quick Docker Install</Space>}
              >
                <Paragraph style={{ marginBottom: 12 }}>
                  Don't have Ollama installed? Run this command in your terminal to start Ollama in Docker:
                </Paragraph>
                <div style={{ background: '#1f1f1f', padding: 12, borderRadius: 4, marginBottom: 12 }}>
                  <Text 
                    code 
                    copyable={{ text: 'docker run -d -v ollama:/root/.ollama -p 11434:11434 --name ollama ollama/ollama && sleep 5 && docker exec ollama ollama pull llama3:latest' }}
                    style={{ color: '#52c41a', fontSize: 12 }}
                  >
                    docker run -d -v ollama:/root/.ollama -p 11434:11434 --name ollama ollama/ollama && docker exec ollama ollama pull llama3:latest
                  </Text>
                </div>
                <Space>
                  <Text type="secondary">After running, click</Text>
                  <Button size="small" onClick={checkOllamaStatus} loading={checkingOllama}>
                    Check Status
                  </Button>
                  <Text type="secondary">to connect</Text>
                </Space>
              </Card>
            )}
          </Card>
          
          {/* API Provider Configuration */}
          <Card 
            title={<Space><ApiOutlined /> Cloud API Providers</Space>}
            size="small"
            extra={
              <Tooltip title="Configure API keys for cloud AI providers. Keys are encrypted and stored securely.">
                <InfoCircleOutlined style={{ color: '#1890ff' }} />
              </Tooltip>
            }
          >
            <Alert
              message="API keys are optional - Ollama (local) works without any API keys"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Row gutter={[16, 16]}>
              {/* OpenAI */}
              <Col span={8}>
                <Card 
                  size="small" 
                  title={
                    <Space>
                      <span>OpenAI</span>
                      {genaiStatus.providers?.openai?.configured ? 
                        <Tag color="green" icon={<CheckCircleOutlined />}>Connected</Tag> : 
                        <Tag>Not Configured</Tag>
                      }
                    </Space>
                  }
                  style={{ height: '100%' }}
                >
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Input.Password
                      placeholder="sk-..."
                      value={apiKeys?.openai || ''}
                      onChange={(e) => setApiKeys(prev => ({ ...prev, openai: e.target.value }))}
                      addonBefore="API Key"
                    />
                    <Select
                      style={{ width: '100%' }}
                      placeholder="Select model"
                      value={apiModels?.openai}
                      onChange={(val) => setApiModels(prev => ({ ...prev, openai: val }))}
                    >
                      <Select.Option value="gpt-4-turbo-preview">GPT-4 Turbo</Select.Option>
                      <Select.Option value="gpt-4">GPT-4</Select.Option>
                      <Select.Option value="gpt-3.5-turbo">GPT-3.5 Turbo</Select.Option>
                    </Select>
                    <Button 
                      type="primary" 
                      size="small" 
                      block
                      onClick={() => saveApiKey('openai')}
                      disabled={!apiKeys?.openai}
                    >
                      Save & Connect
                    </Button>
                  </Space>
                </Card>
              </Col>
              
              {/* Anthropic (Claude) */}
              <Col span={8}>
                <Card 
                  size="small" 
                  title={
                    <Space>
                      <span>Anthropic (Claude)</span>
                      {genaiStatus.providers?.anthropic?.configured ? 
                        <Tag color="green" icon={<CheckCircleOutlined />}>Connected</Tag> : 
                        <Tag>Not Configured</Tag>
                      }
                    </Space>
                  }
                  style={{ height: '100%' }}
                >
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Input.Password
                      placeholder="sk-ant-..."
                      value={apiKeys?.anthropic || ''}
                      onChange={(e) => setApiKeys(prev => ({ ...prev, anthropic: e.target.value }))}
                      addonBefore="API Key"
                    />
                    <Select
                      style={{ width: '100%' }}
                      placeholder="Select model"
                      value={apiModels?.anthropic}
                      onChange={(val) => setApiModels(prev => ({ ...prev, anthropic: val }))}
                    >
                      <Select.Option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</Select.Option>
                      <Select.Option value="claude-3-opus-20240229">Claude 3 Opus</Select.Option>
                      <Select.Option value="claude-3-sonnet-20240229">Claude 3 Sonnet</Select.Option>
                    </Select>
                    <Button 
                      type="primary" 
                      size="small" 
                      block
                      onClick={() => saveApiKey('anthropic')}
                      disabled={!apiKeys?.anthropic}
                    >
                      Save & Connect
                    </Button>
                  </Space>
                </Card>
              </Col>
              
              {/* Gemini */}
              <Col span={8}>
                <Card 
                  size="small" 
                  title={
                    <Space>
                      <span>Google Gemini</span>
                      {genaiStatus.providers?.gemini?.configured ? 
                        <Tag color="green" icon={<CheckCircleOutlined />}>Connected</Tag> : 
                        <Tag>Not Configured</Tag>
                      }
                    </Space>
                  }
                  style={{ height: '100%' }}
                >
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Input.Password
                      placeholder="AIza..."
                      value={apiKeys?.gemini || ''}
                      onChange={(e) => setApiKeys(prev => ({ ...prev, gemini: e.target.value }))}
                      addonBefore="API Key"
                    />
                    <Select
                      style={{ width: '100%' }}
                      placeholder="Select model"
                      value={apiModels?.gemini}
                      onChange={(val) => setApiModels(prev => ({ ...prev, gemini: val }))}
                    >
                      <Select.Option value="gemini-1.5-pro">Gemini 1.5 Pro</Select.Option>
                      <Select.Option value="gemini-pro">Gemini Pro</Select.Option>
                    </Select>
                    <Button 
                      type="primary" 
                      size="small" 
                      block
                      onClick={() => saveApiKey('gemini')}
                      disabled={!apiKeys?.gemini}
                    >
                      Save & Connect
                    </Button>
                  </Space>
                </Card>
              </Col>
            </Row>
          </Card>

          {/* Provider Status Summary */}
          <Card title="Provider Status Summary" size="small">
            <Row gutter={[16, 16]}>
              {Object.entries(genaiStatus.providers || {}).map(([provider, info]) => (
                <Col span={6} key={provider}>
                  <Card 
                    size="small"
                    style={{ 
                      background: info.configured ? '#f6ffed' : '#fafafa',
                      borderColor: info.configured ? '#b7eb8f' : '#d9d9d9'
                    }}
                  >
                    <Space direction="vertical" size={4}>
                      <Space>
                        <Text strong style={{ textTransform: 'uppercase' }}>{provider}</Text>
                        {info.configured ? 
                          <CheckCircleOutlined style={{ color: '#52c41a' }} /> : 
                          <CloseCircleOutlined style={{ color: '#d9d9d9' }} />
                        }
                      </Space>
                      {info.model && <Text type="secondary" style={{ fontSize: 12 }}>Model: {info.model}</Text>}
                      {provider === 'ollama' && info.available_models && (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {info.available_models.length} models available
                        </Text>
                      )}
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        </Space>
      ),
    },
    {
      key: 'scheduler',
      label: <span><ScheduleOutlined /> Job Scheduler</span>,
      children: <SchedulerManager />,
    },
    {
      key: 'scheduler-legacy',
      label: <span style={{ display: 'none' }}><ScheduleOutlined /> Legacy Scheduler</span>,
      style: { display: 'none' },
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {schedulerStatus && (
            <>
              <Alert 
                message={
                  <Space>
                    <span>Automation Scheduler</span>
                    <Tag color={schedulerStatus.running ? 'success' : 'warning'}>
                      {schedulerStatus.running ? 'Running' : 'Stopped'}
                    </Tag>
                    <Tag>{schedulerStatus.job_count} jobs configured</Tag>
                  </Space>
                }
                type={schedulerStatus.running ? 'success' : 'warning'}
                showIcon
                action={
                  <Button size="small" type="primary" icon={<PlusOutlined />} onClick={handleAddJob}>
                    Add Job
                  </Button>
                }
              />
              
              <Card 
                title={<Space><ScheduleOutlined /> Scheduled Jobs</Space>}
                size="small"
              >
                <Table
                  dataSource={schedulerStatus.jobs}
                  rowKey="id"
                  size="small"
                  pagination={false}
                  expandable={{
                    expandedRowRender: (record) => (
                      <div style={{ padding: '8px 0' }}>
                        <Row gutter={16}>
                          <Col span={8}>
                            <Text strong>What it does:</Text>
                            <Paragraph style={{ margin: '4px 0 0 0', fontSize: 13 }}>
                              {record.details || 'No details available'}
                            </Paragraph>
                          </Col>
                          <Col span={8}>
                            <Text strong>Impact:</Text>
                            <Paragraph style={{ margin: '4px 0 0 0', fontSize: 13 }}>
                              {record.impact || 'No impact information'}
                            </Paragraph>
                          </Col>
                          <Col span={8}>
                            <Text strong>Schedule:</Text>
                            <Paragraph style={{ margin: '4px 0 0 0', fontSize: 13 }}>
                              {record.trigger}
                            </Paragraph>
                          </Col>
                        </Row>
                      </div>
                    ),
                    rowExpandable: () => true,
                  }}
                  columns={[
                    {
                      title: 'Job',
                      dataIndex: 'name',
                      key: 'name',
                      width: 280,
                      render: (text, record) => (
                        <div>
                          <Space>
                            <span style={{ fontWeight: 500 }}>{text}</span>
                            <Tag color={record.paused ? 'orange' : 'green'} style={{ fontSize: 10 }}>
                              {record.paused ? 'Paused' : 'Active'}
                            </Tag>
                          </Space>
                          <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                            {record.description || <Tag style={{ fontSize: 10 }}>{record.id}</Tag>}
                          </div>
                        </div>
                      )
                    },
                    {
                      title: 'Schedule',
                      dataIndex: 'trigger',
                      key: 'trigger',
                      width: 180,
                      render: (text) => {
                        let humanReadable = text;
                        if (text.includes('interval')) {
                          const match = text.match(/(\d+):(\d+):(\d+)/);
                          if (match) {
                            const hours = parseInt(match[1]);
                            const mins = parseInt(match[2]);
                            if (hours > 0) humanReadable = `Every ${hours}h ${mins}m`;
                            else humanReadable = `Every ${mins} min`;
                          }
                        } else if (text.includes('cron')) {
                          if (text.includes('day_of_week=\'sun\'')) humanReadable = 'Weekly (Sunday)';
                          else if (text.includes('hour=\'8\'')) humanReadable = 'Daily at 8:00 AM';
                          else if (text.includes('hour=\'2\'')) humanReadable = 'Daily at 2:00 AM';
                          else humanReadable = 'Cron schedule';
                        }
                        return (
                          <Tooltip title={text}>
                            <Tag color="blue" style={{ fontSize: 11 }}>{humanReadable}</Tag>
                          </Tooltip>
                        );
                      }
                    },
                    {
                      title: `Next Run (${getTimezoneAbbr()})`,
                      dataIndex: 'next_run',
                      key: 'next_run',
                      width: 180,
                      render: (text) => text ? (
                        <Tooltip title={formatDateTime(text)}>
                          <Text style={{ fontSize: 12 }}>
                            {formatDateTime(text)}
                          </Text>
                        </Tooltip>
                      ) : <Tag>Paused</Tag>
                    },
                    {
                      title: 'Actions',
                      key: 'actions',
                      width: 200,
                      render: (_, record) => (
                        <Space size="small">
                          <Tooltip title="Run Now">
                            <Button 
                              type="primary" 
                              size="small" 
                              icon={<PlayCircleOutlined />}
                              onClick={() => handleRunJob(record.id)}
                            >
                              Run
                            </Button>
                          </Tooltip>
                          {record.paused ? (
                            <Tooltip title="Resume">
                              <Button 
                                size="small" 
                                icon={<PlayCircleOutlined />}
                                onClick={() => handleResumeJob(record.id)}
                              />
                            </Tooltip>
                          ) : (
                            <Tooltip title="Pause">
                              <Button 
                                size="small" 
                                icon={<PauseCircleOutlined />}
                                onClick={() => handlePauseJob(record.id)}
                              />
                            </Tooltip>
                          )}
                          <Tooltip title="Edit">
                            <Button 
                              size="small" 
                              icon={<EditOutlined />}
                              onClick={() => handleEditJob(record)}
                            />
                          </Tooltip>
                          <Tooltip title="Delete">
                            <Button 
                              size="small" 
                              danger
                              icon={<DeleteOutlined />}
                              onClick={() => {
                                Modal.confirm({
                                  title: 'Delete Job',
                                  content: `Are you sure you want to delete "${record.name}"? This cannot be undone.`,
                                  okText: 'Delete',
                                  okType: 'danger',
                                  onOk: () => handleDeleteJob(record.id)
                                });
                              }}
                            />
                          </Tooltip>
                        </Space>
                      )
                    }
                  ]}
                />
              </Card>
            </>
          )}
          
          {/* Job Edit/Create Modal */}
          <Modal
            title={editingJob ? 'Edit Scheduled Job' : 'Create New Job'}
            open={schedulerModalVisible}
            onCancel={() => setSchedulerModalVisible(false)}
            onOk={handleSaveJob}
            confirmLoading={savingJob}
            okText={editingJob ? 'Update' : 'Create'}
            width={600}
          >
            <Form
              form={schedulerForm}
              layout="vertical"
            >
              <Form.Item
                name="name"
                label="Job Name"
                rules={[{ required: true, message: 'Please enter a job name' }]}
              >
                <Input placeholder="e.g., Process New Articles" />
              </Form.Item>
              
              <Form.Item
                name="job_id"
                label="Job ID"
                rules={[{ required: true, message: 'Please enter a job ID' }]}
                extra="Unique identifier (lowercase, underscores). Example: process_new_articles"
              >
                <Input 
                  placeholder="e.g., process_new_articles" 
                  disabled={!!editingJob}
                />
              </Form.Item>
              
              <Form.Item
                name="trigger_type"
                label="Trigger Type"
                rules={[{ required: true }]}
              >
                <Select>
                  <Select.Option value="interval">Interval (run every X minutes)</Select.Option>
                  <Select.Option value="cron">Cron (scheduled at specific times)</Select.Option>
                </Select>
              </Form.Item>
              
              <Form.Item noStyle shouldUpdate={(prev, curr) => prev.trigger_type !== curr.trigger_type}>
                {({ getFieldValue }) => 
                  getFieldValue('trigger_type') === 'interval' ? (
                    <Form.Item
                      name="interval_minutes"
                      label="Interval (minutes)"
                      rules={[{ required: true, message: 'Please specify interval' }]}
                    >
                      <InputNumber min={1} max={10080} style={{ width: '100%' }} />
                    </Form.Item>
                  ) : (
                    <Form.Item
                      name="cron_expression"
                      label="Cron Expression"
                      rules={[{ required: true, message: 'Please enter cron expression' }]}
                      extra="Format: minute hour day_of_month month day_of_week. Example: 0 8 * * * (daily at 8 AM)"
                    >
                      <Input placeholder="0 8 * * *" />
                    </Form.Item>
                  )
                }
              </Form.Item>
              
              <Form.Item
                name="enabled"
                label="Status"
                valuePropName="checked"
              >
                <Switch checkedChildren="Enabled" unCheckedChildren="Paused" />
              </Form.Item>
            </Form>
          </Modal>
        </Space>
      ),
    },
    {
      key: 'users',
      label: <span><UserOutlined /> Access Management</span>,
      children: <SimpleAccessManager />,
    },
    {
      key: 'configuration',
      label: <span><ToolOutlined /> Configuration</span>,
      children: (
        <Tabs
          defaultActiveKey="config"
          type="card"
          size="small"
          items={[
            {
              key: 'config',
              label: <span><SettingOutlined /> System Configuration</span>,
              children: <ConfigurationManager />,
            },
            {
              key: 'connectors',
              label: <span><ApiOutlined /> Platform Connectors</span>,
              children: <ConnectorsManager />,
            },
            {
              key: 'guardrails',
              label: <span><SafetyOutlined /> Prompt Guardrails</span>,
              children: <GuardrailsManager />,
            },
          ]}
        />
      ),
    },
    {
      key: 'genai-lab',
      label: <span><ExperimentOutlined /> GenAI Testing Lab</span>,
      children: <ComprehensiveGenAILab />,
    },
    {
      key: 'knowledge-base',
      label: <span><DatabaseOutlined /> Knowledge Base</span>,
      children: <RAGDashboard />,
    },
    {
      key: 'documentation',
      label: <span><BookOutlined /> Documentation</span>,
      children: <ParshuDocumentation setActiveTab={setActiveTab} availableModels={availableModels} />,
    },
    {
      key: 'appearance',
      label: <span><BgColorsOutlined /> Appearance</span>,
      children: <ThemeManager />,
    },
  ];

  return (
    <div style={{ padding: 20 }}>
      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}
      
      <Card 
        title={
          <Space>
            <SettingOutlined />
            Admin Dashboard
            {loading && <Spin size="small" style={{ marginLeft: 8 }} />}
          </Space>
        }
      >
        <Tabs items={items} activeKey={activeTab} onChange={setActiveTab} size="large" destroyInactiveTabPane={false} />
      </Card>

      {/* Database Details Modal */}
      <Modal
        title={<Space><DatabaseOutlined /> Database Details</Space>}
        open={databaseModalVisible}
        onCancel={() => setDatabaseModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDatabaseModalVisible(false)}>
            Close
          </Button>
        ]}
        width={600}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Card size="small" title="Connection Info">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Database Type">
                <Tag color="blue">PostgreSQL</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Database Name">
                {settings?.database_name || 'orion'}
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                {health?.checks?.database?.status === 'healthy' ? (
                  <Tag color="success" icon={<CheckCircleOutlined />}>Connected</Tag>
                ) : (
                  <Tag color="error" icon={<CloseCircleOutlined />}>Disconnected</Tag>
                )}
                {health?.checks?.database?.error && (
                  <Text type="danger" style={{ marginLeft: 8, fontSize: 12 }}>
                    Error: {health.checks.database.error}
                  </Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Host">
                {settings?.database_host || 'postgres (Docker)'}
              </Descriptions.Item>
            </Descriptions>
          </Card>
          
          <Card size="small" title="Storage Statistics">
            <Row gutter={16}>
              <Col span={8}>
                <Statistic 
                  title="Articles" 
                  value={stats?.total_articles || 0}
                  prefix={<FileTextOutlined />}
                />
              </Col>
              <Col span={8}>
                <Statistic 
                  title="Hunts" 
                  value={stats?.total_hunts || 0}
                  prefix={<ThunderboltOutlined />}
                />
              </Col>
              <Col span={8}>
                <Statistic 
                  title="Users" 
                  value={stats?.total_users || 0}
                  prefix={<UserOutlined />}
                />
              </Col>
            </Row>
          </Card>
          
          <Alert
            message="Data Retention"
            description={`Articles are retained for ${retentionValues.article_retention_days} days. Configure retention policies in the Overview tab.`}
            type="info"
            showIcon
          />
        </Space>
      </Modal>

      {/* Ollama Model Library Modal */}
      <Modal
        title={
          <Space>
            <DatabaseOutlined style={{ color: '#722ed1' }} />
            Ollama Model Library
            {ollamaLibrary.filter(m => m.installed).length > 0 && (
              <Tag color="success">{ollamaLibrary.filter(m => m.installed).length} installed</Tag>
            )}
          </Space>
        }
        open={libraryModalVisible}
        onCancel={() => setLibraryModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setLibraryModalVisible(false)}>
            Close
          </Button>
        ]}
        width={900}
      >
        {/* Category Filter */}
        <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Text strong style={{ lineHeight: '32px' }}>Category:</Text>
          {['All', 'General', 'Code', 'Reasoning', 'Compact', 'Specialized', 'Vision', 'Custom'].map(cat => (
            <Tag 
              key={cat}
              color={libraryCategory === cat ? 'blue' : 'default'}
              style={{ cursor: 'pointer', padding: '4px 12px', fontSize: 13 }}
              onClick={() => setLibraryCategory(cat)}
            >
              {cat}
            </Tag>
          ))}
        </div>
        
        {/* Models Table */}
        <Table
          dataSource={ollamaLibrary.filter(m => libraryCategory === 'All' || m.category === libraryCategory)}
          rowKey="name"
          size="small"
          pagination={{ pageSize: 10 }}
          loading={libraryLoading}
          columns={[
            {
              title: 'Model',
              dataIndex: 'name',
              key: 'name',
              width: 200,
              render: (name, record) => (
                <Space>
                  {record.installed ? (
                    <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  ) : (
                    <CloseCircleOutlined style={{ color: '#d9d9d9' }} />
                  )}
                  <Text strong={record.installed}>{name}</Text>
                </Space>
              )
            },
            {
              title: 'Size',
              key: 'size',
              width: 100,
              render: (_, record) => (
                <Text type={record.installed ? 'success' : 'secondary'}>
                  {record.installed && record.actual_size ? record.actual_size : record.size}
                </Text>
              )
            },
            {
              title: 'Description',
              dataIndex: 'description',
              key: 'description',
              ellipsis: true
            },
            {
              title: 'Category',
              dataIndex: 'category',
              key: 'category',
              width: 100,
              render: (cat) => <Tag>{cat}</Tag>
            },
            {
              title: 'Status',
              key: 'status',
              width: 120,
              render: (_, record) => (
                record.installed ? (
                  <Tag color="success" icon={<CheckCircleOutlined />}>Installed</Tag>
                ) : (
                  <Tag color="default">Available</Tag>
                )
              )
            },
            {
              title: 'Action',
              key: 'action',
              width: 120,
              render: (_, record) => {
                if (record.installed) {
                  return (
                    <Space size="small">
                      <Button 
                        size="small" 
                        type="primary"
                        onClick={() => {
                          setOllamaModel(record.name);
                          setLibraryModalVisible(false);
                          quickSetupOllama();
                        }}
                      >
                        Use
                      </Button>
                      <Popconfirm
                        title="Delete Model"
                        description={`Delete ${record.name}? This will free up disk space.`}
                        onConfirm={() => {
                          deleteOllamaModel(record.name);
                          // Refresh library after delete
                          setTimeout(() => fetchOllamaLibrary(), 2000);
                        }}
                        okText="Delete"
                        cancelText="Cancel"
                        okButtonProps={{ danger: true }}
                      >
                        <Button size="small" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    </Space>
                  );
                }
                
                if (pullingModels[record.name]) {
                  return <Tag color="processing" icon={<SyncOutlined spin />}>Downloading...</Tag>;
                }
                
                if (!ollamaStatus?.connected) {
                  return (
                    <Tooltip title="Connect to Ollama first">
                      <Button size="small" disabled>Download</Button>
                    </Tooltip>
                  );
                }
                
                return (
                  <Button 
                    size="small" 
                    type="primary" 
                    ghost
                    onClick={() => {
                      pullOllamaModel(record.name);
                    }}
                  >
                    Download
                  </Button>
                );
              }
            }
          ]}
        />
        
        {!ollamaStatus?.connected && (
          <Alert
            message="Ollama Not Connected"
            description="Connect to Ollama first to download or use models. Click 'Check Status' on the GenAI page."
            type="warning"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}
      </Modal>

      {/* Company Branding Modal */}
      <Modal
        title={<Space><FileTextOutlined /> Configure Company Branding</Space>}
        open={brandingModalVisible}
        onCancel={() => setBrandingModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={brandingForm}
          layout="vertical"
          onFinish={handleSaveBranding}
          initialValues={companyBranding}
        >
          <Alert
            message="Report Branding"
            description="These settings will be embedded in all generated Intelligence Reports, MITRE mappings, and exported documents."
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          
          <Form.Item
            name="company_name"
            label="Company Name"
            extra="Appears in report headers and footers"
          >
            <Input placeholder="Acme Corporation" prefix={<SafetyOutlined />} />
          </Form.Item>
          
          <Form.Item
            name="company_logo_url"
            label="Company Logo URL"
            extra="Enter a URL to your company logo (PNG, JPG, or SVG recommended)"
          >
            <Input placeholder="https://example.com/logo.png" />
          </Form.Item>
          
          {brandingForm.getFieldValue('company_logo_url') && (
            <div style={{ marginBottom: 16, textAlign: 'center', padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
              <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>Logo Preview:</Text>
              <img 
                src={brandingForm.getFieldValue('company_logo_url')} 
                alt="Logo Preview" 
                style={{ maxHeight: 80, maxWidth: 200 }} 
                onError={(e) => { e.target.src = ''; e.target.alt = 'Failed to load'; }}
              />
            </div>
          )}
          
          <Form.Item
            name="confidentiality_notice"
            label="Confidentiality Notice"
            extra="This notice will appear at the top and bottom of all reports"
          >
            <Input.TextArea 
              rows={3} 
              placeholder="CONFIDENTIAL - For internal use only. Do not distribute without authorization." 
            />
          </Form.Item>
          
          <Form.Item
            name="report_footer"
            label="Report Footer (Optional)"
            extra="Additional text for report footers (e.g., copyright, contact info)"
          >
            <Input.TextArea 
              rows={2} 
              placeholder="© 2026 Company Name. For questions, contact security@company.com" 
            />
          </Form.Item>
          
          <Divider />
          
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setBrandingModalVisible(false)}>
                Cancel
              </Button>
              <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
                Save Branding Settings
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default Admin;
