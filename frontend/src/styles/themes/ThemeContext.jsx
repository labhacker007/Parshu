/**
 * ThemeContext - Easy Theme State Management
 * Provides: current theme, toggle function, theme metadata
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// Theme definitions with metadata
export const THEMES = {
  hacker: {
    id: 'hacker',
    name: 'Hacker Mode',
    description: 'Terminal-style cyberpunk',
    icon: 'Terminal',
    color: '#00ff41',
    preview: 'Matrix green on black'
  },
  dark: {
    id: 'dark',
    name: 'Dark Mode',
    description: 'Professional SOC dashboard',
    icon: 'Moon',
    color: '#3b82f6',
    preview: 'Deep navy with vibrant accents'
  },
  light: {
    id: 'light',
    name: 'Light Mode',
    description: 'Clean enterprise interface',
    icon: 'Sun',
    color: '#2563eb',
    preview: 'Clean white with blue accents'
  }
};

const DEFAULT_THEME = 'dark';
const THEME_STORAGE_KEY = 'jyoti-theme-v1';

// Create context
const ThemeContext = createContext({
  currentTheme: DEFAULT_THEME,
  toggleTheme: () => {},
  isLoading: false,
  themes: THEMES
});

/**
 * ThemeProvider - Wrap your app with this
 * Usage: <ThemeProvider><App /></ThemeProvider>
 */
export function ThemeProvider({ children, defaultTheme = DEFAULT_THEME }) {
  const [currentTheme, setCurrentTheme] = useState(defaultTheme);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Initialize theme on mount
  useEffect(() => {
    const initTheme = () => {
      // Try to get saved theme from localStorage
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
      
      // Validate saved theme
      const validTheme = savedTheme && THEMES[savedTheme] ? savedTheme : defaultTheme;
      
      // Apply theme immediately (no delay for initial load)
      applyThemeClass(validTheme);
      setCurrentTheme(validTheme);
      setIsReady(true);
    };

    initTheme();
  }, [defaultTheme]);

  // Apply theme class to body
  const applyThemeClass = useCallback((themeId) => {
    // Remove all theme classes
    document.body.classList.remove('theme-hacker', 'theme-dark', 'theme-light');
    
    // Add new theme class
    document.body.classList.add(`theme-${themeId}`);
    
    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      const themeColor = THEMES[themeId].color;
      metaThemeColor.setAttribute('content', themeId === 'light' ? '#ffffff' : themeColor);
    }
  }, []);

  // Toggle theme function
  const toggleTheme = useCallback((themeId) => {
    if (!THEMES[themeId] || themeId === currentTheme) return;
    
    setIsLoading(true);
    
    // Small delay for visual feedback
    setTimeout(() => {
      applyThemeClass(themeId);
      setCurrentTheme(themeId);
      localStorage.setItem(THEME_STORAGE_KEY, themeId);
      setIsLoading(false);
    }, 150);
  }, [currentTheme, applyThemeClass]);

  // Cycle to next theme
  const cycleTheme = useCallback(() => {
    const themeKeys = Object.keys(THEMES);
    const currentIndex = themeKeys.indexOf(currentTheme);
    const nextIndex = (currentIndex + 1) % themeKeys.length;
    toggleTheme(themeKeys[nextIndex]);
  }, [currentTheme, toggleTheme]);

  const value = {
    currentTheme,
    theme: THEMES[currentTheme],
    toggleTheme,
    cycleTheme,
    isLoading,
    isReady,
    themes: THEMES,
    allThemes: Object.values(THEMES)
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * useTheme hook - Use this in any component
 * Usage: const { currentTheme, toggleTheme } = useTheme();
 */
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

// Re-export for convenience
export { ThemeContext };
