import React from 'react';
import { useLocation } from 'react-router-dom';
import { NewSidebar } from './NewSidebar';
import { NewHeader } from './NewHeader';
import { AnimatedBackground } from '../AnimatedBackground';
import { useTheme } from '../../context/ThemeContext';

export function NewLayout({ children }) {
  const location = useLocation();
  const { currentTheme, isDark, terminalMode } = useTheme();
  const isLoginPage = location.pathname === '/login';

  if (isLoginPage) {
    return children;
  }

  const getPageTitle = () => {
    const titles = {
      '/dashboard': { title: 'Operations Overview', subtitle: 'Real-time threat intelligence and hunt operations' },
      '/news': { title: 'News & Feeds', subtitle: 'Threat intelligence feeds and sources' },
      '/articles': { title: 'Articles', subtitle: 'Article triage and analysis queue' },
      '/intelligence': { title: 'Intelligence', subtitle: 'Extracted IOCs and threat indicators' },
      '/hunts': { title: 'Threat Hunts', subtitle: 'Hunt management and execution' },
      '/reports': { title: 'Reports', subtitle: 'Generated threat intelligence reports' },
      '/sources': { title: 'Sources', subtitle: 'Feed sources configuration' },
      '/watchlist': { title: 'Watchlist', subtitle: 'Keyword monitoring' },
      '/audit': { title: 'Audit Logs', subtitle: 'System activity logs' },
      '/admin': { title: 'Admin', subtitle: 'System administration' },
    };
    return titles[location.pathname] || { title: 'Dashboard', subtitle: '' };
  };

  const { title, subtitle } = getPageTitle();

  // Use theme colors directly
  const colors = currentTheme?.colors || {};
  const bgColor = colors.bgBody || (isDark ? '#13151A' : '#f8fafc');
  const textColor = colors.textPrimary || (isDark ? '#FFFFFF' : '#0f172a');

  return (
    <div 
      className="min-h-screen relative"
      style={{ 
        background: bgColor,
        color: textColor
      }}
    >
      {/* Animated Background */}
      <AnimatedBackground />
      
      {/* Content */}
      <div className="relative z-10">
        <NewSidebar />
        <div className="ml-64">
          <NewHeader title={title} subtitle={subtitle} />
          <main 
            className="min-h-[calc(100vh-4rem)]"
            style={{ background: 'transparent' }}
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
