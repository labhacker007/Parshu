// Jyoti Theme Definitions - Research-Based Professional Themes
// Based on analysis of CrowdStrike, SentinelOne, Palo Alto, Fortinet, Trellix, CyberArk

export const themes = {
  // ============================================
  // THEME 1: COMMAND CENTER (Blue) - Default SOC
  // Inspired by: CrowdStrike, Palo Alto Networks
  // Primary: #0EA5E9 (Sky Blue)
  // For: Daily SOC operations, trust and clarity
  // ============================================
  'command-center': {
    id: 'command-center',
    name: 'Command Center',
    description: 'Professional blue theme for daily SOC operations',
    mode: 'dark',
    category: 'professional',
    colors: {
      // Primary Blues
      primary: '#0EA5E9',
      primaryRgb: '14, 165, 233',
      primaryHover: '#0284C7',
      primaryLight: 'rgba(14, 165, 233, 0.15)',
      primaryDark: '#0369A1',
      primaryGlow: 'rgba(14, 165, 233, 0.4)',
      
      // Secondary Accents
      secondary: '#14B8A6',
      secondaryRgb: '20, 184, 166',
      secondaryHover: '#0D9488',
      secondaryLight: 'rgba(20, 184, 166, 0.15)',
      secondaryGlow: 'rgba(20, 184, 166, 0.3)',
      
      // Background Hierarchy
      bgBody: '#0A0F1C',
      bgCard: '#111827',
      bgNavbar: '#0A0F1C',
      bgElevated: '#1F2937',
      bgOverlay: 'rgba(10, 15, 28, 0.85)',
      
      // Login Background Gradient
      loginBgGradient: 'radial-gradient(ellipse at 20% 20%, rgba(14, 165, 233, 0.15) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(59, 130, 246, 0.08) 0%, transparent 50%), #0A0F1C',
      loginAccentColor: '#0EA5E9',
      
      // Text Hierarchy
      textPrimary: '#F8FAFC',
      textSecondary: '#94A3B8',
      textMuted: '#64748B',
      textDisabled: '#475569',
      textInverse: '#0F172A',
      
      // Severity Colors (Industry Standard)
      critical: '#EF4444',
      criticalRgb: '239, 68, 68',
      criticalBg: 'rgba(239, 68, 68, 0.15)',
      criticalGlow: 'rgba(239, 68, 68, 0.4)',
      
      high: '#F97316',
      highRgb: '249, 115, 22',
      highBg: 'rgba(249, 115, 22, 0.15)',
      highGlow: 'rgba(249, 115, 22, 0.3)',
      
      medium: '#EAB308',
      mediumRgb: '234, 179, 8',
      mediumBg: 'rgba(234, 179, 8, 0.15)',
      mediumGlow: 'rgba(234, 179, 8, 0.3)',
      
      low: '#3B82F6',
      lowRgb: '59, 130, 246',
      lowBg: 'rgba(59, 130, 246, 0.15)',
      lowGlow: 'rgba(59, 130, 246, 0.3)',
      
      success: '#10B981',
      successRgb: '16, 185, 129',
      successBg: 'rgba(16, 185, 129, 0.15)',
      successGlow: 'rgba(16, 185, 129, 0.3)',
      
      warning: '#F59E0B',
      warningRgb: '245, 158, 11',
      warningBg: 'rgba(245, 158, 11, 0.15)',
      warningGlow: 'rgba(245, 158, 11, 0.3)',
      
      danger: '#EF4444',
      dangerRgb: '239, 68, 68',
      dangerBg: 'rgba(239, 68, 68, 0.15)',
      dangerGlow: 'rgba(239, 68, 68, 0.4)',
      
      info: '#06B6D4',
      infoRgb: '6, 182, 212',
      infoBg: 'rgba(6, 182, 212, 0.15)',
      infoGlow: 'rgba(6, 182, 212, 0.3)',
      
      // Border System
      borderSubtle: 'rgba(148, 163, 184, 0.1)',
      borderDefault: 'rgba(148, 163, 184, 0.2)',
      borderHover: 'rgba(14, 165, 233, 0.4)',
      borderFocus: '#0EA5E9',
      
      // Icons
      iconPrimary: '#0EA5E9',
      iconMuted: '#64748B',
      iconInverse: '#F8FAFC',
      
      // Navbar
      navText: '#F8FAFC',
      navIcon: '#0EA5E9',
      navHover: 'rgba(14, 165, 233, 0.15)',
      
      // Glassmorphism
      glassBg: 'rgba(17, 24, 39, 0.7)',
      glassBorder: 'rgba(14, 165, 233, 0.2)',
      glassHighlight: 'rgba(255, 255, 255, 0.05)',
      
      // Gradients
      gradientPrimary: 'linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%)',
      gradientCard: 'linear-gradient(180deg, rgba(17, 24, 39, 0.9) 0%, rgba(17, 24, 39, 0.7) 100%)',
      gradientGlow: 'radial-gradient(ellipse at 50% 0%, rgba(14, 165, 233, 0.15) 0%, transparent 50%)',
    },
    antd: {
      colorPrimary: '#0EA5E9',
      colorSuccess: '#10B981',
      colorWarning: '#F59E0B',
      colorError: '#EF4444',
      colorInfo: '#06B6D4',
      colorBgBase: '#0A0F1C',
      colorTextBase: '#F8FAFC',
      borderRadius: 8,
    },
  },

  // ============================================
  // THEME 2: RED ALERT (Crimson) - Incident Response
  // Inspired by: CrowdStrike's aggressive branding
  // Primary: #DC2626 (Crimson Red)
  // For: Crisis management, incident response
  // ============================================
  'red-alert': {
    id: 'red-alert',
    name: 'Red Alert',
    description: 'Aggressive red theme for incident response',
    mode: 'dark',
    category: 'cyber',
    colors: {
      // Primary Reds
      primary: '#DC2626',
      primaryRgb: '220, 38, 38',
      primaryHover: '#B91C1C',
      primaryLight: 'rgba(220, 38, 38, 0.15)',
      primaryDark: '#991B1B',
      primaryGlow: 'rgba(220, 38, 38, 0.5)',
      
      // Secondary Accents (Amber for contrast)
      secondary: '#F59E0B',
      secondaryRgb: '245, 158, 11',
      secondaryHover: '#D97706',
      secondaryLight: 'rgba(245, 158, 11, 0.15)',
      secondaryGlow: 'rgba(245, 158, 11, 0.3)',
      
      // Background Hierarchy (Warm dark)
      bgBody: '#0C0404',
      bgCard: '#1A0A0A',
      bgNavbar: '#0C0404',
      bgElevated: '#2A1515',
      bgOverlay: 'rgba(12, 4, 4, 0.9)',
      
      // Login Background - Aggressive red pulse
      loginBgGradient: 'radial-gradient(ellipse at 20% 20%, rgba(220, 38, 38, 0.2) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(245, 158, 11, 0.08) 0%, transparent 50%), #0C0404',
      loginAccentColor: '#DC2626',
      
      // Text Hierarchy
      textPrimary: '#FAFAFA',
      textSecondary: '#A3A3A3',
      textMuted: '#737373',
      textDisabled: '#525252',
      textInverse: '#0C0404',
      
      // Severity Colors (Enhanced for incident response)
      critical: '#FF0000',
      criticalRgb: '255, 0, 0',
      criticalBg: 'rgba(255, 0, 0, 0.2)',
      criticalGlow: 'rgba(255, 0, 0, 0.6)',
      
      high: '#FF4444',
      highRgb: '255, 68, 68',
      highBg: 'rgba(255, 68, 68, 0.2)',
      highGlow: 'rgba(255, 68, 68, 0.4)',
      
      medium: '#FF8800',
      mediumRgb: '255, 136, 0',
      mediumBg: 'rgba(255, 136, 0, 0.15)',
      mediumGlow: 'rgba(255, 136, 0, 0.3)',
      
      low: '#FFAA44',
      lowRgb: '255, 170, 68',
      lowBg: 'rgba(255, 170, 68, 0.15)',
      lowGlow: 'rgba(255, 170, 68, 0.3)',
      
      success: '#22C55E',
      successRgb: '34, 197, 94',
      successBg: 'rgba(34, 197, 94, 0.15)',
      successGlow: 'rgba(34, 197, 94, 0.3)',
      
      warning: '#F59E0B',
      warningRgb: '245, 158, 11',
      warningBg: 'rgba(245, 158, 11, 0.15)',
      warningGlow: 'rgba(245, 158, 11, 0.3)',
      
      danger: '#FF0000',
      dangerRgb: '255, 0, 0',
      dangerBg: 'rgba(255, 0, 0, 0.2)',
      dangerGlow: 'rgba(255, 0, 0, 0.6)',
      
      info: '#3B82F6',
      infoRgb: '59, 130, 246',
      infoBg: 'rgba(59, 130, 246, 0.15)',
      infoGlow: 'rgba(59, 130, 246, 0.3)',
      
      // Border System
      borderSubtle: 'rgba(163, 163, 163, 0.1)',
      borderDefault: 'rgba(163, 163, 163, 0.2)',
      borderHover: 'rgba(220, 38, 38, 0.5)',
      borderFocus: '#DC2626',
      
      // Icons
      iconPrimary: '#DC2626',
      iconMuted: '#737373',
      iconInverse: '#FAFAFA',
      
      // Navbar
      navText: '#FAFAFA',
      navIcon: '#DC2626',
      navHover: 'rgba(220, 38, 38, 0.15)',
      
      // Glassmorphism
      glassBg: 'rgba(26, 10, 10, 0.8)',
      glassBorder: 'rgba(220, 38, 38, 0.25)',
      glassHighlight: 'rgba(255, 255, 255, 0.03)',
      
      // Gradients
      gradientPrimary: 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)',
      gradientCard: 'linear-gradient(180deg, rgba(26, 10, 10, 0.95) 0%, rgba(26, 10, 10, 0.8) 100%)',
      gradientGlow: 'radial-gradient(ellipse at 50% 0%, rgba(220, 38, 38, 0.2) 0%, transparent 50%)',
    },
    antd: {
      colorPrimary: '#DC2626',
      colorSuccess: '#22C55E',
      colorWarning: '#F59E0B',
      colorError: '#FF0000',
      colorInfo: '#3B82F6',
      colorBgBase: '#0C0404',
      colorTextBase: '#FAFAFA',
      borderRadius: 8,
    },
  },

  // ============================================
  // THEME 3: AURORA (Purple) - Executive/Premium
  // Inspired by: Trellix, SentinelOne purple tones
  // Primary: #A855F7 (Purple)
  // For: Executive dashboards, premium feel
  // ============================================
  'aurora': {
    id: 'aurora',
    name: 'Aurora',
    description: 'Premium purple theme for executives',
    mode: 'dark',
    category: 'premium',
    colors: {
      // Primary Purples
      primary: '#A855F7',
      primaryRgb: '168, 85, 247',
      primaryHover: '#9333EA',
      primaryLight: 'rgba(168, 85, 247, 0.15)',
      primaryDark: '#7C3AED',
      primaryGlow: 'rgba(168, 85, 247, 0.4)',
      
      // Secondary Accents (Pink/Cyan)
      secondary: '#EC4899',
      secondaryRgb: '236, 72, 153',
      secondaryHover: '#DB2777',
      secondaryLight: 'rgba(236, 72, 153, 0.15)',
      secondaryGlow: 'rgba(236, 72, 153, 0.3)',
      
      // Background Hierarchy
      bgBody: '#0F0518',
      bgCard: '#1A0F2E',
      bgNavbar: '#0A0514',
      bgElevated: '#2A1B47',
      bgOverlay: 'rgba(15, 5, 24, 0.9)',
      
      // Login Background - Aurora effect
      loginBgGradient: 'radial-gradient(ellipse at 20% 20%, rgba(168, 85, 247, 0.18) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(236, 72, 153, 0.1) 0%, transparent 50%), #0F0518',
      loginAccentColor: '#A855F7',
      
      // Text Hierarchy
      textPrimary: '#F8FAFC',
      textSecondary: '#C4B5FD',
      textMuted: '#A78BFA',
      textDisabled: '#7C3AED',
      textInverse: '#0F0518',
      
      // Severity Colors
      critical: '#F43F5E',
      criticalRgb: '244, 63, 94',
      criticalBg: 'rgba(244, 63, 94, 0.15)',
      criticalGlow: 'rgba(244, 63, 94, 0.4)',
      
      high: '#F97316',
      highRgb: '249, 115, 22',
      highBg: 'rgba(249, 115, 22, 0.15)',
      highGlow: 'rgba(249, 115, 22, 0.3)',
      
      medium: '#EAB308',
      mediumRgb: '234, 179, 8',
      mediumBg: 'rgba(234, 179, 8, 0.15)',
      mediumGlow: 'rgba(234, 179, 8, 0.3)',
      
      low: '#06B6D4',
      lowRgb: '6, 182, 212',
      lowBg: 'rgba(6, 182, 212, 0.15)',
      lowGlow: 'rgba(6, 182, 212, 0.3)',
      
      success: '#22D3EE',
      successRgb: '34, 211, 238',
      successBg: 'rgba(34, 211, 238, 0.15)',
      successGlow: 'rgba(34, 211, 238, 0.3)',
      
      warning: '#F59E0B',
      warningRgb: '245, 158, 11',
      warningBg: 'rgba(245, 158, 11, 0.15)',
      warningGlow: 'rgba(245, 158, 11, 0.3)',
      
      danger: '#F43F5E',
      dangerRgb: '244, 63, 94',
      dangerBg: 'rgba(244, 63, 94, 0.15)',
      dangerGlow: 'rgba(244, 63, 94, 0.4)',
      
      info: '#A855F7',
      infoRgb: '168, 85, 247',
      infoBg: 'rgba(168, 85, 247, 0.15)',
      infoGlow: 'rgba(168, 85, 247, 0.3)',
      
      // Border System
      borderSubtle: 'rgba(196, 181, 253, 0.1)',
      borderDefault: 'rgba(196, 181, 253, 0.2)',
      borderHover: 'rgba(168, 85, 247, 0.4)',
      borderFocus: '#A855F7',
      
      // Icons
      iconPrimary: '#A855F7',
      iconMuted: '#A78BFA',
      iconInverse: '#F8FAFC',
      
      // Navbar
      navText: '#F8FAFC',
      navIcon: '#A855F7',
      navHover: 'rgba(168, 85, 247, 0.15)',
      
      // Glassmorphism
      glassBg: 'rgba(26, 15, 46, 0.8)',
      glassBorder: 'rgba(168, 85, 247, 0.25)',
      glassHighlight: 'rgba(255, 255, 255, 0.05)',
      
      // Gradients
      gradientPrimary: 'linear-gradient(135deg, #A855F7 0%, #EC4899 100%)',
      gradientCard: 'linear-gradient(180deg, rgba(26, 15, 46, 0.95) 0%, rgba(26, 15, 46, 0.8) 100%)',
      gradientGlow: 'radial-gradient(ellipse at 50% 0%, rgba(168, 85, 247, 0.2) 0%, transparent 50%)',
    },
    antd: {
      colorPrimary: '#A855F7',
      colorSuccess: '#22D3EE',
      colorWarning: '#F59E0B',
      colorError: '#F43F5E',
      colorInfo: '#A855F7',
      colorBgBase: '#0F0518',
      colorTextBase: '#F8FAFC',
      borderRadius: 12,
    },
  },

  // ============================================
  // THEME 4: DAYLIGHT (Light Blue) - Daytime Use
  // Inspired by: CyberArk, Okta light themes
  // Primary: #0369A1 (Sky Blue)
  // For: Daytime operations, presentations
  // ============================================
  'daylight': {
    id: 'daylight',
    name: 'Daylight',
    description: 'Clean light theme for daytime use',
    mode: 'light',
    category: 'professional',
    colors: {
      // Primary Blues
      primary: '#0369A1',
      primaryRgb: '3, 105, 161',
      primaryHover: '#0284C7',
      primaryLight: '#E0F2FE',
      primaryDark: '#075985',
      primaryGlow: 'rgba(3, 105, 161, 0.3)',
      
      // Secondary Accents
      secondary: '#0D9488',
      secondaryRgb: '13, 148, 136',
      secondaryHover: '#0F766E',
      secondaryLight: '#CCFBF1',
      secondaryGlow: 'rgba(13, 148, 136, 0.2)',
      
      // Background Hierarchy
      bgBody: '#F8FAFC',
      bgCard: '#FFFFFF',
      bgNavbar: '#F1F5F9',
      bgElevated: '#FFFFFF',
      bgOverlay: 'rgba(248, 250, 252, 0.95)',
      
      // Login Background - Clean light
      loginBgGradient: 'radial-gradient(ellipse at 20% 20%, rgba(3, 105, 161, 0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(14, 165, 233, 0.05) 0%, transparent 50%), #F8FAFC',
      loginAccentColor: '#0369A1',
      
      // Text Hierarchy
      textPrimary: '#0F172A',
      textSecondary: '#475569',
      textMuted: '#64748B',
      textDisabled: '#94A3B8',
      textInverse: '#FFFFFF',
      
      // Severity Colors
      critical: '#DC2626',
      criticalRgb: '220, 38, 38',
      criticalBg: '#FEE2E2',
      criticalGlow: 'rgba(220, 38, 38, 0.3)',
      
      high: '#EA580C',
      highRgb: '234, 88, 12',
      highBg: '#FFEDD5',
      highGlow: 'rgba(234, 88, 12, 0.25)',
      
      medium: '#CA8A04',
      mediumRgb: '202, 138, 4',
      mediumBg: '#FEF9C3',
      mediumGlow: 'rgba(202, 138, 4, 0.25)',
      
      low: '#2563EB',
      lowRgb: '37, 99, 235',
      lowBg: '#DBEAFE',
      lowGlow: 'rgba(37, 99, 235, 0.25)',
      
      success: '#059669',
      successRgb: '5, 150, 105',
      successBg: '#D1FAE5',
      successGlow: 'rgba(5, 150, 105, 0.2)',
      
      warning: '#D97706',
      warningRgb: '217, 119, 6',
      warningBg: '#FEF3C7',
      warningGlow: 'rgba(217, 119, 6, 0.2)',
      
      danger: '#DC2626',
      dangerRgb: '220, 38, 38',
      dangerBg: '#FEE2E2',
      dangerGlow: 'rgba(220, 38, 38, 0.3)',
      
      info: '#0284C7',
      infoRgb: '2, 132, 199',
      infoBg: '#E0F2FE',
      infoGlow: 'rgba(2, 132, 199, 0.2)',
      
      // Border System
      borderSubtle: 'rgba(148, 163, 184, 0.15)',
      borderDefault: '#E2E8F0',
      borderHover: 'rgba(3, 105, 161, 0.4)',
      borderFocus: '#0369A1',
      
      // Icons
      iconPrimary: '#0369A1',
      iconMuted: '#64748B',
      iconInverse: '#FFFFFF',
      
      // Navbar
      navText: '#0F172A',
      navIcon: '#0369A1',
      navHover: 'rgba(3, 105, 161, 0.1)',
      
      // Glassmorphism (subtle in light mode)
      glassBg: 'rgba(255, 255, 255, 0.8)',
      glassBorder: 'rgba(3, 105, 161, 0.15)',
      glassHighlight: 'rgba(255, 255, 255, 0.5)',
      
      // Gradients
      gradientPrimary: 'linear-gradient(135deg, #0369A1 0%, #0284C7 100%)',
      gradientCard: 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)',
      gradientGlow: 'radial-gradient(ellipse at 50% 0%, rgba(3, 105, 161, 0.1) 0%, transparent 50%)',
    },
    antd: {
      colorPrimary: '#0369A1',
      colorSuccess: '#059669',
      colorWarning: '#D97706',
      colorError: '#DC2626',
      colorInfo: '#0284C7',
      colorBgBase: '#F8FAFC',
      colorTextBase: '#0F172A',
      borderRadius: 8,
    },
  },

  // ============================================
  // THEME 5: MIDNIGHT (Deep Navy) - Fortinet Style
  // Inspired by: Fortinet, enterprise credibility
  // Primary: #3B82F6 (Blue)
  // For: Enterprise deployments
  // ============================================
  'midnight': {
    id: 'midnight',
    name: 'Midnight',
    description: 'Enterprise navy theme with gold accents',
    mode: 'dark',
    category: 'premium',
    colors: {
      // Primary
      primary: '#3B82F6',
      primaryRgb: '59, 130, 246',
      primaryHover: '#2563EB',
      primaryLight: 'rgba(59, 130, 246, 0.15)',
      primaryDark: '#1D4ED8',
      primaryGlow: 'rgba(59, 130, 246, 0.4)',
      
      // Secondary (Gold for enterprise credibility)
      secondary: '#EAB308',
      secondaryRgb: '234, 179, 8',
      secondaryHover: '#CA8A04',
      secondaryLight: 'rgba(234, 179, 8, 0.15)',
      secondaryGlow: 'rgba(234, 179, 8, 0.3)',
      
      // Background
      bgBody: '#020617',
      bgCard: '#0F172A',
      bgNavbar: '#020617',
      bgElevated: '#1E293B',
      bgOverlay: 'rgba(2, 6, 23, 0.9)',
      
      // Login Background - Deep enterprise
      loginBgGradient: 'radial-gradient(ellipse at 20% 20%, rgba(59, 130, 246, 0.12) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(234, 179, 8, 0.06) 0%, transparent 50%), #020617',
      loginAccentColor: '#3B82F6',
      
      // Text
      textPrimary: '#F8FAFC',
      textSecondary: '#94A3B8',
      textMuted: '#64748B',
      textDisabled: '#475569',
      textInverse: '#020617',
      
      // Severity
      critical: '#EF4444',
      criticalRgb: '239, 68, 68',
      criticalBg: 'rgba(239, 68, 68, 0.15)',
      criticalGlow: 'rgba(239, 68, 68, 0.4)',
      
      high: '#F97316',
      highRgb: '249, 115, 22',
      highBg: 'rgba(249, 115, 22, 0.15)',
      highGlow: 'rgba(249, 115, 22, 0.3)',
      
      medium: '#EAB308',
      mediumRgb: '234, 179, 8',
      mediumBg: 'rgba(234, 179, 8, 0.15)',
      mediumGlow: 'rgba(234, 179, 8, 0.3)',
      
      low: '#3B82F6',
      lowRgb: '59, 130, 246',
      lowBg: 'rgba(59, 130, 246, 0.15)',
      lowGlow: 'rgba(59, 130, 246, 0.3)',
      
      success: '#22C55E',
      successRgb: '34, 197, 94',
      successBg: 'rgba(34, 197, 94, 0.15)',
      successGlow: 'rgba(34, 197, 94, 0.3)',
      
      warning: '#EAB308',
      warningRgb: '234, 179, 8',
      warningBg: 'rgba(234, 179, 8, 0.15)',
      warningGlow: 'rgba(234, 179, 8, 0.3)',
      
      danger: '#EF4444',
      dangerRgb: '239, 68, 68',
      dangerBg: 'rgba(239, 68, 68, 0.15)',
      dangerGlow: 'rgba(239, 68, 68, 0.4)',
      
      info: '#3B82F6',
      infoRgb: '59, 130, 246',
      infoBg: 'rgba(59, 130, 246, 0.15)',
      infoGlow: 'rgba(59, 130, 246, 0.3)',
      
      // Border
      borderSubtle: 'rgba(148, 163, 184, 0.1)',
      borderDefault: 'rgba(148, 163, 184, 0.2)',
      borderHover: 'rgba(59, 130, 246, 0.4)',
      borderFocus: '#3B82F6',
      
      // Icons
      iconPrimary: '#3B82F6',
      iconMuted: '#64748B',
      iconInverse: '#F8FAFC',
      
      // Navbar
      navText: '#F8FAFC',
      navIcon: '#3B82F6',
      navHover: 'rgba(59, 130, 246, 0.15)',
      
      // Glassmorphism
      glassBg: 'rgba(15, 23, 42, 0.8)',
      glassBorder: 'rgba(59, 130, 246, 0.2)',
      glassHighlight: 'rgba(255, 255, 255, 0.05)',
      
      // Gradients
      gradientPrimary: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
      gradientCard: 'linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(15, 23, 42, 0.8) 100%)',
      gradientGlow: 'radial-gradient(ellipse at 50% 0%, rgba(59, 130, 246, 0.15) 0%, transparent 50%)',
    },
    antd: {
      colorPrimary: '#3B82F6',
      colorSuccess: '#22C55E',
      colorWarning: '#EAB308',
      colorError: '#EF4444',
      colorInfo: '#3B82F6',
      colorBgBase: '#020617',
      colorTextBase: '#F8FAFC',
      borderRadius: 8,
    },
  },

  // ============================================
  // THEME 6: MATRIX (Green) - Hacker Aesthetic
  // Inspired by: Darktrace, terminal interfaces
  // Primary: #00FF41 (Matrix Green)
  // For: Analysts, threat hunting
  // ============================================
  'matrix': {
    id: 'matrix',
    name: 'Matrix',
    description: 'Matrix green theme for threat hunting',
    mode: 'dark',
    category: 'cyber',
    colors: {
      // Primary Matrix Green
      primary: '#00FF41',
      primaryRgb: '0, 255, 65',
      primaryHover: '#00CC33',
      primaryLight: 'rgba(0, 255, 65, 0.15)',
      primaryDark: '#00AA2A',
      primaryGlow: 'rgba(0, 255, 65, 0.5)',
      
      // Secondary (Cyan)
      secondary: '#00F0FF',
      secondaryRgb: '0, 240, 255',
      secondaryHover: '#00D4E6',
      secondaryLight: 'rgba(0, 240, 255, 0.15)',
      secondaryGlow: 'rgba(0, 240, 255, 0.3)',
      
      // Background
      bgBody: '#050505',
      bgCard: '#0A0A0A',
      bgNavbar: '#000000',
      bgElevated: '#141414',
      bgOverlay: 'rgba(5, 5, 5, 0.95)',
      
      // Login Background - Matrix rain effect colors
      loginBgGradient: 'radial-gradient(ellipse at 20% 20%, rgba(0, 255, 65, 0.1) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(0, 240, 255, 0.05) 0%, transparent 50%), #050505',
      loginAccentColor: '#00FF41',
      
      // Text
      textPrimary: '#00FF41',
      textSecondary: '#33FF66',
      textMuted: '#00CC33',
      textDisabled: '#009922',
      textInverse: '#000000',
      
      // Severity
      critical: '#FF3333',
      criticalRgb: '255, 51, 51',
      criticalBg: 'rgba(255, 51, 51, 0.2)',
      criticalGlow: 'rgba(255, 51, 51, 0.5)',
      
      high: '#FF8800',
      highRgb: '255, 136, 0',
      highBg: 'rgba(255, 136, 0, 0.15)',
      highGlow: 'rgba(255, 136, 0, 0.4)',
      
      medium: '#FFFF00',
      mediumRgb: '255, 255, 0',
      mediumBg: 'rgba(255, 255, 0, 0.15)',
      mediumGlow: 'rgba(255, 255, 0, 0.3)',
      
      low: '#00AAFF',
      lowRgb: '0, 170, 255',
      lowBg: 'rgba(0, 170, 255, 0.15)',
      lowGlow: 'rgba(0, 170, 255, 0.3)',
      
      success: '#00FF41',
      successRgb: '0, 255, 65',
      successBg: 'rgba(0, 255, 65, 0.2)',
      successGlow: 'rgba(0, 255, 65, 0.4)',
      
      warning: '#FFD700',
      warningRgb: '255, 215, 0',
      warningBg: 'rgba(255, 215, 0, 0.15)',
      warningGlow: 'rgba(255, 215, 0, 0.3)',
      
      danger: '#FF3333',
      dangerRgb: '255, 51, 51',
      dangerBg: 'rgba(255, 51, 51, 0.2)',
      dangerGlow: 'rgba(255, 51, 51, 0.5)',
      
      info: '#00F0FF',
      infoRgb: '0, 240, 255',
      infoBg: 'rgba(0, 240, 255, 0.15)',
      infoGlow: 'rgba(0, 240, 255, 0.3)',
      
      // Border
      borderSubtle: 'rgba(0, 255, 65, 0.1)',
      borderDefault: 'rgba(0, 255, 65, 0.2)',
      borderHover: 'rgba(0, 255, 65, 0.4)',
      borderFocus: '#00FF41',
      
      // Icons
      iconPrimary: '#00FF41',
      iconMuted: '#00CC33',
      iconInverse: '#000000',
      
      // Navbar
      navText: '#00FF41',
      navIcon: '#00FF41',
      navHover: 'rgba(0, 255, 65, 0.15)',
      
      // Glassmorphism
      glassBg: 'rgba(10, 10, 10, 0.9)',
      glassBorder: 'rgba(0, 255, 65, 0.2)',
      glassHighlight: 'rgba(0, 255, 65, 0.05)',
      
      // Gradients
      gradientPrimary: 'linear-gradient(135deg, #00FF41 0%, #00CC33 100%)',
      gradientCard: 'linear-gradient(180deg, rgba(10, 10, 10, 0.95) 0%, rgba(10, 10, 10, 0.9) 100%)',
      gradientGlow: 'radial-gradient(ellipse at 50% 0%, rgba(0, 255, 65, 0.15) 0%, transparent 50%)',
    },
    antd: {
      colorPrimary: '#00FF41',
      colorSuccess: '#00FF41',
      colorWarning: '#FFD700',
      colorError: '#FF3333',
      colorInfo: '#00F0FF',
      colorBgBase: '#050505',
      colorTextBase: '#00FF41',
      borderRadius: 4,
    },
  },
};

