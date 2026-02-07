import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Row, Col, Statistic, Table, Select, DatePicker, Button, Space, Tag,
  Progress, Typography, Spin, Alert, Tabs, Divider, Tooltip, Empty,
  Modal, Form, Input, Checkbox, message, Dropdown, Badge, InputNumber
} from 'antd';
import {
  BarChartOutlined, LineChartOutlined, PieChartOutlined, DashboardOutlined,
  ThunderboltOutlined, FileTextOutlined, BugOutlined, ClockCircleOutlined,
  RiseOutlined, FallOutlined, CheckCircleOutlined, CloseCircleOutlined,
  DownloadOutlined, FilterOutlined, CalendarOutlined, TeamOutlined,
  RobotOutlined, TrophyOutlined, AimOutlined, FieldTimeOutlined,
  SafetyOutlined, AlertOutlined, SyncOutlined, PrinterOutlined,
  ExportOutlined, SettingOutlined, StarOutlined, EditOutlined,
  InfoCircleOutlined, DollarOutlined
} from '@ant-design/icons';
import { useTimezone } from '../context/TimezoneContext';
import { analyticsAPI, adminAPI } from '../api/client';
import { useAuthStore } from '../store';
import { usePermissions } from '../hooks/usePermissions';
import './AnalyticsDashboard.css';

// Editable roles (can edit metrics settings)
const EDITABLE_ROLES = ['ADMIN', 'MANAGER'];

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

// Report types available for generation
const REPORT_TYPES = [
  {
    id: 'executive_summary',
    name: 'Executive Summary',
    description: 'High-level overview for C-suite and CISO',
    icon: <TrophyOutlined />,
    metrics: ['total_articles', 'critical_threats', 'hunts_completed', 'mean_time_to_detect', 'automation_savings'],
    audience: ['EXECUTIVE', 'MANAGER', 'ADMIN'],
    category: 'executive'
  },
  {
    id: 'threat_intel_report',
    name: 'Threat Intel Report',
    description: 'TI team productivity, IOCs, and intelligence quality',
    icon: <SafetyOutlined />,
    metrics: ['articles_processed', 'iocs_extracted', 'ttps_mapped', 'escalation_rate', 'coverage_score'],
    audience: ['MANAGER', 'TI', 'ADMIN'],
    category: 'ti'
  },
  {
    id: 'threat_hunt_report',
    name: 'Threat Hunt Report',
    description: 'TH team hunt execution and success metrics',
    icon: <ThunderboltOutlined />,
    metrics: ['hunts_total', 'hunts_completed', 'hunts_failed', 'hunt_success_rate', 'hunts_by_platform'],
    audience: ['MANAGER', 'TH', 'ADMIN'],
    category: 'th'
  },
  {
    id: 'mitre_attack_mapping',
    name: 'MITRE ATT&CK Mapping',
    description: 'TTPs mapped to MITRE framework with heatmap visualization',
    icon: <AimOutlined />,
    metrics: ['ttps_mapped', 'tactics_coverage', 'techniques_by_tactic'],
    audience: ['MANAGER', 'TI', 'TH', 'ADMIN'],
    category: 'mitre',
    hasHeatmap: true
  },
  {
    id: 'custom_report',
    name: 'Custom Report',
    description: 'Build your own report with selected metrics, statuses, and platforms',
    icon: <SettingOutlined />,
    metrics: [],
    audience: ['MANAGER', 'TI', 'TH', 'ADMIN'],
    category: 'custom'
  }
];

// Output format options
const OUTPUT_FORMATS = [
  { value: 'pdf', label: 'PDF Document', icon: <DownloadOutlined /> },
  { value: 'csv', label: 'CSV Spreadsheet', icon: <ExportOutlined /> },
  { value: 'json', label: 'JSON Data', icon: <SettingOutlined /> },
];

// MITRE report format options
const MITRE_FORMATS = [
  { value: 'heatmap', label: 'Heatmap Visualization', description: 'Visual grid showing tactic/technique coverage' },
  { value: 'tabular', label: 'Tabular Report', description: 'Detailed list of techniques with article sources' },
];

// Article filter options for MITRE reports
const ARTICLE_FILTER_OPTIONS = [
  { value: 'reviewed', label: 'Reviewed Articles', description: 'Articles that have been fully reviewed' },
  { value: 'hunt_completed', label: 'Hunt Completed', description: 'Articles with completed threat hunts' },
  { value: 'all', label: 'All Articles', description: 'All articles in the time period' },
];

// Hunt status options for multi-select
const HUNT_STATUS_OPTIONS = [
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'RUNNING', label: 'Running' },
  { value: 'PENDING', label: 'Pending' }
];

// Platform options for multi-select
const PLATFORM_OPTIONS = [
  { value: 'defender', label: 'Microsoft Defender' },
  { value: 'splunk', label: 'Splunk' },
  { value: 'xsiam', label: 'Palo Alto XSIAM' },
  { value: 'wiz', label: 'Wiz' },
  { value: 'sentinel', label: 'Microsoft Sentinel' },
  { value: 'crowdstrike', label: 'CrowdStrike' }
];

// Available metrics for custom reports
const AVAILABLE_METRICS = {
  // Article/Intel Metrics
  articles: {
    label: 'Articles & Intelligence',
    metrics: [
      { id: 'total_articles', name: 'Total Articles Ingested', type: 'count' },
      { id: 'articles_processed', name: 'Articles Processed', type: 'count' },
      { id: 'articles_by_status', name: 'Articles by Status', type: 'breakdown' },
      { id: 'articles_by_source', name: 'Articles by Source', type: 'breakdown' },
      { id: 'high_priority_articles', name: 'High Priority Articles', type: 'count' },
      { id: 'critical_threats', name: 'Critical Threats Identified', type: 'count' },
      { id: 'iocs_extracted', name: 'IOCs Extracted', type: 'count' },
      { id: 'ttps_mapped', name: 'TTPs Mapped', type: 'count' },
      { id: 'unique_ioc_types', name: 'Unique IOC Types', type: 'breakdown' },
    ]
  },
  // Hunt Metrics
  hunts: {
    label: 'Threat Hunts',
    metrics: [
      { id: 'hunts_total', name: 'Total Hunts Created', type: 'count' },
      { id: 'hunts_executed', name: 'Hunts Executed', type: 'count' },
      { id: 'hunts_completed', name: 'Hunts Completed Successfully', type: 'count' },
      { id: 'hunts_failed', name: 'Hunts Failed', type: 'count' },
      { id: 'hunts_by_platform', name: 'Hunts by Platform', type: 'breakdown' },
      { id: 'hunts_by_status', name: 'Hunts by Status', type: 'breakdown' },
      { id: 'hunt_success_rate', name: 'Hunt Success Rate', type: 'percentage' },
      { id: 'mean_hunt_time', name: 'Mean Hunt Duration', type: 'duration' },
      { id: 'articles_to_hunts_ratio', name: 'Articles to Hunts Ratio', type: 'ratio' },
    ]
  },
  // Time Metrics (SLA)
  time: {
    label: 'Time & SLA Metrics',
    metrics: [
      { id: 'mttd', name: 'Mean Time to Detect (MTTD)', type: 'duration' },
      { id: 'mttr', name: 'Mean Time to Respond (MTTR)', type: 'duration' },
      { id: 'mean_triage_time', name: 'Mean Triage Time', type: 'duration' },
      { id: 'mean_escalation_time', name: 'Mean Escalation Time', type: 'duration' },
      { id: 'sla_compliance_rate', name: 'SLA Compliance Rate', type: 'percentage' },
      { id: 'sla_breaches', name: 'SLA Breaches', type: 'count' },
      { id: 'processing_backlog', name: 'Processing Backlog', type: 'count' },
    ]
  },
  // Efficiency & ROI
  efficiency: {
    label: 'Efficiency & ROI',
    metrics: [
      { id: 'automation_hours_saved', name: 'Automation Hours Saved', type: 'duration' },
      { id: 'manual_vs_auto_ratio', name: 'Manual vs Automated Ratio', type: 'ratio' },
      { id: 'genai_extractions', name: 'GenAI Extractions', type: 'count' },
      { id: 'genai_summaries', name: 'GenAI Summaries Generated', type: 'count' },
      { id: 'cost_per_article', name: 'Cost per Article Processed', type: 'currency' },
      { id: 'efficiency_score', name: 'Overall Efficiency Score', type: 'score' },
      { id: 'team_productivity', name: 'Team Productivity Index', type: 'score' },
    ]
  },
  // Team Performance
  team: {
    label: 'Team Performance',
    metrics: [
      { id: 'articles_per_analyst', name: 'Articles per Analyst', type: 'ratio' },
      { id: 'hunts_per_hunter', name: 'Hunts per Hunter', type: 'ratio' },
      { id: 'escalation_rate', name: 'Escalation Rate', type: 'percentage' },
      { id: 'quality_score', name: 'Quality Score', type: 'score' },
      { id: 'coverage_score', name: 'Coverage Score', type: 'score' },
    ]
  }
};

