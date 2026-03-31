import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const TimezoneContext = createContext();

// Common timezones for selection
export const TIMEZONE_OPTIONS = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)', offset: '+00:00' },
  { value: 'LOCAL', label: 'Local Time (Browser)', offset: 'auto' },
  { value: 'America/New_York', label: 'Eastern Time (ET)', offset: '-05:00/-04:00' },
  { value: 'America/Chicago', label: 'Central Time (CT)', offset: '-06:00/-05:00' },
  { value: 'America/Denver', label: 'Mountain Time (MT)', offset: '-07:00/-06:00' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)', offset: '-08:00/-07:00' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)', offset: '-09:00/-08:00' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST)', offset: '-10:00' },
  { value: 'Europe/London', label: 'London (GMT/BST)', offset: '+00:00/+01:00' },
  { value: 'Europe/Paris', label: 'Central European (CET)', offset: '+01:00/+02:00' },
  { value: 'Europe/Berlin', label: 'Berlin (CET)', offset: '+01:00/+02:00' },
  { value: 'Europe/Moscow', label: 'Moscow (MSK)', offset: '+03:00' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)', offset: '+04:00' },
  { value: 'Asia/Kolkata', label: 'India (IST)', offset: '+05:30' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)', offset: '+08:00' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)', offset: '+09:00' },
  { value: 'Asia/Shanghai', label: 'China (CST)', offset: '+08:00' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)', offset: '+10:00/+11:00' },
  { value: 'Pacific/Auckland', label: 'New Zealand (NZST)', offset: '+12:00/+13:00' },
];

export const useTimezone = () => {
  const context = useContext(TimezoneContext);
  if (!context) {
    throw new Error('useTimezone must be used within a TimezoneProvider');
  }
  return context;
};

export const TimezoneProvider = ({ children }) => {
  const [timezone, setTimezoneState] = useState(() => {
    const saved = localStorage.getItem('jyoti-timezone');
    return saved || 'UTC';
  });

  const [use24Hour, setUse24HourState] = useState(() => {
    const saved = localStorage.getItem('jyoti-24hour');
    return saved === 'true';
  });

  const [showSeconds, setShowSecondsState] = useState(() => {
    const saved = localStorage.getItem('jyoti-show-seconds');
    return saved === 'true';
  });

  // Save preferences to localStorage
  useEffect(() => {
    localStorage.setItem('jyoti-timezone', timezone);
    localStorage.setItem('jyoti-24hour', use24Hour.toString());
    localStorage.setItem('jyoti-show-seconds', showSeconds.toString());
  }, [timezone, use24Hour, showSeconds]);

  // Get the actual timezone string for Intl API
  const getTimezoneString = useCallback(() => {
    if (timezone === 'LOCAL') {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    }
    return timezone;
  }, [timezone]);

  // Format a date string (ISO/UTC) to the selected timezone
  const formatDateTime = useCallback((dateString, options = {}) => {
    if (!dateString) return 'Unknown';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';

      const tz = getTimezoneString();
      const formatOptions = {
        timeZone: tz,
        year: options.showYear !== false ? 'numeric' : undefined,
        month: options.monthFormat || 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: showSeconds ? '2-digit' : undefined,
        hour12: !use24Hour,
        ...options.overrides
      };

      // Remove undefined values
      Object.keys(formatOptions).forEach(key => {
        if (formatOptions[key] === undefined) delete formatOptions[key];
      });

      return new Intl.DateTimeFormat('en-US', formatOptions).format(date);
    } catch (e) {
      console.error('Date formatting error:', e);
      return 'Error';
    }
  }, [getTimezoneString, use24Hour, showSeconds]);

  // Format date only (no time)
  const formatDate = useCallback((dateString, options = {}) => {
    if (!dateString) return 'Unknown';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';

      const tz = getTimezoneString();
      const formatOptions = {
        timeZone: tz,
        year: options.showYear !== false ? 'numeric' : undefined,
        month: options.monthFormat || 'short',
        day: 'numeric',
        ...options.overrides
      };

      Object.keys(formatOptions).forEach(key => {
        if (formatOptions[key] === undefined) delete formatOptions[key];
      });

      return new Intl.DateTimeFormat('en-US', formatOptions).format(date);
    } catch (e) {
      return 'Error';
    }
  }, [getTimezoneString]);

  // Format time only (no date)
  const formatTime = useCallback((dateString, options = {}) => {
    if (!dateString) return 'Unknown';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';

      const tz = getTimezoneString();
      const formatOptions = {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        second: showSeconds || options.showSeconds ? '2-digit' : undefined,
        hour12: !use24Hour,
        ...options.overrides
      };

      Object.keys(formatOptions).forEach(key => {
        if (formatOptions[key] === undefined) delete formatOptions[key];
      });

      return new Intl.DateTimeFormat('en-US', formatOptions).format(date);
    } catch (e) {
      return 'Error';
    }
  }, [getTimezoneString, use24Hour, showSeconds]);

  // Get relative time (e.g., "5 minutes ago")
  const getRelativeTime = useCallback((dateString) => {
    if (!dateString) return 'Unknown';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Unknown';
      
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      
      // For older dates, show the formatted date
      return formatDate(dateString, { showYear: diffDays > 365 });
    } catch (e) {
      return 'Unknown';
    }
  }, [formatDate]);

  // Get timezone label for display
  const getTimezoneLabel = useCallback(() => {
    if (timezone === 'UTC') return 'UTC';
    if (timezone === 'LOCAL') {
      const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return `Local (${localTz})`;
    }
    const option = TIMEZONE_OPTIONS.find(o => o.value === timezone);
    return option ? option.label : timezone;
  }, [timezone]);

  // Get short timezone abbreviation
  const getTimezoneAbbr = useCallback(() => {
    if (timezone === 'UTC') return 'UTC';
    
    try {
      const tz = getTimezoneString();
      const date = new Date();
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        timeZoneName: 'short'
      }).formatToParts(date);
      
      const tzPart = parts.find(p => p.type === 'timeZoneName');
      return tzPart ? tzPart.value : timezone;
    } catch (e) {
      return timezone === 'LOCAL' ? 'Local' : timezone;
    }
  }, [timezone, getTimezoneString]);

  // Convert a date to UTC ISO string (for API calls)
  const toUTC = useCallback((date) => {
    if (!date) return null;
    const d = date instanceof Date ? date : new Date(date);
    return d.toISOString();
  }, []);

  const setTimezone = (tz) => {
    if (tz && (tz === 'UTC' || tz === 'LOCAL' || TIMEZONE_OPTIONS.some(o => o.value === tz))) {
      setTimezoneState(tz);
    }
  };

  const setUse24Hour = (val) => {
    setUse24HourState(Boolean(val));
  };

  const setShowSeconds = (val) => {
    setShowSecondsState(Boolean(val));
  };

  const value = {
    // Current settings
    timezone,
    use24Hour,
    showSeconds,
    
    // Setters
    setTimezone,
    setUse24Hour,
    setShowSeconds,
    
    // Formatters
    formatDateTime,
    formatDate,
    formatTime,
    getRelativeTime,
    
    // Helpers
    getTimezoneLabel,
    getTimezoneAbbr,
    getTimezoneString,
    toUTC,
    
    // Options for UI
    timezoneOptions: TIMEZONE_OPTIONS,
  };

  return (
    <TimezoneContext.Provider value={value}>
      {children}
    </TimezoneContext.Provider>
  );
};

export default TimezoneContext;
