import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, Alert, Spin, Divider, message } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { LoginOutlined, SafetyCertificateOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { authAPI } from '../api/client';
import { useAuthStore } from '../store/index';
import './Login.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

function Login() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [samlEnabled, setSamlEnabled] = useState(false);
  const [checkingSaml, setCheckingSaml] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const { setAuth, setTokens, setUser } = useAuthStore();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const saml = params.get('saml');
    const logout = params.get('logout');

    if (logout === 'true') {
      message.info('You have been logged out');
      window.history.replaceState({}, document.title, '/login');
      return;
    }

    if (accessToken && refreshToken && saml === 'true') {
      handleSsoCallback(accessToken, refreshToken);
    }
  }, [location.search]);

  useEffect(() => {
    const checkSamlStatus = async () => {
      try {
        const response = await fetch(`${API_URL}/auth/saml/status`);
        const data = await response.json();
        setSamlEnabled(data.enabled);
      } catch (err) {
        console.log('SAML status check failed, assuming disabled');
        setSamlEnabled(false);
      } finally {
        setCheckingSaml(false);
      }
    };
    checkSamlStatus();
  }, []);

  const handleSsoCallback = async (accessToken, refreshToken) => {
    setLoading(true);
    try {
      setTokens(accessToken, refreshToken);
      const response = await authAPI.me();
      setUser(response.data);
      message.success('SSO login successful!');
      window.history.replaceState({}, document.title, '/login');
      navigate('/dashboard');
    } catch (err) {
      setError('SSO login failed. Please try again.');
      console.error('SSO callback error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSsoLogin = () => {
    window.location.href = `${API_URL}/auth/saml/login`;
  };

  const onFinish = async (values) => {
    setLoading(true);
    setError('');
    try {
      const response = await authAPI.login(values.email, values.password, values.otp);
      const { access_token, refresh_token, user } = response.data;
      setAuth(user, access_token, refresh_token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <Card 
        className="login-card" 
        title={
          <div className="login-header">
            <ThunderboltOutlined className="login-logo" />
            <div className="login-title">HuntSphere</div>
            <div className="login-subtitle">Threat Intelligence Platform</div>
          </div>
        }
      >
        {error && (
          <Alert 
            message={error} 
            type="error" 
            showIcon 
            closable 
            style={{ marginBottom: 20 }} 
          />
        )}
        
        {!checkingSaml && samlEnabled && (
          <>
            <Button 
              type="primary" 
              block 
              size="large"
              icon={<LoginOutlined />}
              onClick={handleSsoLogin}
              loading={loading}
              className="sso-btn"
            >
              Sign in with SSO
            </Button>
            <Divider>or use email</Divider>
          </>
        )}

        <Spin spinning={loading}>
          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            autoComplete="off"
          >
            <Form.Item
              label="Email or Username"
              name="email"
              rules={[
                { required: true, message: 'Please enter your email or username' },
              ]}
            >
              <Input 
                placeholder="admin@huntsphere.local or admin" 
                disabled={loading} 
                size="large" 
              />
            </Form.Item>

            <Form.Item
              label="Password"
              name="password"
              rules={[{ required: true, message: 'Please enter your password' }]}
            >
              <Input.Password 
                placeholder="Password" 
                disabled={loading} 
                size="large" 
              />
            </Form.Item>

            <Form.Item
              label="OTP (if enabled)"
              name="otp"
              tooltip="Enter your 6-digit authenticator code if MFA is enabled"
            >
              <Input 
                placeholder="6-digit code" 
                disabled={loading} 
                size="large" 
                maxLength={6} 
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button 
                type="primary" 
                htmlType="submit" 
                block 
                loading={loading} 
                size="large"
                className="login-btn"
              >
                Sign In
              </Button>
            </Form.Item>
          </Form>
        </Spin>
        
        <div className="login-footer">
          {samlEnabled && (
            <p className="sso-enabled">
              <SafetyCertificateOutlined /> Enterprise SSO is enabled
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}

export default Login;
