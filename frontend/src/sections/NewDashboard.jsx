import React, { useState, useEffect } from 'react';
import { 
  Target, 
  FileText, 
  Globe, 
  Zap,
  TrendingUp,
  Activity,
  Shield,
  Bug,
  Scan,
  LayoutDashboard,
  Eye,
  AlertTriangle,
  CheckCircle,
  RefreshCw
} from 'lucide-react';
import { articlesAPI, huntsAPI, sourcesAPI, intelligenceAPI } from '../api/client';
import { useTheme } from '../context/ThemeContext';

// Stat Card Component - Uses Theme Colors
function StatCard({ label, value, icon: Icon, trend, trendUp }) {
  const { currentTheme } = useTheme();
  const colors = currentTheme?.colors || {};

  return (
    <div 
      className="rounded-xl p-5 transition-all duration-300"
      style={{ 
        background: colors.bgCard || '#1A1D24',
        border: `1px solid ${colors.borderSubtle || 'rgba(113, 113, 122, 0.1)'}`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = colors.primary || '#3B82F6';
        e.currentTarget.style.boxShadow = `0 0 20px ${colors.primaryGlow || 'rgba(59, 130, 246, 0.15)'}`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = colors.borderSubtle || 'rgba(113, 113, 122, 0.1)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5" style={{ color: colors.primary || '#3B82F6' }} />
          <span style={{ 
            color: colors.textMuted || '#71717A', 
            fontSize: '12px', 
            fontWeight: 500, 
            textTransform: 'uppercase', 
            letterSpacing: '0.5px' 
          }}>
            {label}
          </span>
        </div>
        {trend && (
          <span style={{ 
            color: trendUp ? colors.success || '#22C55E' : colors.critical || '#EF4444',
            fontSize: '12px',
            fontWeight: 500
          }}>
            {trendUp ? '↑' : '↓'} {trend}
          </span>
        )}
      </div>
      <div style={{ color: colors.textPrimary || '#FFFFFF', fontSize: '32px', fontWeight: 700 }}>
        {value !== undefined && value !== null ? value.toLocaleString() : '0'}
      </div>
    </div>
  );
}

// Panel Component - Uses Theme Colors
function Panel({ title, icon: Icon, children, action }) {
  const { currentTheme } = useTheme();
  const colors = currentTheme?.colors || {};

  return (
    <div 
      className="rounded-xl overflow-hidden h-full"
      style={{ 
        background: colors.bgCard || '#1A1D24', 
        border: `1px solid ${colors.borderSubtle || 'rgba(113, 113, 122, 0.1)'}` 
      }}
    >
      <div 
        className="px-5 py-4 flex items-center justify-between"
        style={{ 
          background: colors.bgElevated || '#252830', 
          borderBottom: `1px solid ${colors.borderSubtle || 'rgba(113, 113, 122, 0.1)'}` 
        }}
      >
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5" style={{ color: colors.primary || '#3B82F6' }} />
          <span style={{ color: colors.textPrimary || '#FFFFFF', fontWeight: 600 }}>{title}</span>
        </div>
        {action}
      </div>
      <div className="p-5" style={{ color: colors.textSecondary || '#A1A1AA' }}>
        {children}
      </div>
    </div>
  );
}

// Status Badge - Uses Theme Colors
function StatusBadge({ status, children }) {
  const { currentTheme } = useTheme();
  const colors = currentTheme?.colors || {};
  
  const styles = {
    success: { bg: colors.successBg || 'rgba(34, 197, 94, 0.15)', color: colors.success || '#22C55E' },
    warning: { bg: colors.highBg || 'rgba(249, 115, 22, 0.15)', color: colors.high || '#F97316' },
    danger: { bg: colors.criticalBg || 'rgba(239, 68, 68, 0.15)', color: colors.critical || '#EF4444' },
    info: { bg: colors.infoBg || 'rgba(59, 130, 246, 0.15)', color: colors.info || '#3B82F6' },
    default: { bg: colors.bgElevated || '#252830', color: colors.textMuted || '#71717A' }
  };
  
  const style = styles[status] || styles.default;
  
  return (
    <span 
      className="px-2 py-1 rounded-md text-xs font-medium"
      style={{ background: style.bg, color: style.color }}
    >
      {children}
    </span>
  );
}

// Quick Action Button - Uses Theme Colors
function QuickAction({ icon: Icon, label, onClick, primary = false }) {
  const { currentTheme } = useTheme();
  const colors = currentTheme?.colors || {};
  
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 w-full text-left"
      style={{
        background: primary ? colors.primary || '#3B82F6' : colors.bgElevated || '#252830',
        color: primary ? '#FFFFFF' : colors.textPrimary || '#FFFFFF',
        border: `1px solid ${primary ? 'transparent' : colors.borderSubtle || 'rgba(113, 113, 122, 0.1)'}`
      }}
      onMouseEnter={(e) => {
        if (!primary) {
          e.currentTarget.style.borderColor = colors.primary || '#3B82F6';
          e.currentTarget.style.background = colors.bgCard || '#1A1D24';
        }
      }}
      onMouseLeave={(e) => {
        if (!primary) {
          e.currentTarget.style.borderColor = colors.borderSubtle || 'rgba(113, 113, 122, 0.1)';
          e.currentTarget.style.background = colors.bgElevated || '#252830';
        }
      }}
    >
      <Icon className="w-5 h-5" style={{ color: primary ? '#FFFFFF' : colors.primary || '#3B82F6' }} />
      <span className="font-medium">{label}</span>
    </button>
  );
}

// Activity Item - Uses Theme Colors
function ActivityItem({ icon: Icon, title, description, time, type = 'default' }) {
  const { currentTheme } = useTheme();
  const colors = currentTheme?.colors || {};
  
  const iconColors = {
    success: colors.success || '#22C55E',
    warning: colors.high || '#F97316',
    danger: colors.critical || '#EF4444',
    info: colors.info || '#3B82F6',
    default: colors.primary || '#3B82F6'
  };

  return (
    <div 
      className="flex items-start gap-3 py-3"
      style={{ borderBottom: `1px solid ${colors.borderSubtle || 'rgba(113, 113, 122, 0.1)'}` }}
    >
      <div 
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: colors.bgElevated || '#252830' }}
      >
        <Icon className="w-4 h-4" style={{ color: iconColors[type] || colors.primary }} />
      </div>
      <div className="flex-1 min-w-0">
        <p style={{ color: colors.textPrimary || '#FFFFFF', fontWeight: 500 }} className="truncate">
          {title}
        </p>
        <p style={{ color: colors.textMuted || '#71717A', fontSize: '13px' }} className="truncate">
          {description}
        </p>
        <p style={{ color: colors.textDisabled || '#52525B', fontSize: '11px', marginTop: '2px' }}>
          {time}
        </p>
      </div>
    </div>
  );
}

