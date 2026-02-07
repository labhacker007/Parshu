import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Newspaper,
  FileText,
  Brain,
  Target,
  BarChart3,
  Globe,
  Eye,
  ClipboardList,
  Settings,
  Shield,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Bell
} from 'lucide-react';
import { useAuthStore } from '../../store/index';
import { useTheme } from '../../context/ThemeContext';

const navigationItems = [
  { id: 'dashboard', label: 'Operations', icon: LayoutDashboard, path: '/dashboard' },
  { id: 'news', label: 'News & Feeds', icon: Newspaper, path: '/news' },
  { id: 'articles', label: 'Articles', icon: FileText, path: '/articles' },
  { id: 'intelligence', label: 'Intelligence', icon: Brain, path: '/intelligence' },
  { id: 'hunts', label: 'Threat Hunts', icon: Target, path: '/hunts' },
  { id: 'reports', label: 'Reports', icon: BarChart3, path: '/reports' },
  { id: 'sources', label: 'Sources', icon: Globe, path: '/sources' },
  { id: 'watchlist', label: 'Watchlist', icon: Eye, path: '/watchlist' },
  { id: 'audit', label: 'Audit Logs', icon: ClipboardList, path: '/audit' },
  { id: 'admin', label: 'Admin', icon: Settings, path: '/admin' },
];

export function NewSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { currentTheme } = useTheme();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  // Use actual theme colors from currentTheme
  const colors = currentTheme?.colors || {};

  return (
    <aside 
      className={`fixed left-0 top-0 h-full transition-all duration-300 z-50`}
      style={{
        width: isCollapsed ? '64px' : '256px',
        background: colors.bgNavbar || '#0F1115',
        borderRight: `1px solid ${colors.borderSubtle || 'rgba(113, 113, 122, 0.1)'}`,
      }}
    >
      {/* Logo */}
      <div 
        className="h-16 flex items-center px-4"
        style={{ borderBottom: `1px solid ${colors.borderSubtle || 'rgba(113, 113, 122, 0.1)'}` }}
      >
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ 
              background: colors.gradientPrimary || 'linear-gradient(135deg, #3B82F6 0%, #06B6D4 100%)'
            }}
          >
            <Shield className="w-6 h-6 text-white" />
          </div>
          {!isCollapsed && (
            <div>
              <h1 className="font-bold text-lg" style={{ color: colors.textPrimary || '#FFFFFF' }}>PULSER</h1>
            </div>
          )}
        </div>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="ml-auto p-1.5 rounded-lg transition-colors"
          style={{ background: colors.bgElevated || '#252830' }}
        >
          {isCollapsed ? (
            <ChevronRight className="w-5 h-5" style={{ color: colors.textMuted || '#71717A' }} />
          ) : (
            <ChevronLeft className="w-5 h-5" style={{ color: colors.textMuted || '#71717A' }} />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="p-3 space-y-1">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
              style={{
                background: active ? `${colors.primaryLight || 'rgba(59, 130, 246, 0.15)'}` : 'transparent',
                color: active ? colors.primary || '#3B82F6' : colors.textSecondary || '#A1A1AA',
                borderLeft: active ? `3px solid ${colors.primary || '#3B82F6'}` : '3px solid transparent'
              }}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon 
                className="w-5 h-5 shrink-0" 
                style={{ color: active ? colors.primary || '#3B82F6' : colors.textMuted || '#71717A' }} 
              />
              {!isCollapsed && (
                <span style={{ color: active ? colors.primary || '#3B82F6' : colors.textPrimary || '#FFFFFF' }}>
                  {item.label}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Section */}
      <div 
        className="absolute bottom-0 left-0 right-0 p-3"
        style={{ 
          background: colors.bgNavbar || '#0F1115', 
          borderTop: `1px solid ${colors.borderSubtle || 'rgba(113, 113, 122, 0.1)'}` 
        }}
      >
        {/* Notifications */}
        <button 
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors mb-2"
          style={{ color: colors.textMuted || '#71717A' }}
          onClick={() => navigate('/settings/notifications')}
        >
          <div className="relative">
            <Bell className="w-5 h-5" style={{ color: colors.textMuted || '#71717A' }} />
            <span 
              className="absolute -top-1 -right-1 w-2 h-2 rounded-full" 
              style={{ background: colors.critical || '#EF4444' }} 
            />
          </div>
          {!isCollapsed && (
            <span style={{ color: colors.textPrimary || '#FFFFFF' }}>Notifications</span>
          )}
        </button>

        {/* User */}
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors"
        >
          <div 
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ background: colors.primaryLight || 'rgba(59, 130, 246, 0.1)' }}
          >
            <span 
              className="font-medium text-sm" 
              style={{ color: colors.primary || '#3B82F6' }}
            >
              {user?.name?.charAt(0) || user?.email?.charAt(0) || 'A'}
            </span>
          </div>
          {!isCollapsed && (
            <div className="flex-1 text-left">
              <p className="truncate" style={{ color: colors.textPrimary || '#FFFFFF' }}>
                {user?.name || user?.email || 'Admin'}
              </p>
              <p className="text-xs truncate" style={{ color: colors.textMuted || '#71717A' }}>
                {user?.role || 'Administrator'}
              </p>
            </div>
          )}
          {!isCollapsed && (
            <LogOut className="w-4 h-4" style={{ color: colors.textMuted || '#71717A' }} />
          )}
        </button>
      </div>
    </aside>
  );
}

export default NewSidebar;
