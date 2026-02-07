import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Menu, Button, Layout, Dropdown, Avatar, Space, Tag, message, Alert, Modal, Input, Spin, Steps, Result } from 'antd';
import { 
  DashboardOutlined,
  FileTextOutlined, 
  ThunderboltOutlined, 
  BarChartOutlined,
  EyeOutlined,
  SyncOutlined,
  AuditOutlined,
  SettingOutlined,
  UserOutlined,
  LogoutOutlined,
  DownOutlined,
  SafetyOutlined,
  ReadOutlined,
  BgColorsOutlined,
  GlobalOutlined,
  ClockCircleOutlined,
  FontSizeOutlined,
  SwapOutlined,
  ExclamationCircleOutlined,
  RollbackOutlined,
  LockOutlined,
  QrcodeOutlined,
  CheckCircleOutlined,
  MobileOutlined
} from '@ant-design/icons';
import { useAuthStore } from '../store';
import { useTheme } from '../context/ThemeContext';
import { useTimezone, TIMEZONE_OPTIONS } from '../context/TimezoneContext';
import { usersAPI } from '../api/client';

const { Header } = Layout;

function NavBar() {
  const { 
    user, 
    logout, 
    accessToken,
    isImpersonating, 
    assumedRole, 
    originalRole, 
    switchRole, 
    restoreRole,
    loadImpersonationState 
  } = useAuthStore();
  const { currentTheme, setTheme, themes, isDark, fontSizePreference, setFontSize, fontSizeOptions } = useTheme();
  const { setTimezone, getTimezoneAbbr } = useTimezone();
  const navigate = useNavigate();
  const location = useLocation();
  const [availableRoles, setAvailableRoles] = useState([]);
  const [switchingRole, setSwitchingRole] = useState(false);
  const [accessiblePages, setAccessiblePages] = useState([]);
  
  // Security settings modal state
  const [securityModalVisible, setSecurityModalVisible] = useState(false);
  const [otpStatus, setOtpStatus] = useState(null);
  const [otpSetupData, setOtpSetupData] = useState(null);
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [permissionsLoading, setPermissionsLoading] = useState(true);

  // Load impersonation state on mount
  useEffect(() => {
    loadImpersonationState();
  }, [loadImpersonationState]);

  // Fetch user's accessible pages based on their effective role
  const fetchMyPermissions = useCallback(async () => {
    if (!accessToken) {
      setAccessiblePages([]);
      setPermissionsLoading(false);
      return;
    }
    
    try {
      setPermissionsLoading(true);
      const response = await usersAPI.getMyPermissions();
      const pages = response.data?.accessible_pages || [];
      const effectiveRole = response.data?.effective_role;
      const apiIsImpersonating = response.data?.is_impersonating;
      
      setAccessiblePages(pages);
      
      console.log('[NavBar] Permissions loaded:', {
        effectiveRole,
        isImpersonating: apiIsImpersonating,
        accessiblePages: pages.map(p => p.key),
        frontendIsImpersonating: isImpersonating,
        frontendAssumedRole: assumedRole
      });
    } catch (err) {
      console.error('[NavBar] Failed to fetch permissions:', err);
      // On error, set empty - hasPageAccess will handle based on role
      setAccessiblePages([]);
    } finally {
      setPermissionsLoading(false);
    }
  }, [accessToken, isImpersonating, assumedRole]);

  // Fetch permissions on mount and when role/impersonation changes
  useEffect(() => {
    fetchMyPermissions();
  }, [fetchMyPermissions, isImpersonating, assumedRole, user?.role]);

  // Fetch available roles for admins
  useEffect(() => {
    if (user?.role === 'ADMIN' || originalRole === 'ADMIN') {
      usersAPI.getAvailableRoles()
        .then(res => setAvailableRoles(res.data?.roles || []))
        .catch(err => console.error('Failed to fetch roles:', err));
    }
  }, [user?.role, originalRole]);
  
  // Helper to check if user has access to a page
  const hasPageAccess = useCallback((pageKey) => {
    // While loading, hide menu items (safer than showing all)
    if (permissionsLoading) {
      return false;
    }
    
    // If we have accessible pages from the API, use them
    if (accessiblePages.length > 0) {
      return accessiblePages.some(p => p.key === pageKey);
    }
    
    // No pages from API - this means either:
    // 1. API failed (error was logged)
    // 2. Role genuinely has no page access (e.g., unknown role)
    
    // For non-impersonating actual admins, allow all (failsafe)
    if (!isImpersonating && user?.role === 'ADMIN') {
      return true;
    }
    
    // For everyone else (including impersonating admins), be restrictive
    return false;
  }, [accessiblePages, permissionsLoading, isImpersonating, user?.role]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // OTP/2FA Management Functions
  const fetchOtpStatus = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/auth/otp/status`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setOtpStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch OTP status:', error);
    }
  };

  const handleEnableOtp = async () => {
    setOtpLoading(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/auth/otp/enable`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setOtpSetupData(data);
        message.success('Scan the QR code with your authenticator app');
      } else {
        message.error('Failed to initiate OTP setup');
      }
    } catch (error) {
      message.error('Failed to enable OTP: ' + error.message);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.length !== 6) {
      message.warning('Please enter a 6-digit code');
      return;
    }
    
    setOtpLoading(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/auth/otp/verify`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code: otpCode })
      });
      if (response.ok) {
        message.success('Two-factor authentication enabled successfully!');
        setOtpSetupData(null);
        setOtpCode('');
        fetchOtpStatus();
      } else {
        const error = await response.json();
        message.error(error.detail || 'Invalid code. Please try again.');
      }
    } catch (error) {
      message.error('Verification failed: ' + error.message);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleDisableOtp = async () => {
    if (!disablePassword) {
      message.warning('Please enter your password');
      return;
    }
    
    setOtpLoading(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/auth/otp/disable`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password: disablePassword })
      });
      if (response.ok) {
        message.success('Two-factor authentication disabled');
        setDisablePassword('');
        fetchOtpStatus();
      } else {
        const error = await response.json();
        message.error(error.detail || 'Invalid password');
      }
    } catch (error) {
      message.error('Failed to disable OTP: ' + error.message);
    } finally {
      setOtpLoading(false);
    }
  };

  // Fetch OTP status when security modal opens
  useEffect(() => {
    if (securityModalVisible) {
      fetchOtpStatus();
    }
  }, [securityModalVisible]);

  const handleSwitchRole = async (targetRole) => {
    setSwitchingRole(true);
    try {
      const response = await usersAPI.switchRole(targetRole);
      if (response.data?.access_token) {
        switchRole(
          response.data.access_token,
          response.data.assumed_role,
          response.data.original_role
        );
        message.success(`Switched to ${targetRole} role. All activity is logged under your admin account.`);
        // Reload to apply new permissions
        window.location.reload();
      }
    } catch (err) {
      console.error('Failed to switch role:', err);
      message.error(err.response?.data?.detail || 'Failed to switch role');
    } finally {
      setSwitchingRole(false);
    }
  };

  const handleRestoreRole = async () => {
    setSwitchingRole(true);
    try {
      const response = await usersAPI.restoreRole();
      if (response.data?.access_token) {
        restoreRole(response.data.access_token, response.data.original_role);
        message.success('Restored admin role');
        // Reload to apply original permissions
        window.location.reload();
      }
    } catch (err) {
      console.error('Failed to restore role:', err);
      message.error(err.response?.data?.detail || 'Failed to restore role');
    } finally {
      setSwitchingRole(false);
    }
  };

  // The displayed/effective role (assumed if impersonating)
  const displayRole = isImpersonating ? assumedRole : user?.role;
  
  // Check if user is truly an admin (for showing role switcher in menu)
  const isActuallyAdmin = user?.role === 'ADMIN' || originalRole === 'ADMIN';
  
  // For UI visibility, use the EFFECTIVE role (respects impersonation)
  // When impersonating, show UI as if the user has that role
  const isAdmin = isImpersonating ? (assumedRole === 'ADMIN') : (user?.role === 'ADMIN');

  const getRoleColor = (role) => {
    const colors = {
      ADMIN: isDark ? '#EC4899' : '#DC2626',
      TI: currentTheme.colors.primary,
      TH: currentTheme.colors.success,
      IR: currentTheme.colors.warning,
      VIEWER: currentTheme.colors.textMuted,
    };
    return colors[role] || currentTheme.colors.textMuted;
  };

  // Theme selector menu for all users - grouped by category
  const themeMenuItems = [
    // Professional themes
    {
      key: 'professional-header',
      label: <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Professional</span>,
      disabled: true,
    },
    ...themes.filter(t => t.category === 'professional').map(t => ({
      key: t.id,
      label: (
        <Space>
          <div style={{
            width: 16,
            height: 16,
            borderRadius: 4,
            background: t.colors.primary,
            border: `2px solid ${t.id === currentTheme.id ? currentTheme.colors.primary : 'transparent'}`,
          }} />
          <span style={{ fontWeight: t.id === currentTheme.id ? 600 : 400 }}>{t.name}</span>
          {t.id === currentTheme.id && <CheckCircleOutlined style={{ color: 'var(--primary)', fontSize: 12 }} />}
        </Space>
      ),
      onClick: () => setTheme(t.id),
    })),
    // Cyber themes
    {
      key: 'cyber-header',
      label: <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cyber Security</span>,
      disabled: true,
    },
    ...themes.filter(t => t.category === 'cyber').map(t => ({
      key: t.id,
      label: (
        <Space>
          <div style={{
            width: 16,
            height: 16,
            borderRadius: 4,
            background: t.colors.primary,
            border: `2px solid ${t.id === currentTheme.id ? currentTheme.colors.primary : 'transparent'}`,
          }} />
          <span style={{ fontWeight: t.id === currentTheme.id ? 600 : 400 }}>{t.name}</span>
          {t.id === currentTheme.id && <CheckCircleOutlined style={{ color: 'var(--primary)', fontSize: 12 }} />}
        </Space>
      ),
      onClick: () => setTheme(t.id),
    })),
    // Premium themes
    {
      key: 'premium-header',
      label: <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Premium</span>,
      disabled: true,
    },
    ...themes.filter(t => t.category === 'premium').map(t => ({
      key: t.id,
      label: (
        <Space>
          <div style={{
            width: 16,
            height: 16,
            borderRadius: 4,
            background: t.colors.primary,
            border: `2px solid ${t.id === currentTheme.id ? currentTheme.colors.primary : 'transparent'}`,
          }} />
          <span style={{ fontWeight: t.id === currentTheme.id ? 600 : 400 }}>{t.name}</span>
          {t.id === currentTheme.id && <CheckCircleOutlined style={{ color: 'var(--primary)', fontSize: 12 }} />}
        </Space>
      ),
      onClick: () => setTheme(t.id),
    })),
  ];

  // Timezone options for profile menu
  const timezoneMenuItems = [
    {
      key: 'utc',
      label: <Space><GlobalOutlined /> UTC</Space>,
      onClick: () => setTimezone('UTC'),
    },
    {
      key: 'local',
      label: <Space><ClockCircleOutlined /> Local Time</Space>,
      onClick: () => setTimezone('LOCAL'),
    },
    { type: 'divider' },
    ...TIMEZONE_OPTIONS.filter(tz => tz.value !== 'UTC' && tz.value !== 'LOCAL').slice(0, 8).map(tz => ({
      key: tz.value,
      label: tz.label,
      onClick: () => setTimezone(tz.value),
    })),
  ];

  // Role switching menu items for admins
  const roleSwitchMenuItems = availableRoles
    .filter(r => r.value !== 'ADMIN') // Don't show ADMIN as a switch target
    .map(role => ({
      key: `role-${role.value}`,
      label: (
        <Space>
          <span>{role.value}</span>
          {assumedRole === role.value && <Tag color="orange" style={{ marginLeft: 4 }}>Current</Tag>}
        </Space>
      ),
      onClick: () => handleSwitchRole(role.value),
      disabled: assumedRole === role.value || switchingRole,
    }));

  const userMenuItems = [
    {
      key: 'profile',
      label: (
        <Space direction="vertical" size={0}>
          <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{user?.email}</span>
          <Space>
            <Tag style={{ 
              background: getRoleColor(displayRole), 
              color: '#fff', 
              border: 'none',
              marginTop: 4,
              borderRadius: 4,
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.03em'
            }}>
              {displayRole}
            </Tag>
            {isImpersonating && (
              <Tag color="orange" style={{ marginTop: 4, fontSize: 10 }}>
                Testing
              </Tag>
            )}
          </Space>
        </Space>
      ),
      disabled: true,
    },
    // Show impersonation banner if active
    ...(isImpersonating ? [{
      key: 'impersonation-info',
      label: (
        <Alert
          message={`Testing as ${assumedRole}`}
          description="Activity logged under your admin account"
          type="warning"
          showIcon
          icon={<ExclamationCircleOutlined />}
          style={{ margin: '-4px -12px', borderRadius: 0 }}
        />
      ),
      disabled: true,
    }] : []),
    { type: 'divider' },
    // Timezone selector - available to all users
    {
      key: 'timezone',
      label: (
        <Space>
          <GlobalOutlined />
          <span>Timezone: {getTimezoneAbbr()}</span>
        </Space>
      ),
      children: timezoneMenuItems,
    },
    // Font size selector - available to all users
    {
      key: 'fontsize',
      label: (
        <Space>
          <FontSizeOutlined />
          <span>Font Size: {fontSizeOptions[fontSizePreference]?.label || 'Default'}</span>
        </Space>
      ),
      children: Object.entries(fontSizeOptions).map(([key, value]) => ({
        key: `font-${key}`,
        label: (
          <Space>
            <span style={{ fontWeight: fontSizePreference === key ? 600 : 400 }}>
              {value.label}
            </span>
            {fontSizePreference === key && <Tag color="blue" style={{ marginLeft: 8 }}>Active</Tag>}
          </Space>
        ),
        onClick: () => setFontSize(key),
      })),
    },
    { type: 'divider' },
    // Role switching for ACTUAL admins only (not based on assumed role)
    ...(isActuallyAdmin && !isImpersonating ? [{
      key: 'switch-role',
      label: (
        <Space>
          <SwapOutlined />
          <span>Test as Role</span>
        </Space>
      ),
      children: roleSwitchMenuItems,
    }] : []),
    // Restore role option when impersonating
    ...(isImpersonating ? [{
      key: 'restore-role',
      label: (
        <Space style={{ color: 'var(--primary)' }}>
          <RollbackOutlined />
          <span>Restore Admin Role</span>
        </Space>
      ),
      onClick: handleRestoreRole,
      disabled: switchingRole,
    }] : []),
    // Theme selector - available to all users
    {
      key: 'theme',
      label: 'Change Theme',
      icon: <BgColorsOutlined />,
      children: [
        // Link to full theme manager
        {
          key: 'theme-manager',
          label: (
            <Space>
              <SettingOutlined />
              <span>Theme Settings...</span>
            </Space>
          ),
          onClick: () => navigate('/admin?tab=appearance'),
        },
        { type: 'divider' },
        ...themeMenuItems,
      ],
    },
    { type: 'divider' },
    // Security settings - available to all users
    {
      key: 'security',
      label: 'Security Settings',
      icon: <LockOutlined />,
      onClick: () => setSecurityModalVisible(true),
    },
    { type: 'divider' },
    {
      key: 'logout',
      label: 'Logout',
      icon: <LogoutOutlined />,
      onClick: handleLogout,
      danger: true,
    },
  ];

  // Define all possible menu items with their page keys
  const allMenuItems = [
    {
      key: '/dashboard',
      pageKey: 'dashboard',
      icon: <DashboardOutlined />,
      label: <Link to="/dashboard">Operations</Link>,
    },
    {
      key: '/news',
      pageKey: 'feed',
      icon: <ReadOutlined />,
      label: <Link to="/news">News & Feeds</Link>,
    },
    {
      key: '/articles',
      pageKey: 'articles',
      icon: <FileTextOutlined />,
      label: <Link to="/articles">Articles</Link>,
    },
    {
      key: '/intelligence',
      pageKey: 'intelligence',
      icon: <SafetyOutlined />,
      label: <Link to="/intelligence">Intelligence</Link>,
    },
    {
      key: '/hunts',
      pageKey: 'hunts',
      icon: <ThunderboltOutlined />,
      label: <Link to="/hunts">Threat Hunts</Link>,
    },
    {
      key: '/reports',
      pageKey: 'reports',
      icon: <BarChartOutlined />,
      label: <Link to="/reports">Reports</Link>,
    },
    {
      key: '/sources',
      pageKey: 'sources',
      icon: <SyncOutlined />,
      label: <Link to="/sources">Sources</Link>,
    },
    {
      key: '/watchlist',
      pageKey: 'watchlist',
      icon: <EyeOutlined />,
      label: <Link to="/watchlist">Watchlist</Link>,
    },
    {
      key: '/audit',
      pageKey: 'audit',
      icon: <AuditOutlined />,
      label: <Link to="/audit">Audit Logs</Link>,
    },
    {
      key: '/admin',
      pageKey: 'admin',
      icon: <SettingOutlined />,
      label: <Link to="/admin">Admin</Link>,
    },
  ];

  // Filter menu items based on user's accessible pages
  const menuItems = allMenuItems.filter(item => {
    // If no pageKey, always show (shouldn't happen)
    if (!item.pageKey) return true;
    
    // Check if user has access to this page
    return hasPageAccess(item.pageKey);
  }).map(({ pageKey, ...item }) => item); // Remove pageKey from final items

  return (
    <>
      {/* Impersonation Banner - Always visible at top when impersonating */}
      {isImpersonating && (
        <div style={{
          background: 'linear-gradient(90deg, #fa8c16 0%, #faad14 100%)',
          color: '#fff',
          padding: '6px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          fontSize: 13,
          fontWeight: 500,
        }}>
          <ExclamationCircleOutlined />
          <span>
            Testing as <strong>{assumedRole}</strong> — All activity is logged under admin account: <strong>{user?.username}</strong>
          </span>
          <Button 
            size="small" 
            type="primary"
            ghost
            icon={<RollbackOutlined />}
            onClick={handleRestoreRole}
            loading={switchingRole}
            style={{ marginLeft: 8, borderColor: '#fff', color: '#fff' }}
          >
            Restore Admin
          </Button>
        </div>
      )}
      
      <Header className="orion-navbar" style={{ 
        display: 'flex', 
        alignItems: 'center', 
        padding: '0 24px',
        background: 'var(--bg-navbar)',
        height: 56,
      }}>
      <div className="logo" style={{ 
        color: 'var(--text-inverse)', 
        fontWeight: 600, 
        marginRight: 32,
        fontSize: 18,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <ThunderboltOutlined className="logo-icon" style={{ 
          color: 'var(--primary)', 
          fontSize: 20,
          ...(isDark ? { filter: 'drop-shadow(0 0 8px var(--primary))' } : {}),
        }} />
        <span>Parshu</span>
      </div>
      
      {user && (
        <Menu 
          theme="dark" 
          mode="horizontal" 
          selectedKeys={[location.pathname]}
          items={menuItems}
          style={{ 
            flex: 1, 
            background: 'transparent',
            borderBottom: 'none',
            fontSize: 14,
            fontWeight: 500,
            minWidth: 0,
          }}
          overflowedIndicator={null}
          disabledOverflow={true}
        />
      )}
      
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        {user ? (
          <Dropdown 
            menu={{ items: userMenuItems }}
            trigger={['click']}
            placement="bottomRight"
          >
            <Button 
              type="text" 
              style={{ 
                color: 'var(--text-inverse)', 
                height: 'auto', 
                padding: '6px 12px',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Avatar 
                size={28} 
                icon={<UserOutlined />}
                style={{ 
                  backgroundColor: getRoleColor(displayRole),
                  border: isImpersonating ? '2px solid #faad14' : 'none',
                }}
              />
              <span style={{ marginLeft: 6, fontWeight: 500, fontSize: 13 }}>{user.username}</span>
              <DownOutlined style={{ fontSize: 10, marginLeft: 4 }} />
            </Button>
          </Dropdown>
        ) : (
          <Button 
            type="primary" 
            onClick={() => navigate('/login')}
            style={{ borderRadius: 6 }}
          >
            Login
          </Button>
        )}
      </div>
    </Header>

    {/* Security Settings Modal */}
    <Modal
      title={<Space><LockOutlined /> Security Settings</Space>}
      open={securityModalVisible}
      onCancel={() => {
        setSecurityModalVisible(false);
        setOtpSetupData(null);
        setOtpCode('');
        setDisablePassword('');
      }}
      footer={null}
      width={500}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* OTP Status */}
        {otpStatus === null ? (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <Spin size="large" />
            <p>Loading security settings...</p>
          </div>
        ) : otpSetupData ? (
          /* OTP Setup Flow */
          <div>
            <Steps 
              current={1} 
              size="small"
              items={[
                { title: 'Initiate' },
                { title: 'Scan QR Code' },
                { title: 'Verify' }
              ]}
              style={{ marginBottom: 24 }}
            />
            
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <p style={{ marginBottom: 16 }}>
                Scan this QR code with Google Authenticator, Authy, or another TOTP app:
              </p>
              <img 
                src={otpSetupData.qr_code_data_url} 
                alt="OTP QR Code" 
                style={{ width: 200, height: 200, border: '1px solid #d9d9d9', borderRadius: 8 }}
              />
            </div>
            
            <Alert
              message="Manual Entry Key"
              description={
                <Space direction="vertical">
                  <span>If you can't scan the QR code, enter this key manually:</span>
                  <Tag style={{ fontFamily: 'monospace', fontSize: 14 }}>
                    {otpSetupData.manual_entry_key}
                  </Tag>
                </Space>
              }
              type="info"
              showIcon
              icon={<MobileOutlined />}
              style={{ marginBottom: 16 }}
            />
            
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
                Enter the 6-digit code from your authenticator:
              </label>
              <Input
                size="large"
                maxLength={6}
                placeholder="000000"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                style={{ fontSize: 24, textAlign: 'center', letterSpacing: 8 }}
              />
            </div>
            
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => { setOtpSetupData(null); setOtpCode(''); }}>
                Cancel
              </Button>
              <Button 
                type="primary" 
                onClick={handleVerifyOtp} 
                loading={otpLoading}
                disabled={otpCode.length !== 6}
              >
                Verify & Enable
              </Button>
            </Space>
          </div>
        ) : otpStatus?.otp_enabled ? (
          /* OTP Enabled State */
          <div>
            <Result
              status="success"
              title="Two-Factor Authentication Enabled"
              subTitle="Your account is protected with 2FA. You'll need to enter a code from your authenticator app when you log in."
              icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
            />
            
            <Alert
              message="Disable Two-Factor Authentication"
              description={
                <div style={{ marginTop: 8 }}>
                  <p>Enter your password to disable 2FA:</p>
                  <Space style={{ width: '100%' }}>
                    <Input.Password
                      placeholder="Enter password"
                      value={disablePassword}
                      onChange={(e) => setDisablePassword(e.target.value)}
                      style={{ width: 200 }}
                    />
                    <Button 
                      danger 
                      onClick={handleDisableOtp} 
                      loading={otpLoading}
                      disabled={!disablePassword}
                    >
                      Disable 2FA
                    </Button>
                  </Space>
                </div>
              }
              type="warning"
              showIcon
            />
          </div>
        ) : (
          /* OTP Not Enabled State */
          <div>
            <Alert
              message="Two-Factor Authentication"
              description={
                <div>
                  <p>Add an extra layer of security to your account by requiring a verification code from an authenticator app (like Google Authenticator or Authy) when you sign in.</p>
                  <Space style={{ marginTop: 12 }}>
                    <MobileOutlined style={{ fontSize: 24, color: '#1890ff' }} />
                    <span>Works with Google Authenticator, Authy, 1Password, and other TOTP apps</span>
                  </Space>
                </div>
              }
              type="info"
              showIcon
              icon={<LockOutlined />}
              style={{ marginBottom: 16 }}
            />
            
            <Button 
              type="primary" 
              size="large" 
              block
              icon={<QrcodeOutlined />}
              onClick={handleEnableOtp}
              loading={otpLoading}
            >
              Enable Two-Factor Authentication
            </Button>
          </div>
        )}
        
        {/* SAML Status (if enabled) */}
        {user?.is_saml_user && (
          <Alert
            message="Single Sign-On (SSO)"
            description="Your account is linked to your organization's SSO provider. Password and 2FA settings are managed by your IT administrator."
            type="info"
            showIcon
          />
        )}
      </Space>
    </Modal>
    </>
  );
}

export default NavBar;
