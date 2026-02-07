import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { Palette, Moon, Sun, Terminal, Check } from 'lucide-react';

export function ThemeSelector() {
  const { currentThemeId, setTheme, terminalMode, toggleTerminalMode, themes } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const themeOptions = [
    { id: 'command-center', name: 'Dark', icon: Moon, color: '#0EA5E9' },
    { id: 'daylight', name: 'Light', icon: Sun, color: '#F59E0B' },
    { id: 'red-alert', name: 'Hacker', icon: Terminal, color: '#DC2626' },
  ];

  const currentOption = themeOptions.find(t => t.id === currentThemeId) || themeOptions[0];
  const Icon = currentOption.icon;

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '8px',
          color: '#e2e8f0',
          cursor: 'pointer',
          fontSize: '14px',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#06b6d4';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = '#334155';
        }}
      >
        <Icon size={16} style={{ color: currentOption.color }} />
        <span>{currentOption.name}</span>
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '8px',
            background: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '12px',
            padding: '8px',
            minWidth: '180px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
            zIndex: 1000,
          }}
        >
          <div style={{ padding: '8px 12px', color: '#64748b', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Select Theme
          </div>
          
          {themeOptions.map((option) => {
            const OptionIcon = option.icon;
            const isActive = currentThemeId === option.id && !terminalMode;
            
            return (
              <button
                key={option.id}
                onClick={() => {
                  setTheme(option.id);
                  if (terminalMode) toggleTerminalMode();
                  setIsOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                  padding: '10px 12px',
                  background: isActive ? 'rgba(6, 182, 212, 0.1)' : 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  color: isActive ? '#06b6d4' : '#e2e8f0',
                  cursor: 'pointer',
                  fontSize: '14px',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = '#1e293b';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <OptionIcon size={16} style={{ color: option.color }} />
                <span style={{ flex: 1 }}>{option.name}</span>
                {isActive && <Check size={16} style={{ color: '#06b6d4' }} />}
              </button>
            );
          })}

          <div style={{ margin: '8px 0', borderTop: '1px solid #1e293b' }} />
          
          {/* Hacker Mode Toggle */}
          <button
            onClick={() => {
              toggleTerminalMode();
              setIsOpen(false);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              padding: '10px 12px',
              background: terminalMode ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
              border: 'none',
              borderRadius: '8px',
              color: terminalMode ? '#22c55e' : '#e2e8f0',
              cursor: 'pointer',
              fontSize: '14px',
              textAlign: 'left',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (!terminalMode) {
                e.currentTarget.style.background = '#1e293b';
              }
            }}
            onMouseLeave={(e) => {
              if (!terminalMode) {
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            <Terminal size={16} style={{ color: terminalMode ? '#22c55e' : '#64748b' }} />
            <span style={{ flex: 1 }}>Hacker Mode</span>
            {terminalMode && <Check size={16} style={{ color: '#22c55e' }} />}
          </button>
        </div>
      )}
    </div>
  );
}