// ============================================
// TERMINAL MODE OVERLAY - Green Hacker Aesthetic
// ============================================
export const terminalModeOverlay = {
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', monospace",
  textShadow: '0 0 5px currentColor',
  scanlineOpacity: 0.03,
  glowIntensity: 0.5,
  
  colors: {
    primary: '#00FF41',
    primaryRgb: '0, 255, 65',
    primaryHover: '#00CC33',
    primaryLight: 'rgba(0, 255, 65, 0.1)',
    primaryDark: '#00AA2A',
    primaryGlow: 'rgba(0, 255, 65, 0.5)',
    
    secondary: '#00CC33',
    secondaryRgb: '0, 204, 51',
    secondaryGlow: 'rgba(0, 204, 51, 0.3)',
    
    bgBody: '#0A0A0A',
    bgCard: '#111111',
    bgNavbar: '#050505',
    bgElevated: '#1A1A1A',
    
    textPrimary: '#00FF41',
    textSecondary: '#33FF66',
    textMuted: '#00CC33',
    textInverse: '#0A0A0A',
    
    critical: '#FF3333',
    criticalRgb: '255, 51, 51',
    criticalGlow: 'rgba(255, 51, 51, 0.5)',
    
    high: '#FFAA00',
    highRgb: '255, 170, 0',
    highGlow: 'rgba(255, 170, 0, 0.4)',
    
    medium: '#FFFF00',
    mediumRgb: '255, 255, 0',
    mediumGlow: 'rgba(255, 255, 0, 0.3)',
    
    low: '#00AAFF',
    lowRgb: '0, 170, 255',
    lowGlow: 'rgba(0, 170, 255, 0.3)',
    
    success: '#00FF41',
    successRgb: '0, 255, 65',
    successGlow: 'rgba(0, 255, 65, 0.4)',
    
    warning: '#FFD700',
    warningRgb: '255, 215, 0',
    warningGlow: 'rgba(255, 215, 0, 0.3)',
    
    danger: '#FF3333',
    dangerRgb: '255, 51, 51',
    dangerGlow: 'rgba(255, 51, 51, 0.5)',
    
    info: '#00BFFF',
    infoRgb: '0, 191, 255',
    infoGlow: 'rgba(0, 191, 255, 0.3)',
    
    borderSubtle: 'rgba(0, 255, 65, 0.1)',
    borderDefault: 'rgba(0, 255, 65, 0.2)',
    borderHover: 'rgba(0, 255, 65, 0.4)',
    borderFocus: '#00FF41',
    
    iconPrimary: '#00FF41',
    iconMuted: '#00CC33',
    
    navText: '#00FF41',
    navIcon: '#00FF41',
    navHover: 'rgba(0, 255, 65, 0.15)',
    
    glassBg: 'rgba(17, 17, 17, 0.9)',
    glassBorder: 'rgba(0, 255, 65, 0.2)',
  },
};

