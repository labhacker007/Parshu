import React, { useState, useEffect, useRef } from 'react';
import { Badge, Dropdown, List, Typography, Empty, Button, Tag, Spin } from 'antd';
import { 
  BellOutlined, 
  CheckCircleOutlined, 
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
  SettingOutlined,
  ReloadOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import { useTheme } from '../context/ThemeContext';
import { huntsAPI } from '../api/client';

const { Text } = Typography;

// Notification types
const NOTIFICATION_TYPES = {
  HUNT_CREATED: { icon: <CheckCircleOutlined />, color: 'success' },
  HUNT_FAILED: { icon: <CloseCircleOutlined />, color: 'error' },
  HUNT_COMPLETED: { icon: <CheckCircleOutlined />, color: 'success' },
  ARTICLE_HIGH_PRIORITY: { icon: <ExclamationCircleOutlined />, color: 'warning' },
  IOC_MATCH: { icon: <InfoCircleOutlined />, color: 'info' },
  SYSTEM: { icon: <InfoCircleOutlined />, color: 'default' },
};

export function NotificationsDropdown() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const { currentTheme } = useTheme();
  const intervalRef = useRef(null);

  // Fetch notifications (simulated with hunt data for now)
  const fetchNotifications = async () => {
    try {
      setLoading(true);
      // In real implementation, this would call a notifications API
      // For now, we'll create mock notifications based on recent hunts
      const mockNotifications = [
        {
          id: 1,
          type: 'HUNT_COMPLETED',
          title: 'Hunt Execution Completed',
          message: 'USB Threat Hunt executed successfully on XSIAM',
          timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 min ago
          read: false,
          link: '/hunts/1',
        },
        {
          id: 2,
          type: 'ARTICLE_HIGH_PRIORITY',
          title: 'High Priority Article',
          message: 'New critical vulnerability in Microsoft Exchange detected',
          timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 min ago
          read: false,
          link: '/articles/123',
        },
        {
          id: 3,
          type: 'HUNT_FAILED',
          title: 'Hunt Execution Failed',
          message: 'Lateral Movement Hunt failed on Splunk - connection timeout',
          timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // 1 hour ago
          read: true,
          link: '/hunts/2',
        },
        {
          id: 4,
          type: 'IOC_MATCH',
          title: 'IOC Match Detected',
          message: 'Matching IOC found for APT29 threat actor',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
          read: true,
          link: '/intelligence',
        },
      ];
      
      setNotifications(mockNotifications);
      setUnreadCount(mockNotifications.filter(n => !n.read).length);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Poll every 30 seconds
    intervalRef.current = setInterval(fetchNotifications, 30000);
    return () => clearInterval(intervalRef.current);
  }, []);

  // Mark all as read
  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  // Mark single as read
  const markAsRead = (id) => {
    setNotifications(prev => prev.map(n => 
      n.id === id ? { ...n, read: true } : n
    ));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  // Clear all
  const clearAll = () => {
    setNotifications([]);
    setUnreadCount(0);
  };

  // Format time
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 1000 * 60) return 'Just now';
    if (diff < 1000 * 60 * 60) return `${Math.floor(diff / (1000 * 60))}m ago`;
    if (diff < 1000 * 60 * 60 * 24) return `${Math.floor(diff / (1000 * 60 * 60))}h ago`;
    return `${Math.floor(diff / (1000 * 60 * 60 * 24))}d ago`;
  };

  // Get notification style
  const getNotificationStyle = (type) => {
    const config = NOTIFICATION_TYPES[type] || NOTIFICATION_TYPES.SYSTEM;
    const colors = {
      success: currentTheme?.colors?.success || '#22C55E',
      error: currentTheme?.colors?.critical || '#EF4444',
      warning: currentTheme?.colors?.high || '#F97316',
      info: currentTheme?.colors?.primary || '#3B82F6',
      default: currentTheme?.colors?.textMuted || '#71717A',
    };
    return { ...config, color: colors[config.color] };
  };

  // Dropdown content
  const dropdownContent = (
    <div 
      className="w-96 rounded-lg shadow-xl overflow-hidden"
      style={{ 
        background: currentTheme?.colors?.bgCard || '#1A1D24',
        border: `1px solid ${currentTheme?.colors?.borderDefault || 'rgba(113, 113, 122, 0.2)'}`,
      }}
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: currentTheme?.colors?.borderDefault || 'rgba(113, 113, 122, 0.2)' }}
      >
        <Text 
          strong 
          style={{ color: currentTheme?.colors?.textPrimary || '#FFFFFF' }}
        >
          Notifications
        </Text>
        <div className="flex gap-2">
          <Button 
            type="text" 
            size="small"
            icon={<ReloadOutlined />}
            onClick={fetchNotifications}
            loading={loading}
            style={{ color: currentTheme?.colors?.textMuted }}
          />
          <Button 
            type="text" 
            size="small"
            icon={<SettingOutlined />}
            style={{ color: currentTheme?.colors?.textMuted }}
            onClick={() => window.location.href = '/settings/notifications'}
          />
        </div>
      </div>

      {/* Notification List */}
      <div className="max-h-80 overflow-y-auto">
        {loading && notifications.length === 0 ? (
          <div className="flex justify-center py-8">
            <Spin size="small" />
          </div>
        ) : notifications.length === 0 ? (
          <Empty 
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Text style={{ color: currentTheme?.colors?.textMuted }}>
                No notifications
              </Text>
            }
            className="py-8"
          />
        ) : (
          <List
            dataSource={notifications}
            renderItem={(item) => {
              const style = getNotificationStyle(item.type);
              return (
                <List.Item
                  className="px-4 py-3 cursor-pointer hover:opacity-80 transition-opacity"
                  style={{ 
                    background: item.read 
                      ? 'transparent' 
                      : `${currentTheme?.colors?.primaryLight || 'rgba(59, 130, 246, 0.1)'}`,
                    borderBottom: `1px solid ${currentTheme?.colors?.borderSubtle || 'rgba(113, 113, 122, 0.1)'}`,
                  }}
                  onClick={() => {
                    markAsRead(item.id);
                    if (item.link) window.location.href = item.link;
                  }}
                >
                  <div className="flex gap-3 w-full">
                    <div 
                      className="mt-1"
                      style={{ color: style.color }}
                    >
                      {style.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <Text 
                          strong 
                          className="block truncate"
                          style={{ color: currentTheme?.colors?.textPrimary }}
                        >
                          {item.title}
                        </Text>
                        {!item.read && (
                          <span 
                            className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                            style={{ background: currentTheme?.colors?.primary }}
                          />
                        )}
                      </div>
                      <Text 
                        className="block text-sm truncate"
                        style={{ color: currentTheme?.colors?.textSecondary }}
                      >
                        {item.message}
                      </Text>
                      <Text 
                        className="block text-xs mt-1"
                        style={{ color: currentTheme?.colors?.textMuted }}
                      >
                        {formatTime(item.timestamp)}
                      </Text>
                    </div>
                  </div>
                </List.Item>
              );
            }}
          />
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div 
          className="flex items-center justify-between px-4 py-2 border-t"
          style={{ borderColor: currentTheme?.colors?.borderDefault }}
        >
          <Button 
            type="link" 
            size="small"
            onClick={markAllAsRead}
            style={{ color: currentTheme?.colors?.primary }}
          >
            Mark all read
          </Button>
          <Button 
            type="text" 
            size="small"
            icon={<DeleteOutlined />}
            onClick={clearAll}
            style={{ color: currentTheme?.colors?.textMuted }}
          />
        </div>
      )}
    </div>
  );

  return (
    <Dropdown
      dropdownRender={() => dropdownContent}
      open={open}
      onOpenChange={setOpen}
      placement="bottomRight"
      arrow
    >
      <Button
        type="text"
        icon={
          <Badge count={unreadCount} size="small" offset={[0, 2]}>
            <BellOutlined 
              style={{ 
                fontSize: 18, 
                color: currentTheme?.colors?.textSecondary || '#A1A1AA' 
              }} 
            />
          </Badge>
        }
        style={{
          width: 40,
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      />
    </Dropdown>
  );
}

export default NotificationsDropdown;
