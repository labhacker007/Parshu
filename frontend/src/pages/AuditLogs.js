import React, { useState, useEffect } from 'react';
import { 
  Table, Card, Tag, DatePicker, Select, Space, 
  Typography, Button, Drawer, Descriptions, Input,
  Timeline, Badge, Tooltip, Empty
} from 'antd';
import { 
  AuditOutlined, 
  SearchOutlined, 
  FilterOutlined,
  UserOutlined,
  ClockCircleOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import { auditAPI } from '../api/client';
import { useTimezone } from '../context/TimezoneContext';
import './AuditLogs.css';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

function AuditLogs() {
  const { formatDateTime, getRelativeTime, getTimezoneAbbr } = useTimezone();
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selectedLog, setSelectedLog] = useState(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [filters, setFilters] = useState({
    event_type: null,
    user_id: null,
    resource_type: null,
  }); // No filters by default - show all logs

  useEffect(() => {
    fetchLogs();
  }, [page, pageSize]); // Remove filters from dependency - show all by default

  const fetchLogs = async () => {
    setLoading(true);
    try {
      // Show all logs by default - only apply filters if explicitly set
      const activeFilters = Object.fromEntries(
        Object.entries(filters).filter(([_, v]) => v !== null && v !== undefined && v !== '')
      );
      const response = await auditAPI.list(page, pageSize, Object.keys(activeFilters).length > 0 ? activeFilters : {});
      setLogs(response.data.logs || response.data.items || []);
      setTotal(response.data.total || 0);
    } catch (err) {
      console.error('Failed to fetch audit logs', err);
      // Mock data for demo
      setLogs([
        {
          id: 1,
          event_type: 'LOGIN',
          action: 'login_success',
          user_id: 1,
          user_email: 'admin@jyoti.local',
          resource_type: null,
          resource_id: null,
          details: { saml: false },
          ip_address: '192.168.1.1',
          correlation_id: 'abc-123-def',
          created_at: new Date().toISOString(),
        },
        {
          id: 2,
          event_type: 'ARTICLE_LIFECYCLE',
          action: 'status_changed',
          user_id: 1,
          user_email: 'analyst@example.com',
          resource_type: 'article',
          resource_id: 42,
          details: { old_status: 'NEW', new_status: 'IN_ANALYSIS' },
          ip_address: '192.168.1.2',
          correlation_id: 'xyz-456-ghi',
          created_at: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: 3,
          event_type: 'HUNT_TRIGGER',
          action: 'hunt_triggered',
          user_id: 2,
          user_email: 'hunter@example.com',
          resource_type: 'hunt',
          resource_id: 5,
          details: { platform: 'defender', trigger_type: 'MANUAL' },
          ip_address: '192.168.1.3',
          correlation_id: 'mno-789-pqr',
          created_at: new Date(Date.now() - 7200000).toISOString(),
        },
      ]);
      setTotal(3);
    } finally {
      setLoading(false);
    }
  };

  const getEventTypeColor = (eventType) => {
    const colors = {
      LOGIN: 'green',
      LOGOUT: 'default',
      ARTICLE_LIFECYCLE: 'blue',
      EXTRACTION: 'purple',
      CONNECTOR_CONFIG: 'orange',
      HUNT_TRIGGER: 'red',
      NOTIFICATION: 'cyan',
      REPORT_GENERATION: 'gold',
      RBAC_CHANGE: 'magenta',
    };
    return colors[eventType] || 'default';
  };

  const getEventIcon = (eventType) => {
    const icons = {
      LOGIN: <UserOutlined />,
      LOGOUT: <UserOutlined />,
      ARTICLE_LIFECYCLE: <FileTextOutlined />,
      HUNT_TRIGGER: <AuditOutlined />,
    };
    return icons[eventType] || <ClockCircleOutlined />;
  };

  const columns = [
    {
      title: 'Timestamp',
      dataIndex: 'created_at',
      key: 'timestamp',
      width: 180,
      render: (date) => (
        <Tooltip title={new Date(date).toISOString()}>
          {new Date(date).toLocaleString()}
        </Tooltip>
      ),
      sorter: (a, b) => new Date(a.created_at) - new Date(b.created_at),
    },
    {
      title: 'Event Type',
      dataIndex: 'event_type',
      key: 'event_type',
      width: 160,
      render: (type) => (
        <Tag color={getEventTypeColor(type)} icon={getEventIcon(type)}>
          {type}
        </Tag>
      ),
      filters: [
        { text: 'Login', value: 'LOGIN' },
        { text: 'Logout', value: 'LOGOUT' },
        { text: 'Article Lifecycle', value: 'ARTICLE_LIFECYCLE' },
        { text: 'Hunt Trigger', value: 'HUNT_TRIGGER' },
        { text: 'Extraction', value: 'EXTRACTION' },
        { text: 'Connector Config', value: 'CONNECTOR_CONFIG' },
        { text: 'Notification', value: 'NOTIFICATION' },
        { text: 'Report Generation', value: 'REPORT_GENERATION' },
      ],
      onFilter: (value, record) => record.event_type === value,
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      width: 150,
      render: (action) => <Text code>{action}</Text>,
    },
    {
      title: 'User',
      dataIndex: 'user_email',
      key: 'user',
      width: 200,
      render: (email, record) => (
        <Space>
          <UserOutlined />
          <Text>{email || `User #${record.user_id}` || 'System'}</Text>
        </Space>
      ),
    },
    {
      title: 'Resource',
      key: 'resource',
      width: 150,
      render: (_, record) => (
        record.resource_type ? (
          <Tag>
            {record.resource_type}#{record.resource_id}
          </Tag>
        ) : <Text type="secondary">-</Text>
      ),
    },
    {
      title: 'IP Address',
      dataIndex: 'ip_address',
      key: 'ip',
      width: 130,
      render: (ip) => <Text type="secondary">{ip || '-'}</Text>,
    },
    {
      title: 'Correlation ID',
      dataIndex: 'correlation_id',
      key: 'correlation',
      width: 130,
      render: (id) => (
        <Tooltip title={id}>
          <Text type="secondary" copyable={{ text: id }}>
            {id?.substring(0, 8)}...
          </Text>
        </Tooltip>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Button 
          type="link" 
          size="small"
          onClick={() => {
            setSelectedLog(record);
            setDrawerVisible(true);
          }}
        >
          Details
        </Button>
      ),
    },
  ];

  return (
    <div className="audit-container">
      <div className="audit-header">
        <Title level={2}>
          <AuditOutlined /> Audit Logs
        </Title>
        <Text type="secondary">
          Complete audit trail of all system activities with correlation IDs
        </Text>
      </div>

      <Card className="audit-filters">
        <Space wrap size="middle">
          <Select
            placeholder="Event Type"
            allowClear
            style={{ width: 180 }}
            onChange={(value) => setFilters({ ...filters, event_type: value })}
          >
            <Option value="LOGIN">Login</Option>
            <Option value="LOGOUT">Logout</Option>
            <Option value="ARTICLE_LIFECYCLE">Article Lifecycle</Option>
            <Option value="HUNT_TRIGGER">Hunt Trigger</Option>
            <Option value="EXTRACTION">Extraction</Option>
            <Option value="CONNECTOR_CONFIG">Connector Config</Option>
          </Select>
          
          <Select
            placeholder="Resource Type"
            allowClear
            style={{ width: 150 }}
            onChange={(value) => setFilters({ ...filters, resource_type: value })}
          >
            <Option value="article">Article</Option>
            <Option value="hunt">Hunt</Option>
            <Option value="connector">Connector</Option>
            <Option value="report">Report</Option>
          </Select>

          <RangePicker 
            showTime
            placeholder={['Start Time', 'End Time']}
          />

          <Input 
            placeholder="Correlation ID" 
            prefix={<SearchOutlined />}
            style={{ width: 200 }}
          />

          <Button 
            icon={<FilterOutlined />}
            onClick={fetchLogs}
          >
            Apply Filters
          </Button>
        </Space>
      </Card>

      <Card className="audit-table-card">
        <Table
          columns={columns}
          dataSource={logs}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize: pageSize,
            total: total,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} events`,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
          scroll={{ x: 1200 }}
          size="small"
        />
      </Card>

      <Drawer
        title="Audit Log Details"
        placement="right"
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        width={500}
      >
        {selectedLog && (
          <div>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Event ID">
                {selectedLog.id}
              </Descriptions.Item>
              <Descriptions.Item label="Event Type">
                <Tag color={getEventTypeColor(selectedLog.event_type)}>
                  {selectedLog.event_type}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Action">
                <Text code>{selectedLog.action}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="User">
                {selectedLog.user_email || `ID: ${selectedLog.user_id}`}
              </Descriptions.Item>
              <Descriptions.Item label="Resource">
                {selectedLog.resource_type 
                  ? `${selectedLog.resource_type} #${selectedLog.resource_id}`
                  : 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="IP Address">
                {selectedLog.ip_address || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Correlation ID">
                <Text copyable>{selectedLog.correlation_id}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Timestamp">
                {new Date(selectedLog.created_at).toISOString()}
              </Descriptions.Item>
            </Descriptions>

            <div style={{ marginTop: 24 }}>
              <Title level={5}>Event Details</Title>
              <pre className="details-json">
                {JSON.stringify(selectedLog.details, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}

export default AuditLogs;