// ============================================
// NEON MODE OVERLAY - Cyan Futuristic
// ============================================
export const neonModeOverlay = {
  fontFamily: "'Orbitron', 'Rajdhani', 'Share Tech Mono', sans-serif",
  textShadow: '0 0 8px currentColor, 0 0 16px currentColor',
  glowIntensity: 0.7,
  
  colors: {
    primary: '#00F0FF',
    primaryRgb: '0, 240, 255',
    primaryHover: '#00D4E6',
    primaryLight: 'rgba(0, 240, 255, 0.1)',
    primaryDark: '#00A8B5',
    primaryGlow: 'rgba(0, 240, 255, 0.6)',
    
    secondary: '#FF00FF',
    secondaryRgb: '255, 0, 255',
    secondaryGlow: 'rgba(255, 0, 255, 0.4)',
    
    bgBody: '#050510',
    bgCard: '#0A0A1F',
    bgNavbar: '#000005',
    bgElevated: '#15152A',
    
    textPrimary: '#FFFFFF',
    textSecondary: '#00F0FF',
    textMuted: '#00A8B5',
    textInverse: '#050510',
    
    critical: '#FF0080',
    criticalRgb: '255, 0, 128',
    criticalGlow: 'rgba(255, 0, 128, 0.6)',
    
    high: '#FF6B00',
    highRgb: '255, 107, 0',
    highGlow: 'rgba(255, 107, 0, 0.5)',
    
    medium: '#FFFF00',
    mediumRgb: '255, 255, 0',
    mediumGlow: 'rgba(255, 255, 0, 0.4)',
    
    low: '#00F0FF',
    lowRgb: '0, 240, 255',
    lowGlow: 'rgba(0, 240, 255, 0.4)',
    
    success: '#39FF14',
    successRgb: '57, 255, 20',
    successGlow: 'rgba(57, 255, 20, 0.4)',
    
    warning: '#FF6B00',
    warningRgb: '255, 107, 0',
    warningGlow: 'rgba(255, 107, 0, 0.4)',
    
    danger: '#FF0080',
    dangerRgb: '255, 0, 128',
    dangerGlow: 'rgba(255, 0, 128, 0.6)',
    
    info: '#00F0FF',
    infoRgb: '0, 240, 255',
    infoGlow: 'rgba(0, 240, 255, 0.4)',
    
    borderSubtle: 'rgba(0, 240, 255, 0.1)',
    borderDefault: 'rgba(0, 240, 255, 0.2)',
    borderHover: 'rgba(0, 240, 255, 0.5)',
    borderFocus: '#00F0FF',
    
    iconPrimary: '#00F0FF',
    iconMuted: '#00A8B5',
    
    navText: '#FFFFFF',
    navIcon: '#00F0FF',
    navHover: 'rgba(0, 240, 255, 0.2)',
    
    glassBg: 'rgba(10, 10, 31, 0.9)',
    glassBorder: 'rgba(0, 240, 255, 0.25)',
  },
};

// Helper functions
export const getTheme = (themeId) => {
  return themes[themeId] || themes['command-center'];
};

export const getThemeList = () => {
  return Object.values(themes);
};

export const getThemesByMode = (mode) => {
  return Object.values(themes).filter(t => t.mode === mode);
};

export const getThemesByCategory = (category) => {
  return Object.values(themes).filter(t => t.category === category);
};

export const applyTerminalMode = (theme) => {
  return {
    ...theme,
    id: `${theme.id}-terminal`,
    name: `${theme.name} (Terminal)`,
    isTerminalMode: true,
    mode: 'dark',
    colors: {
      ...theme.colors,
      ...terminalModeOverlay.colors,
    },
    terminalOverlay: terminalModeOverlay,
  };
};

export const applyNeonMode = (theme) => {
  return {
    ...theme,
    id: `${theme.id}-neon`,
    name: `${theme.name} (Neon)`,
    isNeonMode: true,
    mode: 'dark',
    colors: {
      ...theme.colors,
      ...neonModeOverlay.colors,
    },
    neonOverlay: neonModeOverlay,
  };
};

export const DEFAULT_THEME = 'command-center';
