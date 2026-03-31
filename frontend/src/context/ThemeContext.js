import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  themes, DEFAULT_THEME, getTheme, 
  applyTerminalMode, applyNeonMode, 
  terminalModeOverlay, neonModeOverlay 
} from '../styles/themes';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Font size scale options
const FONT_SIZES = {
  small: { label: 'Small', scale: 0.9 },
  default: { label: 'Default', scale: 1.0 },
  large: { label: 'Large', scale: 1.1 },
  xlarge: { label: 'Extra Large', scale: 1.2 },
};

export const ThemeProvider = ({ children }) => {
  const [currentThemeId, setCurrentThemeId] = useState(() => {
    const saved = localStorage.getItem('jyoti-theme');
    // Map old theme IDs to new ones if needed
    const themeMap = {
      'arctic-blue': 'command-center',
      'arctic-blue-dark': 'command-center',
      'cyber-teal': 'command-center',
      'cyber-teal-dark': 'command-center',
      'midnight-violet': 'aurora',
      'violet-dawn': 'aurora',
      'obsidian-crimson': 'red-alert',
      'nord-aurora': 'daylight',
    };
    const mappedTheme = themeMap[saved] || saved;
    return themes[mappedTheme] ? mappedTheme : DEFAULT_THEME;
  });

  const [terminalMode, setTerminalMode] = useState(() => {
    return localStorage.getItem('jyoti-terminal-mode') === 'true';
  });

  const [neonMode, setNeonMode] = useState(() => {
    return localStorage.getItem('jyoti-neon-mode') === 'true';
  });
  
  const [fontSizePreference, setFontSizePreference] = useState(() => {
    const saved = localStorage.getItem('jyoti-font-size');
    return saved && FONT_SIZES[saved] ? saved : 'default';
  });

  // Get base theme and apply special modes if enabled
  const baseTheme = getTheme(currentThemeId);
  let currentTheme = baseTheme;
  
  if (terminalMode) {
    currentTheme = applyTerminalMode(baseTheme);
  } else if (neonMode) {
    currentTheme = applyNeonMode(baseTheme);
  }

  // Apply CSS variables when theme changes
  useEffect(() => {
    const root = document.documentElement;
    const colors = currentTheme.colors;

    // ============================================
    // PRIMARY COLORS
    // ============================================
    root.style.setProperty('--primary', colors.primary);
    root.style.setProperty('--primary-rgb', colors.primaryRgb);
    root.style.setProperty('--primary-hover', colors.primaryHover);
    root.style.setProperty('--primary-light', colors.primaryLight);
    root.style.setProperty('--primary-dark', colors.primaryDark);
    root.style.setProperty('--primary-glow', colors.primaryGlow || colors.primary);

    // ============================================
    // SECONDARY COLORS
    // ============================================
    root.style.setProperty('--secondary', colors.secondary);
    root.style.setProperty('--secondary-rgb', colors.secondaryRgb);
    root.style.setProperty('--secondary-hover', colors.secondaryHover);
    root.style.setProperty('--secondary-light', colors.secondaryLight);
    root.style.setProperty('--secondary-glow', colors.secondaryGlow || colors.secondary);

    // ============================================
    // BACKGROUND HIERARCHY
    // ============================================
    root.style.setProperty('--bg-body', colors.bgBody);
    root.style.setProperty('--bg-card', colors.bgCard);
    root.style.setProperty('--bg-navbar', colors.bgNavbar);
    root.style.setProperty('--bg-elevated', colors.bgElevated);
    root.style.setProperty('--bg-overlay', colors.bgOverlay);

    // ============================================
    // TEXT HIERARCHY
    // ============================================
    root.style.setProperty('--text-primary', colors.textPrimary);
    root.style.setProperty('--text-secondary', colors.textSecondary);
    root.style.setProperty('--text-muted', colors.textMuted);
    root.style.setProperty('--text-disabled', colors.textDisabled);
    root.style.setProperty('--text-inverse', colors.textInverse);

    // ============================================
    // SEVERITY COLORS (Industry Standard)
    // ============================================
    root.style.setProperty('--critical', colors.critical);
    root.style.setProperty('--critical-rgb', colors.criticalRgb);
    root.style.setProperty('--critical-bg', colors.criticalBg);
    root.style.setProperty('--critical-glow', colors.criticalGlow);

    root.style.setProperty('--high', colors.high);
    root.style.setProperty('--high-rgb', colors.highRgb);
    root.style.setProperty('--high-bg', colors.highBg);
    root.style.setProperty('--high-glow', colors.highGlow);

    root.style.setProperty('--medium', colors.medium);
    root.style.setProperty('--medium-rgb', colors.mediumRgb);
    root.style.setProperty('--medium-bg', colors.mediumBg);
    root.style.setProperty('--medium-glow', colors.mediumGlow);

    root.style.setProperty('--low', colors.low);
    root.style.setProperty('--low-rgb', colors.lowRgb);
    root.style.setProperty('--low-bg', colors.lowBg);
    root.style.setProperty('--low-glow', colors.lowGlow);

    // ============================================
    // SEMANTIC COLORS
    // ============================================
    root.style.setProperty('--success', colors.success);
    root.style.setProperty('--success-rgb', colors.successRgb);
    root.style.setProperty('--success-bg', colors.successBg);
    root.style.setProperty('--success-glow', colors.successGlow);

    root.style.setProperty('--warning', colors.warning);
    root.style.setProperty('--warning-rgb', colors.warningRgb);
    root.style.setProperty('--warning-bg', colors.warningBg);
    root.style.setProperty('--warning-glow', colors.warningGlow);

    root.style.setProperty('--danger', colors.danger);
    root.style.setProperty('--danger-rgb', colors.dangerRgb);
    root.style.setProperty('--danger-bg', colors.dangerBg);
    root.style.setProperty('--danger-glow', colors.dangerGlow);

    root.style.setProperty('--info', colors.info);
    root.style.setProperty('--info-rgb', colors.infoRgb);
    root.style.setProperty('--info-bg', colors.infoBg);
    root.style.setProperty('--info-glow', colors.infoGlow);

    // ============================================
    // BORDER SYSTEM
    // ============================================
    root.style.setProperty('--border-subtle', colors.borderSubtle);
    root.style.setProperty('--border-default', colors.borderDefault);
    root.style.setProperty('--border-hover', colors.borderHover);
    root.style.setProperty('--border-focus', colors.borderFocus);

    // ============================================
    // ICON COLORS
    // ============================================
    root.style.setProperty('--icon-primary', colors.iconPrimary);
    root.style.setProperty('--icon-muted', colors.iconMuted);
    root.style.setProperty('--icon-inverse', colors.iconInverse);

    // ============================================
    // NAVBAR COLORS
    // ============================================
    root.style.setProperty('--nav-text', colors.navText);
    root.style.setProperty('--nav-icon', colors.navIcon);
    root.style.setProperty('--nav-hover', colors.navHover);

    // ============================================
    // GLASSMORPHISM
    // ============================================
    root.style.setProperty('--glass-bg', colors.glassBg);
    root.style.setProperty('--glass-border', colors.glassBorder);
    root.style.setProperty('--glass-highlight', colors.glassHighlight);

    // ============================================
    // GRADIENTS
    // ============================================
    root.style.setProperty('--gradient-primary', colors.gradientPrimary);
    root.style.setProperty('--gradient-card', colors.gradientCard);
    root.style.setProperty('--gradient-glow', colors.gradientGlow);

    // ============================================
    // LOGIN PAGE SPECIFIC
    // ============================================
    root.style.setProperty('--login-bg-gradient', colors.loginBgGradient);
    root.style.setProperty('--login-accent-color', colors.loginAccentColor || colors.primary);

    // ============================================
    // THEME MODE CLASSES (with backward compatibility)
    // ============================================
    document.body.classList.remove(
      'theme-light', 'theme-dark', 
      'terminal-mode', 'neon-mode',
      'hacker-mode', 'cyber-mode'  // Legacy class names
    );
    document.body.classList.add(`theme-${currentTheme.mode}`);
    
    if (terminalMode) {
      document.body.classList.add('terminal-mode', 'hacker-mode');  // Both for compatibility
      root.style.setProperty('--terminal-font', terminalModeOverlay.fontFamily);
      root.style.setProperty('--terminal-glow', `0 0 10px ${colors.primary}`);
      root.style.setProperty('--hacker-font', terminalModeOverlay.fontFamily);  // Legacy
      root.style.setProperty('--hacker-glow', `0 0 10px ${colors.primary}`);  // Legacy
      root.style.setProperty('--scanline-opacity', terminalModeOverlay.scanlineOpacity.toString());
    } else if (neonMode) {
      document.body.classList.add('neon-mode', 'cyber-mode');  // Both for compatibility
      root.style.setProperty('--neon-font', neonModeOverlay.fontFamily);
      root.style.setProperty('--neon-glow', `0 0 15px ${colors.primary}`);
      root.style.setProperty('--cyber-font', neonModeOverlay.fontFamily);  // Legacy
      root.style.setProperty('--cyber-glow', `0 0 15px ${colors.primary}`);  // Legacy
    } else {
      root.style.setProperty('--terminal-font', 'inherit');
      root.style.setProperty('--terminal-glow', 'none');
      root.style.setProperty('--neon-font', 'inherit');
      root.style.setProperty('--neon-glow', 'none');
      root.style.setProperty('--hacker-font', 'inherit');  // Legacy
      root.style.setProperty('--hacker-glow', 'none');  // Legacy
      root.style.setProperty('--cyber-font', 'inherit');  // Legacy
      root.style.setProperty('--cyber-glow', 'none');  // Legacy
      root.style.setProperty('--scanline-opacity', '0');
    }
    
    document.body.setAttribute('data-theme', currentThemeId);
    document.body.setAttribute('data-terminal', terminalMode ? 'true' : 'false');
    document.body.setAttribute('data-neon', neonMode ? 'true' : 'false');
    document.body.setAttribute('data-hacker', terminalMode ? 'true' : 'false');  // Legacy
    document.body.setAttribute('data-cyber', neonMode ? 'true' : 'false');  // Legacy
    
    // ============================================
    // FONT SIZE SCALING
    // ============================================
    const fontScale = FONT_SIZES[fontSizePreference]?.scale || 1.0;
    root.style.setProperty('--font-scale', fontScale.toString());
    root.style.setProperty('--font-size-xs', `${Math.round(12 * fontScale)}px`);
    root.style.setProperty('--font-size-sm', `${Math.round(13 * fontScale)}px`);
    root.style.setProperty('--font-size-base', `${Math.round(14 * fontScale)}px`);
    root.style.setProperty('--font-size-md', `${Math.round(15 * fontScale)}px`);
    root.style.setProperty('--font-size-lg', `${Math.round(17 * fontScale)}px`);
    root.style.setProperty('--font-size-xl', `${Math.round(22 * fontScale)}px`);
    root.style.setProperty('--font-size-2xl', `${Math.round(28 * fontScale)}px`);
    document.body.setAttribute('data-font-size', fontSizePreference);

    // ============================================
    // SAVE TO LOCALSTORAGE
    // ============================================
    localStorage.setItem('jyoti-theme', currentThemeId);
    localStorage.setItem('jyoti-terminal-mode', terminalMode.toString());
    localStorage.setItem('jyoti-neon-mode', neonMode.toString());
    localStorage.setItem('jyoti-font-size', fontSizePreference);
  }, [currentThemeId, currentTheme, terminalMode, neonMode, fontSizePreference]);

  const setTheme = (themeId) => {
    if (themes[themeId]) {
      setCurrentThemeId(themeId);
    }
  };

  const toggleTerminalMode = () => {
    if (!terminalMode) {
      setNeonMode(false); // Disable neon mode when enabling terminal mode
    }
    setTerminalMode(prev => !prev);
  };

  const toggleNeonMode = () => {
    if (!neonMode) {
      setTerminalMode(false); // Disable terminal mode when enabling neon mode
    }
    setNeonMode(prev => !prev);
  };

  const setFontSize = (size) => {
    if (FONT_SIZES[size]) {
      setFontSizePreference(size);
    }
  };

  const value = {
    currentTheme,
    currentThemeId,
    setTheme,
    themes: Object.values(themes),
    isDark: currentTheme.mode === 'dark' || terminalMode || neonMode,
    terminalMode,
    neonMode,
    toggleTerminalMode,
    toggleNeonMode,
    setTerminalMode,
    setNeonMode,
    // Font size preferences
    fontSizePreference,
    setFontSize,
    fontSizeOptions: FONT_SIZES,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;
