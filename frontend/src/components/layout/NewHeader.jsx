import React, { useState } from 'react';
import { Search, Bell, Moon, Sun, Palette, Terminal } from 'lucide-react';
import { Dropdown, Button, Typography } from 'antd';
import { NotificationsDropdown } from '../NotificationsDropdown';
import { useTheme } from '../../context/ThemeContext';

const { Text } = Typography;

// Simple theme options
const THEMES = [
  { id: 'graphite', name: 'Graphite', icon: <Moon className="w-4 h-4" /> },
  { id: 'daylight', name: 'Daylight', icon: <Sun className="w-4 h-4" /> },
  { id: 'matrix', name: 'Matrix', icon: <Terminal className="w-4 h-4" /> },
];

export function NewHeader({ title, subtitle }) {
  const [searchQuery, setSearchQuery] = useState('');
  const { currentTheme, setTheme } = useTheme();

  // Theme switcher dropdown
  const themeMenu = (
    <div 
      className="w-48 rounded-lg shadow-xl py-2"
      style={{ 
        background: currentTheme?.colors?.bgCard || '#1A1D24',
        border: `1px solid ${currentTheme?.colors?.borderDefault || 'rgba(113, 113, 122, 0.2)'}`,
      }}
    >
      {THEMES.map((t) => (
        <button
          key={t.id}
          className="w-full px-4 py-2 flex items-center gap-3 hover:opacity-80 transition-opacity text-left"
          style={{ 
            background: currentTheme?.id === t.id 
              ? currentTheme?.colors?.primaryLight || 'rgba(59, 130, 246, 0.1)'
              : 'transparent',
          }}
          onClick={() => setTheme(t.id)}
        >
          <span style={{ color: currentTheme?.colors?.textSecondary }}>
            {t.icon}
          </span>
          <Text 
            style={{ 
              color: currentTheme?.id === t.id 
                ? currentTheme?.colors?.primary 
                : currentTheme?.colors?.textPrimary,
              margin: 0,
            }}
          >
            {t.name}
          </Text>
        </button>
      ))}
    </div>
  );

  return (
    <header 
      className="h-16 flex items-center justify-between px-6 sticky top-0 z-40"
      style={{ 
        background: currentTheme?.colors?.bgNavbar || '#0F1115', 
        borderBottom: `1px solid ${currentTheme?.colors?.borderSubtle || 'rgba(113, 113, 122, 0.1)'}`,
      }}
    >
      {/* Left: Title */}
      <div>
        <h1 
          className="text-xl font-semibold" 
          style={{ color: currentTheme?.colors?.textPrimary || '#FFFFFF' }}
        >
          {title}
        </h1>
        {subtitle && (
          <p 
            className="text-sm" 
            style={{ color: currentTheme?.colors?.textMuted || '#71717A' }}
          >
            {subtitle}
          </p>
        )}
      </div>

      {/* Right: Search & Actions */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative">
          <Search 
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" 
            style={{ color: currentTheme?.colors?.textMuted || '#71717A' }} 
          />
          <input
            type="text"
            placeholder="Search articles, IOCs, hunts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 w-80 rounded-lg text-sm focus:outline-none transition-all"
            style={{ 
              background: currentTheme?.colors?.bgElevated || '#252830', 
              border: `1px solid ${currentTheme?.colors?.borderDefault || 'rgba(113, 113, 122, 0.2)'}`,
              color: currentTheme?.colors?.textPrimary || '#FFFFFF',
            }}
          />
        </div>

        {/* Theme Toggle */}
        <Dropdown 
          dropdownRender={() => themeMenu}
          placement="bottomRight"
          arrow
        >
          <Button
            type="text"
            icon={
              <Palette 
                className="w-5 h-5" 
                style={{ color: currentTheme?.colors?.textSecondary || '#A1A1AA' }} 
              />
            }
            style={{
              width: 40,
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          />
        </Dropdown>

        {/* Notifications */}
        <NotificationsDropdown />
      </div>
    </header>
  );
}

export default NewHeader;
