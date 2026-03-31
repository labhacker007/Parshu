/**
 * ThemeToggle Component
 * Beautiful admin panel for switching themes
 * Usage: <ThemeToggle /> anywhere in your app
 */

import React from 'react';
import { useTheme, THEMES } from './ThemeContext';
import { 
  Terminal, 
  Moon, 
  Sun, 
  Check,
  Sparkles,
  Monitor,
  Palette
} from 'lucide-react';

// Icon mapping
const ICONS = {
  Terminal,
  Moon,
  Sun
};

/**
 * Compact Theme Toggle (for header/navigation)
 */
export function ThemeToggleCompact({ className = '' }) {
  const { currentTheme, cycleTheme, theme } = useTheme();
  const Icon = ICONS[theme.icon] || Monitor;

  return (
    <button
      onClick={cycleTheme}
      className={`theme-toggle-compact ${className}`}
      title={`Current: ${theme.name}. Click to cycle themes`}
      style={{ '--theme-color': theme.color }}
    >
      <Icon className="w-5 h-5" />
      <span className="theme-indicator" />
    </button>
  );
}

/**
 * Full Theme Toggle Panel (for admin/settings page)
 */
export function ThemeToggle({ showPreview = true, className = '' }) {
  const { currentTheme, toggleTheme, isLoading, allThemes, theme } = useTheme();

  return (
    <div className={`theme-toggle-panel ${className}`}>
      {/* Header */}
      <div className="theme-header">
        <div className="theme-title">
          <Palette className="w-5 h-5" />
          <h3>Theme Studio</h3>
        </div>
        <span className="theme-badge">
          <Sparkles className="w-3 h-3" />
          Live Preview
        </span>
      </div>

      {/* Theme Options */}
      <div className="theme-options">
        {allThemes.map((t) => {
          const Icon = ICONS[t.icon] || Monitor;
          const isActive = currentTheme === t.id;
          
          return (
            <button
              key={t.id}
              className={`theme-option ${isActive ? 'active' : ''} ${isLoading && isActive ? 'loading' : ''}`}
              onClick={() => toggleTheme(t.id)}
              disabled={isLoading}
              style={{ '--theme-color': t.color }}
            >
              {/* Icon & Check */}
              <div className="option-icon-wrapper">
                <Icon className="option-icon" />
                {isActive && (
                  <div className="check-badge">
                    <Check className="w-3 h-3" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="option-info">
                <span className="option-name">{t.name}</span>
                <span className="option-description">{t.description}</span>
              </div>

              {/* Preview Badge */}
              <span className="option-preview">{t.preview}</span>
            </button>
          );
        })}
      </div>

      {/* Current Status */}
      <div className="theme-status">
        <div className="status-indicator">
          <div className="pulse-dot" style={{ background: theme.color }} />
          <span>Active: <strong>{theme.name}</strong></span>
        </div>
        <span className="status-hint">
          Changes apply instantly across all pages
        </span>
      </div>

      {/* Keyboard Shortcut Hint */}
      <div className="theme-shortcut">
        <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>T</kbd> to cycle themes
      </div>
    </div>
  );
}

/**
 * Theme Preview Card - Shows how components look
 */
export function ThemePreview() {
  const { theme } = useTheme();
  
  return (
    <div className="theme-preview-card">
      <h4>Component Preview</h4>
      
      <div className="preview-section">
        <span className="preview-label">Buttons</span>
        <div className="preview-row">
          <button className="btn btn-primary">Primary</button>
          <button className="btn btn-secondary">Secondary</button>
          <button className="btn btn-danger">Danger</button>
        </div>
      </div>

      <div className="preview-section">
        <span className="preview-label">Status Badges</span>
        <div className="preview-row">
          <span className="badge badge-success">Healthy</span>
          <span className="badge badge-warning">Warning</span>
          <span className="badge badge-danger">Critical</span>
        </div>
      </div>

      <div className="preview-section">
        <span className="preview-label">Card</span>
        <div className="preview-card">
          <div className="preview-card-header">
            <strong>Sample Card</strong>
            <span className="text-muted">Just now</span>
          </div>
          <p className="preview-card-text">
            This is how cards appear in {theme.name}.
          </p>
        </div>
      </div>
    </div>
  );
}

// Export all
export default ThemeToggle;
