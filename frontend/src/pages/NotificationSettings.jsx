import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Switch, 
  Typography, 
  Divider, 
  Button, 
  message,
  Space,
  Tag,
  List,
  Checkbox
} from 'antd';
import { 
  BellOutlined, 
  MailOutlined, 
  MobileOutlined,
  SaveOutlined,
  InfoCircleOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  SearchOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { useTheme } from '../context/ThemeContext';

const { Title, Text, Paragraph } = Typography;

// Notification categories
const NOTIFICATION_CATEGORIES = [
  {
    key: 'articles',
    title: 'Articles & Intelligence',
    icon: <FileTextOutlined />,
    description: 'Notifications about new threat intelligence articles',
    options: [
      { key: 'new_article', label: 'New article published', default: true },
      { key: 'high_priority', label: 'High priority article detected', default: true },
      { key: 'ioc_match', label: 'IOC matches your watchlist', default: true },
      { key: 'ttp_detected', label: 'TTP matches threat actor', default: false },
    ]
  },
  {
    key: 'hunts',
    title: 'Threat Hunts',
    icon: <SearchOutlined />,
    description: 'Notifications about hunt execution and results',
    options: [
      { key: 'hunt_created', label: 'Hunt created successfully', default: true },
      { key: 'hunt_completed', label: 'Hunt execution completed', default: true },
      { key: 'hunt_failed', label: 'Hunt execution failed', default: true },
      { key: 'hunt_available', label: 'New hunt template available', default: false },
    ]
  },
  {
    key: 'system',
    title: 'System & Security',
    icon: <WarningOutlined />,
    description: 'Important system and security alerts',
    options: [
      { key: 'feed_error', label: 'Feed source error', default: true },
      { key: 'api_error', label: 'Connector API error', default: true },
      { key: 'storage_warning', label: 'Storage capacity warning', default: true },
      { key: 'security_alert', label: 'Security incident detected', default: true },
    ]
  },
];

// Delivery methods
const DELIVERY_METHODS = [
  { key: 'in_app', label: 'In-App Notifications', icon: <BellOutlined />, default: true },
  { key: 'email', label: 'Email Notifications', icon: <MailOutlined />, default: false },
  { key: 'push', label: 'Push Notifications', icon: <MobileOutlined />, default: false },
];

export function NotificationSettings() {
  const { currentTheme, isDark } = useTheme();
  const [settings, setSettings] = useState({});
  const [deliveryMethods, setDeliveryMethods] = useState({});
  const [loading, setLoading] = useState(false);

  // Load settings
  useEffect(() => {
    // In real implementation, fetch from API
    const savedSettings = localStorage.getItem('parshu-notification-settings');
    const savedDelivery = localStorage.getItem('parshu-delivery-methods');
    
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    } else {
      // Initialize with defaults
      const defaults = {};
      NOTIFICATION_CATEGORIES.forEach(cat => {
        cat.options.forEach(opt => {
          defaults[opt.key] = opt.default;
        });
      });
      setSettings(defaults);
    }

    if (savedDelivery) {
      setDeliveryMethods(JSON.parse(savedDelivery));
    } else {
      const defaults = {};
      DELIVERY_METHODS.forEach(method => {
        defaults[method.key] = method.default;
      });
      setDeliveryMethods(defaults);
    }
  }, []);

  // Save settings
  const handleSave = async () => {
    setLoading(true);
    try {
      localStorage.setItem('parshu-notification-settings', JSON.stringify(settings));
      localStorage.setItem('parshu-delivery-methods', JSON.stringify(deliveryMethods));
      message.success('Notification settings saved successfully');
    } catch (error) {
      message.error('Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  // Toggle notification option
  const toggleOption = (key) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Toggle delivery method
  const toggleDelivery = (key) => {
    setDeliveryMethods(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Select all in category
  const selectAllInCategory = (categoryKey, value) => {
    const category = NOTIFICATION_CATEGORIES.find(c => c.key === categoryKey);
    const newSettings = { ...settings };
    category.options.forEach(opt => {
      newSettings[opt.key] = value;
    });
    setSettings(newSettings);
  };

  // Check if all options in category are selected
  const isAllSelected = (categoryKey) => {
    const category = NOTIFICATION_CATEGORIES.find(c => c.key === categoryKey);
    return category.options.every(opt => settings[opt.key]);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Title 
          level={2} 
          style={{ color: currentTheme?.colors?.textPrimary, margin: 0 }}
        >
          Notification Settings
        </Title>
        <Paragraph style={{ color: currentTheme?.colors?.textSecondary }}>
          Configure how and when you receive notifications
        </Paragraph>
      </div>

      {/* Delivery Methods */}
      <Card
        className="mb-6"
        style={{
          background: currentTheme?.colors?.bgCard,
          borderColor: currentTheme?.colors?.borderDefault,
        }}
        title={
          <Space>
            <BellOutlined style={{ color: currentTheme?.colors?.primary }} />
            <Text strong style={{ color: currentTheme?.colors?.textPrimary }}>
              Delivery Methods
            </Text>
          </Space>
        }
      >
        <List
          dataSource={DELIVERY_METHODS}
          renderItem={(method) => (
            <List.Item
              style={{ borderColor: currentTheme?.colors?.borderSubtle }}
              actions={[
                <Switch
                  checked={deliveryMethods[method.key]}
                  onChange={() => toggleDelivery(method.key)}
                />
              ]}
            >
              <List.Item.Meta
                avatar={
                  <div style={{ color: currentTheme?.colors?.primary }}>
                    {method.icon}
                  </div>
                }
                title={
                  <Text style={{ color: currentTheme?.colors?.textPrimary }}>
                    {method.label}
                  </Text>
                }
                description={
                  <Text style={{ color: currentTheme?.colors?.textMuted }}>
                    {method.key === 'in_app' && 'Show notifications within the application'}
                    {method.key === 'email' && 'Receive email notifications'}
                    {method.key === 'push' && 'Receive browser push notifications'}
                  </Text>
                }
              />
            </List.Item>
          )}
        />
      </Card>

      {/* Notification Categories */}
      {NOTIFICATION_CATEGORIES.map((category) => (
        <Card
          key={category.key}
          className="mb-4"
          style={{
            background: currentTheme?.colors?.bgCard,
            borderColor: currentTheme?.colors?.borderDefault,
          }}
          title={
            <Space>
              <span style={{ color: currentTheme?.colors?.primary }}>
                {category.icon}
              </span>
              <Text strong style={{ color: currentTheme?.colors?.textPrimary }}>
                {category.title}
              </Text>
            </Space>
          }
          extra={
            <Button 
              type="link" 
              size="small"
              onClick={() => selectAllInCategory(category.key, !isAllSelected(category.key))}
            >
              {isAllSelected(category.key) ? 'Deselect All' : 'Select All'}
            </Button>
          }
        >
          <Paragraph style={{ color: currentTheme?.colors?.textSecondary }}>
            {category.description}
          </Paragraph>
          <Divider style={{ borderColor: currentTheme?.colors?.borderSubtle }} />
          <List
            dataSource={category.options}
            renderItem={(option) => (
              <List.Item
                style={{ borderColor: currentTheme?.colors?.borderSubtle }}
                actions={[
                  <Switch
                    size="small"
                    checked={settings[option.key]}
                    onChange={() => toggleOption(option.key)}
                  />
                ]}
              >
                <Text style={{ color: currentTheme?.colors?.textPrimary }}>
                  {option.label}
                </Text>
              </List.Item>
            )}
          />
        </Card>
      ))}

      {/* Info Card */}
      <Card
        className="mb-6"
        style={{
          background: `${currentTheme?.colors?.infoBg || 'rgba(59, 130, 246, 0.1)'}`,
          borderColor: currentTheme?.colors?.info || '#3B82F6',
        }}
      >
        <Space align="start">
          <InfoCircleOutlined style={{ color: currentTheme?.colors?.info || '#3B82F6', fontSize: 20 }} />
          <div>
            <Text strong style={{ color: currentTheme?.colors?.textPrimary }}>
              About Notifications
            </Text>
            <Paragraph style={{ color: currentTheme?.colors?.textSecondary, margin: 0 }}>
              High priority notifications (security alerts, hunt failures) will always be delivered 
              via in-app notifications regardless of your settings.
            </Paragraph>
          </div>
        </Space>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          type="primary"
          size="large"
          icon={<SaveOutlined />}
          loading={loading}
          onClick={handleSave}
          style={{
            background: currentTheme?.colors?.gradientPrimary || 'linear-gradient(135deg, #3B82F6 0%, #06B6D4 100%)',
            borderColor: 'transparent',
          }}
        >
          Save Settings
        </Button>
      </div>
    </div>
  );
}

export default NotificationSettings;
