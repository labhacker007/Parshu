import React, { useState, useEffect } from 'react';
import {
  Card, Form, Input, Button, Typography, message, Space,
  Descriptions, Tag, Divider, Row, Col, Statistic, Alert
} from 'antd';
import {
  UserOutlined, LockOutlined, MailOutlined, SafetyOutlined,
  CalendarOutlined, KeyOutlined
} from '@ant-design/icons';
import { authAPI } from '../api/client';
import { useAuthStore } from '../store';
import client from '../api/client';

const { Title, Text } = Typography;

function UserProfile() {
  const { user } = useAuthStore();
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordForm] = Form.useForm();
  const [userWatchlistCount, setUserWatchlistCount] = useState(0);
  const [userFeedsCount, setUserFeedsCount] = useState(0);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [watchlistResp, feedsResp] = await Promise.allSettled([
        client.get('/users/watchlist/'),
        client.get('/users/feeds/')
      ]);
      if (watchlistResp.status === 'fulfilled') {
        setUserWatchlistCount(watchlistResp.value.data?.length || 0);
      }
      if (feedsResp.status === 'fulfilled') {
        setUserFeedsCount(feedsResp.value.data?.length || 0);
      }
    } catch (err) {
      // Stats are optional
    }
  };

  const handleChangePassword = async (values) => {
    setChangingPassword(true);
    try {
      await client.post('/auth/change-password', {
        current_password: values.current_password,
        new_password: values.new_password
      });
      message.success('Password changed successfully');
      passwordForm.resetFields();
    } catch (err) {
      const detail = err.response?.data?.detail || 'Failed to change password';
      message.error(detail);
    } finally {
      setChangingPassword(false);
    }
  };

  const isOAuthUser = user?.oauth_provider != null;

  return (
    <div style={{ padding: '24px', maxWidth: 900, margin: '0 auto' }}>
      <Title level={3}>
        <UserOutlined /> Profile
      </Title>

      <Row gutter={[16, 16]}>
        {/* Account Info */}
        <Col span={24}>
          <Card title="Account Information" size="small">
            <Descriptions column={2} size="small">
              <Descriptions.Item label="Email">
                <Space>
                  <MailOutlined />
                  {user?.email || 'N/A'}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Username">
                {user?.username || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Full Name">
                {user?.full_name || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Role">
                <Tag color={user?.role === 'ADMIN' ? 'red' : 'blue'}>
                  {user?.role || 'USER'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Login Method">
                {isOAuthUser ? (
                  <Tag color="green">{user.oauth_provider} OAuth</Tag>
                ) : (
                  <Tag color="default">Email/Password</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="2FA Status">
                {user?.otp_enabled ? (
                  <Tag color="green" icon={<SafetyOutlined />}>Enabled</Tag>
                ) : (
                  <Tag color="default">Disabled</Tag>
                )}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        {/* Quick Stats */}
        <Col span={12}>
          <Card size="small">
            <Statistic
              title="Personal Watchlist Keywords"
              value={userWatchlistCount}
              prefix={<KeyOutlined />}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small">
            <Statistic
              title="Custom Feeds"
              value={userFeedsCount}
              prefix={<CalendarOutlined />}
            />
          </Card>
        </Col>

        {/* Password Change */}
        <Col span={24}>
          <Card title="Change Password" size="small">
            {isOAuthUser ? (
              <Alert
                type="info"
                message="OAuth accounts cannot change password"
                description="You signed in with your OAuth provider. Password management is handled by your provider."
                showIcon
              />
            ) : (
              <Form
                form={passwordForm}
                layout="vertical"
                onFinish={handleChangePassword}
                style={{ maxWidth: 400 }}
              >
                <Form.Item
                  name="current_password"
                  label="Current Password"
                  rules={[{ required: true, message: 'Enter current password' }]}
                >
                  <Input.Password prefix={<LockOutlined />} placeholder="Current password" />
                </Form.Item>
                <Form.Item
                  name="new_password"
                  label="New Password"
                  rules={[
                    { required: true, message: 'Enter new password' },
                    { min: 12, message: 'Password must be at least 12 characters' }
                  ]}
                >
                  <Input.Password prefix={<LockOutlined />} placeholder="New password (min 12 chars)" />
                </Form.Item>
                <Form.Item
                  name="confirm_password"
                  label="Confirm New Password"
                  dependencies={['new_password']}
                  rules={[
                    { required: true, message: 'Confirm your new password' },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (!value || getFieldValue('new_password') === value) {
                          return Promise.resolve();
                        }
                        return Promise.reject(new Error('Passwords do not match'));
                      },
                    }),
                  ]}
                >
                  <Input.Password prefix={<LockOutlined />} placeholder="Confirm new password" />
                </Form.Item>
                <Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={changingPassword}
                    icon={<SafetyOutlined />}
                  >
                    Change Password
                  </Button>
                </Form.Item>
              </Form>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default UserProfile;
