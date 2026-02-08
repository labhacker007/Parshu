/**
 * ThemePreview Component
 * Live preview of components in current theme
 */

import React from 'react';
import { useTheme } from './ThemeContext';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  Activity,
  Terminal,
  TrendingUp,
  Users
} from 'lucide-react';

export function ThemePreview() {
  const { theme, currentTheme } = useTheme();

  return (
    <div className="theme-preview-dashboard">
      {/* Mock Dashboard Preview */}
      <div className="preview-grid">
        {/* KPI Cards */}
        <div className="preview-kpi-card">
          <div className="kpi-icon" style={{ color: theme.color }}>
            <Shield className="w-6 h-6" />
          </div>
          <div className="kpi-content">
            <span className="kpi-value">1,247</span>
            <span className="kpi-label">Articles Ingested</span>
          </div>
        </div>

        <div className="preview-kpi-card">
          <div className="kpi-icon" style={{ color: 'var(--accent-danger)' }}>
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="kpi-content">
            <span className="kpi-value">89</span>
            <span className="kpi-label">Active Threats</span>
          </div>
        </div>

        <div className="preview-kpi-card">
          <div className="kpi-icon" style={{ color: 'var(--accent-success)' }}>
            <CheckCircle className="w-6 h-6" />
          </div>
          <div className="kpi-content">
            <span className="kpi-value">23</span>
            <span className="kpi-label">Hunts Completed</span>
          </div>
        </div>

        <div className="preview-kpi-card">
          <div className="kpi-icon" style={{ color: 'var(--accent-info)' }}>
            <Activity className="w-6 h-6" />
          </div>
          <div className="kpi-content">
            <span className="kpi-value">98.2%</span>
            <span className="kpi-label">System Health</span>
          </div>
        </div>
      </div>

      {/* Activity Feed Preview */}
      <div className="preview-activity">
        <h5>Recent Activity</h5>
        <div className="activity-list">
          <div className="activity-item">
            <div className="activity-dot" style={{ background: 'var(--accent-success)' }} />
            <span className="activity-text">New article: CVE-2024-XXXX</span>
            <span className="activity-time">2m ago</span>
          </div>
          <div className="activity-item">
            <div className="activity-dot" style={{ background: 'var(--accent-primary)' }} />
            <span className="activity-text">Hunt #234 executed on Splunk</span>
            <span className="activity-time">5m ago</span>
          </div>
          <div className="activity-item">
            <div className="activity-dot" style={{ background: 'var(--accent-warning)' }} />
            <span className="activity-text">IOC extracted: 5 items</span>
            <span className="activity-time">12m ago</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="preview-actions">
        <h5>Quick Actions</h5>
        <div className="action-buttons">
          <button className="btn btn-primary">
            <Terminal className="w-4 h-4" />
            Run Hunt
          </button>
          <button className="btn btn-secondary">
            <TrendingUp className="w-4 h-4" />
            View Reports
          </button>
          <button className="btn btn-secondary">
            <Users className="w-4 h-4" />
            Manage Team
          </button>
        </div>
      </div>

      {/* Theme-specific note */}
      <div className="preview-note" style={{ borderColor: theme.color }}>
        <strong>Current Theme:</strong> {theme.name}
        <br />
        <span className="text-secondary">{theme.description}</span>
      </div>
    </div>
  );
}

export default ThemePreview;
