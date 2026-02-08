/**
 * ThemeSettings - Admin page for managing themes
 * Full theme studio with live preview
 */

import React from 'react';
import { ThemeToggle, ThemePreview } from '../../styles/themes';
import { Paintbrush, Info, Keyboard } from 'lucide-react';

export function ThemeSettings() {
  return (
    <div className="theme-settings-page">
      <div className="page-header">
        <div className="header-title">
          <Paintbrush className="w-8 h-8" style={{ color: 'var(--accent-primary)' }} />
          <div>
            <h1>Theme Studio</h1>
            <p>Customize the visual experience for your team</p>
          </div>
        </div>
      </div>

      <div className="theme-settings-grid">
        {/* Theme Selection Panel */}
        <div className="settings-panel">
          <ThemeToggle showPreview={false} />
        </div>

        {/* Live Preview Panel */}
        <div className="settings-panel preview-panel">
          <div className="panel-header">
            <Info className="w-5 h-5" />
            <h3>Live Preview</h3>
          </div>
          <p className="panel-description">
            See how your dashboard looks in the selected theme. 
            All changes apply instantly.
          </p>
          <ThemePreview />
        </div>

        {/* Keyboard Shortcuts */}
        <div className="settings-panel shortcuts-panel">
          <div className="panel-header">
            <Keyboard className="w-5 h-5" />
            <h3>Keyboard Shortcuts</h3>
          </div>
          <div className="shortcuts-list">
            <div className="shortcut-item">
              <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>T</kbd>
              <span>Cycle through themes</span>
            </div>
            <div className="shortcut-item">
              <kbd>Ctrl</kbd> + <kbd>K</kbd>
              <span>Open search</span>
            </div>
            <div className="shortcut-item">
              <kbd>Ctrl</kbd> + <kbd>/</kbd>
              <span>Toggle sidebar</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ThemeSettings;
