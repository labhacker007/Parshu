import React from 'react';
import { 
  Select, Switch, Space, Card, Typography, Tooltip, Divider, Tag,
  Row, Col
} from 'antd';
import { 
  GlobalOutlined, ClockCircleOutlined, FieldTimeOutlined 
} from '@ant-design/icons';
import { useTimezone, TIMEZONE_OPTIONS } from '../context/TimezoneContext';
import './TimezoneSettings.css';

const { Text, Title } = Typography;
const { Option, OptGroup } = Select;

/**
 * TimezoneSettings - Full settings panel for timezone preferences
 */
export const TimezoneSettings = ({ compact = false }) => {
  const { 
    timezone, 
    setTimezone, 
    use24Hour, 
    setUse24Hour, 
    showSeconds, 
    setShowSeconds,
    formatDateTime,
    getTimezoneLabel
  } = useTimezone();

  const now = new Date().toISOString();

  // Group timezones by region
  const americaTimezones = TIMEZONE_OPTIONS.filter(tz => 
    tz.value.startsWith('America/') || tz.value === 'Pacific/Honolulu'
  );
  const europeTimezones = TIMEZONE_OPTIONS.filter(tz => tz.value.startsWith('Europe/'));
  const asiaTimezones = TIMEZONE_OPTIONS.filter(tz => tz.value.startsWith('Asia/'));
  const otherTimezones = TIMEZONE_OPTIONS.filter(tz => 
    tz.value.startsWith('Australia/') || tz.value.startsWith('Pacific/Auckland')
  );
  const specialTimezones = TIMEZONE_OPTIONS.filter(tz => 
    tz.value === 'UTC' || tz.value === 'LOCAL'
  );

  if (compact) {
    return (
      <div className="timezone-settings-compact">
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <div className="tz-setting-row">
            <GlobalOutlined />
            <Select
              value={timezone}
              onChange={setTimezone}
              style={{ flex: 1 }}
              size="small"
              dropdownMatchSelectWidth={false}
            >
              {TIMEZONE_OPTIONS.map(tz => (
                <Option key={tz.value} value={tz.value}>
                  {tz.label}
                </Option>
              ))}
            </Select>
          </div>
          <div className="tz-setting-row">
            <FieldTimeOutlined />
            <Text style={{ flex: 1 }}>24-hour format</Text>
            <Switch checked={use24Hour} onChange={setUse24Hour} size="small" />
          </div>
        </Space>
      </div>
    );
  }

  return (
    <Card 
      title={<Space><GlobalOutlined /> Time & Timezone Settings</Space>} 
      size="small"
      className="timezone-settings-card"
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {/* Current Time Preview */}
        <div className="current-time-preview">
          <ClockCircleOutlined style={{ fontSize: 24, color: 'var(--primary)' }} />
          <div>
            <Text strong style={{ fontSize: 18 }}>{formatDateTime(now)}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>{getTimezoneLabel()}</Text>
          </div>
        </div>

        <Divider style={{ margin: '12px 0' }} />

        {/* Timezone Selector */}
        <div className="tz-setting-item">
          <Text strong>Display Timezone</Text>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
            All data is stored in UTC. This setting controls how times are displayed.
          </Text>
          <Select
            value={timezone}
            onChange={setTimezone}
            style={{ width: '100%' }}
            placeholder="Select timezone"
            showSearch
            optionFilterProp="children"
          >
            <OptGroup label="Quick Options">
              {specialTimezones.map(tz => (
                <Option key={tz.value} value={tz.value}>
                  <Space>
                    {tz.value === 'UTC' ? <GlobalOutlined /> : <ClockCircleOutlined />}
                    {tz.label}
                    <Tag color={tz.value === 'UTC' ? 'blue' : 'green'}>{tz.offset}</Tag>
                  </Space>
                </Option>
              ))}
            </OptGroup>
            <OptGroup label="Americas">
              {americaTimezones.map(tz => (
                <Option key={tz.value} value={tz.value}>
                  {tz.label} <Tag>{tz.offset}</Tag>
                </Option>
              ))}
            </OptGroup>
            <OptGroup label="Europe">
              {europeTimezones.map(tz => (
                <Option key={tz.value} value={tz.value}>
                  {tz.label} <Tag>{tz.offset}</Tag>
                </Option>
              ))}
            </OptGroup>
            <OptGroup label="Asia">
              {asiaTimezones.map(tz => (
                <Option key={tz.value} value={tz.value}>
                  {tz.label} <Tag>{tz.offset}</Tag>
                </Option>
              ))}
            </OptGroup>
            <OptGroup label="Pacific">
              {otherTimezones.map(tz => (
                <Option key={tz.value} value={tz.value}>
                  {tz.label} <Tag>{tz.offset}</Tag>
                </Option>
              ))}
            </OptGroup>
          </Select>
        </div>

        {/* Format Options */}
        <Row gutter={16}>
          <Col span={12}>
            <div className="tz-toggle-item">
              <div>
                <Text strong>24-Hour Format</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {use24Hour ? '14:30' : '2:30 PM'}
                </Text>
              </div>
              <Switch checked={use24Hour} onChange={setUse24Hour} />
            </div>
          </Col>
          <Col span={12}>
            <div className="tz-toggle-item">
              <div>
                <Text strong>Show Seconds</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {showSeconds ? 'HH:MM:SS' : 'HH:MM'}
                </Text>
              </div>
              <Switch checked={showSeconds} onChange={setShowSeconds} />
            </div>
          </Col>
        </Row>

        {/* Info */}
        <div className="tz-info">
          <Text type="secondary" style={{ fontSize: 11 }}>
            <GlobalOutlined style={{ marginRight: 4 }} />
            Preferences are saved locally and apply to all time displays in HuntSphere.
          </Text>
        </div>
      </Space>
    </Card>
  );
};

/**
 * TimezoneIndicator - Small indicator for navbar showing current timezone
 */
export const TimezoneIndicator = ({ onClick }) => {
  const { getTimezoneAbbr, timezone, formatTime } = useTimezone();
  const now = new Date().toISOString();

  return (
    <Tooltip title={`Timezone: ${timezone === 'LOCAL' ? 'Local' : timezone}`}>
      <div className="timezone-indicator" onClick={onClick}>
        <GlobalOutlined />
        <span className="tz-abbr">{getTimezoneAbbr()}</span>
        <span className="tz-time">{formatTime(now)}</span>
      </div>
    </Tooltip>
  );
};

/**
 * TimezoneQuickSelect - Dropdown for quick timezone selection
 */
export const TimezoneQuickSelect = ({ style }) => {
  const { timezone, setTimezone } = useTimezone();

  return (
    <Select
      value={timezone}
      onChange={setTimezone}
      style={{ minWidth: 180, ...style }}
      size="small"
      dropdownMatchSelectWidth={false}
    >
      <Option value="UTC">
        <Space><GlobalOutlined /> UTC</Space>
      </Option>
      <Option value="LOCAL">
        <Space><ClockCircleOutlined /> Local Time</Space>
      </Option>
      <Divider style={{ margin: '4px 0' }} />
      {TIMEZONE_OPTIONS.filter(tz => tz.value !== 'UTC' && tz.value !== 'LOCAL').map(tz => (
        <Option key={tz.value} value={tz.value}>
          {tz.label}
        </Option>
      ))}
    </Select>
  );
};

export default TimezoneSettings;
