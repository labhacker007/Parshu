/**
 * New Dashboard - Modern 3-Theme Support
 * Works with Hacker Mode, Dark Mode, and Light Mode
 */

import React, { useState, useEffect } from 'react';
import { useTheme } from '../../styles/themes/ThemeContext';
import {
  Shield,
  FileText,
  Target,
  TrendingUp,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Globe,
  Zap,
  Users
} from 'lucide-react';

// Mock data - replace with real API calls
const mockStats = {
  articlesIngested: 1247,
  activeThreats: 89,
  huntsCompleted: 23,
  systemHealth: 98.2,
  iocsExtracted: 456,
  reportsGenerated: 12
};

const mockActivity = [
  { type: 'success', message: 'New article ingested: CVE-2024-XXXX', time: '2m ago' },
  { type: 'info', message: 'Hunt #234 executed successfully on Splunk', time: '5m ago' },
  { type: 'warning', message: 'IOC extraction completed: 5 items', time: '12m ago' },
  { type: 'success', message: 'Connector synced: Palo Alto XSIAM', time: '18m ago' },
  { type: 'danger', message: 'High priority alert: APT29 activity detected', time: '25m ago' },
];

export function Dashboard() {
  const { currentTheme, theme } = useTheme();
  const [stats, setStats] = useState(mockStats);
  const [activity, setActivity] = useState(mockActivity);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Format time based on theme (Hacker mode shows terminal-style)
  const formatTime = () => {
    if (currentTheme === 'hacker') {
      return currentTime.toISOString().replace('T', ' ').slice(0, 19);
    }
    return currentTime.toLocaleTimeString();
  };

  const StatCard = ({ icon: Icon, label, value, trend, color }) => (
    <div className="stat-card">
      <div className="stat-icon" style={{ color: `var(${color})` }}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="stat-content">
        <span className="stat-value">{value}</span>
        <span className="stat-label">{label}</span>
        {trend && (
          <span className={`stat-trend ${trend > 0 ? 'up' : 'down'}`}>
            {trend > 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className={`dashboard-container theme-${currentTheme}`}>
      {/* Header Section */}
      <div className="dashboard-header">
        <div className="welcome-section">
          <h1>
            {currentTheme === 'hacker' ? '> ' : ''}
            Dashboard
            {currentTheme === 'hacker' ? '_' : ''}
          </h1>
          <p className="timestamp">
            {currentTheme === 'hacker' ? 'SYSTEM_TIME: ' : ''}
            {formatTime()}
          </p>
        </div>
        
        <div className="quick-actions">
          <button className="btn btn-primary">
            <Zap className="w-4 h-4" />
            Run Hunt
          </button>
          <button className="btn btn-secondary">
            <Globe className="w-4 h-4" />
            Refresh Intel
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <StatCard
          icon={FileText}
          label="Articles Ingested"
          value={stats.articlesIngested}
          trend={12}
          color="--accent-primary"
        />
        <StatCard
          icon={AlertTriangle}
          label="Active Threats"
          value={stats.activeThreats}
          trend={-5}
          color="--accent-danger"
        />
        <StatCard
          icon={Target}
          label="Hunts Completed"
          value={stats.huntsCompleted}
          trend={8}
          color="--accent-success"
        />
        <StatCard
          icon={Activity}
          label="System Health"
          value={`${stats.systemHealth}%`}
          color="--accent-info"
        />
        <StatCard
          icon={Shield}
          label="IOCs Extracted"
          value={stats.iocsExtracted}
          trend={15}
          color="--accent-secondary"
        />
        <StatCard
          icon={TrendingUp}
          label="Reports Generated"
          value={stats.reportsGenerated}
          color="--accent-warning"
        />
      </div>

      {/* Main Content Grid */}
      <div className="dashboard-grid">
        {/* Activity Feed */}
        <div className="dashboard-card activity-card">
          <div className="card-header">
            <h3>
              <Activity className="w-5 h-5" />
              Live Activity
              <span className="live-indicator">
                <span className="pulse" />
                LIVE
              </span>
            </h3>
          </div>
          <div className="activity-list">
            {activity.map((item, idx) => (
              <div key={idx} className={`activity-item ${item.type}`}>
                <div className={`activity-dot ${item.type}`} />
                <span className="activity-message">{item.message}</span>
                <span className="activity-time">{item.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* System Status */}
        <div className="dashboard-card status-card">
          <div className="card-header">
            <h3>
              <CheckCircle className="w-5 h-5" />
              System Status
            </h3>
          </div>
          <div className="status-list">
            <div className="status-row">
              <span className="status-name">Ingestion Engine</span>
              <span className="status-badge online">Active</span>
            </div>
            <div className="status-row">
              <span className="status-name">AI/ML Pipeline</span>
              <span className="status-badge online">Running</span>
            </div>
            <div className="status-row">
              <span className="status-name">Splunk Connector</span>
              <span className="status-badge online">Connected</span>
            </div>
            <div className="status-row">
              <span className="status-name">Palo Alto XSIAM</span>
              <span className="status-badge warning">Syncing</span>
            </div>
            <div className="status-row">
              <span className="status-name">Database</span>
              <span className="status-badge online">Healthy</span>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="dashboard-card quick-stats-card">
          <div className="card-header">
            <h3>
              <Clock className="w-5 h-5" />
              Queue Status
            </h3>
          </div>
          <div className="queue-stats">
            <div className="queue-item">
              <span className="queue-label">New Articles</span>
              <span className="queue-value new">23</span>
            </div>
            <div className="queue-item">
              <span className="queue-label">In Analysis</span>
              <span className="queue-value analyzing">12</span>
            </div>
            <div className="queue-item">
              <span className="queue-label">Ready for Hunt</span>
              <span className="queue-value ready">8</span>
            </div>
            <div className="queue-item">
              <span className="queue-label">Completed Today</span>
              <span className="queue-value completed">45</span>
            </div>
          </div>
        </div>

        {/* Team Activity */}
        <div className="dashboard-card team-card">
          <div className="card-header">
            <h3>
              <Users className="w-5 h-5" />
              Team Activity
            </h3>
          </div>
          <div className="team-list">
            <div className="team-member">
              <div className="member-avatar">JD</div>
              <div className="member-info">
                <span className="member-name">John Doe</span>
                <span className="member-status">Analyzing CVE-2024...</span>
              </div>
              <span className="member-time">2m ago</span>
            </div>
            <div className="team-member">
              <div className="member-avatar">AS</div>
              <div className="member-info">
                <span className="member-name">Alice Smith</span>
                <span className="member-status">Running hunt #234</span>
              </div>
              <span className="member-time">5m ago</span>
            </div>
            <div className="team-member">
              <div className="member-avatar">MK</div>
              <div className="member-info">
                <span className="member-name">Mike King</span>
                <span className="member-status">Reviewing report</span>
              </div>
              <span className="member-time">12m ago</span>
            </div>
          </div>
        </div>
      </div>

      {/* Theme Indicator Footer */}
      <div className="dashboard-footer">
        <div className="theme-indicator">
          <span>Current Theme:</span>
          <span className="theme-name" style={{ color: theme.color }}>
            {theme.name}
          </span>
          <span className="theme-description">{theme.description}</span>
        </div>
        <div className="system-info">
          <span>Parshu TI Platform v2.4.1</span>
          <span className="separator">|</span>
          <span className="uptime">Uptime: 99.98%</span>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
