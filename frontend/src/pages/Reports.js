import React, { useState, useEffect, useMemo } from 'react';
import { 
  Table, Card, Button, Space, Tag, Modal, Form, Input, 
  Select, Typography, message, Drawer, Descriptions, Tabs,
  Empty, Divider, List, Checkbox, Popconfirm, Switch, Tooltip, Dropdown, Alert
} from 'antd';
import {
  PlusOutlined, 
  FileTextOutlined, 
  ShareAltOutlined,
  EyeOutlined,
  DownloadOutlined,
  MailOutlined,
  DeleteOutlined,
  RobotOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  FileExcelOutlined,
  GlobalOutlined,
  CopyOutlined,
  MoreOutlined,
  EditOutlined,
  CheckCircleOutlined,
  SaveOutlined,
  BarChartOutlined,
  DashboardOutlined,
  SearchOutlined,
  CalendarOutlined
} from '@ant-design/icons';
import { reportsAPI, articlesAPI } from '../api/client';
import { useAuthStore } from '../store';
import FormattedContent from '../components/FormattedContent';
import { useTimezone } from '../context/TimezoneContext';
import AnalyticsDashboard from '../components/AnalyticsDashboard';
import './Reports.css';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

// Roles that can create, edit, and delete reports
const REPORT_EDIT_ROLES = ['ADMIN', 'TI', 'TI_ANALYST', 'MANAGER'];
// Roles that can view reports (includes executives)
const REPORT_VIEW_ROLES = ['ADMIN', 'TI', 'TI_ANALYST', 'MANAGER', 'EXECUTIVE', 'TH', 'IR', 'VIEWER'];

