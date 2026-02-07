import React from 'react';
import { Card, Row, Col, Button, Tag, Space, Typography, Switch, Divider, Alert, message, Segmented } from 'antd';
import { 
  CheckCircleOutlined, 
  BgColorsOutlined,
  SunOutlined,
  MoonOutlined,
  CodeOutlined,
  ThunderboltOutlined,
  RocketOutlined,
  EyeOutlined
} from '@ant-design/icons';
import { useTheme } from '../context/ThemeContext';
import './ThemeManager.css';

const { Title, Text, Paragraph } = Typography;

/**
 * Theme Manager - Admin component to switch between application themes
 * Based on research of CrowdStrike, SentinelOne, Splunk, CyFocus, SOCius
 */
const ThemeManager = () => {
  const { 
    currentTheme, currentThemeId, setTheme, themes, 
    terminalMode, neonMode, toggleTerminalMode, toggleNeonMode 
  } = useTheme();

  const handleThemeChange = (themeId) => {
    setTheme(themeId);
    message.success(`Theme changed to ${themes.find(t => t.id === themeId)?.name}`);
  };

  // Group themes by category
  const themeCategories = {
    professional: themes.filter(t => t.category === 'professional'),
    cyber: themes.filter(t => t.category === 'cyber'),
    premium: themes.filter(t => t.category === 'premium'),
  };

  const specialMode = terminalMode ? 'terminal' : neonMode ? 'neon' : 'none';

  return (
    <div className="theme-manager">
      <div className="theme-intro">
        <Title level={5}>
          <BgColorsOutlined style={{ marginRight: 8 }} />
          Application Themes
        </Title>
        <Paragraph type="secondary">
          Choose from 4 professionally designed themes based on industry-leading cybersecurity platforms. 
          Enable special modes for a unique aesthetic experience.
        </Paragraph>
      </div>

      {/* Special Modes Section */}
      <Card className="special-modes-card" size="small" style={{ marginBottom: 24 }}>
        <Title level={5} style={{ marginBottom: 16 }}>
          <RocketOutlined style={{ marginRight: 8 }} />
          Special Modes
        </Title>
        
        <Row gutter={16}>
          <Col span={12}>
            <div className={`mode-option ${terminalMode ? 'active terminal' : ''}`}>
              <div className="mode-header">
                <Space>
                  <CodeOutlined style={{ fontSize: 20, color: terminalMode ? '#00FF41' : 'var(--text-muted)' }} />
                  <div>
                    <Text strong>Terminal Mode</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Green terminal aesthetic with monospace fonts
                    </Text>
                  </div>
                </Space>
                <Switch 
                  checked={terminalMode} 
                  onChange={toggleTerminalMode}
                  style={{ backgroundColor: terminalMode ? '#00FF41' : undefined }}
                />
              </div>
              {terminalMode && (
                <div className="mode-preview terminal-preview">
                  <Text style={{ fontFamily: 'monospace', color: '#00FF41' }}>
                    &gt; System initialized...
                  </Text>
                </div>
              )}
            </div>
          </Col>
          
          <Col span={12}>
            <div className={`mode-option ${neonMode ? 'active neon' : ''}`}>
              <div className="mode-header">
                <Space>
                  <ThunderboltOutlined style={{ fontSize: 20, color: neonMode ? '#00F0FF' : 'var(--text-muted)' }} />
                  <div>
                    <Text strong>Neon Mode</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Futuristic cyan neon aesthetic
                    </Text>
                  </div>
                </Space>
                <Switch 
                  checked={neonMode} 
                  onChange={toggleNeonMode}
                  style={{ backgroundColor: neonMode ? '#00F0FF' : undefined }}
                />
              </div>
              {neonMode && (
                <div className="mode-preview neon-preview">
                  <Text style={{ color: '#00F0FF', textShadow: '0 0 10px #00F0FF' }}>
                    NEURAL LINK ACTIVE
                  </Text>
                </div>
              )}
            </div>
          </Col>
        </Row>

        {(terminalMode || neonMode) && (
          <Alert
            message={terminalMode ? "Terminal Mode Active" : "Neon Mode Active"}
            description={terminalMode 
              ? "Monospace fonts, green terminal colors, and matrix-style glow effects applied." 
              : "Futuristic fonts, cyan neon colors, and cyberpunk glow effects applied."
            }
            type="info"
            showIcon
            icon={terminalMode ? <CodeOutlined /> : <ThunderboltOutlined />}
            style={{ 
              marginTop: 16, 
              background: terminalMode ? 'rgba(0, 255, 65, 0.1)' : 'rgba(0, 240, 255, 0.1)', 
              borderColor: terminalMode ? '#00FF41' : '#00F0FF' 
            }}
          />
        )}
      </Card>

      {/* Professional Themes */}
      <Divider orientation="left">
        <Space>
          <EyeOutlined />
          Professional
        </Space>
      </Divider>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {themeCategories.professional.map((theme) => (
          <Col xs={24} sm={12} md={8} key={theme.id}>
            <ThemeCard 
              theme={theme} 
              isSelected={currentThemeId === theme.id && !terminalMode && !neonMode}
              onSelect={() => handleThemeChange(theme.id)}
              disabled={terminalMode || neonMode}
            />
          </Col>
        ))}
      </Row>

      {/* Cyber Themes */}
      <Divider orientation="left">
        <Space>
          <ThunderboltOutlined />
          Cyber Security
        </Space>
      </Divider>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {themeCategories.cyber.map((theme) => (
          <Col xs={24} sm={12} md={8} key={theme.id}>
            <ThemeCard 
              theme={theme} 
              isSelected={currentThemeId === theme.id && !terminalMode && !neonMode}
              onSelect={() => handleThemeChange(theme.id)}
              disabled={terminalMode || neonMode}
            />
          </Col>
        ))}
      </Row>

      {/* Premium Themes */}
      <Divider orientation="left">
        <Space>
          <MoonOutlined />
          Premium
        </Space>
      </Divider>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {themeCategories.premium.map((theme) => (
          <Col xs={24} sm={12} md={8} key={theme.id}>
            <ThemeCard 
              theme={theme} 
              isSelected={currentThemeId === theme.id && !terminalMode && !neonMode}
              onSelect={() => handleThemeChange(theme.id)}
              disabled={terminalMode || neonMode}
            />
          </Col>
        ))}
      </Row>

      {/* Theme Info */}
      <Card size="small" className="theme-info-card">
        <Row gutter={16}>
          <Col span={6}>
            <div className="info-item">
              <Text strong>Current Theme</Text>
              <div>
                <Tag color="blue">{currentTheme.name}</Tag>
              </div>
            </div>
          </Col>
          <Col span={6}>
            <div className="info-item">
              <Text strong>Mode</Text>
              <Tag>{currentTheme.mode === 'dark' ? 'Dark' : 'Light'}</Tag>
            </div>
          </Col>
          <Col span={6}>
            <div className="info-item">
              <Text strong>Primary Color</Text>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div 
                  style={{ 
                    width: 20, 
                    height: 20, 
                    borderRadius: 4, 
                    background: currentTheme.colors.primary,
                    border: '2px solid var(--border-default)',
                    boxShadow: (terminalMode || neonMode) ? `0 0 8px ${currentTheme.colors.primary}` : 'none'
                  }} 
                />
                <Text code style={{ fontSize: 11 }}>{currentTheme.colors.primary}</Text>
              </div>
            </div>
          </Col>
          <Col span={6}>
            <div className="info-item">
              <Text strong>Special Mode</Text>
              <Tag color={terminalMode ? 'green' : neonMode ? 'cyan' : 'default'}>
                {terminalMode ? 'TERMINAL' : neonMode ? 'NEON' : 'OFF'}
              </Tag>
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

/**
 * Individual Theme Card Component
 */
const ThemeCard = ({ theme, isSelected, onSelect, disabled }) => {
  return (
    <Card
      className={`theme-card ${isSelected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
      hoverable={!disabled}
      onClick={disabled ? undefined : onSelect}
    >
      {/* Theme Preview */}
      <div 
        className="theme-preview"
        style={{ 
          background: theme.mode === 'dark' 
            ? theme.colors.bgBody 
            : `linear-gradient(135deg, ${theme.colors.bgNavbar} 0%, ${theme.colors.primary} 100%)`,
        }}
      >
        <div 
          className="preview-card"
          style={{ 
            background: theme.colors.bgCard,
            borderColor: theme.colors.borderDefault,
          }}
        >
          <div 
            className="preview-header"
            style={{ borderColor: theme.colors.borderDefault }}
          >
            <div 
              className="preview-dot"
              style={{ background: theme.colors.primary }}
            />
            <div 
              className="preview-text"
              style={{ background: theme.colors.textPrimary, opacity: 0.2 }}
            />
          </div>
          <div className="preview-content">
            <div 
              className="preview-btn"
              style={{ background: theme.colors.primary }}
            />
            <div 
              className="preview-tag"
              style={{ background: theme.colors.success }}
            />
          </div>
        </div>
      </div>

      {/* Theme Info */}
      <div className="theme-info">
        <div className="theme-header">
          <div className="theme-name">
            <Text strong style={{ fontSize: 14 }}>{theme.name}</Text>
            {isSelected && (
              <CheckCircleOutlined style={{ color: 'var(--success)', marginLeft: 8 }} />
            )}
          </div>
          <Tag color={theme.mode === 'dark' ? 'default' : 'blue'} style={{ fontSize: 10 }}>
            {theme.mode === 'dark' ? <MoonOutlined /> : <SunOutlined />}
            {' '}
            {theme.mode === 'dark' ? 'Dark' : 'Light'}
          </Tag>
        </div>
        <Text type="secondary" className="theme-desc">
          {theme.description}
        </Text>
      </div>

      {/* Color Swatches */}
      <div className="color-swatches">
        <div className="swatch" style={{ background: theme.colors.primary }} title="Primary" />
        <div className="swatch" style={{ background: theme.colors.success }} title="Success" />
        <div className="swatch" style={{ background: theme.colors.warning }} title="Warning" />
        <div className="swatch" style={{ background: theme.colors.danger }} title="Danger" />
        <div className="swatch" style={{ background: theme.colors.bgNavbar }} title="Navbar" />
      </div>

      {isSelected && (
        <div className="current-badge">
          <Tag color="green">Active</Tag>
        </div>
      )}
    </Card>
  );
};

export default ThemeManager;
