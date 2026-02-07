import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ConfigProvider, theme as antdTheme } from 'antd';

// New Components
import { LoginPage } from './sections/LoginPage';
import { Dashboard as NewDashboard } from './sections/Dashboard';
import { Sidebar, Header } from './components/Sidebar';
import { initTheme, getCurrentTheme, getTheme, applyTheme } from './themes';

// Legacy Pages (will be gradually migrated)
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ArticleQueue from './pages/ArticleQueue';
import NewsFeeds from './pages/NewsFeeds';
import Intelligence from './pages/Intelligence';
import Hunts from './pages/Hunts';
import Reports from './pages/Reports';
import Sources from './pages/Sources';
import Watchlist from './pages/Watchlist';
import AuditLogs from './pages/AuditLogs';
import Admin from './pages/Admin';
import Unauthorized from './pages/Unauthorized';
import ProtectedRoute from './components/ProtectedRoute';
import NavBar from './components/NavBar';
import Chatbot from './components/Chatbot';

// Contexts
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { TimezoneProvider } from './context/TimezoneContext';
import { useAuthStore } from './store';
import { authAPI } from './api/client';

// Styles
import './App.css';
import './styles/parshu-theme.css';

/**
 * NewLayout - Modern layout with collapsible sidebar
 * Used when USE_NEW_UI feature flag is enabled
 */
function NewLayout({ children }) {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';

  if (isLoginPage) {
    return children;
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <Sidebar 
        user={user} 
        onLogout={logout}
        notifications={[
          { type: 'critical', message: 'New high-priority article detected', time: '2 min ago' },
          { type: 'warning', message: 'SLA breach: 3 articles pending', time: '15 min ago' },
          { type: 'info', message: 'Hunt #54 completed successfully', time: '1 hour ago' },
        ]}
      />
      <div className="ml-64">
        <Header onSearch={(q) => console.log('Search:', q)} />
        <main className="min-h-[calc(100vh-4rem)]">
          {children}
        </main>
      </div>
    </div>
  );
}

/**
 * LegacyLayout - Traditional top-navbar layout
 * Used for backward compatibility
 */
function LegacyLayout({ children }) {
  return (
    <>
      <NavBar />
      <Chatbot />
      {children}
    </>
  );
}

// Inner App component that uses theme context
function AppContent() {
  const { accessToken, refreshToken, setUser, setTokens, logout, user } = useAuthStore();
  const { currentTheme, isDark } = useTheme();
  const [useNewUI, setUseNewUI] = useState(true); // New UI is now default
  const [newThemeId, setNewThemeId] = useState(getCurrentTheme());

  // Initialize new theme system
  useEffect(() => {
    initTheme();
  }, []);

  // Sync new theme with legacy theme context
  useEffect(() => {
    const handleStorage = () => {
      const themeId = getCurrentTheme();
      setNewThemeId(themeId);
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Auth initialization
  useEffect(() => {
    const init = async () => {
      if (!accessToken && !refreshToken) return;
      try {
        const resp = await authAPI.me();
        setUser(resp.data);
      } catch (err) {
        if (err.response?.status === 401 && refreshToken) {
          try {
            const r = await authAPI.refresh(refreshToken);
            setTokens(r.data.access_token, refreshToken);
            const me = await authAPI.me();
            setUser(me.data);
          } catch (err2) {
            logout();
          }
        } else {
          logout();
        }
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Get theme configuration for Ant Design
  const themeConfig = React.useMemo(() => {
    const theme = getTheme(newThemeId);
    const isDarkTheme = !['corporate'].includes(newThemeId);
    
    return {
      algorithm: isDarkTheme ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      token: {
        colorPrimary: `hsl(${theme.colors.primary})`,
        colorSuccess: `hsl(${theme.colors.success})`,
        colorWarning: `hsl(${theme.colors.warning})`,
        colorError: `hsl(${theme.colors.critical})`,
        colorInfo: `hsl(${theme.colors.info})`,
        borderRadius: parseFloat(theme.colors.radius) * 16,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      },
      components: {
        Card: {
          borderRadiusLG: 12,
        },
        Button: {
          borderRadius: 6,
          controlHeight: 36,
        },
      },
    };
  }, [newThemeId]);

  // Handle login for new UI
  const handleLogin = () => {
    // In a real app, this would be handled by the auth flow
    window.location.href = '/dashboard';
  };

  // Layout wrapper based on UI mode
  const Layout = useNewUI ? NewLayout : LegacyLayout;

  return (
    <ConfigProvider theme={themeConfig}>
      <Router>
        <Layout>
          <Routes>
            {/* Login - use new design when enabled */}
            <Route 
              path="/login" 
              element={
                useNewUI ? (
                  <LoginPage onLogin={handleLogin} />
                ) : (
                  <Login />
                )
              } 
            />
            
            {/* Dashboard */}
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  {useNewUI ? <NewDashboard /> : <Dashboard />}
                </ProtectedRoute>
              } 
            />
            
            {/* Other routes - using legacy components for now */}
            <Route path="/news" element={<ProtectedRoute><NewsFeeds /></ProtectedRoute>} />
            <Route path="/articles" element={<ProtectedRoute><ArticleQueue /></ProtectedRoute>} />
            <Route path="/intelligence" element={<ProtectedRoute><Intelligence /></ProtectedRoute>} />
            <Route path="/hunts" element={<ProtectedRoute><Hunts /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
            <Route path="/sources" element={<ProtectedRoute><Sources /></ProtectedRoute>} />
            <Route path="/watchlist" element={<ProtectedRoute><Watchlist /></ProtectedRoute>} />
            <Route path="/audit" element={<ProtectedRoute><AuditLogs /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
            
            <Route path="/unauthorized" element={<Unauthorized />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Layout>
      </Router>
    </ConfigProvider>
  );
}

// Main App component wrapped with ThemeProvider and TimezoneProvider
function App() {
  return (
    <ThemeProvider>
      <TimezoneProvider>
        <AppContent />
      </TimezoneProvider>
    </ThemeProvider>
  );
}

export default App;