function AnalyticsDashboard() {
  const { user } = useAuthStore();
  const { formatDateTime, getRelativeTime } = useTimezone();
  const { hasPageAccess } = usePermissions();
  
  // Check if user can access Intelligence page
  const canAccessIntelligence = hasPageAccess('intelligence');
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState(null);
  const [dateRange, setDateRange] = useState([null, null]);
  const [selectedPeriod, setSelectedPeriod] = useState('7d'); // Default: Last 7 days
  const [activeTab, setActiveTab] = useState('overview');
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [selectedReportType, setSelectedReportType] = useState(null);
  const [selectedMetrics, setSelectedMetrics] = useState([]);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [huntFilter, setHuntFilter] = useState({ statuses: [], platforms: [] });
  const [selectedPlatforms, setSelectedPlatforms] = useState([]); // Platform filter buttons
  
  // Enhanced report options
  const [outputFormat, setOutputFormat] = useState('pdf');
  const [mitreFormat, setMitreFormat] = useState('heatmap');
  const [articlesFilter, setArticlesFilter] = useState('reviewed');
  const [includeHunts, setIncludeHunts] = useState(true);
  
  // Edit settings state
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [settingsType, setSettingsType] = useState(null); // 'team', 'sla', 'roi'
  const [settingsValues, setSettingsValues] = useState(() => {
    // Load from localStorage or use defaults
    const saved = localStorage.getItem('huntsphere-analytics-settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Migrate old settings structure - combine roi and cost
      if (parsed.cost && !parsed.roi?.cost_per_article) {
        parsed.roi = {
          ...parsed.roi,
          cost_per_article: parsed.cost.cost_per_article,
          time_per_article_minutes: parsed.roi?.time_per_article_minutes || 30
        };
        delete parsed.cost;
        localStorage.setItem('huntsphere-analytics-settings', JSON.stringify(parsed));
      }
      // Ensure time_per_article_minutes exists
      if (parsed.roi && !parsed.roi.time_per_article_minutes) {
        parsed.roi.time_per_article_minutes = 30;
      }
      return parsed;
    }
    return {
      team: { analysts_count: 5, hunters_count: 3 },
      sla: { mttd_target_hours: 4, mttr_target_hours: 8, triage_target_minutes: 15, escalation_target_hours: 2 },
      roi: { 
        hourly_rate: 75, 
        time_per_article_minutes: 30
      }
    };
  });
  
  // Check if current user can edit settings
  const canEditSettings = user && EDITABLE_ROLES.includes(user.role);

  // Fetch analytics data
  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      // Calculate date range based on selected period
      let startDate, endDate;
      const now = new Date();
      endDate = now.toISOString();
      
      switch (selectedPeriod) {
        case '24h':
          startDate = new Date(now - 24 * 60 * 60 * 1000).toISOString();
          break;
        case '7d':
          startDate = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
          break;
        case '30d':
          startDate = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
          break;
        case '90d':
          startDate = new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString();
          break;
        case '1y':
          startDate = new Date(now - 365 * 24 * 60 * 60 * 1000).toISOString();
          break;
        case 'custom':
          if (dateRange[0] && dateRange[1]) {
            startDate = dateRange[0].toISOString();
            endDate = dateRange[1].toISOString();
          }
          break;
        default:
          startDate = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(); // Default: 7 days
      }

      // Fetch comprehensive analytics
      const response = await analyticsAPI.getDashboard(startDate, endDate);
      setMetrics(response.data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      // Set mock data for demonstration
      setMetrics(getMockMetrics());
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod, dateRange]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Mock data for when API is not available
  const getMockMetrics = () => ({
    summary: {
      total_articles: 1247,
      articles_processed: 1089,
      articles_pending: 158,
      high_priority: 47,
      critical_threats: 47,  // Same as high_priority for consistency
      watchlist_matches: 47,
      active_sources: 12,
      hunts_on_high_priority: 23,
      iocs_extracted: 3842,
      ttps_mapped: 156,
      hunts_total: 89,
      hunts_completed: 72,
      hunts_failed: 8,
      hunts_pending: 9,
    },
    sla: {
      mttd_hours: 2.4,
      mttr_hours: 4.8,
      mean_triage_minutes: 18,
      mean_escalation_hours: 1.2,
      sla_compliance_rate: 94.2,
      sla_breaches: 7,
    },
    efficiency: {
      automation_hours_saved: 312,
      genai_extractions: 2847,
      genai_summaries: 1089,
      technical_summaries: 845,
      manual_articles: 342,
      auto_articles: 905,
      pending_processing: 158,
      cost_per_article: 12.50,
      efficiency_score: 87,
      automation_breakdown: {
        genai: {
          executive_summaries: 1089,
          technical_summaries: 845,
          ioc_extractions: 3842,
          ttp_extractions: 156,
          hunt_queries_generated: 34,
        },
        platform: {
          articles_ingested: 1247,
          active_sources: 12,
          watchlist_matches: 47,
          auto_processed: 905,
        },
        hunting: {
          total_hunts: 89,
          auto_hunts: 34,
          manual_hunts: 55,
          hunts_on_high_priority: 23,
          hunts_completed: 72,
        },
        manual: {
          manual_reviews: 342,
          manual_hunts: 55,
          pending_review: 158,
        }
      }
    },
    trends: {
      articles_by_day: [],
      hunts_by_week: [],
      iocs_by_type: { 'IPv4': 1240, 'Domain': 892, 'Hash-SHA256': 621, 'URL': 489, 'Email': 156 },
      hunts_by_platform: { 'Defender': 42, 'Splunk': 28, 'XSIAM': 15, 'Wiz': 4 },
      // Enhanced hunt data per platform with success/failed breakdown
      hunts_by_platform_detailed: {
        'Defender': { total: 42, completed: 38, failed: 4 },
        'Splunk': { total: 28, completed: 24, failed: 4 },
        'XSIAM': { total: 15, completed: 15, failed: 0 },
        'Wiz': { total: 4, completed: 3, failed: 1 }
      },
    },
    team: {
      articles_per_analyst: 218,
      hunts_per_hunter: 29,
      escalation_rate: 7.2,
      quality_score: 92,
      coverage_score: 88,
    },
    period: {
      start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      end_date: new Date().toISOString(),
    }
  });

  const handleGenerateReport = async () => {
    if (!selectedReportType) {
      message.warning('Please select a report type');
      return;
    }
    
    setGeneratingReport(true);
    try {
      // Handle MITRE ATT&CK reports differently
      if (selectedReportType.id === 'mitre_attack_mapping') {
        const startDate = dateRange[0]?.toISOString() || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const endDate = dateRange[1]?.toISOString() || new Date().toISOString();
        
        if (outputFormat === 'csv') {
          // Direct CSV download
          const response = await analyticsAPI.exportMitreCsv(startDate, endDate, articlesFilter);
          const blob = new Blob([response.data], { type: 'text/csv' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `mitre_attack_mapping_${new Date().toISOString().split('T')[0]}.csv`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
          message.success('MITRE ATT&CK CSV exported successfully!');
        } else {
          // JSON report or PDF
          const response = await analyticsAPI.generateMitreReport({
            report_format: mitreFormat,
            output_format: outputFormat,
            include_hunts: includeHunts,
            articles_filter: articlesFilter,
            date_range: {
              start: startDate,
              end: endDate,
            }
          });
          
          if (outputFormat === 'pdf') {
            // For PDF, we'd need a separate endpoint - show JSON for now
            message.success('MITRE ATT&CK report generated! PDF export coming soon.');
          } else {
            message.success('MITRE ATT&CK report generated successfully!');
          }
        }
      } else {
        // Standard report generation with download
        const startDate = dateRange[0]?.toISOString() || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const endDate = dateRange[1]?.toISOString() || new Date().toISOString();
        
        // Fetch branding from API (with localStorage fallback)
        let brandingData = {};
        try {
          const brandingResponse = await adminAPI.getCategoryConfigurations('branding');
          if (brandingResponse.data) {
            brandingResponse.data.forEach(config => {
              brandingData[config.key] = config.value;
            });
          }
        } catch (err) {
          console.warn('Failed to fetch branding from API, using localStorage:', err);
          brandingData = JSON.parse(localStorage.getItem('huntsphere-company-branding') || '{}');
        }
        
        const response = await analyticsAPI.generateReport(
          selectedReportType.id,
          selectedReportType.id === 'custom_report' ? selectedMetrics : selectedReportType.metrics,
          {
            start: startDate,
            end: endDate,
          },
          huntFilter
        );
        
        // Generate downloadable HTML report
        const reportData = response.data;
        const reportHtml = generateProfessionalReportHtml(reportData, selectedReportType, brandingData, startDate, endDate);
        
        // Create download blob
        const blob = new Blob([reportHtml], { type: 'text/html' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedReportType.id}_${new Date().toISOString().split('T')[0]}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        message.success('Report downloaded successfully!');
      }
      
      setReportModalVisible(false);
    } catch (error) {
      console.error('Report generation error:', error);
      message.error('Failed to generate report');
    } finally {
      setGeneratingReport(false);
    }
  };

  // Generate professional HTML report with company branding
  const generateProfessionalReportHtml = (data, reportType, branding, startDate, endDate) => {
    const companyName = branding.company_name || 'Organization';
    const logoUrl = branding.company_logo_url || '';
    const confidentiality = branding.confidentiality_notice || 'CONFIDENTIAL';
    const footer = branding.report_footer || '';
    const primaryColor = branding.primary_color || '#0f172a';
    const accentColor = branding.dark_color || '#3b82f6';
    const reportDate = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });
    const periodStart = new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const periodEnd = new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    
    // Get metrics from data or fallback to current metrics state
    const summary = data.summary || metrics?.summary || {};
    const sla = data.sla || metrics?.sla || {};
    const efficiency = data.efficiency || metrics?.efficiency || {};

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${reportType.name} - ${companyName}</title>
    <style>
        :root {
            --primary: ${primaryColor};
            --accent: ${accentColor};
            --success: #10b981;
            --warning: #f59e0b;
            --danger: #ef4444;
            --gray-50: #f8fafc;
            --gray-100: #f1f5f9;
            --gray-200: #e2e8f0;
            --gray-400: #94a3b8;
            --gray-600: #475569;
            --gray-800: #1e293b;
            --gray-900: #0f172a;
        }
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: var(--gray-50);
            color: var(--gray-800);
            line-height: 1.5;
            font-size: 14px;
        }
        
        /* Classification Banner */
        .classification-banner {
            background: var(--danger);
            color: white;
            text-align: center;
            padding: 6px 16px;
            font-weight: 600;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 2px;
        }
        
        /* Modern Header */
        .header {
            background: var(--primary);
            color: white;
            padding: 32px 48px;
        }
        .header-content {
            max-width: 1100px;
            margin: 0 auto;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .header-left { display: flex; align-items: center; gap: 16px; }
        .logo { 
            max-height: 48px; 
            max-width: 160px;
            border-radius: 4px;
        }
        .header-text { }
        .company-name { 
            font-size: 20px; 
            font-weight: 600;
            letter-spacing: -0.025em;
        }
        .report-type { 
            font-size: 13px; 
            opacity: 0.8;
            margin-top: 2px;
        }
        .header-right { text-align: right; }
        .report-date { 
            font-size: 13px; 
            opacity: 0.9;
        }
        .report-period { 
            font-size: 12px; 
            opacity: 0.7;
            margin-top: 2px;
        }
        
        /* Main Content */
        .main { 
            max-width: 1100px; 
            margin: 0 auto; 
            padding: 32px 48px;
        }
        
        /* Section Cards */
        .section { 
            background: white; 
            border-radius: 8px; 
            border: 1px solid var(--gray-200);
            margin-bottom: 24px;
            overflow: hidden;
        }
        .section-header {
            padding: 16px 24px;
            border-bottom: 1px solid var(--gray-200);
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .section-icon {
            width: 32px;
            height: 32px;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
        }
        .section-icon.blue { background: #dbeafe; color: #2563eb; }
        .section-icon.green { background: #d1fae5; color: #059669; }
        .section-icon.orange { background: #ffedd5; color: #ea580c; }
        .section-icon.purple { background: #ede9fe; color: #7c3aed; }
        .section-title {
            font-size: 15px;
            font-weight: 600;
            color: var(--gray-800);
        }
        .section-body {
            padding: 24px;
        }
        
        /* Metrics Grid */
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 16px;
        }
        @media (max-width: 800px) {
            .metrics-grid { grid-template-columns: repeat(2, 1fr); }
        }
        .metric {
            text-align: center;
            padding: 16px;
            border-radius: 6px;
            background: var(--gray-50);
        }
        .metric-value {
            font-size: 28px;
            font-weight: 700;
            color: var(--primary);
            line-height: 1.2;
        }
        .metric-value.success { color: var(--success); }
        .metric-value.warning { color: var(--warning); }
        .metric-value.danger { color: var(--danger); }
        .metric-label {
            font-size: 11px;
            color: var(--gray-600);
            margin-top: 4px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-weight: 500;
        }
        
        /* Key Insights */
        .insights-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
        }
        .insight-card {
            padding: 16px;
            border-radius: 6px;
            border-left: 3px solid var(--accent);
            background: var(--gray-50);
        }
        .insight-title {
            font-size: 12px;
            font-weight: 600;
            color: var(--gray-600);
            margin-bottom: 4px;
        }
        .insight-value {
            font-size: 18px;
            font-weight: 600;
            color: var(--gray-800);
        }
        
        /* Footer */
        .footer {
            background: var(--gray-900);
            color: white;
            padding: 24px 48px;
            text-align: center;
        }
        .footer-classification {
            font-size: 10px;
            opacity: 0.6;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 8px;
        }
        .footer-text {
            font-size: 12px;
            opacity: 0.5;
        }
        
        /* Print Styles */
        @media print {
            body { background: white; }
            .section { border: 1px solid #ddd; box-shadow: none; }
            .header, .footer, .classification-banner { 
                print-color-adjust: exact; 
                -webkit-print-color-adjust: exact; 
            }
        }
    </style>
</head>
<body>
    <div class="classification-banner">${confidentiality}</div>
    
    <header class="header">
        <div class="header-content">
            <div class="header-left">
                ${logoUrl ? `<img src="${logoUrl}" alt="${companyName}" class="logo" />` : ''}
                <div class="header-text">
                    <div class="company-name">${companyName}</div>
                    <div class="report-type">${reportType.name}</div>
                </div>
            </div>
            <div class="header-right">
                <div class="report-date">${reportDate}</div>
                <div class="report-period">${periodStart} — ${periodEnd}</div>
            </div>
        </div>
    </header>
    
    <main class="main">
        <!-- Executive Summary -->
        <section class="section">
            <div class="section-header">
                <div class="section-icon blue">📊</div>
                <div class="section-title">Executive Summary</div>
            </div>
            <div class="section-body">
                <div class="metrics-grid">
                    <div class="metric">
                        <div class="metric-value">${summary.total_articles || 0}</div>
                        <div class="metric-label">Articles Ingested</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value success">${summary.articles_processed || 0}</div>
                        <div class="metric-label">Processed</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value warning">${summary.high_priority || 0}</div>
                        <div class="metric-label">High Priority</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value">${summary.iocs_extracted || 0}</div>
                        <div class="metric-label">IOCs Extracted</div>
                    </div>
                </div>
            </div>
        </section>
        
        <!-- Threat Hunting -->
        <section class="section">
            <div class="section-header">
                <div class="section-icon purple">⚡</div>
                <div class="section-title">Threat Hunting Operations</div>
            </div>
            <div class="section-body">
                <div class="metrics-grid">
                    <div class="metric">
                        <div class="metric-value">${summary.hunts_total || 0}</div>
                        <div class="metric-label">Total Hunts</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value success">${summary.hunts_completed || 0}</div>
                        <div class="metric-label">Completed</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value danger">${summary.hunts_failed || 0}</div>
                        <div class="metric-label">Failed</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value success">${summary.hunts_total > 0 ? ((summary.hunts_completed / summary.hunts_total) * 100).toFixed(0) : 0}%</div>
                        <div class="metric-label">Success Rate</div>
                    </div>
                </div>
            </div>
        </section>
        
        <!-- SLA Performance -->
        <section class="section">
            <div class="section-header">
                <div class="section-icon orange">⏱️</div>
                <div class="section-title">SLA Performance</div>
            </div>
            <div class="section-body">
                <div class="metrics-grid">
                    <div class="metric">
                        <div class="metric-value">${sla.mttd_hours || 0}h</div>
                        <div class="metric-label">Mean Time to Detect</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value">${sla.mttr_hours || 0}h</div>
                        <div class="metric-label">Mean Time to Respond</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value success">${sla.sla_compliance_rate || 0}%</div>
                        <div class="metric-label">SLA Compliance</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value ${(sla.sla_breaches || 0) > 0 ? 'danger' : 'success'}">${sla.sla_breaches || 0}</div>
                        <div class="metric-label">SLA Breaches</div>
                    </div>
                </div>
            </div>
        </section>
        
        <!-- GenAI & Automation -->
        <section class="section">
            <div class="section-header">
                <div class="section-icon green">🤖</div>
                <div class="section-title">GenAI & Automation Value</div>
            </div>
            <div class="section-body">
                <div class="metrics-grid">
                    <div class="metric">
                        <div class="metric-value">${efficiency.genai_summaries || 0}</div>
                        <div class="metric-label">AI Summaries</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value">${summary.iocs_extracted || 0}</div>
                        <div class="metric-label">IOCs Extracted</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value">${summary.ttps_mapped || 0}</div>
                        <div class="metric-label">TTPs Mapped</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value success">${efficiency.auto_articles || 0}</div>
                        <div class="metric-label">Auto-Processed</div>
                    </div>
                </div>
            </div>
        </section>
        
        <!-- Key Insights -->
        <section class="section">
            <div class="section-header">
                <div class="section-icon blue">💡</div>
                <div class="section-title">Key Insights</div>
            </div>
            <div class="section-body">
                <div class="insights-grid">
                    <div class="insight-card">
                        <div class="insight-title">Processing Rate</div>
                        <div class="insight-value">${summary.total_articles > 0 ? ((summary.articles_processed / summary.total_articles) * 100).toFixed(0) : 0}% of articles processed</div>
                    </div>
                    <div class="insight-card">
                        <div class="insight-title">Automation Coverage</div>
                        <div class="insight-value">${efficiency.auto_articles || 0} articles auto-analyzed by AI</div>
                    </div>
                    <div class="insight-card">
                        <div class="insight-title">Intelligence Extracted</div>
                        <div class="insight-value">${(summary.iocs_extracted || 0) + (summary.ttps_mapped || 0)} total IOCs + TTPs</div>
                    </div>
                    <div class="insight-card">
                        <div class="insight-title">Active Sources</div>
                        <div class="insight-value">${summary.active_sources || 0} feed sources monitored</div>
                    </div>
                </div>
            </div>
        </section>
    </main>
    
    <footer class="footer">
        <div class="footer-classification">${confidentiality}</div>
        <div class="footer-text">${footer || `${companyName} • Threat Intelligence Report • Generated by HuntSphere`}</div>
    </footer>
</body>
</html>`;
  };

  const formatDuration = (hours) => {
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    if (hours < 24) return `${hours.toFixed(1)}h`;
    return `${(hours / 24).toFixed(1)}d`;
  };

  const formatPercentage = (value) => `${value.toFixed(1)}%`;
  
  // Save settings to localStorage
  const saveSettings = (type, values) => {
    const newSettings = { ...settingsValues, [type]: { ...settingsValues[type], ...values } };
    setSettingsValues(newSettings);
    localStorage.setItem('huntsphere-analytics-settings', JSON.stringify(newSettings));
    message.success('Settings saved successfully');
    setSettingsModalVisible(false);
  };
  
  // Open settings modal
  const openSettingsModal = (type) => {
    setSettingsType(type);
    setSettingsModalVisible(true);
  };
  
  // Simple hours saved calculation (not shown in UI, kept for compatibility)
  const calculateHoursSaved = () => {
    // Based on auto-processed articles and configured time per article
    const autoArticles = m.efficiency?.auto_articles || 0;
    const timePerArticleMinutes = settingsValues.roi?.time_per_article_minutes || 30;
    return Math.round((autoArticles * timePerArticleMinutes) / 60);
  };
  
  // Simple dollars saved calculation (not shown in UI, kept for compatibility)
  const calculateDollarsSaved = () => {
    const hoursSaved = calculateHoursSaved();
    const hourlyRate = settingsValues.roi?.hourly_rate || 75;
    return hoursSaved * hourlyRate;
  };

  const getTrendIndicator = (current, previous, isGoodWhenUp = true) => {
    if (!previous) return null;
    const change = ((current - previous) / previous) * 100;
    const isUp = change > 0;
    const isGood = isGoodWhenUp ? isUp : !isUp;
    
    return (
      <span style={{ 
        color: isGood ? 'var(--success)' : 'var(--danger)',
        fontSize: 12,
        marginLeft: 8
      }}>
        {isUp ? <RiseOutlined /> : <FallOutlined />}
        {Math.abs(change).toFixed(1)}%
      </span>
    );
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>Loading analytics...</div>
      </div>
    );
  }

  const m = metrics || getMockMetrics();

  return (
    <div className="analytics-dashboard">
      {/* Controls Row - Right aligned */}
      <div className="analytics-header" style={{ justifyContent: 'flex-end' }}>
        <Space wrap>
          <Select 
            value={selectedPeriod} 
            onChange={setSelectedPeriod}
            style={{ width: 150 }}
          >
            <Option value="24h">Last 24 hours</Option>
            <Option value="7d">Last 7 days</Option>
            <Option value="30d">Last 30 days</Option>
            <Option value="90d">Last 90 days</Option>
            <Option value="1y">Last year</Option>
            <Option value="custom">Custom Range</Option>
          </Select>
          {selectedPeriod === 'custom' && (
            <RangePicker 
              value={dateRange}
              onChange={setDateRange}
              size="middle"
            />
          )}
          <Button icon={<SyncOutlined />} onClick={fetchAnalytics}>
            Refresh
          </Button>
          <Button 
            type="primary" 
            icon={<DownloadOutlined />}
            onClick={() => setReportModalVisible(true)}
          >
            Generate Report
          </Button>
        </Space>
      </div>


      {/* Period Indicator Banner */}
      <Alert
        message={
          <Space>
            <CalendarOutlined />
            <strong>Showing data for:</strong>
            <Tag color="blue">
              {selectedPeriod === '24h' && 'Last 24 Hours'}
              {selectedPeriod === '7d' && 'Last 7 Days'}
              {selectedPeriod === '30d' && 'Last 30 Days'}
              {selectedPeriod === '90d' && 'Last 90 Days'}
              {selectedPeriod === '1y' && 'Last Year'}
              {selectedPeriod === 'custom' && dateRange[0] && dateRange[1] && 
                `${dateRange[0].format('MMM D, YYYY')} - ${dateRange[1].format('MMM D, YYYY')}`}
            </Tag>
            {m.period && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                ({m.period.days || Math.ceil((new Date(m.period.end) - new Date(m.period.start)) / (1000 * 60 * 60 * 24))} days)
              </Text>
            )}
          </Space>
        }
        type="info"
        style={{ marginBottom: 16 }}
        showIcon={false}
      />

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        {/* EXECUTIVE OVERVIEW TAB */}
        <Tabs.TabPane 
          tab={<span><DashboardOutlined /> Executive Overview</span>} 
          key="overview"
        >
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* KPI Cards - Clickable with explanations */}
            <Row gutter={[16, 16]}>
              <Col xs={12} sm={8} md={6} lg={4}>
                <Tooltip title="Click for details • Count of articles that have been triaged, analyzed, or had hunts generated">
                  <Card 
                    className="kpi-card" 
                    size="small"
                    hoverable
                    onClick={() => Modal.info({
                      title: 'Articles Processed',
                      content: <div>
                        <p><strong>Definition:</strong> Articles that have moved beyond NEW status (IN_ANALYSIS, NEED_TO_HUNT, HUNT_GENERATED, REVIEWED).</p>
                        <p><strong>Current:</strong> {m.summary.articles_processed} of {m.summary.total_articles} ({Math.round((m.summary.articles_processed / m.summary.total_articles) * 100)}%)</p>
                        <p><strong>Target:</strong> 90%+ within 24 hours of ingestion</p>
                      </div>
                    })}
                  >
                    <Statistic 
                      title="Articles Processed" 
                      value={m.summary.articles_processed}
                      prefix={<FileTextOutlined />}
                      suffix={<Text type="secondary" style={{ fontSize: 12 }}>/ {m.summary.total_articles}</Text>}
                    />
                    <Progress 
                      percent={Math.round((m.summary.articles_processed / m.summary.total_articles) * 100)} 
                      size="small" 
                      showInfo={false}
                    />
                  </Card>
                </Tooltip>
              </Col>
              <Col xs={12} sm={8} md={6} lg={4}>
                <Tooltip title="Click for details • Articles flagged as urgent requiring immediate attention">
                  <Card 
                    className="kpi-card kpi-danger" 
                    size="small"
                    hoverable
                    onClick={() => Modal.info({
                      title: 'High Priority Articles',
                      content: <div>
                        <p><strong>Definition:</strong> Articles flagged as high priority based on source priority, keyword matches, or severity indicators.</p>
                        <p><strong>Current:</strong> {m.summary.high_priority} articles</p>
                        <p><strong>SLA:</strong> Should be triaged within 1 hour of ingestion</p>
                        <p><strong>Action:</strong> Navigate to Article Queue and filter by High Priority</p>
                      </div>
                    })}
                  >
                    <Statistic 
                      title="High Priority" 
                      value={m.summary.high_priority}
                      prefix={<AlertOutlined style={{ color: 'var(--danger)' }} />}
                    />
                    <Text type="secondary" style={{ fontSize: 11 }}>Requiring attention</Text>
                  </Card>
                </Tooltip>
              </Col>
              <Col xs={12} sm={8} md={6} lg={4}>
                <Tooltip title="Click for details • Total IOCs extracted using GenAI and pattern matching">
                  <Card 
                    className="kpi-card kpi-success" 
                    size="small"
                    hoverable
                    onClick={() => Modal.info({
                      title: 'IOCs Extracted',
                      content: <div>
                        <p><strong>Definition:</strong> Indicators of Compromise extracted from articles using GenAI and regex patterns.</p>
                        <p><strong>Types:</strong> IP addresses, domains, URLs, file hashes (MD5/SHA1/SHA256), CVEs, email addresses, Bitcoin wallets</p>
                        <p><strong>Current:</strong> {m.summary.iocs_extracted} indicators</p>
                        <p><strong>Process:</strong> Auto-extracted on article ingestion or manually via "Extract IOCs" button</p>
                      </div>
                    })}
                  >
                    <Statistic 
                      title="IOCs Extracted" 
                      value={m.summary.iocs_extracted}
                      prefix={<BugOutlined style={{ color: 'var(--success)' }} />}
                    />
                    <Text type="secondary" style={{ fontSize: 11 }}>Automated via GenAI</Text>
                  </Card>
                </Tooltip>
              </Col>
              <Col xs={12} sm={8} md={6} lg={4}>
                <Tooltip title="Click for details • MITRE ATT&CK tactics, techniques and procedures mapped from articles">
                  <Card 
                    className="kpi-card kpi-purple" 
                    size="small"
                    hoverable
                    onClick={() => Modal.info({
                      title: 'TTPs Mapped',
                      content: <div>
                        <p><strong>Definition:</strong> MITRE ATT&CK Tactics, Techniques, and Procedures identified in threat intelligence articles.</p>
                        <p><strong>Current:</strong> {m.summary.ttps_mapped} unique TTPs</p>
                        <p><strong>Framework:</strong> MITRE ATT&CK Enterprise</p>
                        <p><strong>Process:</strong> Auto-extracted via GenAI pattern matching against MITRE database</p>
                        <p><strong>Navigation:</strong> View in Intelligence page → Filter by TTP</p>
                      </div>
                    })}
                  >
                    <Statistic 
                      title="TTPs Mapped" 
                      value={m.summary.ttps_mapped}
                      prefix={<AimOutlined style={{ color: '#8B5CF6' }} />}
                    />
                    <Text type="secondary" style={{ fontSize: 11 }}>MITRE ATT&CK</Text>
                  </Card>
                </Tooltip>
              </Col>
              <Col xs={12} sm={8} md={6} lg={4}>
                <Tooltip title="Click for details • Threat hunts successfully executed against SIEM/EDR platforms">
                  <Card 
                    className="kpi-card" 
                    size="small"
                    hoverable
                    onClick={() => Modal.info({
                      title: 'Hunts Completed',
                      content: <div>
                        <p><strong>Definition:</strong> Hunt queries generated from intelligence and successfully executed on connected platforms.</p>
                        <p><strong>Current:</strong> {m.summary.hunts_completed} of {m.summary.hunts_total} ({Math.round((m.summary.hunts_completed / m.summary.hunts_total) * 100)}%)</p>
                        <p><strong>Failed:</strong> {m.summary.hunts_failed} hunts</p>
                        <p><strong>Platforms:</strong> Microsoft Defender, Splunk, Palo Alto XSIAM, Wiz</p>
                        <p><strong>Navigation:</strong> View in Threat Hunt Workbench → Hunt Executions</p>
                      </div>
                    })}
                  >
                    <Statistic 
                      title="Hunts Completed" 
                      value={m.summary.hunts_completed}
                      prefix={<ThunderboltOutlined style={{ color: 'var(--primary)' }} />}
                      suffix={<Text type="secondary" style={{ fontSize: 12 }}>/ {m.summary.hunts_total}</Text>}
                    />
                    <Progress 
                      percent={Math.round((m.summary.hunts_completed / m.summary.hunts_total) * 100)} 
                      size="small" 
                      status={m.summary.hunts_failed > 0 ? 'exception' : 'success'}
                      showInfo={false}
                    />
                  </Card>
                </Tooltip>
              </Col>
              <Col xs={12} sm={8} md={6} lg={4}>
                <Tooltip title="Click for details • Overall platform efficiency based on automation and processing speed">
                  <Card 
                    className="kpi-card kpi-info" 
                    size="small"
                    hoverable
                    onClick={() => Modal.info({
                      title: 'Efficiency Score',
                      content: <div>
                        <p><strong>Definition:</strong> Composite score measuring automation utilization, processing speed, and successful completions.</p>
                        <p><strong>Current:</strong> {m.efficiency.efficiency_score}%</p>
                        <p><strong>Calculation:</strong></p>
                        <ul>
                          <li>Automation Rate: {m.summary.total_articles > 0 ? Math.round((m.efficiency.auto_articles / m.summary.total_articles) * 100) : 0}%</li>
                          <li>Hunt Success Rate: {m.summary.hunts_total > 0 ? Math.round((m.summary.hunts_completed / m.summary.hunts_total) * 100) : 0}%</li>
                          <li>GenAI Utilization: {m.efficiency.genai_extractions} extractions</li>
                          <li>Hours Saved: {m.efficiency.automation_hours_saved}</li>
                        </ul>
                        <p><strong>Target:</strong> 85%+ for mature TI programs</p>
                      </div>
                    })}
                  >
                    <Statistic 
                      title="Efficiency Score" 
                      value={m.efficiency.efficiency_score}
                      suffix="%"
                      prefix={<TrophyOutlined style={{ color: 'var(--warning)' }} />}
                    />
                    <Progress 
                      percent={m.efficiency.efficiency_score} 
                      size="small" 
                      strokeColor="var(--warning)"
                      showInfo={false}
                    />
                  </Card>
                </Tooltip>
              </Col>
            </Row>

            {/* Intel-to-Hunt Ratio Card - Key CISO/Manager Metric */}
            <Card 
              title={<Space><RiseOutlined /> Intel-to-Hunt Escalation</Space>} 
              size="small"
              style={{ marginTop: 16 }}
            >
              <Row gutter={24}>
                <Col span={6}>
                  <div className="sla-metric">
                    <div className="sla-value">{m.summary.total_articles}</div>
                    <div className="sla-label">Total Articles</div>
                    <Text type="secondary" style={{ fontSize: 11 }}>Ingested in period</Text>
                  </div>
                </Col>
                <Col span={6}>
                  <div className="sla-metric">
                    <div className="sla-value" style={{ color: 'var(--warning)' }}>
                      {m.summary.high_priority}
                    </div>
                    <div className="sla-label">Escalated to Hunt</div>
                    <Text type="secondary" style={{ fontSize: 11 }}>Marked for hunting</Text>
                  </div>
                </Col>
                <Col span={6}>
                  <div className="sla-metric">
                    <div className="sla-value" style={{ color: 'var(--success)' }}>
                      {m.summary.hunts_completed}
                    </div>
                    <div className="sla-label">Hunts Completed</div>
                    <Text type="secondary" style={{ fontSize: 11 }}>Successfully executed</Text>
                  </div>
                </Col>
                <Col span={6}>
                  <div className="sla-metric">
                    <div className="sla-value" style={{ color: 'var(--primary)' }}>
                      {m.summary.total_articles > 0 ? 
                        `${((m.summary.high_priority / m.summary.total_articles) * 100).toFixed(1)}%` : 
                        '0%'}
                    </div>
                    <div className="sla-label">Escalation Rate</div>
                    <Tag color={m.summary.high_priority / m.summary.total_articles < 0.1 ? 'success' : 'warning'}>
                      {m.summary.high_priority / m.summary.total_articles < 0.1 ? 'Normal' : 'Elevated'}
                    </Tag>
                  </div>
                </Col>
              </Row>
              <Divider style={{ margin: '12px 0' }} />
              <Row gutter={16}>
                <Col span={12}>
                  <Text strong>Articles : Hunts Ratio</Text>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--primary)' }}>
                    {m.summary.hunts_completed > 0 ? 
                      `${Math.round(m.summary.total_articles / m.summary.hunts_completed)}:1` : 
                      'N/A'}
                  </div>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    Lower ratio indicates more hunting activity
                  </Text>
                </Col>
                <Col span={12}>
                  <Text strong>Hunt Coverage</Text>
                  <Progress 
                    percent={m.summary.high_priority > 0 ? 
                      Math.round((m.summary.hunts_completed / m.summary.high_priority) * 100) : 0}
                    status={m.summary.hunts_completed >= m.summary.high_priority ? 'success' : 'active'}
                    format={(p) => `${p}% of escalated`}
                  />
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    % of escalated items with completed hunts
                  </Text>
                </Col>
              </Row>
            </Card>

            {/* SLA & Time Metrics */}
            <Card 
              title={<Space><ClockCircleOutlined /> SLA & Time Metrics</Space>} 
              size="small"
              extra={canEditSettings && (
                <Tooltip title="Edit SLA targets">
                  <Button 
                    type="text" 
                    size="small" 
                    icon={<EditOutlined />}
                    onClick={() => openSettingsModal('sla')}
                  />
                </Tooltip>
              )}
            >
              <Row gutter={[24, 16]}>
                <Col span={4}>
                  <Tooltip title="Click for details">
                    <div 
                      className="sla-metric clickable"
                      onClick={() => Modal.info({
                        title: 'Mean Time to Detect (MTTD)',
                        content: <div>
                          <p><strong>Definition:</strong> Average time from when a threat article is ingested until it's identified as requiring action.</p>
                          <p><strong>Current:</strong> {formatDuration(m.sla.mttd_hours)}</p>
                          <p><strong>SLA Target:</strong> Less than 4 hours</p>
                          <p><strong>Status:</strong> {m.sla.mttd_hours < 4 ? '✅ Within SLA' : '⚠️ Near or exceeding SLA'}</p>
                          <p><strong>Calculation:</strong> Average of (time_analyzed - time_ingested) for all articles</p>
                        </div>
                      })}
                    >
                      <div className="sla-value">{formatDuration(m.sla.mttd_hours)}</div>
                      <div className="sla-label">Mean Time to Detect</div>
                      <Tag color={m.sla.mttd_hours < 4 ? 'success' : 'warning'}>
                        {m.sla.mttd_hours < 4 ? 'Within SLA' : 'Near SLA'}
                      </Tag>
                    </div>
                  </Tooltip>
                </Col>
                <Col span={4}>
                  <Tooltip title="Click for details">
                    <div 
                      className="sla-metric clickable"
                      onClick={() => Modal.info({
                        title: 'Mean Time to Respond (MTTR)',
                        content: <div>
                          <p><strong>Definition:</strong> Average time from threat detection to active hunting/response initiation.</p>
                          <p><strong>Current:</strong> {formatDuration(m.sla.mttr_hours)}</p>
                          <p><strong>SLA Target:</strong> Less than 8 hours</p>
                          <p><strong>Status:</strong> {m.sla.mttr_hours < 8 ? '✅ Within SLA' : '⚠️ Near or exceeding SLA'}</p>
                          <p><strong>Calculation:</strong> Average of (hunt_initiated - time_analyzed) for hunted articles</p>
                        </div>
                      })}
                    >
                      <div className="sla-value">{formatDuration(m.sla.mttr_hours)}</div>
                      <div className="sla-label">Mean Time to Respond</div>
                      <Tag color={m.sla.mttr_hours < 8 ? 'success' : 'warning'}>
                        {m.sla.mttr_hours < 8 ? 'Within SLA' : 'Near SLA'}
                      </Tag>
                    </div>
                  </Tooltip>
                </Col>
                <Col span={4}>
                  <Tooltip title="Click for details">
                    <div 
                      className="sla-metric clickable"
                      onClick={() => Modal.info({
                        title: 'Average Triage Time',
                        content: <div>
                          <p><strong>Definition:</strong> Average time spent reviewing an article before status change.</p>
                          <p><strong>Current:</strong> {m.sla.mean_triage_minutes} minutes</p>
                          <p><strong>Target:</strong> Less than 15 minutes for non-critical articles</p>
                          <p><strong>Calculation:</strong> Average of (status_change_time - article_opened_time)</p>
                        </div>
                      })}
                    >
                      <div className="sla-value">{m.sla.mean_triage_minutes}m</div>
                      <div className="sla-label">Avg Triage Time</div>
                    </div>
                  </Tooltip>
                </Col>
                <Col span={4}>
                  <Tooltip title="Click for details">
                    <div 
                      className="sla-metric clickable"
                      onClick={() => Modal.info({
                        title: 'Average Escalation Time',
                        content: <div>
                          <p><strong>Definition:</strong> Average time to escalate articles to hunt status after initial triage.</p>
                          <p><strong>Current:</strong> {formatDuration(m.sla.mean_escalation_hours)}</p>
                          <p><strong>Target:</strong> Less than 2 hours for high priority items</p>
                          <p><strong>Calculation:</strong> Average of (escalated_time - triaged_time) for escalated articles</p>
                        </div>
                      })}
                    >
                      <div className="sla-value">{formatDuration(m.sla.mean_escalation_hours)}</div>
                      <div className="sla-label">Avg Escalation Time</div>
                    </div>
                  </Tooltip>
                </Col>
                <Col span={4}>
                  <Tooltip title="Click for details">
                    <div 
                      className="sla-metric clickable"
                      onClick={() => Modal.info({
                        title: 'SLA Compliance Rate',
                        content: <div>
                          <p><strong>Definition:</strong> Percentage of articles and hunts completed within SLA timeframes.</p>
                          <p><strong>Current:</strong> {formatPercentage(m.sla.sla_compliance_rate)}</p>
                          <p><strong>Target:</strong> 95% or higher</p>
                          <p><strong>Status:</strong> {m.sla.sla_compliance_rate >= 95 ? '✅ Meeting target' : '⚠️ Below target'}</p>
                          <p><strong>Calculation:</strong> (Items completed within SLA / Total items) × 100</p>
                        </div>
                      })}
                    >
                      <div className="sla-value">{formatPercentage(m.sla.sla_compliance_rate)}</div>
                      <div className="sla-label">SLA Compliance</div>
                      <Progress 
                        percent={m.sla.sla_compliance_rate} 
                        size="small"
                        status={m.sla.sla_compliance_rate >= 95 ? 'success' : 'exception'}
                      />
                    </div>
                  </Tooltip>
                </Col>
                <Col span={4}>
                  <Tooltip title="Click to view SLA breaches">
                    <div 
                      className="sla-metric clickable"
                      onClick={() => Modal.info({
                        title: <Space><AlertOutlined style={{ color: 'var(--danger)' }} /> SLA Breaches</Space>,
                        width: 600,
                        content: <div>
                          <p><strong>Definition:</strong> Items that exceeded SLA timeframes in the selected period.</p>
                          <Divider style={{ margin: '12px 0' }} />
                          {m.sla.sla_breaches > 0 ? (
                            <div>
                              <Alert 
                                message={`${m.sla.sla_breaches} item(s) breached SLA`}
                                type="error"
                                showIcon
                                style={{ marginBottom: 16 }}
                              />
                              <Text strong style={{ display: 'block', marginBottom: 8 }}>Breached Items (click to view):</Text>
                              <div style={{ maxHeight: 300, overflow: 'auto' }}>
                                {/* Example breached articles - in real implementation, this would come from API */}
                                {m.sla.breached_items?.map((item, idx) => (
                                  <div 
                                    key={idx} 
                                    style={{ 
                                      padding: '8px 12px', 
                                      border: '1px solid var(--border-color)',
                                      borderRadius: 6,
                                      marginBottom: 8,
                                      cursor: 'pointer',
                                      background: 'var(--danger-bg)'
                                    }}
                                    onClick={() => window.location.href = item.type === 'hunt' ? `/hunts?id=${item.id}` : `/articles?article_id=${item.id}`}
                                  >
                                    <Space>
                                      <Tag color={item.type === 'hunt' ? 'purple' : 'blue'}>
                                        {item.type === 'hunt' ? 'Hunt' : 'Article'}
                                      </Tag>
                                      <Text>{item.title}</Text>
                                      <Text type="danger">+{item.overtime}</Text>
                                    </Space>
                                  </div>
                                )) || (
                                  <Text type="secondary">
                                    View detailed breach information in the{' '}
                                    <a href="/admin?tab=audit">Audit Logs</a>
                                  </Text>
                                )}
                              </div>
                              <Divider style={{ margin: '12px 0' }} />
                              <Space>
                                <Button type="primary" size="small" onClick={() => window.location.href = '/articles?sla_breach=true'}>
                                  View Breached Articles
                                </Button>
                                <Button size="small" onClick={() => window.location.href = '/hunts?sla_breach=true'}>
                                  View Breached Hunts
                                </Button>
                              </Space>
                            </div>
                          ) : (
                            <Alert 
                              message="No SLA breaches in this period" 
                              type="success" 
                              showIcon 
                            />
                          )}
                        </div>
                      })}
                    >
                      <div className="sla-value" style={{ color: m.sla.sla_breaches > 0 ? 'var(--danger)' : 'var(--success)' }}>
                        {m.sla.sla_breaches}
                      </div>
                      <div className="sla-label">SLA Breaches</div>
                      <Tag color={m.sla.sla_breaches === 0 ? 'success' : 'error'}>
                        {m.sla.sla_breaches === 0 ? 'None' : 'View Details'}
                      </Tag>
                    </div>
                  </Tooltip>
                </Col>
              </Row>
            </Card>

            {/* ROI & Automation - Three Category Breakdown */}
            <Row gutter={16}>
              <Col span={12}>
                <Card 
                  title={<Space><RobotOutlined /> Automation & ROI</Space>} 
                  size="small"
                  extra={canEditSettings && (
                    <Tooltip title="Edit ROI settings">
                      <Button 
                        type="text" 
                        size="small" 
                        icon={<EditOutlined />}
                        onClick={(e) => { e.stopPropagation(); openSettingsModal('roi'); }}
                      />
                    </Tooltip>
                  )}
                  hoverable
                  style={{ cursor: 'pointer' }}
                  onClick={() => Modal.info({
                    title: <Space><RobotOutlined /> Automation & ROI Breakdown</Space>,
                    width: 800,
                    content: <div>
                      {/* Total Savings Banner */}
                      <div style={{ background: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)', padding: 20, borderRadius: 8, marginBottom: 20, color: 'white' }}>
                        <Row gutter={24}>
                          <Col span={8} style={{ textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.3)' }}>
                            <div style={{ fontSize: 32, fontWeight: 'bold' }}>{calculateHoursSaved()}h</div>
                            <div style={{ opacity: 0.9 }}>Hours Saved</div>
                          </Col>
                          <Col span={8} style={{ textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.3)' }}>
                            <div style={{ fontSize: 32, fontWeight: 'bold' }}>${calculateDollarsSaved().toLocaleString()}</div>
                            <div style={{ opacity: 0.9 }}>Dollars Saved</div>
                          </Col>
                          <Col span={8} style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 32, fontWeight: 'bold' }}>
                              {Math.round((m.efficiency.auto_articles / Math.max(1, m.efficiency.manual_articles + m.efficiency.auto_articles)) * 100)}%
                            </div>
                            <div style={{ opacity: 0.9 }}>Automation Rate</div>
                          </Col>
                        </Row>
                      </div>
                      
                      {/* Three Automation Categories */}
                      <Row gutter={16} style={{ marginBottom: 16 }}>
                        {/* GenAI Automation */}
                        <Col span={8}>
                          <div style={{ background: '#f0f5ff', padding: 16, borderRadius: 8, height: '100%', borderTop: '3px solid #1890ff' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                              <RobotOutlined style={{ fontSize: 18, color: '#1890ff' }} />
                              <strong style={{ color: '#1890ff' }}>GenAI Automation</strong>
                            </div>
                            <div style={{ fontSize: 11, color: '#666', marginBottom: 8 }}>AI-powered analysis that would take analysts hours</div>
                            <table style={{ width: '100%', fontSize: 12 }}>
                              <tbody>
                                <tr><td style={{ padding: '4px 0' }}>Executive Summaries</td><td style={{ textAlign: 'right', fontWeight: 600, color: '#1890ff' }}>{m.efficiency.genai_summaries}</td></tr>
                                <tr><td style={{ padding: '4px 0' }}>Technical Summaries</td><td style={{ textAlign: 'right', fontWeight: 600, color: '#1890ff' }}>{m.efficiency.technical_summaries || 0}</td></tr>
                                <tr><td style={{ padding: '4px 0' }}>IOCs Extracted</td><td style={{ textAlign: 'right', fontWeight: 600, color: '#1890ff' }}>{m.summary.iocs_extracted}</td></tr>
                                <tr><td style={{ padding: '4px 0' }}>TTPs Mapped</td><td style={{ textAlign: 'right', fontWeight: 600, color: '#1890ff' }}>{m.summary.ttps_mapped}</td></tr>
                                <tr><td style={{ padding: '4px 0' }}>Auto Hunt Queries</td><td style={{ textAlign: 'right', fontWeight: 600, color: '#1890ff' }}>{m.efficiency.automation_breakdown?.genai?.hunt_queries_generated || 0}</td></tr>
                              </tbody>
                            </table>
                            <div style={{ marginTop: 12, padding: 8, background: '#e6f7ff', borderRadius: 4, fontSize: 11 }}>
                              <strong>Time saved:</strong> ~{Math.round((m.efficiency.genai_summaries * 15 + m.summary.iocs_extracted * 5 + m.summary.ttps_mapped * 5) / 60)}h
                            </div>
                          </div>
                        </Col>
                        
                        {/* Platform Automation */}
                        <Col span={8}>
                          <div style={{ background: '#f6ffed', padding: 16, borderRadius: 8, height: '100%', borderTop: '3px solid #52c41a' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                              <SyncOutlined style={{ fontSize: 18, color: '#52c41a' }} />
                              <strong style={{ color: '#52c41a' }}>Platform Automation</strong>
                            </div>
                            <div style={{ fontSize: 11, color: '#666', marginBottom: 8 }}>Scheduled tasks running 24/7 without human intervention</div>
                            <table style={{ width: '100%', fontSize: 12 }}>
                              <tbody>
                                <tr><td style={{ padding: '4px 0' }}>Articles Ingested</td><td style={{ textAlign: 'right', fontWeight: 600, color: '#52c41a' }}>{m.summary.total_articles}</td></tr>
                                <tr><td style={{ padding: '4px 0' }}>Auto-Processed</td><td style={{ textAlign: 'right', fontWeight: 600, color: '#52c41a' }}>{m.efficiency.auto_articles}</td></tr>
                                <tr><td style={{ padding: '4px 0' }}>Watchlist Matches</td><td style={{ textAlign: 'right', fontWeight: 600, color: '#52c41a' }}>{m.summary.watchlist_matches || m.summary.critical_threats || 0}</td></tr>
                                <tr><td style={{ padding: '4px 0' }}>Feed Sources Active</td><td style={{ textAlign: 'right', fontWeight: 600, color: '#52c41a' }}>{m.summary.active_sources || 0}</td></tr>
                              </tbody>
                            </table>
                            <div style={{ marginTop: 12, padding: 8, background: '#d9f7be', borderRadius: 4, fontSize: 11 }}>
                              <strong>Runs every:</strong> 15 min (feeds), 30 min (processing)
                            </div>
                          </div>
                        </Col>
                        
                        {/* Manual Tasks */}
                        <Col span={8}>
                          <div style={{ background: '#fff7e6', padding: 16, borderRadius: 8, height: '100%', borderTop: '3px solid #faad14' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                              <TeamOutlined style={{ fontSize: 18, color: '#faad14' }} />
                              <strong style={{ color: '#faad14' }}>Human Tasks</strong>
                            </div>
                            <div style={{ fontSize: 11, color: '#666', marginBottom: 8 }}>Tasks requiring human judgment and decision</div>
                            <table style={{ width: '100%', fontSize: 12 }}>
                              <tbody>
                                <tr><td style={{ padding: '4px 0' }}>Manual Reviews</td><td style={{ textAlign: 'right', fontWeight: 600, color: '#faad14' }}>{m.efficiency.manual_articles}</td></tr>
                                <tr><td style={{ padding: '4px 0' }}>Manual Hunts</td><td style={{ textAlign: 'right', fontWeight: 600, color: '#faad14' }}>{m.efficiency.automation_breakdown?.hunting?.manual_hunts || 0}</td></tr>
                                <tr><td style={{ padding: '4px 0' }}>Pending Review</td><td style={{ textAlign: 'right', fontWeight: 600, color: '#faad14' }}>{m.efficiency.pending_processing || 0}</td></tr>
                                <tr><td style={{ padding: '4px 0' }}>Hunt Executions</td><td style={{ textAlign: 'right', fontWeight: 600, color: '#faad14' }}>{m.summary.hunts_completed}</td></tr>
                              </tbody>
                            </table>
                            <div style={{ marginTop: 12, padding: 8, background: '#fff1b8', borderRadius: 4, fontSize: 11 }}>
                              <strong>Focus:</strong> Review AI outputs, execute hunts
                            </div>
                          </div>
                        </Col>
                      </Row>
                      
                      {/* Clickable Article Links */}
                      <div style={{ background: '#fafafa', padding: 12, borderRadius: 8, marginBottom: 16 }}>
                        <strong style={{ marginBottom: 8, display: 'block' }}>View Articles by Processing Type:</strong>
                        <Space wrap>
                          <Tag color="green" style={{ cursor: 'pointer', padding: '4px 12px' }} onClick={() => window.location.href = '/articles?processing=automated'}>
                            <RobotOutlined /> {m.efficiency.auto_articles} AI Processed →
                          </Tag>
                          <Tag color="orange" style={{ cursor: 'pointer', padding: '4px 12px' }} onClick={() => window.location.href = '/articles?processing=manual'}>
                            <TeamOutlined /> {m.efficiency.manual_articles} Manual →
                          </Tag>
                          <Tag color="red" style={{ cursor: 'pointer', padding: '4px 12px' }} onClick={() => window.location.href = '/articles?high_priority=true'}>
                            <AlertOutlined /> {m.summary.high_priority || 0} High Priority →
                          </Tag>
                        </Space>
                      </div>
                      
                      {/* Cost Savings Breakdown */}
                      <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 8 }}>
                        <Row gutter={24}>
                          <Col span={12}>
                            <strong>ROI Calculation</strong>
                            <div style={{ marginTop: 8, fontSize: 12, fontFamily: 'monospace', color: '#666' }}>
                              Hours Saved = {m.efficiency.auto_articles} articles × {settingsValues.roi?.time_per_article_minutes || 30} min<br/>
                              = <strong style={{ color: '#52c41a' }}>{calculateHoursSaved()} hours</strong><br/><br/>
                              Dollars Saved = {calculateHoursSaved()}h × ${settingsValues.roi?.hourly_rate || 75}/hr<br/>
                              = <strong style={{ color: '#52c41a' }}>${calculateDollarsSaved().toLocaleString()}</strong>
                            </div>
                          </Col>
                          <Col span={12}>
                            <strong>Cost per Article</strong>
                            <div style={{ marginTop: 8 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>Your Cost:</span>
                                <span style={{ fontSize: 20, fontWeight: 600, color: '#52c41a' }}>${(settingsValues.roi?.cost_per_article || 12.50).toFixed(2)}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#888' }}>
                                <span>Industry Avg:</span>
                                <span style={{ fontSize: 16, textDecoration: 'line-through' }}>$45.00</span>
                              </div>
                              <div style={{ marginTop: 8, color: '#52c41a', fontWeight: 500 }}>
                                Saving {Math.round(((45 - (settingsValues.roi?.cost_per_article || 12.50)) / 45) * 100)}% per article
                              </div>
                            </div>
                          </Col>
                        </Row>
                      </div>
                    </div>
                  })}
                >
                  {/* Main Card - Three Category Summary */}
                  <Row gutter={8}>
                    <Col span={8}>
                      <Tooltip title="Click to see GenAI automation details">
                        <div style={{ textAlign: 'center', padding: '8px 4px', cursor: 'pointer', background: '#f0f5ff', borderRadius: 6 }}>
                          <RobotOutlined style={{ color: '#1890ff', fontSize: 14 }} />
                          <div style={{ fontSize: 18, fontWeight: 700, color: '#1890ff' }}>{m.efficiency.genai_summaries}</div>
                          <div style={{ fontSize: 9, color: '#666' }}>GenAI Tasks</div>
                        </div>
                      </Tooltip>
                    </Col>
                    <Col span={8}>
                      <Tooltip title="Click to see platform automation details">
                        <div style={{ textAlign: 'center', padding: '8px 4px', cursor: 'pointer', background: '#f6ffed', borderRadius: 6 }}>
                          <SyncOutlined style={{ color: '#52c41a', fontSize: 14 }} />
                          <div style={{ fontSize: 18, fontWeight: 700, color: '#52c41a' }}>{m.efficiency.auto_articles}</div>
                          <div style={{ fontSize: 9, color: '#666' }}>Auto-Processed</div>
                        </div>
                      </Tooltip>
                    </Col>
                    <Col span={8}>
                      <Tooltip title="Click to see manual task details">
                        <div style={{ textAlign: 'center', padding: '8px 4px', cursor: 'pointer', background: '#fff7e6', borderRadius: 6 }}>
                          <TeamOutlined style={{ color: '#faad14', fontSize: 14 }} />
                          <div style={{ fontSize: 18, fontWeight: 700, color: '#faad14' }}>{m.efficiency.manual_articles}</div>
                          <div style={{ fontSize: 9, color: '#666' }}>Manual</div>
                        </div>
                      </Tooltip>
                    </Col>
                  </Row>
                  <Divider style={{ margin: '10px 0' }} />
                  <Row gutter={16}>
                    <Col span={12}>
                      <Tooltip title="Hours saved via automated processing">
                        <div style={{ textAlign: 'center', cursor: 'pointer' }}>
                          <div style={{ fontSize: 20, fontWeight: 700, color: '#52c41a' }}>{calculateHoursSaved()}h</div>
                          <div style={{ fontSize: 10, color: '#666' }}>Hours Saved</div>
                        </div>
                      </Tooltip>
                    </Col>
                    <Col span={12}>
                      <Tooltip title="Estimated dollar savings based on hourly rate">
                        <div style={{ textAlign: 'center', cursor: 'pointer' }}>
                          <div style={{ fontSize: 20, fontWeight: 700, color: '#fa8c16' }}>${calculateDollarsSaved().toLocaleString()}</div>
                          <div style={{ fontSize: 10, color: '#666' }}>$ Saved</div>
                        </div>
                      </Tooltip>
                    </Col>
                  </Row>
                </Card>
              </Col>
              <Col span={12}>
                <Tooltip title="Click for team performance details">
                  <Card 
                    title={<Space><TeamOutlined /> Team Performance</Space>} 
                    size="small"
                    hoverable
                    style={{ cursor: 'pointer' }}
                    extra={canEditSettings && (
                      <Tooltip title="Edit team settings (analysts/hunters count)">
                        <Button 
                          type="text" 
                          size="small" 
                          icon={<EditOutlined />}
                          onClick={(e) => { e.stopPropagation(); openSettingsModal('team'); }}
                        />
                      </Tooltip>
                    )}
                    onClick={() => Modal.info({
                      title: 'Team Performance Details',
                      width: 600,
                      content: <div>
                        <p><strong>Definition:</strong> Productivity and quality metrics for the threat intelligence team.</p>
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
                          <thead>
                            <tr style={{ borderBottom: '2px solid #f0f0f0' }}>
                              <th style={{ textAlign: 'left', padding: '8px' }}>Metric</th>
                              <th style={{ textAlign: 'right', padding: '8px' }}>Value</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                              <td style={{ padding: '8px' }}>Articles per Analyst</td>
                              <td style={{ textAlign: 'right', padding: '8px' }}><strong>{Math.round(m.summary.articles_processed / settingsValues.team.analysts_count)}</strong></td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                              <td style={{ padding: '8px' }}>Hunts per Hunter</td>
                              <td style={{ textAlign: 'right', padding: '8px' }}><strong>{Math.round(m.summary.hunts_completed / settingsValues.team.hunters_count)}</strong></td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                              <td style={{ padding: '8px' }}>Escalation Rate</td>
                              <td style={{ textAlign: 'right', padding: '8px' }}><strong>{m.team.escalation_rate}%</strong></td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                              <td style={{ padding: '8px' }}>Quality Score</td>
                              <td style={{ textAlign: 'right', padding: '8px' }}><strong>{m.team.quality_score}/100</strong></td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                              <td style={{ padding: '8px' }}>Coverage Score</td>
                              <td style={{ textAlign: 'right', padding: '8px' }}><strong>{m.team.coverage_score}/100</strong></td>
                            </tr>
                          </tbody>
                        </table>
                        <p style={{ marginTop: 16, color: '#888', fontSize: 12 }}>
                          <strong>Team Size:</strong> {settingsValues.team.analysts_count} analysts, {settingsValues.team.hunters_count} hunters
                        </p>
                      </div>
                    })}
                  >
                    <Row gutter={16}>
                      <Col span={8}>
                        <div className="team-metric">
                          <div className="team-value">{Math.round(m.summary.articles_processed / settingsValues.team.analysts_count)}</div>
                          <div className="team-label">Articles/Analyst</div>
                          <Text type="secondary" style={{ fontSize: 10 }}>({settingsValues.team.analysts_count} analysts)</Text>
                        </div>
                      </Col>
                      <Col span={8}>
                        <div className="team-metric">
                          <div className="team-value">{Math.round(m.summary.hunts_completed / settingsValues.team.hunters_count)}</div>
                          <div className="team-label">Hunts/Hunter</div>
                          <Text type="secondary" style={{ fontSize: 10 }}>({settingsValues.team.hunters_count} hunters)</Text>
                        </div>
                      </Col>
                      <Col span={8}>
                        <div className="team-metric">
                          <div className="team-value">{m.team.escalation_rate}%</div>
                          <div className="team-label">Escalation Rate</div>
                        </div>
                      </Col>
                    </Row>
                    <Divider style={{ margin: '12px 0' }} />
                    <Row gutter={16}>
                      <Col span={12}>
                        <Text strong>Quality Score</Text>
                        <Progress 
                          percent={m.team.quality_score}
                          strokeColor="#52c41a"
                          format={(p) => `${p}/100`}
                        />
                      </Col>
                      <Col span={12}>
                        <Text strong>Coverage Score</Text>
                        <Progress 
                          percent={m.team.coverage_score}
                          strokeColor="#1890ff"
                          format={(p) => `${p}/100`}
                        />
                      </Col>
                    </Row>
                  </Card>
                </Tooltip>
              </Col>
            </Row>

            {/* Distribution Charts - Clickable */}
            <Row gutter={16}>
              <Col span={12}>
                <Card 
                  title={<Space><BugOutlined /> IOCs by Type</Space>} 
                  size="small"
                  extra={
                    canAccessIntelligence && (
                      <Tooltip title="View all IOCs on Intelligence page">
                        <Button 
                          type="link" 
                          size="small"
                          onClick={() => window.location.href = '/intelligence?type=IOC'}
                        >
                          View All →
                        </Button>
                      </Tooltip>
                    )
                  }
                >
                  {Object.keys(m.trends.iocs_by_type).length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                      {Object.entries(m.trends.iocs_by_type)
                        .sort((a, b) => b[1] - a[1])  // Sort by count descending
                        .map(([type, count]) => {
                          const tagColor = 
                            type.toLowerCase().includes('ip') ? 'blue' :
                            type.toLowerCase().includes('domain') ? 'green' :
                            type.toLowerCase().includes('hash') || type.toLowerCase().includes('sha') || type.toLowerCase().includes('md5') ? 'purple' :
                            type.toLowerCase().includes('url') ? 'cyan' :
                            type.toLowerCase().includes('email') ? 'orange' :
                            'default';
                          
                          return (
                            <Tooltip 
                              key={type} 
                              title={canAccessIntelligence ? `Click to view ${count} ${type} IOCs` : `${count} ${type} IOCs`}
                            >
                              <Tag 
                                color={tagColor}
                                style={{ 
                                  margin: 0, 
                                  padding: '4px 10px', 
                                  cursor: canAccessIntelligence ? 'pointer' : 'default',
                                  fontSize: 12
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (canAccessIntelligence) {
                                    window.location.href = `/intelligence?type=IOC&ioc_type=${encodeURIComponent(type)}`;
                                  }
                                }}
                              >
                                <strong>{type}</strong>: {count}
                                {canAccessIntelligence && <span style={{ marginLeft: 4, opacity: 0.7 }}>→</span>}
                              </Tag>
                            </Tooltip>
                          );
                        })}
                    </div>
                  ) : (
                    <Empty description="No IOCs extracted in this period" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  )}
                  <div style={{ marginTop: 12, textAlign: 'center', borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
                    <Text strong style={{ fontSize: 18, color: '#1890ff' }}>{m.summary.iocs_extracted}</Text>
                    <Text type="secondary" style={{ marginLeft: 4, fontSize: 12 }}>Total IOCs</Text>
                  </div>
                </Card>
              </Col>
              <Col span={12}>
                <Tooltip title="Click for hunt platform breakdown details">
                  <Card 
                    title={<Space><ThunderboltOutlined /> Hunts by Platform</Space>} 
                    size="small"
                    hoverable
                    style={{ cursor: 'pointer' }}
                    extra={
                      <Space size={12}>
                        <Badge color="var(--success)" text={<Text style={{ fontSize: 11 }}>Successful</Text>} />
                        <Badge color="var(--danger)" text={<Text style={{ fontSize: 11 }}>Failed</Text>} />
                      </Space>
                    }
                    onClick={() => Modal.info({
                      title: 'Hunts by Platform - Details',
                      width: 700,
                      content: <div>
                        <p><strong>Definition:</strong> Distribution of threat hunts executed across SIEM/EDR platforms.</p>
                        <p style={{ marginBottom: 16 }}>
                          <strong>Total Hunts:</strong> {m.summary.hunts_total} | 
                          <span style={{ color: 'green', marginLeft: 8 }}>Completed: {m.summary.hunts_completed}</span> | 
                          <span style={{ color: 'red', marginLeft: 8 }}>Failed: {m.summary.hunts_failed}</span>
                        </p>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ borderBottom: '2px solid #f0f0f0' }}>
                              <th style={{ textAlign: 'left', padding: '8px' }}>Platform</th>
                              <th style={{ textAlign: 'right', padding: '8px' }}>Total</th>
                              <th style={{ textAlign: 'right', padding: '8px' }}>Completed</th>
                              <th style={{ textAlign: 'right', padding: '8px' }}>Failed</th>
                              <th style={{ textAlign: 'right', padding: '8px' }}>Success Rate</th>
                            </tr>
                          </thead>
                          <tbody>
                            {m.trends.hunts_by_platform_detailed ? (
                              Object.entries(m.trends.hunts_by_platform_detailed).map(([platform, data]) => {
                                const total = data.total || 0;
                                const completed = data.completed || 0;
                                const failed = data.failed || 0;
                                const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;
                                return (
                                  <tr key={platform} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                    <td style={{ padding: '8px' }}><strong>{platform}</strong></td>
                                    <td style={{ textAlign: 'right', padding: '8px' }}>{total}</td>
                                    <td style={{ textAlign: 'right', padding: '8px', color: 'green' }}>{completed}</td>
                                    <td style={{ textAlign: 'right', padding: '8px', color: failed > 0 ? 'red' : 'inherit' }}>{failed}</td>
                                    <td style={{ textAlign: 'right', padding: '8px' }}>{successRate}%</td>
                                  </tr>
                                );
                              })
                            ) : (
                              Object.entries(m.trends.hunts_by_platform).map(([platform, count]) => (
                                <tr key={platform} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                  <td style={{ padding: '8px' }}><strong>{platform}</strong></td>
                                  <td style={{ textAlign: 'right', padding: '8px' }}>{count}</td>
                                  <td style={{ textAlign: 'right', padding: '8px' }}>-</td>
                                  <td style={{ textAlign: 'right', padding: '8px' }}>-</td>
                                  <td style={{ textAlign: 'right', padding: '8px' }}>-</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                        <p style={{ marginTop: 16, color: '#888', fontSize: 12 }}>
                          <strong>Navigation:</strong> Go to Hunts page → Filter by platform to view hunt details
                        </p>
                      </div>
                    })}
                  >
                    {/* Use detailed platform data if available, fallback to simple counts */}
                    {m.trends.hunts_by_platform_detailed && Object.keys(m.trends.hunts_by_platform_detailed).length > 0 ? (
                      Object.entries(m.trends.hunts_by_platform_detailed).map(([platform, data]) => {
                        const total = data.total || 0;
                        const completed = data.completed || 0;
                        const failed = data.failed || 0;
                        const successPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
                        const failPercent = total > 0 ? Math.round((failed / total) * 100) : 0;
                        
                        return (
                          <div key={platform} style={{ marginBottom: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <Text strong style={{ fontSize: 13 }}>{platform}</Text>
                              <Space size={8}>
                                <Tag color="success" style={{ margin: 0, fontSize: 11 }}>
                                  <CheckCircleOutlined /> {completed}
                                </Tag>
                                <Tag color={failed > 0 ? 'error' : 'default'} style={{ margin: 0, fontSize: 11 }}>
                                  <CloseCircleOutlined /> {failed}
                                </Tag>
                                <Text type="secondary" style={{ fontSize: 11 }}>Total: {total}</Text>
                              </Space>
                            </div>
                            <Progress 
                              percent={successPercent + failPercent}
                              success={{ percent: successPercent, strokeColor: 'var(--success)' }}
                              strokeColor="var(--danger)"
                              size="small"
                              showInfo={false}
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                              <Text type="secondary" style={{ fontSize: 10 }}>
                                Success: {successPercent}%
                              </Text>
                              {failed > 0 && (
                                <Text type="danger" style={{ fontSize: 10 }}>
                                  Failed: {failPercent}%
                                </Text>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : Object.keys(m.trends.hunts_by_platform).length > 0 ? (
                      // Fallback to simple progress bars if detailed data not available
                      Object.entries(m.trends.hunts_by_platform).map(([platform, count]) => (
                        <div key={platform} style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                          <Text style={{ width: 100 }}>{platform}</Text>
                          <Progress 
                            percent={m.summary.hunts_total > 0 ? Math.round((count / m.summary.hunts_total) * 100) : 0} 
                            size="small"
                            strokeColor="#8B5CF6"
                            format={() => count}
                            style={{ flex: 1 }}
                          />
                        </div>
                      ))
                    ) : (
                      <Text type="secondary">No hunts executed in this period</Text>
                    )}
                  </Card>
                </Tooltip>
              </Col>
            </Row>
          </Space>
        </Tabs.TabPane>

        {/* HUNT OPERATIONS TAB */}
        <Tabs.TabPane 
          tab={<span><ThunderboltOutlined /> Hunt Operations</span>} 
          key="hunts"
        >
          {/* Platform Filter Buttons - Like Article Status Filters */}
          <Card size="small" style={{ marginBottom: 16 }} className="platform-filter-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text strong><FilterOutlined style={{ marginRight: 8 }} />Filter by Platform:</Text>
              {selectedPlatforms.length > 0 && selectedPlatforms.length < Object.keys(m.trends.hunts_by_platform_detailed || m.trends.hunts_by_platform || {}).length && (
                <Button 
                  size="small" 
                  type="text" 
                  danger 
                  onClick={() => setSelectedPlatforms([])}
                >
                  Clear Filter
                </Button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {Object.entries(m.trends.hunts_by_platform_detailed || m.trends.hunts_by_platform || {}).map(([platform, data]) => {
                const isSelected = selectedPlatforms.length === 0 || selectedPlatforms.includes(platform);
                const count = typeof data === 'object' ? data.total : data;
                const completed = typeof data === 'object' ? data.completed : 0;
                const failed = typeof data === 'object' ? data.failed : 0;
                
                return (
                  <Button
                    key={platform}
                    type={selectedPlatforms.includes(platform) ? 'primary' : 'default'}
                    style={{
                      borderColor: selectedPlatforms.includes(platform) ? 'var(--primary)' : undefined,
                      opacity: isSelected ? 1 : 0.5,
                    }}
                    onClick={() => {
                      if (selectedPlatforms.includes(platform)) {
                        setSelectedPlatforms(selectedPlatforms.filter(p => p !== platform));
                      } else {
                        setSelectedPlatforms([...selectedPlatforms, platform]);
                      }
                    }}
                  >
                    <Space>
                      <ThunderboltOutlined />
                      <span>{platform}</span>
                      <Badge 
                        count={count} 
                        showZero 
                        style={{ 
                          backgroundColor: selectedPlatforms.includes(platform) ? '#fff' : '#1890ff',
                          color: selectedPlatforms.includes(platform) ? '#1890ff' : '#fff'
                        }} 
                      />
                    </Space>
                  </Button>
                );
              })}
              {Object.keys(m.trends.hunts_by_platform_detailed || m.trends.hunts_by_platform || {}).length === 0 && (
                <Text type="secondary">No hunt data available for the selected period</Text>
              )}
            </div>
          </Card>

          <Card title={`Hunt Execution Summary ${selectedPlatforms.length > 0 ? `(${selectedPlatforms.join(', ')})` : '(All Platforms)'}`}>
            {(() => {
              // Calculate filtered stats based on selected platforms
              const platformData = m.trends.hunts_by_platform_detailed || {};
              const filteredPlatforms = selectedPlatforms.length > 0 
                ? Object.entries(platformData).filter(([p]) => selectedPlatforms.includes(p))
                : Object.entries(platformData);
              
              const filteredTotal = filteredPlatforms.reduce((sum, [_, d]) => sum + (d.total || 0), 0);
              const filteredCompleted = filteredPlatforms.reduce((sum, [_, d]) => sum + (d.completed || 0), 0);
              const filteredFailed = filteredPlatforms.reduce((sum, [_, d]) => sum + (d.failed || 0), 0);
              const filteredSuccessRate = filteredTotal > 0 ? ((filteredCompleted / filteredTotal) * 100).toFixed(1) : '0.0';
              
              return (
                <Row gutter={16} style={{ marginBottom: 24 }}>
                  <Col span={6}>
                    <Statistic 
                      title="Total Hunts" 
                      value={filteredTotal || m.summary.hunts_total}
                      prefix={<ThunderboltOutlined />}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic 
                      title="Completed" 
                      value={filteredCompleted || m.summary.hunts_completed}
                      valueStyle={{ color: 'var(--success)' }}
                      prefix={<CheckCircleOutlined />}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic 
                      title="Failed" 
                      value={filteredFailed || m.summary.hunts_failed}
                      valueStyle={{ color: 'var(--danger)' }}
                      prefix={<CloseCircleOutlined />}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic 
                      title="Success Rate" 
                      value={filteredSuccessRate}
                      suffix="%"
                      prefix={<TrophyOutlined />}
                    />
                  </Col>
                </Row>
              );
            })()}
            <Divider style={{ margin: '16px 0' }} />
            
            {/* Intel to Hunt Pipeline */}
            <Row gutter={16}>
              <Col span={12}>
                <Tooltip title="Click for pipeline details">
                  <Card 
                    size="small" 
                    title="Intel → Hunt Pipeline"
                    hoverable
                    style={{ cursor: 'pointer' }}
                    onClick={() => Modal.info({
                      title: 'Intelligence to Hunt Pipeline',
                      width: 600,
                      content: <div>
                        <p><strong>Definition:</strong> Tracks the flow from article ingestion to threat hunt execution.</p>
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
                          <tbody>
                            <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                              <td style={{ padding: '8px' }}>Articles Reviewed</td>
                              <td style={{ textAlign: 'right', padding: '8px' }}><strong>{m.summary.articles_processed}</strong></td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                              <td style={{ padding: '8px' }}>High Priority / Escalated</td>
                              <td style={{ textAlign: 'right', padding: '8px', color: 'orange' }}><strong>{m.summary.high_priority}</strong></td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                              <td style={{ padding: '8px' }}>Hunts Executed</td>
                              <td style={{ textAlign: 'right', padding: '8px', color: 'green' }}><strong>{m.summary.hunts_completed}</strong></td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                              <td style={{ padding: '8px' }}>Escalation Rate</td>
                              <td style={{ textAlign: 'right', padding: '8px' }}><strong>{m.team.escalation_rate}%</strong></td>
                            </tr>
                          </tbody>
                        </table>
                        <p style={{ marginTop: 16, color: '#888', fontSize: 12 }}>
                          <strong>Navigation:</strong> Go to Article Queue → Filter by status to see pipeline stages
                        </p>
                      </div>
                    })}
                  >
                    <Row gutter={16}>
                      <Col span={8}>
                        <Statistic 
                          title="Articles Reviewed" 
                          value={m.summary.articles_processed}
                          valueStyle={{ fontSize: 18 }}
                        />
                      </Col>
                      <Col span={8}>
                        <Statistic 
                          title="Escalated" 
                          value={m.summary.high_priority}
                          valueStyle={{ fontSize: 18, color: 'var(--warning)' }}
                        />
                      </Col>
                      <Col span={8}>
                        <Statistic 
                          title="Hunted" 
                          value={m.summary.hunts_completed}
                          valueStyle={{ fontSize: 18, color: 'var(--success)' }}
                        />
                      </Col>
                    </Row>
                    <Divider style={{ margin: '8px 0' }} />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Escalation Rate: <strong>{m.team.escalation_rate}%</strong> | 
                      Time to Hunt: <strong>~4.2 hours avg</strong>
                    </Text>
                  </Card>
                </Tooltip>
              </Col>
              <Col span={12}>
                <Tooltip title="Click for execution time details">
                  <Card 
                    size="small" 
                    title="Hunt Execution Time"
                    hoverable
                    style={{ cursor: 'pointer' }}
                    onClick={() => Modal.info({
                      title: 'Hunt Execution Time Details',
                      content: <div>
                        <p><strong>Definition:</strong> Time metrics for hunt query execution across platforms.</p>
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
                          <tbody>
                            <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                              <td style={{ padding: '8px' }}>Average Hunt Duration</td>
                              <td style={{ textAlign: 'right', padding: '8px' }}><strong>12.5 min</strong></td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                              <td style={{ padding: '8px' }}>Total Hunt Time (period)</td>
                              <td style={{ textAlign: 'right', padding: '8px' }}><strong>{Math.round(m.summary.hunts_completed * 12.5)} min</strong></td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                              <td style={{ padding: '8px' }}>Hunts Completed</td>
                              <td style={{ textAlign: 'right', padding: '8px' }}><strong>{m.summary.hunts_completed}</strong></td>
                            </tr>
                          </tbody>
                        </table>
                        <p style={{ marginTop: 16, color: '#888', fontSize: 12 }}>
                          <strong>Note:</strong> Execution time varies by platform and query complexity
                        </p>
                      </div>
                    })}
                  >
                    <Row gutter={16}>
                      <Col span={12}>
                        <Statistic 
                          title="Avg Hunt Duration" 
                          value="12.5"
                          suffix="min"
                          valueStyle={{ fontSize: 18 }}
                        />
                      </Col>
                      <Col span={12}>
                        <Statistic 
                          title="Total Hunt Time" 
                          value={Math.round(m.summary.hunts_completed * 12.5)}
                          suffix="min"
                          valueStyle={{ fontSize: 18 }}
                        />
                      </Col>
                    </Row>
                    <Divider style={{ margin: '8px 0' }} />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Automation saved: <strong>{Math.round(m.summary.hunts_completed * 45)} min</strong> vs manual
                    </Text>
                  </Card>
                </Tooltip>
              </Col>
            </Row>
            
          </Card>
        </Tabs.TabPane>

        {/* SLA METRICS TAB */}
        <Tabs.TabPane 
          tab={<span><ClockCircleOutlined /> SLA Metrics</span>} 
          key="sla"
        >
          <Card title="Service Level Agreement Compliance">
            <Alert 
              message={`Current SLA Compliance: ${formatPercentage(m.sla.sla_compliance_rate)}`}
              type={m.sla.sla_compliance_rate >= 95 ? 'success' : m.sla.sla_compliance_rate >= 90 ? 'warning' : 'error'}
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Row gutter={[24, 24]}>
              <Col span={8}>
                <Tooltip title="Click for MTTD details">
                  <Card 
                    size="small" 
                    title="Detection Time" 
                    className="sla-card"
                    hoverable
                    style={{ cursor: 'pointer' }}
                    onClick={() => Modal.info({
                      title: 'Mean Time to Detect (MTTD)',
                      content: <div>
                        <p><strong>Definition:</strong> Average time from when a threat indicator appears in an article to when it is detected and flagged.</p>
                        <p><strong>Current:</strong> {formatDuration(m.sla.mttd_hours)}</p>
                        <p><strong>Target SLA:</strong> Less than 4 hours</p>
                        <p><strong>Status:</strong> {m.sla.mttd_hours < 4 ? 'Meeting SLA' : 'Near or exceeding threshold'}</p>
                        <p style={{ marginTop: 16 }}><strong>How to improve:</strong></p>
                        <ul>
                          <li>Enable auto-processing on high-fidelity sources</li>
                          <li>Tune watchlist keywords for faster matching</li>
                          <li>Increase feed refresh frequency</li>
                        </ul>
                      </div>
                    })}
                  >
                    <div className="sla-big-value">{formatDuration(m.sla.mttd_hours)}</div>
                    <Text type="secondary">Mean Time to Detect</Text>
                    <Divider style={{ margin: '8px 0' }} />
                    <Text>Target: &lt; 4 hours</Text>
                    <br />
                    <Tag color={m.sla.mttd_hours < 4 ? 'success' : 'warning'}>
                      {m.sla.mttd_hours < 4 ? 'MEETING SLA' : 'NEAR THRESHOLD'}
                    </Tag>
                  </Card>
                </Tooltip>
              </Col>
              <Col span={8}>
                <Tooltip title="Click for MTTR details">
                  <Card 
                    size="small" 
                    title="Response Time" 
                    className="sla-card"
                    hoverable
                    style={{ cursor: 'pointer' }}
                    onClick={() => Modal.info({
                      title: 'Mean Time to Respond (MTTR)',
                      content: <div>
                        <p><strong>Definition:</strong> Average time from threat detection to having a hunt query executed or action taken.</p>
                        <p><strong>Current:</strong> {formatDuration(m.sla.mttr_hours)}</p>
                        <p><strong>Target SLA:</strong> Less than 8 hours</p>
                        <p><strong>Status:</strong> {m.sla.mttr_hours < 8 ? 'Meeting SLA' : 'Near or exceeding threshold'}</p>
                        <p style={{ marginTop: 16 }}><strong>How to improve:</strong></p>
                        <ul>
                          <li>Enable auto-hunt generation for high-priority articles</li>
                          <li>Configure connector integrations for faster execution</li>
                          <li>Assign dedicated hunters to review queue</li>
                        </ul>
                      </div>
                    })}
                  >
                    <div className="sla-big-value">{formatDuration(m.sla.mttr_hours)}</div>
                    <Text type="secondary">Mean Time to Respond</Text>
                    <Divider style={{ margin: '8px 0' }} />
                    <Text>Target: &lt; 8 hours</Text>
                    <br />
                    <Tag color={m.sla.mttr_hours < 8 ? 'success' : 'warning'}>
                      {m.sla.mttr_hours < 8 ? 'MEETING SLA' : 'NEAR THRESHOLD'}
                    </Tag>
                  </Card>
                </Tooltip>
              </Col>
              <Col span={8}>
                <Tooltip title="Click for SLA breach details">
                  <Card 
                    size="small" 
                    title="SLA Breaches" 
                    className={`sla-card ${m.sla.sla_breaches > 0 ? 'sla-breach' : ''}`}
                    hoverable
                    style={{ cursor: 'pointer' }}
                    onClick={() => Modal.info({
                      title: 'SLA Breaches',
                      content: <div>
                        <p><strong>Definition:</strong> Number of incidents where detection or response time exceeded SLA thresholds.</p>
                        <p><strong>Current:</strong> {m.sla.sla_breaches} breaches in selected period</p>
                        <p><strong>Target:</strong> 0 breaches</p>
                        <p><strong>Status:</strong> {m.sla.sla_breaches === 0 ? 'No breaches - excellent!' : 'Needs attention'}</p>
                        {m.sla.sla_breaches > 0 && (
                          <div style={{ marginTop: 16 }}>
                            <p><strong>Recommended actions:</strong></p>
                            <ul>
                              <li>Review articles that breached SLA</li>
                              <li>Identify bottlenecks in processing pipeline</li>
                              <li>Consider increasing automation</li>
                              <li>Review team capacity and assignment</li>
                            </ul>
                          </div>
                        )}
                      </div>
                    })}
                  >
                    <div className="sla-big-value" style={{ color: m.sla.sla_breaches > 0 ? 'var(--danger)' : 'var(--success)' }}>
                      {m.sla.sla_breaches}
                    </div>
                    <Text type="secondary">In selected period</Text>
                    <Divider style={{ margin: '8px 0' }} />
                    <Text>Target: 0</Text>
                    <br />
                    <Tag color={m.sla.sla_breaches === 0 ? 'success' : 'error'}>
                      {m.sla.sla_breaches === 0 ? 'NO BREACHES' : 'NEEDS ATTENTION'}
                    </Tag>
                  </Card>
                </Tooltip>
              </Col>
            </Row>
          </Card>
        </Tabs.TabPane>
      </Tabs>

      {/* Report Generation Modal */}
      <Modal
        title={<Space><DownloadOutlined /> Generate Report</Space>}
        open={reportModalVisible}
        onCancel={() => setReportModalVisible(false)}
        onOk={handleGenerateReport}
        confirmLoading={generatingReport}
        okText="Generate Report"
        width={800}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {/* Report Type Selection */}
          <div>
            <Text strong style={{ display: 'block', marginBottom: 12 }}>Report Type</Text>
            <Row gutter={[12, 12]}>
              {REPORT_TYPES.map(report => (
                <Col span={6} key={report.id}>
                  <Card 
                    size="small" 
                    hoverable
                    className={`report-type-card ${selectedReportType?.id === report.id ? 'report-type-selected' : ''}`}
                    onClick={() => setSelectedReportType(report)}
                    style={{ 
                      cursor: 'pointer', 
                      height: '100%',
                      minHeight: 100,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      border: selectedReportType?.id === report.id ? '2px solid var(--primary)' : '1px solid var(--border-color)'
                    }}
                    bodyStyle={{ padding: '12px', textAlign: 'center' }}
                  >
                    <div style={{ fontSize: 22, marginBottom: 6, color: selectedReportType?.id === report.id ? 'var(--primary)' : 'var(--text-secondary)' }}>
                      {report.icon}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4 }}>{report.name}</div>
                    <Text type="secondary" style={{ fontSize: 10, lineHeight: 1.2 }}>{report.description}</Text>
                    {report.category && (
                      <Tag 
                        style={{ marginTop: 6, fontSize: 9 }}
                        color={
                          report.category === 'executive' ? 'gold' :
                          report.category === 'ti' ? 'blue' :
                          report.category === 'th' ? 'purple' :
                          report.category === 'mitre' ? 'red' : 'default'
                        }
                      >
                        {report.category.toUpperCase()}
                      </Tag>
                    )}
                  </Card>
                </Col>
              ))}
            </Row>
          </div>

          {/* Output Format Selection */}
          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>Output Format</Text>
            <Row gutter={[12, 12]}>
              {OUTPUT_FORMATS.map(format => (
                <Col span={8} key={format.value}>
                  <Card
                    size="small"
                    hoverable
                    onClick={() => setOutputFormat(format.value)}
                    style={{
                      cursor: 'pointer',
                      border: outputFormat === format.value ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                      background: outputFormat === format.value ? 'var(--primary-bg)' : 'transparent'
                    }}
                    bodyStyle={{ padding: '10px', textAlign: 'center' }}
                  >
                    <Space>
                      {format.icon}
                      <span style={{ fontWeight: outputFormat === format.value ? 600 : 400 }}>{format.label}</span>
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
          </div>

          {/* MITRE-specific options */}
          {selectedReportType?.id === 'mitre_attack_mapping' && (
            <div style={{ background: 'var(--bg-secondary)', padding: 16, borderRadius: 8 }}>
              <Text strong style={{ display: 'block', marginBottom: 12, color: '#ff4d4f' }}>
                <AimOutlined /> MITRE ATT&CK Options
              </Text>
              
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Text style={{ display: 'block', marginBottom: 6, fontSize: 12 }}>Report Format</Text>
                  <Select
                    value={mitreFormat}
                    onChange={setMitreFormat}
                    style={{ width: '100%' }}
                    options={MITRE_FORMATS.map(f => ({
                      value: f.value,
                      label: (
                        <Space direction="vertical" size={0}>
                          <span>{f.label}</span>
                          <Text type="secondary" style={{ fontSize: 10 }}>{f.description}</Text>
                        </Space>
                      )
                    }))}
                  />
                </Col>
                <Col span={12}>
                  <Text style={{ display: 'block', marginBottom: 6, fontSize: 12 }}>Article Filter</Text>
                  <Select
                    value={articlesFilter}
                    onChange={setArticlesFilter}
                    style={{ width: '100%' }}
                    options={ARTICLE_FILTER_OPTIONS.map(f => ({
                      value: f.value,
                      label: f.label
                    }))}
                  />
                </Col>
              </Row>
              
              <div style={{ marginTop: 12 }}>
                <Checkbox
                  checked={includeHunts}
                  onChange={(e) => setIncludeHunts(e.target.checked)}
                >
                  Include hunt execution data in report
                </Checkbox>
              </div>
              
              <Alert
                message="MITRE ATT&CK Mapping"
                description={
                  <div>
                    <p style={{ marginBottom: 8 }}>Generates a comprehensive mapping of observed TTPs to the MITRE ATT&CK framework.</p>
                    <ul style={{ margin: 0, paddingLeft: 20, fontSize: 11 }}>
                      <li><strong>Heatmap:</strong> Visual grid showing tactic coverage with technique counts per tactic</li>
                      <li><strong>Tabular:</strong> Detailed list of all techniques with source articles and hunt data</li>
                    </ul>
                  </div>
                }
                type="info"
                showIcon
                style={{ marginTop: 12 }}
              />
            </div>
          )}

          {/* Custom metrics selection */}
          {selectedReportType?.id === 'custom_report' && (
            <div className="custom-metrics-section">
              <Text strong style={{ display: 'block', marginBottom: 12 }}>Select Metrics</Text>
              <div style={{ maxHeight: 280, overflowY: 'auto', paddingRight: 8 }}>
                {Object.entries(AVAILABLE_METRICS).map(([category, data]) => (
                  <div key={category} className="metrics-category" style={{ marginBottom: 16 }}>
                    <Text strong style={{ fontSize: 12, color: 'var(--primary)', display: 'block', marginBottom: 8 }}>
                      {data.label}
                    </Text>
                    <Row gutter={[8, 8]}>
                      {data.metrics.map(metric => (
                        <Col span={12} key={metric.id}>
                          <Checkbox
                            checked={selectedMetrics.includes(metric.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedMetrics([...selectedMetrics, metric.id]);
                              } else {
                                setSelectedMetrics(selectedMetrics.filter(id => id !== metric.id));
                              }
                            }}
                            style={{ width: '100%' }}
                          >
                            <span style={{ fontSize: 12 }}>{metric.name}</span>
                          </Checkbox>
                        </Col>
                      ))}
                    </Row>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Date Range */}
          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>Date Range</Text>
            <RangePicker 
              value={dateRange}
              onChange={setDateRange}
              style={{ width: '100%' }}
            />
          </div>

          {/* Hunt & Platform Filters for custom reports */}
          {selectedReportType?.id === 'custom_report' && (
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>Hunt & Platform Filters</Text>
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>
                    Status (leave empty for All)
                  </Text>
                  <Select 
                    mode="multiple"
                    placeholder="All Statuses"
                    allowClear
                    value={huntFilter.statuses}
                    onChange={(v) => setHuntFilter(prev => ({ ...prev, statuses: v }))}
                    style={{ width: '100%' }}
                    maxTagCount={2}
                    options={HUNT_STATUS_OPTIONS}
                  />
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>
                    Platforms (leave empty for All)
                  </Text>
                  <Select 
                    mode="multiple"
                    placeholder="All Platforms"
                    allowClear
                    value={huntFilter.platforms}
                    onChange={(v) => setHuntFilter(prev => ({ ...prev, platforms: v }))}
                    style={{ width: '100%' }}
                    maxTagCount={2}
                    options={PLATFORM_OPTIONS}
                  />
                </Col>
              </Row>
              <Space style={{ marginTop: 12 }}>
                <Button 
                  size="small" 
                  onClick={() => setHuntFilter({ 
                    statuses: HUNT_STATUS_OPTIONS.map(o => o.value), 
                    platforms: PLATFORM_OPTIONS.map(o => o.value) 
                  })}
                >
                  Select All
                </Button>
                <Button 
                  size="small" 
                  onClick={() => setHuntFilter({ statuses: [], platforms: [] })}
                >
                  Clear All
                </Button>
              </Space>
              <Alert
                message="Multi-Select Filters"
                description="Select multiple statuses and/or platforms to create reports covering specific combinations. Leave empty to include all."
                type="info"
                showIcon
                style={{ marginTop: 12 }}
              />
            </div>
          )}

          {/* Report type descriptions */}
          {selectedReportType && selectedReportType.id !== 'custom_report' && selectedReportType.id !== 'mitre_attack_mapping' && (
            <Alert
              message={`${selectedReportType.name} Report`}
              description={
                <div>
                  <p>{selectedReportType.description}</p>
                  <p style={{ marginTop: 8, marginBottom: 0 }}>
                    <strong>Included metrics:</strong> {selectedReportType.metrics.join(', ')}
                  </p>
                </div>
              }
              type="info"
              showIcon
            />
          )}
        </Space>
      </Modal>

      {/* Settings Edit Modal */}
      <Modal
        title={
          <Space>
            <SettingOutlined />
            {settingsType === 'team' && 'Team Performance Settings'}
            {settingsType === 'sla' && 'SLA Target Settings'}
            {settingsType === 'roi' && 'Automation & ROI Settings'}
          </Space>
        }
        open={settingsModalVisible}
        onCancel={() => setSettingsModalVisible(false)}
        footer={null}
        width={settingsType === 'roi' ? 680 : 480}
      >
        {settingsType === 'team' && (
          <Form
            layout="vertical"
            initialValues={settingsValues.team}
            onFinish={(values) => saveSettings('team', values)}
          >
            <Form.Item 
              name="analysts_count" 
              label="Number of TI Analysts"
              rules={[{ required: true, message: 'Required' }]}
            >
              <InputNumber min={1} max={100} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item 
              name="hunters_count" 
              label="Number of Threat Hunters"
              rules={[{ required: true, message: 'Required' }]}
            >
              <InputNumber min={1} max={100} style={{ width: '100%' }} />
            </Form.Item>
            <Alert 
              message="These values are used to calculate per-person metrics like articles/analyst and hunts/hunter."
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Form.Item>
              <Button type="primary" htmlType="submit" block>Save Settings</Button>
            </Form.Item>
          </Form>
        )}

        {settingsType === 'sla' && (
          <Form
            layout="vertical"
            initialValues={settingsValues.sla}
            onFinish={(values) => saveSettings('sla', values)}
          >
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item 
                  name="mttd_target_hours" 
                  label="MTTD Target (hours)"
                  rules={[{ required: true, message: 'Required' }]}
                >
                  <InputNumber min={0.5} max={48} step={0.5} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item 
                  name="mttr_target_hours" 
                  label="MTTR Target (hours)"
                  rules={[{ required: true, message: 'Required' }]}
                >
                  <InputNumber min={0.5} max={72} step={0.5} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item 
                  name="triage_target_minutes" 
                  label="Triage Target (minutes)"
                  rules={[{ required: true, message: 'Required' }]}
                >
                  <InputNumber min={1} max={120} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item 
                  name="escalation_target_hours" 
                  label="Escalation Target (hours)"
                  rules={[{ required: true, message: 'Required' }]}
                >
                  <InputNumber min={0.25} max={24} step={0.25} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
            <Alert 
              message="SLA targets are used to determine compliance status on the dashboard."
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Form.Item>
              <Button type="primary" htmlType="submit" block>Save SLA Targets</Button>
            </Form.Item>
          </Form>
        )}

        {settingsType === 'roi' && (
          <Form
            layout="vertical"
            initialValues={settingsValues.roi}
            onFinish={(values) => saveSettings('roi', values)}
          >
            <Alert
              message="These settings are used for team productivity calculations only."
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item 
                  name="hourly_rate" 
                  label="Analyst Hourly Rate ($)"
                  rules={[{ required: true, message: 'Required' }]}
                  tooltip="Average fully-loaded cost per hour for a security analyst"
                >
                  <InputNumber min={10} max={500} prefix="$" style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item 
                  name="time_per_article_minutes" 
                  label="Manual Time per Article (min)"
                  rules={[{ required: true, message: 'Required' }]}
                  tooltip="Estimated time to manually analyze one article without automation"
                >
                  <InputNumber min={5} max={180} addonAfter="min" style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
            
            <Form.Item style={{ marginTop: 16 }}>
              <Button type="primary" htmlType="submit" block>Save Settings</Button>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
}

export default AnalyticsDashboard;
