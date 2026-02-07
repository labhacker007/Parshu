import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Target,
  FileText,
  CheckCircle,
  Clock,
  Eye,
  Globe,
  RefreshCw,
  AlertTriangle,
  Zap,
  Shield,
  TrendingUp,
  Activity,
} from 'lucide-react';
import { Card, StatCard, FeatureCard } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { AnimatedCounter } from '../components/ui/AnimatedCounter';
import { cn } from '../lib/utils';

/**
 * Dashboard Component
 * Modern dashboard with glassmorphism cards and animations
 */

export function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [recentArticles, setRecentArticles] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Simulate data fetching
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Demo data
      setStats({
        totalArticles: 2847,
        newArticles: 23,
        inAnalysis: 8,
        reviewed: 156,
        highPriority: 12,
        activeHunts: 41,
        completedHunts: 238,
        failedHunts: 3,
        iocsExtracted: 771,
        ttpsMapped: 142,
      });
      
      setRecentArticles([
        { id: 1, title: 'Critical CVE-2024-1234 in Apache Struts', source: 'CISA', severity: 'critical', status: 'NEW', time: '2 min ago' },
        { id: 2, title: 'Ransomware Group Targets Healthcare Sector', source: 'BleepingComputer', severity: 'high', status: 'IN_ANALYSIS', time: '15 min ago' },
        { id: 3, title: 'New APT Group Activity Detected in APAC', source: 'Dark Reading', severity: 'high', status: 'NEED_TO_HUNT', time: '1 hour ago' },
        { id: 4, title: 'Microsoft Patch Tuesday Summary', source: 'Microsoft', severity: 'medium', status: 'REVIEWED', time: '3 hours ago' },
        { id: 5, title: 'Phishing Campaign Using QR Codes', source: 'SANS', severity: 'medium', status: 'NEW', time: '4 hours ago' },
      ]);
      
      setLastUpdated(new Date());
      setLoading(false);
    };
    
    fetchData();
  }, []);

  // Severity badge component
  const SeverityBadge = ({ severity }) => {
    const colors = {
      critical: 'bg-[hsl(var(--critical))]/10 text-[hsl(var(--critical))] border-[hsl(var(--critical))]/20',
      high: 'bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/20',
      medium: 'bg-[hsl(var(--info))]/10 text-[hsl(var(--info))] border-[hsl(var(--info))]/20',
      low: 'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] border-[hsl(var(--success))]/20',
    };
    
    return (
      <span className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border uppercase tracking-wide',
        colors[severity] || colors.low
      )}>
        {severity}
      </span>
    );
  };

  // Status badge component
  const StatusBadge = ({ status }) => {
    const colors = {
      NEW: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      IN_ANALYSIS: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      NEED_TO_HUNT: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
      HUNT_GENERATED: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
      REVIEWED: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    };
    
    const labels = {
      NEW: 'New',
      IN_ANALYSIS: 'In Analysis',
      NEED_TO_HUNT: 'Need to Hunt',
      HUNT_GENERATED: 'Hunt Generated',
      REVIEWED: 'Reviewed',
    };
    
    return (
      <span className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border',
        colors[status] || colors.NEW
      )}>
        {labels[status] || status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        {/* Skeleton loading */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 rounded-xl skeleton" />
          ))}
        </div>
        <div className="h-96 rounded-xl skeleton" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Operations Dashboard</h1>
          <p className="text-[hsl(var(--muted-foreground))]">
            Real-time threat intelligence overview
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[hsl(var(--muted-foreground))]">
            Last updated: {lastUpdated?.toLocaleTimeString()}
          </span>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Articles"
          value={stats?.totalArticles}
          icon={FileText}
          trend="+5.2%"
          trendUp={true}
          glass={true}
          delay={0}
        />
        <StatCard
          title="New Articles"
          value={stats?.newArticles}
          icon={Clock}
          trend="12 today"
          glass={true}
          delay={100}
        />
        <StatCard
          title="In Analysis"
          value={stats?.inAnalysis}
          icon={Activity}
          trend="3 pending"
          glass={true}
          delay={200}
        />
        <StatCard
          title="High Priority"
          value={stats?.highPriority}
          icon={AlertTriangle}
          trend="Action needed"
          trendUp={false}
          glass={true}
          delay={300}
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card glass={true} className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Threat Hunts</h3>
            <Target className="w-5 h-5 text-[hsl(var(--primary))]" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-[hsl(var(--primary))]">
                <AnimatedCounter value={stats?.activeHunts} />
              </div>
              <div className="text-xs text-[hsl(var(--muted-foreground))]">Active</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[hsl(var(--success))]">
                <AnimatedCounter value={stats?.completedHunts} />
              </div>
              <div className="text-xs text-[hsl(var(--muted-foreground))]">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[hsl(var(--critical))]">
                <AnimatedCounter value={stats?.failedHunts} />
              </div>
              <div className="text-xs text-[hsl(var(--muted-foreground))]">Failed</div>
            </div>
          </div>
        </Card>

        <Card glass={true} className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Intelligence Extracted</h3>
            <Shield className="w-5 h-5 text-[hsl(var(--primary))]" />
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[hsl(var(--muted-foreground))]">IOCs</span>
              <span className="font-semibold">
                <AnimatedCounter value={stats?.iocsExtracted} />
              </span>
            </div>
            <div className="w-full bg-[hsl(var(--muted))] rounded-full h-2">
              <div 
                className="bg-[hsl(var(--primary))] h-2 rounded-full transition-all duration-1000"
                style={{ width: '75%' }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[hsl(var(--muted-foreground))]">TTPs Mapped</span>
              <span className="font-semibold">
                <AnimatedCounter value={stats?.ttpsMapped} />
              </span>
            </div>
            <div className="w-full bg-[hsl(var(--muted))] rounded-full h-2">
              <div 
                className="bg-[hsl(var(--secondary))] h-2 rounded-full transition-all duration-1000"
                style={{ width: '60%' }}
              />
            </div>
          </div>
        </Card>

        <Card glass={true} className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Quick Actions</h3>
            <Zap className="w-5 h-5 text-[hsl(var(--primary))]" />
          </div>
          <div className="space-y-2">
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => navigate('/articles')}
            >
              <FileText className="w-4 h-4 mr-2" />
              Review New Articles
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => navigate('/hunts')}
            >
              <Target className="w-4 h-4 mr-2" />
              Create Hunt
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => navigate('/intelligence')}
            >
              <Shield className="w-4 h-4 mr-2" />
              View Intelligence
            </Button>
          </div>
        </Card>
      </div>

      {/* Recent Articles Table */}
      <Card>
        <div className="p-6 border-b border-[hsl(var(--border))]">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Recent Articles</h3>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/news')}
            >
              View All
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[hsl(var(--border))]">
                <th className="text-left py-3 px-6 text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                  Title
                </th>
                <th className="text-left py-3 px-6 text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                  Source
                </th>
                <th className="text-left py-3 px-6 text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                  Severity
                </th>
                <th className="text-left py-3 px-6 text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left py-3 px-6 text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                  Time
                </th>
              </tr>
            </thead>
            <tbody>
              {recentArticles.map((article) => (
                <tr 
                  key={article.id}
                  className="border-b border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]/50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/articles/${article.id}`)}
                >
                  <td className="py-3 px-6">
                    <span className="font-medium">{article.title}</span>
                  </td>
                  <td className="py-3 px-6 text-[hsl(var(--muted-foreground))]">
                    {article.source}
                  </td>
                  <td className="py-3 px-6">
                    <SeverityBadge severity={article.severity} />
                  </td>
                  <td className="py-3 px-6">
                    <StatusBadge status={article.status} />
                  </td>
                  <td className="py-3 px-6 text-[hsl(var(--muted-foreground))] text-sm">
                    {article.time}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export default Dashboard;
