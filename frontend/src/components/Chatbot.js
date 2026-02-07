import React, { useState, useRef, useEffect } from 'react';
import {
  Drawer, Button, Input, Space, Avatar, Typography, Tag, 
  Divider, Tooltip, message, Spin, Upload, List, Card, 
  Popconfirm, Badge, Empty, Modal, Form, Select, Row, Col,
  InputNumber
} from 'antd';
import {
  RobotOutlined, SendOutlined, UserOutlined, CloseOutlined,
  MessageOutlined, FileTextOutlined, DeleteOutlined, ClearOutlined,
  UploadOutlined, QuestionCircleOutlined, BulbOutlined, 
  WarningOutlined, CheckCircleOutlined, BookOutlined,
  GlobalOutlined, LinkOutlined, SafetyOutlined, DatabaseOutlined
} from '@ant-design/icons';
import client, { knowledgeAPI } from '../api/client';
import './Chatbot.css';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

function Chatbot() {
  const [visible, setVisible] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "👋 Hi! I'm HuntSphere Assistant, your AI-powered helper for the HuntSphere Threat Intelligence Platform. I can help you with:\n\n• Navigating platform features\n• Configuring SAML SSO and email notifications\n• Generating hunt queries for Defender, XSIAM, Splunk, Wiz\n• Understanding IOC extraction and MITRE mapping\n• Troubleshooting issues\n\nHow can I help you today?",
      sources: []
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [urlModalVisible, setUrlModalVisible] = useState(false);
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlForm] = Form.useForm();
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchDocuments = async () => {
    setDocsLoading(true);
    try {
      const response = await client.get('/chatbot/documents');
      setDocuments(response.data.documents || []);
    } catch (err) {
      console.error('Failed to fetch documents', err);
    } finally {
      setDocsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const response = await client.post('/chatbot/chat', {
        message: userMessage,
        context: {
          current_page: window.location.pathname
        }
      });

      const assistantMessage = {
        role: 'assistant',
        content: response.data.response,
        sources: response.data.sources || [],
        ragSources: response.data.rag_sources || [],
        feedbackNeeded: response.data.feedback_needed,
        feedbackPrompt: response.data.feedback_prompt,
        modelUsed: response.data.model_used,
        guardrailsApplied: response.data.guardrails_applied || false
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Chat failed', err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${err.response?.data?.detail || err.message}. Please make sure Ollama is running.`,
        error: true
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = async () => {
    try {
      await client.post('/chatbot/clear-history');
      setMessages([{
        role: 'assistant',
        content: "Conversation cleared! How can I help you?",
        sources: []
      }]);
      message.success('Conversation history cleared');
    } catch (err) {
      message.error('Failed to clear history');
    }
  };

  const handleFeedback = async (msg, issueType) => {
    try {
      await client.post('/chatbot/feedback', {
        message: `User reported: ${issueType} - Context: ${msg.content?.substring(0, 200)}`,
        issue_type: issueType,
        context: { messages: messages.slice(-5) }
      });
      message.success('Feedback submitted! Thank you for helping improve HuntSphere.');
    } catch (err) {
      message.error('Failed to submit feedback');
    }
  };

  const handleUpload = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', file.name);

    try {
      const response = await client.post('/chatbot/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      message.success(`Document "${response.data.title}" uploaded!`);
      fetchDocuments();
    } catch (err) {
      message.error(err.response?.data?.detail || 'Upload failed');
    }
    return false; // Prevent default upload behavior
  };

  const handleDeleteDocument = async (docId) => {
    try {
      await client.delete(`/chatbot/documents/${docId}`);
      message.success('Document deleted');
      fetchDocuments();
    } catch (err) {
      message.error(err.response?.data?.detail || 'Delete failed');
    }
  };

  const handleUrlSubmit = async (values) => {
    setUrlLoading(true);
    try {
      // Use user-level knowledge API to add URL to personal knowledge base
      const response = await knowledgeAPI.addUserUrl(
        values.url,
        values.title || `URL: ${values.url}`,
        values.crawl_depth || 0,
        values.max_pages || 10,
        null // description
      );
      
      message.success(`URL added to your personal knowledge base!`);
      setUrlModalVisible(false);
      urlForm.resetFields();
      fetchDocuments(); // Refresh document list
      
      // Add assistant message about the URL
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `✅ I've added "${values.title || values.url}" to your personal knowledge base${values.crawl_depth > 0 ? ` with depth ${values.crawl_depth} crawling` : ''}.\n\nThe content is being processed and will be available for questions shortly.\n\n📌 Note: This is stored in your personal knowledge base. Admin-managed documents have higher priority across the platform.`,
        sources: []
      }]);
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Failed to add URL';
      if (errorMsg.includes('already exists')) {
        message.warning(errorMsg);
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `⚠️ ${errorMsg}\n\nThis document is already part of the knowledge base. You can ask questions about it directly!`,
          sources: []
        }]);
      } else {
        message.error(errorMsg);
      }
    } finally {
      setUrlLoading(false);
    }
  };

  const renderMessage = (msg, index) => {
    const isUser = msg.role === 'user';

    return (
      <div key={index} className={`chat-message ${isUser ? 'user' : 'assistant'}`}>
        <div className="message-avatar">
          <Avatar
            icon={isUser ? <UserOutlined /> : <RobotOutlined />}
            style={{
              backgroundColor: isUser ? '#1890ff' : '#52c41a',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
            }}
          />
        </div>
        <div className="message-content">
          <div className="message-bubble" style={{
            backgroundColor: isUser ? '#1890ff' : '#f0f0f0',
            color: isUser ? 'white' : 'inherit',
            ...(msg.error && { backgroundColor: '#fff1f0', borderLeft: '3px solid #ff4d4f' })
          }}>
            <Paragraph style={{ 
              marginBottom: 0, 
              whiteSpace: 'pre-wrap',
              color: isUser ? 'white' : 'inherit'
            }}>
              {msg.content}
            </Paragraph>
          </div>
          
          {/* RAG Sources from Knowledge Base */}
          {msg.ragSources && msg.ragSources.length > 0 && (
            <div className="message-sources" style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 11 }}>
                <DatabaseOutlined /> Knowledge Base:
              </Text>
              {msg.ragSources.map((src, i) => (
                <Tooltip key={i} title={`Similarity: ${Math.round((src.similarity || 0) * 100)}%`}>
                  <Tag size="small" color="purple" style={{ fontSize: 10 }}>
                    {src.title}
                  </Tag>
                </Tooltip>
              ))}
            </div>
          )}

          {/* Built-in Doc Sources */}
          {msg.sources && msg.sources.filter(s => s.type === 'builtin_docs').length > 0 && (
            <div className="message-sources">
              <Text type="secondary" style={{ fontSize: 11 }}>
                <BookOutlined /> Docs:
              </Text>
              {msg.sources.filter(s => s.type === 'builtin_docs').map((src, i) => (
                <Tag key={i} size="small" color="blue" style={{ fontSize: 10 }}>
                  {src.title}
                </Tag>
              ))}
            </div>
          )}

          {/* Feedback prompt */}
          {msg.feedbackNeeded && (
            <div className="message-feedback">
              <Text type="warning" style={{ fontSize: 11 }}>
                <WarningOutlined /> {msg.feedbackPrompt}
              </Text>
              <Space size={4} style={{ marginTop: 4 }}>
                <Button 
                  size="small" 
                  type="link"
                  onClick={() => handleFeedback(msg, 'documentation')}
                >
                  Report Doc Issue
                </Button>
                <Button 
                  size="small" 
                  type="link"
                  onClick={() => handleFeedback(msg, 'feature')}
                >
                  Feature Request
                </Button>
              </Space>
            </div>
          )}

          {/* Model info and guardrails for assistant messages */}
          {!isUser && (msg.modelUsed || msg.guardrailsApplied) && (
            <div style={{ marginTop: 4 }}>
              {msg.modelUsed && (
                <Text type="secondary" style={{ fontSize: 10, marginRight: 8 }}>
                  <RobotOutlined /> {msg.modelUsed}
                </Text>
              )}
              {msg.guardrailsApplied && (
                <Tooltip title="Response was generated with safety guardrails applied">
                  <Tag size="small" color="green" style={{ fontSize: 9 }}>
                    <SafetyOutlined /> Guardrails
                  </Tag>
                </Tooltip>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Floating Button */}
      <Tooltip title="Ask HuntSphere Assistant">
        <Button
          type="primary"
          shape="circle"
          size="large"
          icon={<RobotOutlined />}
          onClick={() => setVisible(true)}
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            width: 56,
            height: 56,
            zIndex: 1000,
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            background: 'linear-gradient(135deg, #52c41a 0%, #1890ff 100%)'
          }}
        />
      </Tooltip>

      {/* Chat Drawer */}
      <Drawer
        title={
          <Space>
            <Avatar icon={<RobotOutlined />} style={{ backgroundColor: '#52c41a' }} />
            <div>
              <div style={{ fontWeight: 600 }}>HuntSphere Assistant</div>
              <Text type="secondary" style={{ fontSize: 11 }}>AI-powered help</Text>
            </div>
          </Space>
        }
        placement="right"
        onClose={() => setVisible(false)}
        open={visible}
        width={450}
        extra={
          <Space>
            <Tooltip title="Knowledge Base">
              <Button 
                icon={<FileTextOutlined />} 
                onClick={() => { setShowDocs(!showDocs); if (!showDocs) fetchDocuments(); }}
                type={showDocs ? 'primary' : 'default'}
              />
            </Tooltip>
            <Tooltip title="Clear History">
              <Popconfirm
                title="Clear conversation?"
                onConfirm={handleClearHistory}
                okText="Yes"
              >
                <Button icon={<ClearOutlined />} />
              </Popconfirm>
            </Tooltip>
          </Space>
        }
        styles={{
          body: { 
            padding: 0, 
            display: 'flex', 
            flexDirection: 'column',
            height: '100%'
          }
        }}
      >
        {showDocs ? (
          /* Knowledge Base View */
          <div style={{ padding: 16, height: '100%', overflow: 'auto' }}>
            <div style={{ marginBottom: 16 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Upload
                  beforeUpload={handleUpload}
                  showUploadList={false}
                  accept=".pdf,.txt,.csv,.xlsx,.xls,.png,.jpg,.jpeg"
                >
                  <Button icon={<UploadOutlined />} block>
                    Upload Document (PDF, Excel, TXT, Image)
                  </Button>
                </Upload>
                <Button 
                  icon={<GlobalOutlined />} 
                  onClick={() => setUrlModalVisible(true)}
                  block
                  type="dashed"
                >
                  Add URL / Crawl Website
                </Button>
              </Space>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                Add documents or websites to enhance chatbot knowledge (query syntax, product docs)
              </Text>
            </div>
            
            <Divider orientation="left" style={{ fontSize: 12 }}>
              Knowledge Base ({documents.length} docs)
            </Divider>
            
            {docsLoading ? (
              <div style={{ textAlign: 'center', padding: 20 }}><Spin /></div>
            ) : documents.length === 0 ? (
              <Empty description="No documents yet" />
            ) : (
              <List
                size="small"
                dataSource={documents}
                renderItem={(doc) => (
                  <List.Item
                    actions={[
                      doc.source !== 'builtin' && (
                        <Popconfirm
                          key="delete"
                          title="Delete this document?"
                          onConfirm={() => handleDeleteDocument(doc.id)}
                        >
                          <Button size="small" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                      )
                    ].filter(Boolean)}
                  >
                    <List.Item.Meta
                      avatar={<FileTextOutlined style={{ fontSize: 20, color: '#1890ff' }} />}
                      title={doc.title}
                      description={
                        <Space>
                          <Tag size="small">{doc.type}</Tag>
                          <Tag size="small" color={doc.source === 'builtin' ? 'green' : 'blue'}>
                            {doc.source}
                          </Tag>
                          <Text type="secondary" style={{ fontSize: 10 }}>
                            {doc.word_count} words
                          </Text>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </div>
        ) : (
          /* Chat View */
          <>
            <div className="chat-messages" style={{ 
              flex: 1, 
              overflow: 'auto', 
              padding: 16,
              background: '#fafafa'
            }}>
              {messages.map((msg, i) => renderMessage(msg, i))}
              {loading && (
                <div className="chat-message assistant">
                  <div className="message-avatar">
                    <Avatar icon={<RobotOutlined />} style={{ backgroundColor: '#52c41a' }} />
                  </div>
                  <div className="message-content">
                    <div className="message-bubble" style={{ backgroundColor: '#f0f0f0' }}>
                      <Spin size="small" /> <Text type="secondary">Thinking...</Text>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Actions */}
            <div style={{ padding: '8px 16px', borderTop: '1px solid #f0f0f0', background: '#fff' }}>
              <Space wrap size={4}>
                <Text type="secondary" style={{ fontSize: 11 }}>Quick:</Text>
                <Button size="small" onClick={() => setInput('How do I configure SAML SSO?')}>
                  SAML SSO
                </Button>
                <Button size="small" onClick={() => setInput('How do I extract IOCs from articles?')}>
                  Extract IOCs
                </Button>
                <Button size="small" onClick={() => setInput('Generate a KQL hunt query for a suspicious IP')}>
                  KQL Query
                </Button>
              </Space>
            </div>

            {/* Input Area */}
            <div style={{ 
              padding: 16, 
              borderTop: '1px solid #f0f0f0',
              background: '#fff'
            }}>
              <Space.Compact style={{ width: '100%' }}>
                <TextArea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onPressEnter={(e) => {
                    if (!e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Ask me anything about HuntSphere..."
                  autoSize={{ minRows: 1, maxRows: 4 }}
                  style={{ borderRadius: '8px 0 0 8px' }}
                  disabled={loading}
                />
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={handleSend}
                  loading={loading}
                  style={{ height: 'auto', borderRadius: '0 8px 8px 0' }}
                />
              </Space.Compact>
              <Text type="secondary" style={{ fontSize: 10, marginTop: 4, display: 'block' }}>
                <RobotOutlined /> Ollama • <DatabaseOutlined /> RAG Knowledge Base • <SafetyOutlined /> Guardrails
              </Text>
            </div>
          </>
        )}
      </Drawer>

      {/* URL Crawl Modal */}
      <Modal
        title={<Space><GlobalOutlined /> Add URL / Crawl Website</Space>}
        open={urlModalVisible}
        onCancel={() => {
          setUrlModalVisible(false);
          urlForm.resetFields();
        }}
        footer={null}
        width={500}
      >
        <Form form={urlForm} layout="vertical" onFinish={handleUrlSubmit}>
          <Form.Item
            name="url"
            label="URL"
            rules={[
              { required: true, message: 'URL is required' },
              { type: 'url', message: 'Please enter a valid URL' }
            ]}
          >
            <Input 
              prefix={<LinkOutlined />}
              placeholder="https://docs.microsoft.com/en-us/..." 
            />
          </Form.Item>
          
          <Form.Item name="title" label="Title (optional)">
            <Input placeholder="e.g., Microsoft Defender Query Reference" />
          </Form.Item>
          
          <Card size="small" style={{ marginBottom: 16, background: '#f6ffed' }}>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item 
                  name="crawl_depth" 
                  label="Crawl Depth" 
                  initialValue={0}
                  tooltip="How many levels of links to follow"
                >
                  <Select>
                    <Option value={0}>0 - Single Page</Option>
                    <Option value={1}>1 - Page + Links</Option>
                    <Option value={2}>2 - Deep Crawl</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item 
                  name="max_pages" 
                  label="Max Pages" 
                  initialValue={20}
                >
                  <Select>
                    <Option value={10}>10 pages</Option>
                    <Option value={20}>20 pages</Option>
                    <Option value={50}>50 pages</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Text type="secondary" style={{ fontSize: 11 }}>
              💡 Use depth 0 for a single page, or increase to crawl linked pages.
            </Text>
          </Card>
          
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" loading={urlLoading} block>
              Add to Knowledge Base
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

export default Chatbot;
