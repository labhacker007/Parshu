import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Form, Input, Button, Alert, Spin, Typography } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LoginOutlined,
  LockOutlined,
  SafetyOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  CheckCircleFilled,
  SafetyCertificateFilled,
  LockFilled,
  GoogleOutlined,
  WindowsOutlined
} from '@ant-design/icons';
import { authAPI } from '../api/client';
import { useAuthStore } from '../store/index';
import { useTheme } from '../context/ThemeContext';
import './Login.css';

const { Text, Title } = Typography;

// ============================================
// ANIMATED BACKGROUND COMPONENTS
// ============================================

// 1. Neural Network Background (Nodes and connections)
const NeuralNetworkBackground = ({ color }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const particlesRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    // Create particles
    const particleCount = Math.floor((width * height) / 25000);
    particlesRef.current = [];

    for (let i = 0; i < particleCount; i++) {
      particlesRef.current.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        radius: Math.random() * 2 + 1,
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      // Update and draw particles
      particlesRef.current.forEach((particle, i) => {
        particle.x += particle.vx;
        particle.y += particle.vy;

        // Wrap around edges
        if (particle.x < 0) particle.x = width;
        if (particle.x > width) particle.x = 0;
        if (particle.y < 0) particle.y = height;
        if (particle.y > height) particle.y = 0;

        // Draw particle
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fillStyle = color + '40';
        ctx.fill();

        // Draw connections
        particlesRef.current.slice(i + 1).forEach((other) => {
          const dx = particle.x - other.x;
          const dy = particle.y - other.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 120) {
            ctx.beginPath();
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(other.x, other.y);
            ctx.strokeStyle = color + Math.floor((1 - distance / 120) * 30).toString(16).padStart(2, '0');
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        });
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, [color]);

  return <canvas ref={canvasRef} className="login-animated-bg" />;
};

// 2. Matrix Rain Background
const MatrixRainBackground = ({ color }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    const fontSize = 14;
    const columns = Math.floor(width / fontSize);
    const drops = Array(columns).fill(1);
    const chars = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';

    let frameCount = 0;
    const animate = () => {
      frameCount++;
      // Slow down animation (render every 2nd frame)
      if (frameCount % 2 === 0) {
        ctx.fillStyle = 'rgba(5, 5, 5, 0.05)';
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = color;
        ctx.font = `${fontSize}px monospace`;

        drops.forEach((drop, i) => {
          const char = chars[Math.floor(Math.random() * chars.length)];
          ctx.fillText(char, i * fontSize, drop * fontSize);

          if (drop * fontSize > height && Math.random() > 0.975) {
            drops[i] = 0;
          }
          drops[i]++;
        });
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, [color]);

  return <canvas ref={canvasRef} className="login-animated-bg matrix-bg" />;
};

// 3. Floating Orbs Background
const FloatingOrbsBackground = ({ primaryColor, secondaryColor }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    const orbs = [];
    const orbCount = 5;

    for (let i = 0; i < orbCount; i++) {
      orbs.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 150 + 100,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        color: i % 2 === 0 ? primaryColor : secondaryColor,
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      orbs.forEach((orb) => {
        orb.x += orb.vx;
        orb.y += orb.vy;

        // Bounce off edges
        if (orb.x < -orb.radius) orb.x = width + orb.radius;
        if (orb.x > width + orb.radius) orb.x = -orb.radius;
        if (orb.y < -orb.radius) orb.y = height + orb.radius;
        if (orb.y > height + orb.radius) orb.y = -orb.radius;

        // Draw orb with gradient
        const gradient = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.radius);
        gradient.addColorStop(0, orb.color + '20');
        gradient.addColorStop(0.5, orb.color + '10');
        gradient.addColorStop(1, 'transparent');

        ctx.beginPath();
        ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, [primaryColor, secondaryColor]);

  return <canvas ref={canvasRef} className="login-animated-bg" />;
};

// 4. Particle Constellation Background
const ConstellationBackground = ({ color }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const mouseRef = useRef({ x: null, y: null });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    const particles = [];
    const particleCount = 60;

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: Math.random() * 2 + 1,
      });
    }

    const handleMouseMove = (e) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseLeave = () => {
      mouseRef.current = { x: null, y: null };
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      particles.forEach((particle) => {
        particle.x += particle.vx;
        particle.y += particle.vy;

        if (particle.x < 0 || particle.x > width) particle.vx *= -1;
        if (particle.y < 0 || particle.y > height) particle.vy *= -1;

        // Draw particle
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = color + '60';
        ctx.fill();

        // Connect to mouse
        if (mouseRef.current.x && mouseRef.current.y) {
          const dx = mouseRef.current.x - particle.x;
          const dy = mouseRef.current.y - particle.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 150) {
            ctx.beginPath();
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(mouseRef.current.x, mouseRef.current.y);
            ctx.strokeStyle = color + Math.floor((1 - distance / 150) * 40).toString(16).padStart(2, '0');
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [color]);

  return <canvas ref={canvasRef} className="login-animated-bg" />;
};

// ============================================
// JYOTI LOGO COMPONENT
// ============================================
const JyotiLogo = ({ size = 48, color }) => (
  <div className="jyoti-logo" style={{ width: size, height: size }}>
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path 
        d="M50 5L93.3013 30V80L50 95L6.69873 80V30L50 5Z" 
        stroke={color} 
        strokeWidth="3"
        fill="none"
        className="logo-hex"
      />
      <path 
        d="M50 15L83.3013 35V75L50 85L16.6987 75V35L50 15Z" 
        stroke={color} 
        strokeWidth="1.5"
        fill="none"
        opacity="0.4"
      />
      <path 
        d="M35 35V75M35 35H55C62 35 67 40 67 47C67 54 62 59 55 59H35" 
        stroke={color} 
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="logo-p"
      />
      <circle cx="72" cy="65" r="5" fill={color} className="logo-dot" />
    </svg>
  </div>
);

// ============================================
// SECURITY BADGE COMPONENT
// ============================================
const SecurityBadge = ({ icon: Icon, label, color }) => (
  <div className="security-badge" style={{ color: color + '99' }}>
    <Icon style={{ color: color }} />
    <span>{label}</span>
  </div>
);

// ============================================
// MAIN LOGIN COMPONENT
// ============================================
function Login() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [samlEnabled, setSamlEnabled] = useState(false);
  const [checkingSaml, setCheckingSaml] = useState(true);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { setAuth, setTokens, setUser } = useAuthStore();
  const { currentTheme } = useTheme();

  // Get accent color from theme
  const accentColor = currentTheme.colors.loginAccentColor || currentTheme.colors.primary;
  const secondaryColor = currentTheme.colors.secondary;

  // Check SAML on mount
  useEffect(() => {
    const checkSaml = async () => {
      try {
        const response = await authAPI.checkSaml();
        setSamlEnabled(response.data?.enabled || false);
      } catch (err) {
        setSamlEnabled(false);
      } finally {
        setCheckingSaml(false);
      }
    };
    checkSaml();
  }, []);

  // Handle OAuth callback tokens
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const accessToken = urlParams.get('access_token');
    const refreshToken = urlParams.get('refresh_token');

    if (accessToken && refreshToken) {
      // OAuth login successful - store tokens and redirect
      setTokens(accessToken, refreshToken);

      // Fetch user info
      authAPI.me().then(resp => {
        setUser(resp.data);
        // Clear URL parameters
        window.history.replaceState({}, document.title, window.location.pathname);
        navigate('/news');
      }).catch(err => {
        console.error('Failed to fetch user info after OAuth login:', err);
        setError('Authentication successful but failed to load user profile. Please try again.');
      });
    }
  }, [setTokens, setUser, navigate]);

  const handleSubmit = async (values) => {
    setLoading(true);
    setError('');

    try {
      const response = await authAPI.login({
        email: values.username,  // Backend expects 'email' field but accepts username or email
        password: values.password,
      });

      if (response.data?.access_token) {
        setTokens(response.data.access_token, response.data.refresh_token);
        setUser(response.data.user);
        setAuth(true);

        const from = location.state?.from?.pathname || '/dashboard';
        navigate(from, { replace: true });
      }
    } catch (err) {
      // Handle different error response formats
      let errorMsg = 'Invalid credentials. Please try again.';
      if (err.response?.data) {
        if (typeof err.response.data === 'string') {
          errorMsg = err.response.data;
        } else if (err.response.data.detail) {
          errorMsg = typeof err.response.data.detail === 'string' 
            ? err.response.data.detail 
            : JSON.stringify(err.response.data.detail);
        } else if (err.response.data.msg) {
          errorMsg = err.response.data.msg;
        } else {
          errorMsg = JSON.stringify(err.response.data);
        }
      } else if (err.message) {
        errorMsg = err.message;
      }
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleSamlLogin = () => {
    window.location.href = `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/auth/saml/login`;
  };

  // Select background based on theme
  const renderBackground = () => {
    const themeId = currentTheme.id?.replace('-terminal', '').replace('-neon', '');
    
    switch (themeId) {
      case 'matrix':
        return <MatrixRainBackground color={accentColor} />;
      case 'aurora':
        return <FloatingOrbsBackground primaryColor={accentColor} secondaryColor={secondaryColor} />;
      case 'red-alert':
        return <ConstellationBackground color={accentColor} />;
      case 'midnight':
        return <FloatingOrbsBackground primaryColor={accentColor} secondaryColor={secondaryColor} />;
      case 'daylight':
        return <NeuralNetworkBackground color={accentColor} />;
      case 'command-center':
      default:
        return <NeuralNetworkBackground color={accentColor} />;
    }
  };

  return (
    <div className="jyoti-login" style={{ background: currentTheme.colors.loginBgGradient }}>
      {/* Animated Background */}
      {renderBackground()}

      {/* Content Container */}
      <div className="login-content">
        {/* Logo & Brand */}
        <div className="login-brand">
          <JyotiLogo size={56} color={accentColor} />
          <Title level={3} className="brand-title" style={{ color: currentTheme.colors.textPrimary }}>
            Jyoti
          </Title>
          <Text className="brand-subtitle" style={{ color: currentTheme.colors.textSecondary }}>
            Continuous AI-Powered TI to Hunt
          </Text>
        </div>

        {/* Login Card */}
        <div 
          className="login-card"
          style={{
            background: currentTheme.colors.glassBg,
            borderColor: currentTheme.colors.glassBorder,
          }}
        >
          {/* Welcome Text */}
          <div className="login-header">
            <Title level={4} style={{ color: currentTheme.colors.textPrimary, margin: 0 }}>
              Welcome back
            </Title>
            <Text style={{ color: currentTheme.colors.textMuted }}>
              Sign in to your account
            </Text>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert
              message={error}
              type="error"
              showIcon
              className="login-error"
              style={{
                background: currentTheme.colors.criticalBg,
                borderColor: currentTheme.colors.critical + '40',
                color: currentTheme.colors.critical,
              }}
            />
          )}

          {/* Login Form */}
          <Form
            form={form}
            name="login"
            onFinish={handleSubmit}
            className="login-form"
            layout="vertical"
          >
            {/* OAuth Login Buttons */}
            <Form.Item style={{ marginBottom: 12 }}>
              <Button
                size="large"
                block
                icon={<GoogleOutlined />}
                onClick={() => {
                  window.location.href = `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/auth/google/login`;
                }}
                style={{
                  background: currentTheme.colors.mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#ffffff',
                  borderColor: currentTheme.colors.borderDefault,
                  color: currentTheme.colors.textPrimary,
                  boxShadow: `0 2px 8px ${currentTheme.colors.mode === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.08)'}`,
                }}
              >
                Sign in with Google
              </Button>
            </Form.Item>

            <Form.Item style={{ marginBottom: 12 }}>
              <Button
                size="large"
                block
                icon={<WindowsOutlined />}
                onClick={() => {
                  window.location.href = `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/auth/microsoft/login`;
                }}
                style={{
                  background: currentTheme.colors.mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#ffffff',
                  borderColor: currentTheme.colors.borderDefault,
                  color: currentTheme.colors.textPrimary,
                  boxShadow: `0 2px 8px ${currentTheme.colors.mode === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.08)'}`,
                }}
              >
                Sign in with Microsoft
              </Button>
            </Form.Item>

            {/* Divider */}
            <div style={{
              textAlign: 'center',
              margin: '24px 0',
              position: 'relative'
            }}>
              <div style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: '50%',
                borderTop: `1px solid ${currentTheme.colors.borderDefault}`,
              }} />
              <span style={{
                position: 'relative',
                background: currentTheme.colors.backgroundPrimary,
                padding: '0 16px',
                color: currentTheme.colors.textMuted,
                fontSize: '14px',
              }}>
                OR
              </span>
            </div>

            <Form.Item
              name="username"
              rules={[{ required: true, message: 'Please enter your username' }]}
            >
              <Input
                prefix={<LoginOutlined style={{ color: currentTheme.colors.textMuted }} />}
                placeholder="Username or email"
                size="large"
                style={{
                  background: currentTheme.colors.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                  borderColor: currentTheme.colors.borderDefault,
                  color: currentTheme.colors.textPrimary,
                }}
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: 'Please enter your password' }]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: currentTheme.colors.textMuted }} />}
                placeholder="Password"
                size="large"
                visibilityToggle={{
                  visible: passwordVisible,
                  onVisibleChange: setPasswordVisible,
                }}
                iconRender={(visible) =>
                  visible ? (
                    <EyeOutlined style={{ color: currentTheme.colors.textMuted }} />
                  ) : (
                    <EyeInvisibleOutlined style={{ color: currentTheme.colors.textMuted }} />
                  )
                }
                style={{
                  background: currentTheme.colors.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                  borderColor: currentTheme.colors.borderDefault,
                  color: currentTheme.colors.textPrimary,
                }}
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 12 }}>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                block
                loading={loading}
                style={{
                  background: currentTheme.colors.gradientPrimary,
                  borderColor: 'transparent',
                  boxShadow: `0 4px 16px ${currentTheme.colors.primaryGlow}`,
                }}
              >
                Sign In
              </Button>
            </Form.Item>

            {/* SAML Login */}
            {samlEnabled && !checkingSaml && (
              <Form.Item>
                <Button
                  size="large"
                  block
                  onClick={handleSamlLogin}
                  style={{
                    borderColor: currentTheme.colors.borderDefault,
                    color: currentTheme.colors.textSecondary,
                  }}
                >
                  Sign in with SSO
                </Button>
              </Form.Item>
            )}
          </Form>

          {/* Security Badges */}
          <div 
            className="security-badges"
            style={{ borderColor: currentTheme.colors.borderSubtle }}
          >
            <SecurityBadge 
              icon={LockFilled} 
              label="TLS 1.3" 
              color={accentColor}
            />
            <SecurityBadge 
              icon={SafetyCertificateFilled} 
              label="AES-256" 
              color={accentColor}
            />
            <SecurityBadge 
              icon={CheckCircleFilled} 
              label="SOC 2" 
              color={accentColor}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="login-footer">
          <Text style={{ color: currentTheme.colors.textMuted }}>
            © 2026 Jyoti. All rights reserved.
          </Text>
        </div>
      </div>
    </div>
  );
}

export default Login;
