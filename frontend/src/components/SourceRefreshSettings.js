/**
 * Simplified Source Refresh Settings
 * 
 * Simple model:
 * 1. Admin sets global default refresh interval (applies to all users)
 * 2. Users can set their personal preference (within admin-defined limits)
 * 3. Admin can disable refresh for specific pages if needed
 */
import React, { useState, useEffect } from 'react';
import {
  Card, Select, Switch, Button, Space, Tag, Modal,
  InputNumber, Typography, message, Alert, Tooltip,
  Row, Col, Statistic, Divider, Radio
} from 'antd';
import {
  SettingOutlined, ClockCircleOutlined, SyncOutlined, 
  SaveOutlined, GlobalOutlined, UserOutlined, CheckCircleOutlined
} from '@ant-design/icons';
import { useAuthStore } from '../store';

const { Text, Title } = Typography;

// Simple preset intervals
const REFRESH_INTERVALS = [
  { value: 0, label: 'Manual Only (No Auto-Refresh)' },
  { value: 30, label: '30 seconds' },
  { value: 60, label: '1 minute' },
  { value: 120, label: '2 minutes' },
  { value: 300, label: '5 minutes' },
  { value: 600, label: '10 minutes' },
  { value: 900, label: '15 minutes' },
  { value: 1800, label: '30 minutes' },
  { value: 3600, label: '1 hour' },
];

// Get stored settings
const getStoredAdminSettings = () => {
  try {
    return JSON.parse(localStorage.getItem('jyoti-refresh-admin-settings') || '{}');
  } catch {
    return {};
  }
};

const getStoredUserSettings = () => {
  try {
    return JSON.parse(localStorage.getItem('jyoti-refresh-user-settings') || '{}');
  } catch {
    return {};
  }
};