function Reports() {
  const { user, isImpersonating, assumedRole } = useAuthStore();
  const { formatDateTime, getRelativeTime } = useTimezone();
  const [activeTab, setActiveTab] = useState('analytics');
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState([]);
  const [articles, setArticles] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedArticleIds, setSelectedArticleIds] = useState([]);
  const [shareEmails, setShareEmails] = useState('');
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [useGenAI, setUseGenAI] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  
  // Article search and filter state
  const [articleSearch, setArticleSearch] = useState('');
  const [articleDateFilter, setArticleDateFilter] = useState(null); // 'today', 'week', 'month', null
  
  // Respect impersonation for role-based UI
  const effectiveRole = isImpersonating ? assumedRole : user?.role;
  
  // Filter articles based on search and date
  const filteredArticles = useMemo(() => {
    let filtered = [...articles];
    
    // Search filter
    if (articleSearch.trim()) {
      const searchLower = articleSearch.toLowerCase();
      filtered = filtered.filter(a => 
        (a.title || '').toLowerCase().includes(searchLower) ||
        (a.summary || '').toLowerCase().includes(searchLower)
      );
    }
    
    // Date filter
    if (articleDateFilter) {
      const now = new Date();
      let cutoff;
      
      switch (articleDateFilter) {
        case 'today':
          cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          cutoff = null;
      }
      
      if (cutoff) {
        filtered = filtered.filter(a => {
          const articleDate = new Date(a.published_at || a.created_at);
          return articleDate >= cutoff;
        });
      }
    }
    
    // Sort by date (newest first)
    filtered.sort((a, b) => {
      const dateA = new Date(a.published_at || a.created_at || 0);
      const dateB = new Date(b.published_at || b.created_at || 0);
      return dateB - dateA;
    });
    
    return filtered;
  }, [articles, articleSearch, articleDateFilter]);
  
  // Check if user can edit/create/delete reports (uses effective role)
  const canEditReports = effectiveRole && REPORT_EDIT_ROLES.includes(effectiveRole);

  useEffect(() => {
    fetchReports();
    fetchArticles();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const response = await reportsAPI.list();
      setReports(response.data.reports || response.data || []);
    } catch (err) {
      console.error('Failed to fetch reports', err);
      // Demo data
      setReports([
        {
          id: 1,
          title: 'Weekly Threat Intelligence Summary - Jan 2026',
          report_type: 'comprehensive',
          article_ids: [1, 2, 3],
          generated_at: new Date().toISOString(),
          shared_with_emails: ['security@company.com'],
          content: '# Weekly Summary\n\nThis week we observed...',
        },
        {
          id: 2,
          title: 'Ransomware Campaign Analysis',
          report_type: 'technical',
          article_ids: [4, 5],
          generated_at: new Date(Date.now() - 86400000).toISOString(),
          shared_with_emails: [],
          content: '## Technical Analysis\n\nThe ransomware variant...',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchArticles = async () => {
    try {
      const response = await articlesAPI.getTriageQueue(1, 100);
      setArticles(response.data.articles || response.data.items || []);
    } catch (err) {
      console.error('Failed to fetch articles', err);
    }
  };

  const handleCreate = () => {
    form.resetFields();
    setSelectedArticleIds([]);
    setModalVisible(true);
  };

  const handleSubmit = async (values) => {
    if (selectedArticleIds.length === 0) {
      message.warning('Please select at least one article');
      return;
    }

    // Prevent double submission
    if (submitting) {
      return;
    }

    setSubmitting(true);
    try {
      const response = await reportsAPI.create(values.title, selectedArticleIds, values.report_type, useGenAI);
      const newReport = response.data;
      message.success(`Report generated successfully${useGenAI ? ' with AI summarization' : ''}`);
      setModalVisible(false);
      setSelectedArticleIds([]);
      form.resetFields();
      
      // Auto-download PDF after creation
      if (newReport?.id) {
        message.loading({ content: 'Generating PDF...', key: 'pdf-download', duration: 0 });
        try {
          const pdfResponse = await reportsAPI.downloadPDF(newReport.id);
          const blob = new Blob([pdfResponse.data], { type: 'application/pdf' });
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${values.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${new Date().toISOString().split('T')[0]}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
          message.success({ content: 'PDF downloaded successfully!', key: 'pdf-download' });
        } catch (pdfErr) {
          console.error('PDF download failed:', pdfErr);
          message.warning({ content: 'Report created but PDF download failed. You can download it later.', key: 'pdf-download' });
        }
      }
      
      fetchReports();
    } catch (err) {
      message.error(err.response?.data?.detail || 'Failed to generate report');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (reportId) => {
    setDeleting(true);
    try {
      await reportsAPI.delete(reportId);
      message.success('Report deleted');
      fetchReports();
    } catch (err) {
      message.error(err.response?.data?.detail || 'Failed to delete report');
    } finally {
      setDeleting(false);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('Please select reports to delete');
      return;
    }

    setDeleting(true);
    try {
      await reportsAPI.batchDelete(selectedRowKeys);
      message.success(`Deleted ${selectedRowKeys.length} reports`);
      setSelectedRowKeys([]);
      fetchReports();
    } catch (err) {
      message.error(err.response?.data?.detail || 'Failed to delete reports');
    } finally {
      setDeleting(false);
    }
  };

  const handleExportCsv = async (report) => {
    try {
      const response = await reportsAPI.exportCsv(report.id);
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `report_${report.id}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      message.success('CSV exported successfully');
    } catch (err) {
      message.error('Failed to export CSV');
    }
  };

  const handleExportDocx = async (report) => {
    try {
      const response = await reportsAPI.exportDocx(report.id);
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `report_${report.id}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      message.success('Word document exported successfully');
    } catch (err) {
      message.error('Failed to export Word document');
    }
  };

  const handleView = (report) => {
    setSelectedReport(report);
    setDrawerVisible(true);
  };

  const handleEdit = (report) => {
    setSelectedReport(report);
    editForm.setFieldsValue({
      title: report.title,
      executive_summary: report.executive_summary || '',
      technical_summary: report.technical_summary || '',
      key_findings: report.key_findings?.join('\n') || '',
      recommendations: report.recommendations?.join('\n') || '',
    });
    setEditModalVisible(true);
  };

  const handleSaveEdits = async () => {
    try {
      const values = await editForm.validateFields();
      setSubmitting(true);
      
      const updateData = {
        title: values.title,
        executive_summary: values.executive_summary,
        technical_summary: values.technical_summary,
        key_findings: values.key_findings ? values.key_findings.split('\n').filter(f => f.trim()) : [],
        recommendations: values.recommendations ? values.recommendations.split('\n').filter(r => r.trim()) : [],
      };
      
      await reportsAPI.update(selectedReport.id, updateData);
      message.success('Report updated successfully');
      setEditModalVisible(false);
      fetchReports();
    } catch (err) {
      console.error('Failed to update report', err);
      message.error(err.response?.data?.detail || 'Failed to update report');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublish = async (reportId) => {
    try {
      setPublishing(true);
      await reportsAPI.publish(reportId);
      message.success('Report published successfully');
      fetchReports();
    } catch (err) {
      console.error('Failed to publish report', err);
      message.error(err.response?.data?.detail || 'Failed to publish report');
    } finally {
      setPublishing(false);
    }
  };

  const handleUnpublish = async (reportId) => {
    try {
      await reportsAPI.unpublish(reportId);
      message.success('Report moved back to draft');
      fetchReports();
    } catch (err) {
      console.error('Failed to unpublish report', err);
      message.error(err.response?.data?.detail || 'Failed to unpublish report');
    }
  };

  const handleDownloadPDF = async (report) => {
    try {
      const response = await reportsAPI.downloadPDF(report.id);
      
      // Create blob from response
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${report.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      message.success('Report downloaded successfully');
    } catch (err) {
      console.error('Failed to download report', err);
      message.error('Failed to download report. Feature may not be available yet.');
    }
  };

  const handleViewInBrowser = async (report) => {
    try {
      const response = await reportsAPI.exportHtml(report.id);
      const blob = new Blob([response.data], { type: 'text/html' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      // Clean up after a delay
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
      message.success('Opening report in browser');
    } catch (err) {
      console.error('Failed to open report in browser', err);
      message.error('Failed to open report in browser');
    }
  };

  const handleCopyContent = (report) => {
    if (report?.content) {
      navigator.clipboard.writeText(report.content);
      message.success('Report content copied to clipboard');
    }
  };

  const handleShare = (report) => {
    setSelectedReport(report);
    setShareEmails(report.shared_with_emails?.join(', ') || '');
    setShareModalVisible(true);
  };

  const handleShareSubmit = async () => {
    if (!shareEmails.trim()) {
      message.warning('Please enter email addresses');
      return;
    }

    const emails = shareEmails.split(',').map(e => e.trim()).filter(Boolean);
    
    try {
      await reportsAPI.share(selectedReport.id, emails);
      message.success(`Report shared with ${emails.length} recipients`);
      setShareModalVisible(false);
      fetchReports();
    } catch (err) {
      message.error('Failed to share report');
    }
  };

  const getReportTypeColor = (type) => {
    const colors = {
      comprehensive: 'purple',
      executive: 'blue',
      technical: 'green',
    };
    return colors[type] || 'default';
  };

  const columns = [
    {
      title: 'Report Title',
      dataIndex: 'title',
      key: 'title',
      render: (title) => (
        <Space>
          <FileTextOutlined />
          <Text strong>{title}</Text>
        </Space>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'report_type',
      key: 'type',
      width: 130,
      render: (type) => (
        <Tag color={getReportTypeColor(type)}>
          {type?.charAt(0).toUpperCase() + type?.slice(1)}
        </Tag>
      ),
    },
    {
      title: 'Articles',
      dataIndex: 'article_ids',
      key: 'articles',
      width: 100,
      render: (ids) => (
        <Tag>{ids?.length || 0} articles</Tag>
      ),
    },
    {
      title: 'Generated',
      dataIndex: 'generated_at',
      key: 'generated',
      width: 180,
      render: (date) => new Date(date).toLocaleString(),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => (
        <Tag color={status === 'PUBLISHED' ? 'green' : 'orange'} icon={status === 'PUBLISHED' ? <CheckCircleOutlined /> : <EditOutlined />}>
          {status || 'DRAFT'}
        </Tag>
      ),
    },
    {
      title: 'Shared With',
      dataIndex: 'shared_with_emails',
      key: 'shared',
      width: 130,
      render: (emails) => (
        emails?.length > 0 ? (
          <Tag icon={<MailOutlined />} color="green">
            {emails.length}
          </Tag>
        ) : (
          <Text type="secondary">-</Text>
        )
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 380,
      render: (_, record) => (
        <Space size={4}>
          {record.status === 'DRAFT' && canEditReports && (
            <>
              <Tooltip title="Edit Report">
                <Button
                  icon={<EditOutlined />}
                  size="small"
                  onClick={() => handleEdit(record)}
                >
                  Edit
                </Button>
              </Tooltip>
              <Tooltip title="Publish Report">
                <Button
                  icon={<CheckCircleOutlined />}
                  size="small"
                  type="primary"
                  onClick={() => handlePublish(record.id)}
                  loading={publishing}
                >
                  Publish
                </Button>
              </Tooltip>
            </>
          )}
          {record.status === 'PUBLISHED' && (
            <Tooltip title="View Published Report">
              <Button
                icon={<EyeOutlined />}
                size="small"
                type="primary"
                onClick={() => handleView(record)}
              >
                View
              </Button>
            </Tooltip>
          )}
          <Tooltip title="Open in Browser">
            <Button
              icon={<GlobalOutlined />}
              size="small"
              className="view-browser-btn"
              onClick={() => handleViewInBrowser(record)}
            >
              View
            </Button>
          </Tooltip>
          <Dropdown
            menu={{
              items: [
                {
                  key: 'pdf',
                  icon: <FilePdfOutlined />,
                  label: 'Download PDF',
                  onClick: () => handleDownloadPDF(record),
                },
                {
                  key: 'docx',
                  icon: <FileWordOutlined />,
                  label: 'Download Word',
                  onClick: () => handleExportDocx(record),
                },
                {
                  key: 'csv',
                  icon: <FileExcelOutlined />,
                  label: 'Download CSV',
                  onClick: () => handleExportCsv(record),
                },
                { type: 'divider' },
                ...(record.status === 'PUBLISHED' && canEditReports ? [{
                  key: 'unpublish',
                  icon: <EditOutlined />,
                  label: 'Move to Draft',
                  onClick: () => handleUnpublish(record.id),
                }] : []),
                ...(canEditReports ? [{ type: 'divider' }] : []),
                {
                  key: 'share',
                  icon: <ShareAltOutlined />,
                  label: 'Share Report',
                  onClick: () => handleShare(record),
                },
              ],
            }}
            trigger={['click']}
          >
            <Button icon={<MoreOutlined />} size="small">
              Export
            </Button>
          </Dropdown>
          {canEditReports && (
            <Popconfirm
              title="Delete this report?"
              description="This action cannot be undone."
              onConfirm={() => handleDelete(record.id)}
              okText="Delete"
              cancelText="Cancel"
              okButtonProps={{ danger: true }}
            >
              <Button
                icon={<DeleteOutlined />}
                size="small"
                danger
                loading={deleting}
              />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: setSelectedRowKeys,
  };

  return (
    <div className="reports-container">
      <div className="reports-header">
        <div>
          <Title level={2}>
            <BarChartOutlined /> Reports & Analytics
          </Title>
          <Text type="secondary">
            Enterprise metrics, KPIs, SLAs, and threat intelligence reports
          </Text>
        </div>
      </div>

      <Tabs activeKey={activeTab} onChange={setActiveTab} size="large">
        <Tabs.TabPane 
          tab={<span><DashboardOutlined /> Analytics Dashboard</span>} 
          key="analytics"
        >
          <AnalyticsDashboard />
        </Tabs.TabPane>
        
        <Tabs.TabPane 
          tab={<span><FileTextOutlined /> Intelligence Reports</span>} 
          key="reports"
        >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Custom Reports Section */}
        <Card 
          title={
            <Space>
              <FilePdfOutlined style={{ color: 'var(--primary)' }} />
              <span style={{ fontSize: 16, fontWeight: 600 }}>Custom Reports</span>
              <Tag color="blue">{reports.length} reports</Tag>
            </Space>
          }
          extra={
            canEditReports && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleCreate}
              >
                Create Custom Report
              </Button>
            )
          }
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
        >
          <Alert
            message="Custom reports are auto-generated as professional PDFs"
            description="When you create a custom report, HuntSphere will automatically generate and download a professionally formatted PDF document with executive summaries, IOCs, TTPs, and recommendations."
            type="info"
            showIcon
            icon={<FilePdfOutlined />}
            style={{ marginBottom: 16 }}
          />
          
          {selectedRowKeys.length > 0 && (
            <div style={{ marginBottom: 16, padding: '12px 16px', background: 'var(--bg-elevated)', borderRadius: 8 }}>
              <Space>
                <Text strong>{selectedRowKeys.length} report(s) selected</Text>
                {canEditReports && (
                  <Popconfirm
                    title={`Delete ${selectedRowKeys.length} reports?`}
                    description="This action cannot be undone."
                    onConfirm={handleBatchDelete}
                    okText="Delete All"
                    cancelText="Cancel"
                    okButtonProps={{ danger: true }}
                  >
                    <Button danger icon={<DeleteOutlined />} loading={deleting} size="small">
                      Delete Selected
                    </Button>
                  </Popconfirm>
                )}
                <Button onClick={() => setSelectedRowKeys([])} size="small">
                  Clear Selection
                </Button>
              </Space>
            </div>
          )}
          
          {reports.length === 0 ? (
            canEditReports ? (
              <Empty 
                description="No custom reports created yet"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                <Space direction="vertical" align="center">
                  <Text type="secondary">Create professional threat intelligence reports from your analyzed articles</Text>
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                    Create Your First Report
                  </Button>
                </Space>
              </Empty>
            ) : (
              <Empty 
                description="No reports available. Reports can only be created by TI Analysts and Admins."
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )
          ) : (
            <Table
              columns={columns}
              dataSource={reports}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10 }}
              rowSelection={rowSelection}
              style={{ background: 'var(--bg-card)' }}
            />
          )}
        </Card>
      </Space>

      {/* Create Report Modal */}
      <Modal
        title="Generate Report"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="title"
            label="Report Title"
            rules={[{ required: true, message: 'Please enter report title' }]}
          >
            <Input placeholder="e.g., Weekly Threat Intelligence Summary" />
          </Form.Item>

          <Form.Item
            name="report_type"
            label="Report Type"
            initialValue="comprehensive"
          >
            <Select>
              <Option value="comprehensive">
                Comprehensive - Full analysis with all details
              </Option>
              <Option value="executive">
                Executive - High-level summary for leadership
              </Option>
              <Option value="technical">
                Technical - Detailed IOCs and TTPs
              </Option>
            </Select>
          </Form.Item>

          <Form.Item label="AI Enhancement">
            <Space>
              <Switch 
                checked={useGenAI} 
                onChange={setUseGenAI}
                checkedChildren={<RobotOutlined />}
                unCheckedChildren="Off"
              />
              <span>
                {useGenAI ? (
                  <Tag color="blue" icon={<RobotOutlined />}>
                    GenAI will synthesize and summarize content
                  </Tag>
                ) : (
                  <Tag>Manual concatenation of article summaries</Tag>
                )}
              </span>
            </Space>
          </Form.Item>

          <Form.Item label="Select Articles to Include">
            {/* Search and Filter Controls */}
            <Space style={{ marginBottom: 12, width: '100%' }} wrap>
              <Input
                placeholder="Search by title or keyword..."
                prefix={<SearchOutlined />}
                value={articleSearch}
                onChange={(e) => setArticleSearch(e.target.value)}
                style={{ width: 250 }}
                allowClear
              />
              <Select
                placeholder="Filter by date"
                value={articleDateFilter}
                onChange={setArticleDateFilter}
                style={{ width: 140 }}
                allowClear
              >
                <Option value="today">
                  <CalendarOutlined /> Today
                </Option>
                <Option value="week">
                  <CalendarOutlined /> Last 7 days
                </Option>
                <Option value="month">
                  <CalendarOutlined /> Last 30 days
                </Option>
              </Select>
              {selectedArticleIds.length > 0 && (
                <Button 
                  size="small" 
                  onClick={() => setSelectedArticleIds([])}
                >
                  Clear Selection
                </Button>
              )}
            </Space>
            
            <Card 
              size="small" 
              style={{ maxHeight: 350, overflow: 'auto' }}
              title={
                <Space style={{ fontSize: 12 }}>
                  <Text type="secondary">
                    {filteredArticles.length} articles found
                  </Text>
                  {articleSearch && (
                    <Tag color="blue">Search: "{articleSearch}"</Tag>
                  )}
                  {articleDateFilter && (
                    <Tag color="green">{articleDateFilter === 'today' ? 'Today' : articleDateFilter === 'week' ? 'Last 7 days' : 'Last 30 days'}</Tag>
                  )}
                </Space>
              }
            >
              {filteredArticles.length === 0 ? (
                <Empty 
                  image={Empty.PRESENTED_IMAGE_SIMPLE} 
                  description={articleSearch ? "No articles match your search" : "No articles available"}
                />
              ) : (
                <List
                  size="small"
                  dataSource={filteredArticles}
                  renderItem={(article) => (
                    <List.Item style={{ padding: '8px 0' }}>
                      <Checkbox
                        checked={selectedArticleIds.includes(article.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedArticleIds([...selectedArticleIds, article.id]);
                          } else {
                            setSelectedArticleIds(selectedArticleIds.filter(id => id !== article.id));
                          }
                        }}
                        style={{ width: '100%' }}
                      >
                        <Space direction="vertical" size={0} style={{ width: '100%' }}>
                          <Text style={{ fontWeight: 500 }}>
                            {article.title?.substring(0, 70)}{article.title?.length > 70 ? '...' : ''}
                          </Text>
                          <Space size="small">
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              {article.published_at || article.created_at 
                                ? formatDateTime(article.published_at || article.created_at)
                                : 'No date'}
                            </Text>
                            {article.source?.name && (
                              <Tag size="small" style={{ fontSize: 10 }}>{article.source.name}</Tag>
                            )}
                          </Space>
                        </Space>
                      </Checkbox>
                    </List.Item>
                  )}
                />
              )}
            </Card>
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text type="secondary">
                <CheckCircleOutlined style={{ marginRight: 4 }} />
                {selectedArticleIds.length} article{selectedArticleIds.length !== 1 ? 's' : ''} selected
              </Text>
              {filteredArticles.length > 0 && (
                <Button 
                  size="small" 
                  type="link"
                  onClick={() => {
                    const allIds = filteredArticles.map(a => a.id);
                    const allSelected = allIds.every(id => selectedArticleIds.includes(id));
                    if (allSelected) {
                      setSelectedArticleIds(selectedArticleIds.filter(id => !allIds.includes(id)));
                    } else {
                      setSelectedArticleIds([...new Set([...selectedArticleIds, ...allIds])]);
                    }
                  }}
                >
                  {filteredArticles.every(a => selectedArticleIds.includes(a.id)) 
                    ? 'Deselect All Visible' 
                    : 'Select All Visible'}
                </Button>
              )}
            </div>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={submitting} disabled={submitting}>
                {submitting ? 'Generating...' : 'Generate Report'}
              </Button>
              <Button onClick={() => setModalVisible(false)} disabled={submitting}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Share Modal */}
      <Modal
        title="Share Report"
        open={shareModalVisible}
        onCancel={() => setShareModalVisible(false)}
        onOk={handleShareSubmit}
        okText="Share"
      >
        <Paragraph>
          Share "{selectedReport?.title}" with team members via email.
        </Paragraph>
        <TextArea
          rows={4}
          placeholder="Enter email addresses (comma-separated)"
          value={shareEmails}
          onChange={(e) => setShareEmails(e.target.value)}
        />
        <Text type="secondary" style={{ marginTop: 8, display: 'block' }}>
          Recipients will receive an email with the full report content.
        </Text>
      </Modal>

      {/* Edit Report Modal - Intel & Admin only */}
      <Modal
        title={
          <Space>
            <EditOutlined />
            <span>Edit Report - {selectedReport?.title}</span>
            <Tag color="orange">DRAFT</Tag>
          </Space>
        }
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onOk={handleSaveEdits}
        okText={<><SaveOutlined /> Save Changes</>}
        width={900}
        confirmLoading={submitting}
      >
        <Form
          form={editForm}
          layout="vertical"
        >
          <Form.Item
            name="title"
            label="Report Title"
            rules={[{ required: true, message: 'Title is required' }]}
          >
            <Input size="large" placeholder="Report title" />
          </Form.Item>

          <Form.Item
            name="executive_summary"
            label="Executive Summary"
            tooltip="High-level summary for leadership and stakeholders"
          >
            <TextArea
              rows={6}
              placeholder="Executive summary - focus on business impact and strategic recommendations..."
            />
          </Form.Item>

          <Form.Item
            name="technical_summary"
            label="Technical Summary"
            tooltip="Detailed technical analysis for security teams"
          >
            <TextArea
              rows={6}
              placeholder="Technical summary - detailed IOCs, TTPs, and technical indicators..."
            />
          </Form.Item>

          <Form.Item
            name="key_findings"
            label="Key Findings"
            tooltip="One finding per line"
          >
            <TextArea
              rows={5}
              placeholder="Enter key findings, one per line..."
            />
          </Form.Item>

          <Form.Item
            name="recommendations"
            label="Recommendations"
            tooltip="One recommendation per line"
          >
            <TextArea
              rows={5}
              placeholder="Enter recommendations, one per line..."
            />
          </Form.Item>

          <Alert
            message="Review and Publish"
            description="Once you're satisfied with the edits, save the changes. You can then publish the report to make it final and available for viewing/download."
            type="info"
            showIcon
            style={{ marginTop: 16 }}
          />
        </Form>
      </Modal>

      {/* View Report Drawer */}
      <Drawer
        title={selectedReport?.title}
        placement="right"
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        width={750}
        extra={
          <Space>
            <Button 
              icon={<GlobalOutlined />}
              type="primary"
              onClick={() => handleViewInBrowser(selectedReport)}
            >
              Open in Browser
            </Button>
            <Button 
              icon={<CopyOutlined />}
              onClick={() => handleCopyContent(selectedReport)}
            >
              Copy
            </Button>
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'pdf',
                    icon: <FilePdfOutlined />,
                    label: 'Download PDF',
                    onClick: () => handleDownloadPDF(selectedReport),
                  },
                  {
                    key: 'docx',
                    icon: <FileWordOutlined />,
                    label: 'Download Word',
                    onClick: () => handleExportDocx(selectedReport),
                  },
                  {
                    key: 'csv',
                    icon: <FileExcelOutlined />,
                    label: 'Download CSV',
                    onClick: () => handleExportCsv(selectedReport),
                  },
                ],
              }}
              trigger={['click']}
            >
              <Button icon={<DownloadOutlined />}>
                Export
              </Button>
            </Dropdown>
          </Space>
        }
      >
        {selectedReport && (
          <div>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="Type">
                <Tag color={getReportTypeColor(selectedReport.report_type)}>
                  {selectedReport.report_type?.charAt(0).toUpperCase() + selectedReport.report_type?.slice(1)}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Articles">
                {selectedReport.article_ids?.length || 0}
              </Descriptions.Item>
              <Descriptions.Item label="Generated">
                {new Date(selectedReport.generated_at).toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="Shared With">
                {selectedReport.shared_with_emails?.length || 0} recipients
              </Descriptions.Item>
            </Descriptions>

            <Divider />

            <div className="report-content">
              <div className="report-content-header" style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: 16 
              }}>
                <Title level={4} style={{ margin: 0 }}>Report Content</Title>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Formatted view • Use "Open in Browser" for print-ready version
                </Text>
              </div>
              <Card 
                size="small" 
                style={{ 
                  maxHeight: 'calc(100vh - 320px)', 
                  overflow: 'auto',
                  background: '#fafafa'
                }}
              >
                <FormattedContent content={selectedReport.content} />
              </Card>
            </div>
          </div>
        )}
      </Drawer>
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
}

export default Reports;
