/**
 * PARSHU - Complete Theme System
 * 4 Professional Cybersecurity Themes
 * 
 * 1. MIDNIGHT OPS    - Dark theme with cyan accents (Prototype match)
 * 2. CORPORATE       - Light/Day enterprise theme with blue accents
 * 3. CYBERPUNK       - High contrast neon theme (purple/pink/cyan)
 * 4. TACTICAL        - Military-style dark theme with amber accents
 */

export const THEMES = {
  midnight: {
    id: 'midnight',
    name: 'Midnight Ops',
    description: 'Professional dark theme with cyan accents',
    author: 'Parshu Design Team',
    colors: {
      // Background hierarchy
      background: '240 20% 4%',        // #0a0a0f
      foreground: '210 40% 98%',      // #f8fafc
      card: '240 15% 8%',             // #111118
      'card-foreground': '210 40% 98%',
      popover: '240 15% 8%',
      'popover-foreground': '210 40% 98%',
      
      // Primary - Cyan
      primary: '187 94% 43%',         // #06b6d4
      'primary-foreground': '240 20% 4%',
      'primary-light': '187 94% 43% / 0.1',
      'primary-glow': '187 94% 43% / 0.3',
      
      // Secondary - Violet
      secondary: '263 70% 50%',       // #8b5cf6
      'secondary-foreground': '210 40% 98%',
      
      // Muted
      muted: '240 12% 12%',           // #1a1a23
      'muted-foreground': '215 20% 55%', // #8a9199
      
      // Accent
      accent: '240 12% 12%',
      'accent-foreground': '210 40% 98%',
      
      // Destructive
      destructive: '0 84% 60%',       // #ef4444
      'destructive-foreground': '210 40% 98%',
      
      // Border
      border: '240 12% 18%',          // #282833
      input: '240 12% 18%',
      ring: '187 94% 43%',
      
      // Radius
      radius: '0.625rem',
      
      // Sidebar
      'sidebar-background': '240 15% 6%',
      'sidebar-foreground': '210 40% 98%',
      'sidebar-primary': '187 94% 43%',
      'sidebar-primary-foreground': '240 20% 4%',
      'sidebar-accent': '240 12% 12%',
      'sidebar-accent-foreground': '210 40% 98%',
      'sidebar-border': '240 12% 15%',
      'sidebar-ring': '187 94% 43%',
      
      // Semantic colors
      success: '160 84% 39%',         // #10b981
      warning: '38 92% 50%',          // #f59e0b
      critical: '0 84% 60%',          // #ef4444
      info: '217 91% 60%',            // #3b82f6
      
      // Platform colors
      xsiam: '25 95% 53%',            // Orange
      splunk: '160 84% 39%',          // Green
      defender: '217 91% 60%',        // Blue
      wiz: '263 70% 50%',             // Purple
    },
    features: {
      glassmorphism: true,
      glowEffects: true,
      animatedBackground: true,
      gridPattern: true,
    }
  },

  corporate: {
    id: 'corporate',
    name: 'Corporate Sentinel',
    description: 'Clean enterprise theme for business environments',
    author: 'Parshu Design Team',
    colors: {
      // Background hierarchy - Light theme
      background: '0 0% 98%',         // #fafafa
      foreground: '222 47% 11%',      // #0f172a
      card: '0 0% 100%',              // #ffffff
      'card-foreground': '222 47% 11%',
      popover: '0 0% 100%',
      'popover-foreground': '222 47% 11%',
      
      // Primary - Royal Blue
      primary: '221 83% 53%',         // #2563eb
      'primary-foreground': '0 0% 100%',
      'primary-light': '221 83% 53% / 0.1',
      'primary-glow': '221 83% 53% / 0.2',
      
      // Secondary - Slate
      secondary: '215 16% 47%',       // #64748b
      'secondary-foreground': '0 0% 100%',
      
      // Muted
      muted: '210 40% 96%',           // #f1f5f9
      'muted-foreground': '215 16% 47%', // #64748b
      
      // Accent
      accent: '210 40% 96%',
      'accent-foreground': '222 47% 11%',
      
      // Destructive
      destructive: '0 84% 60%',
      'destructive-foreground': '0 0% 100%',
      
      // Border
      border: '214 32% 91%',          // #e2e8f0
      input: '214 32% 91%',
      ring: '221 83% 53%',
      
      // Radius
      radius: '0.5rem',
      
      // Sidebar
      'sidebar-background': '0 0% 100%',
      'sidebar-foreground': '222 47% 11%',
      'sidebar-primary': '221 83% 53%',
      'sidebar-primary-foreground': '0 0% 100%',
      'sidebar-accent': '210 40% 96%',
      'sidebar-accent-foreground': '222 47% 11%',
      'sidebar-border': '214 32% 91%',
      'sidebar-ring': '221 83% 53%',
      
      // Semantic colors
      success: '142 71% 45%',
      warning: '38 92% 50%',
      critical: '0 84% 60%',
      info: '217 91% 60%',
      
      // Platform colors
      xsiam: '25 95% 53%',
      splunk: '142 71% 45%',
      defender: '217 91% 60%',
      wiz: '263 70% 50%',
    },
    features: {
      glassmorphism: false,
      glowEffects: false,
      animatedBackground: false,
      gridPattern: false,
    }
  },

  cyberpunk: {
    id: 'cyberpunk',
    name: 'Neon Cyberpunk',
    description: 'High contrast neon theme for SOC operations',
    author: 'Parshu Design Team',
    colors: {
      // Background hierarchy - Deep purple/black
      background: '270 50% 5%',       // #0d0612
      foreground: '280 100% 95%',     // #f5e6ff
      card: '270 45% 8%',             // #170d1f
      'card-foreground': '280 100% 95%',
      popover: '270 45% 8%',
      'popover-foreground': '280 100% 95%',
      
      // Primary - Neon Pink/Magenta
      primary: '320 100% 60%',        // #ff1a8c
      'primary-foreground': '270 50% 5%',
      'primary-light': '320 100% 60% / 0.15',
      'primary-glow': '320 100% 60% / 0.4',
      
      // Secondary - Neon Cyan
      secondary: '180 100% 50%',      // #00ffff
      'secondary-foreground': '270 50% 5%',
      
      // Muted
      muted: '270 40% 12%',           // #1f1229
      'muted-foreground': '280 30% 60%', // #9b7bb8
      
      // Accent
      accent: '270 40% 12%',
      'accent-foreground': '280 100% 95%',
      
      // Destructive
      destructive: '0 100% 60%',      // #ff3333
      'destructive-foreground': '280 100% 95%',
      
      // Border
      border: '280 50% 20%',          // #331a4d
      input: '280 50% 20%',
      ring: '320 100% 60%',
      
      // Radius
      radius: '0.75rem',
      
      // Sidebar
      'sidebar-background': '270 45% 6%',
      'sidebar-foreground': '280 100% 95%',
      'sidebar-primary': '320 100% 60%',
      'sidebar-primary-foreground': '270 50% 5%',
      'sidebar-accent': '270 40% 12%',
      'sidebar-accent-foreground': '280 100% 95%',
      'sidebar-border': '280 50% 20%',
      'sidebar-ring': '320 100% 60%',
      
      // Semantic colors - Neon variants
      success: '140 100% 50%',        // #00ff66
      warning: '45 100% 50%',         // #ffcc00
      critical: '0 100% 60%',         // #ff3333
      info: '180 100% 50%',           // #00ffff
      
      // Platform colors - Neon
      xsiam: '30 100% 50%',           // Neon Orange
      splunk: '140 100% 50%',         // Neon Green
      defender: '200 100% 60%',       // Neon Blue
      wiz: '270 100% 70%',            // Neon Purple
    },
    features: {
      glassmorphism: true,
      glowEffects: true,
      animatedBackground: true,
      gridPattern: true,
    }
  },

  tactical: {
    id: 'tactical',
    name: 'Military Tactical',
    description: 'Dark tactical theme with amber/green accents',
    author: 'Parshu Design Team',
    colors: {
      // Background hierarchy - Dark olive/black
      background: '120 20% 5%',       // #0a0f0a
      foreground: '60 30% 95%',       // #f2f2e6
      card: '120 15% 8%',             // #111a11
      'card-foreground': '60 30% 95%',
      popover: '120 15% 8%',
      'popover-foreground': '60 30% 95%',
      
      // Primary - Amber/Gold
      primary: '45 100% 50%',         // #ffbf00
      'primary-foreground': '120 20% 5%',
      'primary-light': '45 100% 50% / 0.15',
      'primary-glow': '45 100% 50% / 0.4',
      
      // Secondary - Olive
      secondary: '80 60% 35%',        // #5c8a23
      'secondary-foreground': '60 30% 95%',
      
      // Muted
      muted: '120 12% 12%',           // #1a241a
      'muted-foreground': '60 20% 55%', // #999980
      
      // Accent
      accent: '120 12% 12%',
      'accent-foreground': '60 30% 95%',
      
      // Destructive
      destructive: '0 80% 50%',       // #e61a1a
      'destructive-foreground': '60 30% 95%',
      
      // Border
      border: '60 20% 20%',           // #4d4d33
      input: '60 20% 20%',
      ring: '45 100% 50%',
      
      // Radius
      radius: '0.375rem',
      
      // Sidebar
      'sidebar-background': '120 15% 6%',
      'sidebar-foreground': '60 30% 95%',
      'sidebar-primary': '45 100% 50%',
      'sidebar-primary-foreground': '120 20% 5%',
      'sidebar-accent': '120 12% 12%',
      'sidebar-accent-foreground': '60 30% 95%',
      'sidebar-border': '60 20% 20%',
      'sidebar-ring': '45 100% 50%',
      
      // Semantic colors - Tactical
      success: '100 80% 40%',         // #66cc14
      warning: '45 100% 50%',         // #ffbf00
      critical: '0 80% 50%',          // #e61a1a
      info: '180 60% 50%',            // #33cccc
      
      // Platform colors - Tactical
      xsiam: '30 100% 45%',
      splunk: '100 80% 40%',
      defender: '200 60% 50%',
      wiz: '270 50% 45%',
    },
    features: {
      glassmorphism: true,
      glowEffects: true,
      animatedBackground: false,
      gridPattern: true,
    }
  }
};

// Helper function to apply theme CSS variables
export function applyTheme(themeId) {
  const theme = THEMES[themeId];
  if (!theme) return;

  const root = document.documentElement;
  
  // Apply all color variables
  Object.entries(theme.colors).forEach(([key, value]) => {
    root.style.setProperty(`--${key}`, value);
  });
  
  // Apply theme class
  root.classList.remove('theme-midnight', 'theme-corporate', 'theme-cyberpunk', 'theme-tactical');
  root.classList.add(`theme-${themeId}`);
  
  // Store preference
  localStorage.setItem('parshu-theme', themeId);
}

// Get current theme
export function getCurrentTheme() {
  return localStorage.getItem('parshu-theme') || 'midnight';
}

// Initialize theme on load
export function initTheme() {
  const savedTheme = getCurrentTheme();
  applyTheme(savedTheme);
}

// Get theme by ID
export function getTheme(themeId) {
  return THEMES[themeId] || THEMES.midnight;
}

// Get all themes as array
export function getAllThemes() {
  return Object.values(THEMES);
}

export default THEMES;
