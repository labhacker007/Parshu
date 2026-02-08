/**
 * NewHeader Component
 * Modern header with theme toggle, search, and notifications
 */

import React, { useState } from 'react';
import { useTheme } from '../../styles/themes/ThemeContext';
import { ThemeToggleCompact } from '../../styles/themes/ThemeToggle';
import { 
  Search, 
  Bell, 
  Settings, 
  User,
  Menu,
  Shield,
  LogOut
} from 'lucide-react';

export function NewHeader({ 
  onMenuToggle, 
  user, 
  onLogout,
  notifications = [] 
}) {
  const { currentTheme } = useTheme();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <header className="new-header">
      <div className="header-left">
        <button className="menu-btn" onClick={onMenuToggle}>
          <Menu className="w-5 h-5" />
        </button>
        
        <div className="logo">
          <Shield className="w-8 h-8" />
          <span className="logo-text">PARSHU</span>
          <span className="logo-badge">TI</span>
        </div>
      </div>

      <div className="header-center">
        <div className="search-box">
          <Search className="search-icon w-4 h-4" />
          <input
            type="text"
            placeholder="Search articles, IOCs, hunts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <kbd className="search-shortcut">Ctrl+K</kbd>
        </div>
      </div>

      <div className="header-right">
        {/* Theme Toggle */}
        <ThemeToggleCompact />

        {/* Notifications */}
        <div className="notification-wrapper">
          <button 
            className="icon-btn"
            onClick={() => setShowNotifications(!showNotifications)}
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="notification-badge">{unreadCount}</span>
            )}
          </button>

          {showNotifications && (
            <div className="dropdown notifications-dropdown">
              <div className="dropdown-header">
                <h4>Notifications</h4>
                <button className="text-btn">Mark all read</button>
              </div>
              <div className="notifications-list">
                {notifications.length === 0 ? (
                  <p className="empty-state">No notifications</p>
                ) : (
                  notifications.map((notif, idx) => (
                    <div key={idx} className={`notification-item ${notif.type}`}>
                      <span className="notification-text">{notif.message}</span>
                      <span className="notification-time">{notif.time}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile */}
        <div className="profile-wrapper">
          <button 
            className="profile-btn"
            onClick={() => setShowProfile(!showProfile)}
          >
            <div className="avatar">
              {user?.name?.charAt(0) || <User className="w-5 h-5" />}
            </div>
            <div className="profile-info">
              <span className="profile-name">{user?.name || 'Admin'}</span>
              <span className="profile-role">{user?.role || 'Administrator'}</span>
            </div>
          </button>

          {showProfile && (
            <div className="dropdown profile-dropdown">
              <a href="/settings" className="dropdown-item">
                <Settings className="w-4 h-4" />
                Settings
              </a>
              <button className="dropdown-item" onClick={onLogout}>
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default NewHeader;
