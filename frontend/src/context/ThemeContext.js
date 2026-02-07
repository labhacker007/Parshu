import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  themes, DEFAULT_THEME, getTheme, 
  applyHackerMode, applyCyberMode, 
  hackerModeOverlay, cyberModeOverlay 
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
    const saved = localStorage.getItem('huntsphere-theme');
    return saved && themes[saved] ? saved : DEFAULT_THEME;
  });

  const [hackerMode, setHackerMode] = useState(() => {
    return localStorage.getItem('huntsphere-hacker-mode') === 'true';
  });

  const [cyberMode, setCyberMode] = useState(() => {
    return localStorage.getItem('huntsphere-cyber-mode') === 'true';
  });
  
  const [fontSizePreference, setFontSizePreference] = useState(() => {
    const saved = localStorage.getItem('huntsphere-font-size');
    return saved && FONT_SIZES[saved] ? saved : 'default';
  });

  // Get base theme and apply special modes if enabled
  const baseTheme = getTheme(currentThemeId);
  let currentTheme = baseTheme;
  
  if (hackerMode) {
    currentTheme = applyHackerMode(baseTheme);
  } else if (cyberMode) {
    currentTheme = applyCyberMode(baseTheme);
  }

  // Apply CSS variables when theme changes
  useEffect(() => {
    const root = document.documentElement;
    const colors = currentTheme.colors;

    // Set CSS variables
    root.style.setProperty('--primary', colors.primary);
    root.style.setProperty('--primary-rgb', colors.primaryRgb);
    root.style.setProperty('--primary-hover', colors.primaryHover);
    root.style.setProperty('--primary-light', colors.primaryLight);
    root.style.setProperty('--primary-dark', colors.primaryDark);
    root.style.setProperty('--bg-body', colors.bgBody);
    root.style.setProperty('--bg-card', colors.bgCard);
    root.style.setProperty('--bg-navbar', colors.bgNavbar);
    root.style.setProperty('--bg-elevated', colors.bgElevated);
    root.style.setProperty('--text-primary', colors.textPrimary);
    root.style.setProperty('--text-secondary', colors.textSecondary);
    root.style.setProperty('--text-muted', colors.textMuted);
    root.style.setProperty('--text-inverse', colors.textInverse);
    root.style.setProperty('--success', colors.success);
    root.style.setProperty('--success-bg', colors.successBg);
    root.style.setProperty('--warning', colors.warning);
    root.style.setProperty('--warning-bg', colors.warningBg);
    root.style.setProperty('--danger', colors.danger);
    root.style.setProperty('--danger-bg', colors.dangerBg);
    root.style.setProperty('--info', colors.info);
    root.style.setProperty('--info-bg', colors.infoBg);
    root.style.setProperty('--border-color', colors.border);
    root.style.setProperty('--icon-primary', colors.iconPrimary);
    root.style.setProperty('--icon-muted', colors.iconMuted);
    
    // Navbar specific colors
    root.style.setProperty('--nav-text', colors.navText || colors.textInverse);
    root.style.setProperty('--nav-icon', colors.navIcon || colors.iconPrimary);
    root.style.setProperty('--nav-hover', colors.navHover || 'rgba(255, 255, 255, 0.1)');

    // Set theme mode class on body
    document.body.classList.remove('theme-light', 'theme-dark', 'hacker-mode', 'cyber-mode');
    document.body.classList.add(`theme-${currentTheme.mode}`);
    
    if (hackerMode) {
      document.body.classList.add('hacker-mode');
      root.style.setProperty('--hacker-font', hackerModeOverlay.fontFamily);
      root.style.setProperty('--hacker-glow', `0 0 10px ${colors.primary}`);
      root.style.setProperty('--scanline-opacity', hackerModeOverlay.scanlineOpacity.toString());
    } else if (cyberMode) {
      document.body.classList.add('cyber-mode');
      root.style.setProperty('--cyber-font', cyberModeOverlay.fontFamily);
      root.style.setProperty('--cyber-glow', `0 0 15px ${colors.primary}`);
    } else {
      root.style.setProperty('--hacker-font', 'inherit');
      root.style.setProperty('--hacker-glow', 'none');
      root.style.setProperty('--cyber-font', 'inherit');
      root.style.setProperty('--cyber-glow', 'none');
      root.style.setProperty('--scanline-opacity', '0');
    }
    
    document.body.setAttribute('data-theme', currentThemeId);
    document.body.setAttribute('data-hacker', hackerMode ? 'true' : 'false');
    document.body.setAttribute('data-cyber', cyberMode ? 'true' : 'false');
    
    // Apply font size scaling - base sizes from theme.css (comfortable reading)
    const fontScale = FONT_SIZES[fontSizePreference]?.scale || 1.0;
    root.style.setProperty('--font-scale', fontScale.toString());
    // Base sizes: xs=12, sm=13, base=14, md=15, lg=17, xl=22, 2xl=28
    root.style.setProperty('--font-size-xs', `${Math.round(12 * fontScale)}px`);
    root.style.setProperty('--font-size-sm', `${Math.round(13 * fontScale)}px`);
    root.style.setProperty('--font-size-base', `${Math.round(14 * fontScale)}px`);
    root.style.setProperty('--font-size-md', `${Math.round(15 * fontScale)}px`);
    root.style.setProperty('--font-size-lg', `${Math.round(17 * fontScale)}px`);
    root.style.setProperty('--font-size-xl', `${Math.round(22 * fontScale)}px`);
    root.style.setProperty('--font-size-2xl', `${Math.round(28 * fontScale)}px`);
    document.body.setAttribute('data-font-size', fontSizePreference);

    // Save to localStorage
    localStorage.setItem('huntsphere-theme', currentThemeId);
    localStorage.setItem('huntsphere-hacker-mode', hackerMode.toString());
    localStorage.setItem('huntsphere-cyber-mode', cyberMode.toString());
    localStorage.setItem('huntsphere-font-size', fontSizePreference);
  }, [currentThemeId, currentTheme, hackerMode, cyberMode, fontSizePreference]);

  const setTheme = (themeId) => {
    if (themes[themeId]) {
      setCurrentThemeId(themeId);
    }
  };

  const toggleHackerMode = () => {
    if (!hackerMode) {
      setCyberMode(false); // Disable cyber mode when enabling hacker mode
    }
    setHackerMode(prev => !prev);
  };

  const toggleCyberMode = () => {
    if (!cyberMode) {
      setHackerMode(false); // Disable hacker mode when enabling cyber mode
    }
    setCyberMode(prev => !prev);
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
    isDark: currentTheme.mode === 'dark' || hackerMode || cyberMode,
    hackerMode,
    cyberMode,
    toggleHackerMode,
    toggleCyberMode,
    setHackerMode,
    setCyberMode,
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
