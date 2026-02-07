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
  Bell,
  Search,
  Menu,
  X,
  LogOut,
  Shield,
  Sun,
  Moon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from './ui/Button';
import { applyTheme, getCurrentTheme, getAllThemes } from '../themes';
import { cn } from '../lib/utils';

/**
 * Navigation Items Configuration
 */
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

/**
 * Sidebar Component
 * Collapsible sidebar navigation with glassmorphism
 */
export function Sidebar({ 
  onLogout, 
  user,
  notifications = [],
  className 
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(true);
  const [currentTheme, setCurrentTheme] = useState(getCurrentTheme());
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Check if nav item is active
  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  // Toggle theme
  const toggleTheme = () => {
    const themes = getAllThemes();
    const currentIndex = themes.findIndex(t => t.id === currentTheme);
    const nextIndex = (currentIndex + 1) % themes.length;
    const nextTheme = themes[nextIndex].id;
    
    applyTheme(nextTheme);
    setCurrentTheme(nextTheme);
  };

  // Handle navigation
  const handleNavigate = (path) => {
    navigate(path);
  };

  return (
    <>
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 bg-[hsl(var(--sidebar-background))] border-r border-[hsl(var(--sidebar-border))] transition-all duration-300 ease-in-out flex flex-col',
          isOpen ? 'w-64' : 'w-16',
          className
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-[hsl(var(--sidebar-border))]">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="p-2 rounded-lg bg-[hsl(var(--sidebar-primary))]/10 shrink-0">
              <Shield className="w-5 h-5 text-[hsl(var(--sidebar-primary))]" />
            </div>
            {isOpen && (
              <div className="overflow-hidden whitespace-nowrap">
                <h1 className="font-bold text-[hsl(var(--sidebar-foreground))] text-lg tracking-tight">
                  PARSHU
                </h1>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                  Threat Intel
                </p>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'ml-auto shrink-0',
              !isOpen && 'absolute -right-3 top-5 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-full w-6 h-6'
            )}
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? (
              <ChevronLeft className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);

            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.path)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group',
                  active
                    ? 'bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--sidebar-primary-foreground))]'
                    : 'text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-accent-foreground))]',
                  !isOpen && 'justify-center px-2'
                )}
                title={!isOpen ? item.label : undefined}
              >
                <Icon className={cn(
                  'w-5 h-5 shrink-0 transition-transform',
                  active && 'scale-110'
                )} />
                {isOpen && (
                  <span className="truncate">{item.label}</span>
                )}
                {active && isOpen && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[hsl(var(--sidebar-primary-foreground))]" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Section */}
        <div className="p-3 border-t border-[hsl(var(--sidebar-border))] space-y-2">
          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size={isOpen ? 'default' : 'icon'}
            onClick={toggleTheme}
            className={cn(
              'w-full justify-start text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))]',
              !isOpen && 'justify-center px-2'
            )}
            title={!isOpen ? 'Toggle Theme' : undefined}
          >
            <Sun className="w-4 h-4 shrink-0" />
            {isOpen && <span className="ml-2">Change Theme</span>}
          </Button>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                'hover:bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-foreground))]',
                !isOpen && 'justify-center px-2'
              )}
            >
              <div className="w-8 h-8 rounded-full bg-[hsl(var(--sidebar-primary))]/20 flex items-center justify-center shrink-0">
                <span className="text-sm font-medium text-[hsl(var(--sidebar-primary))]">
                  {user?.name?.charAt(0) || user?.email?.charAt(0) || 'A'}
                </span>
              </div>
              {isOpen && (
                <>
                  <div className="flex-1 text-left overflow-hidden">
                    <p className="text-sm font-medium truncate">{user?.name || user?.email || 'Admin'}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">
                      {user?.role || 'Administrator'}
                    </p>
                  </div>
                  <ChevronDown className="w-4 h-4 shrink-0" />
                </>
              )}
            </button>

            {/* User Dropdown */}
            {showUserMenu && isOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 py-1 bg-[hsl(var(--popover))] border border-[hsl(var(--border))] rounded-lg shadow-lg">
                <button
                  onClick={() => {
                    handleNavigate('/profile');
                    setShowUserMenu(false);
                  }}
                  className="w-full px-4 py-2 text-sm text-left text-[hsl(var(--popover-foreground))] hover:bg-[hsl(var(--muted))]"
                >
                  Profile
                </button>
                <button
                  onClick={() => {
                    handleNavigate('/settings');
                    setShowUserMenu(false);
                  }}
                  className="w-full px-4 py-2 text-sm text-left text-[hsl(var(--popover-foreground))] hover:bg-[hsl(var(--muted))]"
                >
                  Settings
                </button>
                <div className="my-1 border-t border-[hsl(var(--border))]" />
                <button
                  onClick={onLogout}
                  className="w-full px-4 py-2 text-sm text-left text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))]/10"
                >
                  <LogOut className="w-4 h-4 inline mr-2" />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Spacer */}
      <div className={cn('transition-all duration-300', isOpen ? 'ml-64' : 'ml-16')} />

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}

/**
 * Top Header Component
 * Sticky header with search and notifications
 */
export function Header({ 
  onMenuClick, 
  notifications = [],
  onSearch 
}) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <header className="h-16 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]/50 backdrop-blur-sm sticky top-0 z-30">
      <div className="h-full px-6 flex items-center justify-between">
        {/* Left: Menu button (mobile) + Search */}
        <div className="flex items-center gap-4 flex-1">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onMenuClick}
          >
            <Menu className="w-5 h-5" />
          </Button>

          {/* Search */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
              <input
                type="text"
                placeholder="Search articles, IOCs, hunts..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  onSearch?.(e.target.value);
                }}
                className="input pl-10 w-full bg-[hsl(var(--background))]"
              />
            </div>
          </div>
        </div>

        {/* Right: Notifications */}
        <div className="flex items-center gap-4">
          {/* Notifications */}
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-[hsl(var(--critical))] rounded-full animate-pulse" />
              )}
            </Button>

            {/* Notification Dropdown */}
            {showNotifications && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowNotifications(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-80 bg-[hsl(var(--popover))] border border-[hsl(var(--border))] rounded-lg shadow-lg z-50">
                  <div className="p-3 border-b border-[hsl(var(--border))]">
                    <h3 className="font-semibold">Notifications</h3>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-[hsl(var(--muted-foreground))]">
                        No notifications
                      </div>
                    ) : (
                      notifications.map((notification, i) => (
                        <div
                          key={i}
                          className="p-3 border-b border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] cursor-pointer"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className={cn(
                              'text-xs px-2 py-0.5 rounded-full',
                              notification.type === 'critical' && 'bg-[hsl(var(--critical))]/10 text-[hsl(var(--critical))]',
                              notification.type === 'warning' && 'bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]',
                              notification.type === 'info' && 'bg-[hsl(var(--info))]/10 text-[hsl(var(--info))]'
                            )}>
                              {notification.type}
                            </span>
                            <span className="text-xs text-[hsl(var(--muted-foreground))]">
                              {notification.time}
                            </span>
                          </div>
                          <p className="text-sm">{notification.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default Sidebar;