function SourceRefreshSettings({ visible, onClose }) {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';
  
  const [saving, setSaving] = useState(false);
  
  // Admin settings (global defaults)
  const [adminSettings, setAdminSettings] = useState(() => ({
    default_refresh_seconds: 300, // 5 minutes default
    allow_user_override: true,
    min_refresh_seconds: 30, // Users can't go faster than this
    disabled_pages: [], // Pages where refresh is disabled
    ...getStoredAdminSettings()
  }));
  
  // User settings (personal preference)
  const [userSettings, setUserSettings] = useState(() => ({
    my_refresh_seconds: null, // null = use admin default
    ...getStoredUserSettings()
  }));

  // Calculate effective refresh rate for current user
  const getEffectiveRefreshSeconds = () => {
    // If user has override and admin allows it
    if (adminSettings.allow_user_override && userSettings.my_refresh_seconds !== null) {
      // Ensure user can't go below admin minimum
      return Math.max(userSettings.my_refresh_seconds, adminSettings.min_refresh_seconds);
    }
    return adminSettings.default_refresh_seconds;
  };

  const handleSaveAdminSettings = () => {
    setSaving(true);
    try {
      localStorage.setItem('jyoti-refresh-admin-settings', JSON.stringify(adminSettings));
      
      // Broadcast to other components
      window.dispatchEvent(new CustomEvent('refresh-settings-changed', { 
        detail: { adminSettings } 
      }));
      
      message.success('Global refresh settings saved');
      onClose();
    } catch (err) {
      message.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveUserSettings = () => {
    setSaving(true);
    try {
      localStorage.setItem('jyoti-refresh-user-settings', JSON.stringify(userSettings));
      
      // Broadcast to other components
      window.dispatchEvent(new CustomEvent('refresh-settings-changed', { 
        detail: { userSettings } 
      }));
      
      message.success('Your refresh preference saved');
      onClose();
    } catch (err) {
      message.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefault = () => {
    setUserSettings({ my_refresh_seconds: null });
    localStorage.setItem('jyoti-refresh-user-settings', JSON.stringify({ my_refresh_seconds: null }));
    message.success('Reset to admin default');
  };

  const formatSeconds = (seconds) => {
    if (seconds === 0) return 'Manual Only';
    if (seconds < 60) return `${seconds} seconds`;
    if (seconds < 3600) return `${seconds / 60} minute${seconds > 60 ? 's' : ''}`;
    return `${seconds / 3600} hour${seconds > 3600 ? 's' : ''}`;
  };

  // Filter intervals based on admin minimum
  const getAvailableIntervals = () => {
    if (isAdmin) return REFRESH_INTERVALS;
    return REFRESH_INTERVALS.filter(i => 
      i.value === 0 || i.value >= adminSettings.min_refresh_seconds
    );
  };

  return (
    <Modal
      title={
        <Space>
          <SyncOutlined />
          <span>Refresh Settings</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={550}
      destroyOnClose
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        
        {/* Current Effective Setting */}
        <Card size="small" style={{ background: '#f6ffed', border: '1px solid #b7eb8f' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />
              <div>
                <Text strong>Your Current Refresh Rate</Text>
                <div>
                  <Tag color="green" style={{ marginTop: 4 }}>
                    {formatSeconds(getEffectiveRefreshSeconds())}
                  </Tag>
                </div>
              </div>
            </Space>
            <Statistic 
              value={getEffectiveRefreshSeconds() > 0 ? getEffectiveRefreshSeconds() : '∞'} 
              suffix={getEffectiveRefreshSeconds() > 0 ? 's' : ''}
              valueStyle={{ fontSize: 24, color: '#52c41a' }}
            />
          </div>
        </Card>

        {/* Admin Section */}
        {isAdmin && (
          <Card 
            size="small" 
            title={<Space><GlobalOutlined /> Global Default (Admin)</Space>}
            style={{ borderColor: '#1890ff' }}
          >
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <div>
                <Text strong>Default Refresh Interval</Text>
                <Text type="secondary" style={{ display: 'block', fontSize: 12, marginBottom: 8 }}>
                  This applies to all users unless they set their own preference
                </Text>
                <Select
                  value={adminSettings.default_refresh_seconds}
                  onChange={(v) => setAdminSettings(prev => ({ ...prev, default_refresh_seconds: v }))}
                  style={{ width: '100%' }}
                  options={REFRESH_INTERVALS}
                />
              </div>

              <Divider style={{ margin: '12px 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <Text strong>Allow User Overrides</Text>
                  <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                    Let users set their own refresh preference
                  </Text>
                </div>
                <Switch
                  checked={adminSettings.allow_user_override}
                  onChange={(v) => setAdminSettings(prev => ({ ...prev, allow_user_override: v }))}
                  checkedChildren="Yes"
                  unCheckedChildren="No"
                />
              </div>

              {adminSettings.allow_user_override && (
                <div>
                  <Text strong>Minimum Allowed</Text>
                  <Text type="secondary" style={{ display: 'block', fontSize: 12, marginBottom: 8 }}>
                    Users cannot set refresh faster than this
                  </Text>
                  <Select
                    value={adminSettings.min_refresh_seconds}
                    onChange={(v) => setAdminSettings(prev => ({ ...prev, min_refresh_seconds: v }))}
                    style={{ width: '100%' }}
                    options={REFRESH_INTERVALS.filter(i => i.value > 0)}
                  />
                </div>
              )}

              <div style={{ textAlign: 'right', marginTop: 8 }}>
                <Button 
                  type="primary" 
                  icon={<SaveOutlined />}
                  onClick={handleSaveAdminSettings}
                  loading={saving}
                >
                  Save Global Settings
                </Button>
              </div>
            </Space>
          </Card>
        )}

        {/* User Preference Section */}
        <Card 
          size="small" 
          title={<Space><UserOutlined /> My Preference</Space>}
        >
          {!adminSettings.allow_user_override && !isAdmin ? (
            <Alert
              message="User overrides are disabled"
              description={`Admin has set refresh to ${formatSeconds(adminSettings.default_refresh_seconds)} for all users.`}
              type="info"
              showIcon
            />
          ) : (
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <div>
                <Text strong>My Refresh Interval</Text>
                <Text type="secondary" style={{ display: 'block', fontSize: 12, marginBottom: 8 }}>
                  Override the default for your account only
                </Text>
                <Radio.Group
                  value={userSettings.my_refresh_seconds === null ? 'default' : 'custom'}
                  onChange={(e) => {
                    if (e.target.value === 'default') {
                      setUserSettings({ my_refresh_seconds: null });
                    } else {
                      setUserSettings({ my_refresh_seconds: adminSettings.default_refresh_seconds });
                    }
                  }}
                  style={{ marginBottom: 12 }}
                >
                  <Radio value="default">
                    Use admin default ({formatSeconds(adminSettings.default_refresh_seconds)})
                  </Radio>
                  <Radio value="custom">Set my own preference</Radio>
                </Radio.Group>

                {userSettings.my_refresh_seconds !== null && (
                  <Select
                    value={userSettings.my_refresh_seconds}
                    onChange={(v) => setUserSettings({ my_refresh_seconds: v })}
                    style={{ width: '100%' }}
                    options={getAvailableIntervals()}
                  />
                )}
              </div>

              {userSettings.my_refresh_seconds !== null && 
               userSettings.my_refresh_seconds < adminSettings.min_refresh_seconds && 
               userSettings.my_refresh_seconds > 0 && (
                <Alert
                  message={`Minimum is ${formatSeconds(adminSettings.min_refresh_seconds)}`}
                  description="Your preference will be adjusted to the minimum allowed."
                  type="warning"
                  showIcon
                />
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                {userSettings.my_refresh_seconds !== null && (
                  <Button onClick={handleResetToDefault}>
                    Reset to Default
                  </Button>
                )}
                <div style={{ marginLeft: 'auto' }}>
                  <Button 
                    type="primary" 
                    icon={<SaveOutlined />}
                    onClick={handleSaveUserSettings}
                    loading={saving}
                  >
                    Save My Preference
                  </Button>
                </div>
              </div>
            </Space>
          )}
        </Card>

        {/* Quick Info */}
        <Alert
          message="How Refresh Works"
          description={
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li>Refresh interval controls how often data automatically reloads</li>
              <li>Set to "Manual Only" to disable auto-refresh entirely</li>
              <li>Changes apply to Dashboard, News Feeds, and Sources pages</li>
            </ul>
          }
          type="info"
          showIcon
        />
      </Space>
    </Modal>
  );
}

// Hook for components to get the effective refresh interval
export const useRefreshSettings = () => {
  const [refreshSeconds, setRefreshSeconds] = useState(() => {
    const admin = getStoredAdminSettings();
    const user = getStoredUserSettings();
    
    if (admin.allow_user_override !== false && user.my_refresh_seconds !== null) {
      return Math.max(user.my_refresh_seconds || 0, admin.min_refresh_seconds || 30);
    }
    return admin.default_refresh_seconds || 300;
  });

  useEffect(() => {
    const handleChange = () => {
      const admin = getStoredAdminSettings();
      const user = getStoredUserSettings();
      
      if (admin.allow_user_override !== false && user.my_refresh_seconds !== null) {
        setRefreshSeconds(Math.max(user.my_refresh_seconds || 0, admin.min_refresh_seconds || 30));
      } else {
        setRefreshSeconds(admin.default_refresh_seconds || 300);
      }
    };

    window.addEventListener('refresh-settings-changed', handleChange);
    return () => window.removeEventListener('refresh-settings-changed', handleChange);
  }, []);

  return refreshSeconds;
};

export default SourceRefreshSettings;