export function NewDashboard() {
  const [stats, setStats] = useState({
    articles: 0,
    hunts: 0,
    sources: 0,
    iocs: 0
  });
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState([]);
  const { currentTheme } = useTheme();
  const colors = currentTheme?.colors || {};

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch sources count
      const sourcesRes = await sourcesAPI.list();
      const sourcesCount = sourcesRes.data?.length || 0;
      
      // Fetch articles (with a large page size to get count)
      const articlesRes = await articlesAPI.getTriageQueue(1, 1);
      const articlesCount = articlesRes.data?.total || 0;
      
      // Fetch hunts count
      const huntsRes = await huntsAPI.list(1, 1);
      const huntsCount = huntsRes.data?.total || 0;
      
      // Fetch intelligence/IOCs
      const intelRes = await intelligenceAPI.getAll(1, 1);
      const iocsCount = intelRes.data?.total || 0;

      setStats({
        articles: articlesCount,
        hunts: huntsCount,
        sources: sourcesCount,
        iocs: iocsCount
      });

      // Mock recent activity
      setRecentActivity([
        { icon: CheckCircle, title: 'Hunt completed successfully', description: 'USB Threat Hunt executed on XSIAM', time: '5 minutes ago', type: 'success' },
        { icon: AlertTriangle, title: 'High priority article detected', description: 'Critical vulnerability in Microsoft Exchange', time: '12 minutes ago', type: 'warning' },
        { icon: Bug, title: 'New IOC extracted', description: 'Malware hash identified from article analysis', time: '23 minutes ago', type: 'info' },
        { icon: RefreshCw, title: 'Feed sources updated', description: 'All 20 sources refreshed successfully', time: '1 hour ago', type: 'success' },
        { icon: Eye, title: 'Watchlist match', description: 'Keyword "ransomware" found in 3 articles', time: '2 hours ago', type: 'info' },
      ]);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 style={{ color: colors.textPrimary || '#FFFFFF', fontSize: '24px', fontWeight: 700 }}>
          Operations Overview
        </h1>
        <p style={{ color: colors.textMuted || '#71717A', marginTop: '4px' }}>
          Real-time threat intelligence and hunt operations
        </p>
      </div>

      {/* Alert Banner */}
      <div 
        className="rounded-xl p-4 mb-6 flex items-center justify-between"
        style={{ 
          background: colors.criticalBg || 'rgba(239, 68, 68, 0.15)', 
          border: `1px solid ${colors.critical || '#EF4444'}` 
        }}
      >
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5" style={{ color: colors.critical || '#EF4444' }} />
          <span style={{ color: colors.textPrimary || '#FFFFFF' }}>
            <strong>3 high-priority articles</strong> require immediate attention
          </span>
        </div>
        <button 
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ 
            background: colors.critical || '#EF4444', 
            color: '#FFFFFF' 
          }}
          onClick={() => window.location.href = '/articles?filter=high-priority'}
        >
          Review Now
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard 
          label="Total Articles" 
          value={stats.articles} 
          icon={FileText}
          trend="12%"
          trendUp={true}
        />
        <StatCard 
          label="Active Hunts" 
          value={stats.hunts} 
          icon={Target}
          trend="5%"
          trendUp={true}
        />
        <StatCard 
          label="Feed Sources" 
          value={stats.sources} 
          icon={Globe}
        />
        <StatCard 
          label="IOCs Extracted" 
          value={stats.iocs} 
          icon={Bug}
          trend="8%"
          trendUp={true}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="lg:col-span-1">
          <Panel title="Quick Actions" icon={Zap}>
            <div className="space-y-3">
              <QuickAction 
                icon={Target} 
                label="Create New Hunt" 
                primary
                onClick={() => window.location.href = '/hunts'}
              />
              <QuickAction 
                icon={Scan} 
                label="Run Intelligence Scan"
                onClick={() => window.location.href = '/intelligence'}
              />
              <QuickAction 
                icon={RefreshCw} 
                label="Refresh All Feeds"
                onClick={() => fetchDashboardData()}
              />
              <QuickAction 
                icon={FileText} 
                label="Generate Report"
                onClick={() => window.location.href = '/reports'}
              />
            </div>
          </Panel>
        </div>

        {/* System Health */}
        <div className="lg:col-span-1">
          <Panel title="System Health" icon={Activity}>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span style={{ color: colors.textSecondary || '#A1A1AA' }}>Feed Sources</span>
                  <StatusBadge status="success">Healthy</StatusBadge>
                </div>
                <div 
                  className="h-2 rounded-full overflow-hidden"
                  style={{ background: colors.bgElevated || '#252830' }}
                >
                  <div 
                    className="h-full rounded-full transition-all duration-500"
                    style={{ 
                      width: '95%', 
                      background: colors.success || '#22C55E' 
                    }}
                  />
                </div>
                <p style={{ color: colors.textMuted || '#71717A', fontSize: '12px', marginTop: '4px' }}>
                  {stats.sources}/20 sources active
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span style={{ color: colors.textSecondary || '#A1A1AA' }}>API Connectors</span>
                  <StatusBadge status="success">Online</StatusBadge>
                </div>
                <div 
                  className="h-2 rounded-full overflow-hidden"
                  style={{ background: colors.bgElevated || '#252830' }}
                >
                  <div 
                    className="h-full rounded-full transition-all duration-500"
                    style={{ 
                      width: '100%', 
                      background: colors.success || '#22C55E' 
                    }}
                  />
                </div>
                <p style={{ color: colors.textMuted || '#71717A', fontSize: '12px', marginTop: '4px' }}>
                  All connectors responding
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span style={{ color: colors.textSecondary || '#A1A1AA' }}>Storage</span>
                  <StatusBadge status="warning">75%</StatusBadge>
                </div>
                <div 
                  className="h-2 rounded-full overflow-hidden"
                  style={{ background: colors.bgElevated || '#252830' }}
                >
                  <div 
                    className="h-full rounded-full transition-all duration-500"
                    style={{ 
                      width: '75%', 
                      background: colors.high || '#F97316' 
                    }}
                  />
                </div>
                <p style={{ color: colors.textMuted || '#71717A', fontSize: '12px', marginTop: '4px' }}>
                  75 GB of 100 GB used
                </p>
              </div>
            </div>
          </Panel>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-1">
          <Panel 
            title="Recent Activity" 
            icon={LayoutDashboard}
            action={
              <button 
                className="text-sm transition-colors"
                style={{ color: colors.primary || '#3B82F6' }}
                onClick={() => window.location.href = '/audit'}
              >
                View All
              </button>
            }
          >
            <div className="space-y-0">
              {recentActivity.map((activity, index) => (
                <ActivityItem key={index} {...activity} />
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

export default NewDashboard;
