import React, { useState, useEffect } from 'react';
import { 
  Palette, 
  CheckCircle, 
  AlertTriangle, 
  Info, 
  XCircle,
  Sun,
  Moon,
  Monitor,
  Shield
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, StatCard } from '../components/ui/Card';
import { getAllThemes, applyTheme, getCurrentTheme } from '../themes';
import { cn } from '../lib/utils';

/**
 * ThemeTester Component
 * Comprehensive theme testing and preview page
 * Tests all 4 themes for contrast, visibility, and accessibility
 */

export function ThemeTester() {
  const [currentThemeId, setCurrentThemeId] = useState(getCurrentTheme());
  const [testResults, setTestResults] = useState({});
  const themes = getAllThemes();

  // Apply theme when changed
  const handleThemeChange = (themeId) => {
    applyTheme(themeId);
    setCurrentThemeId(themeId);
  };

  // Calculate contrast ratio between two colors
  const getContrastRatio = (color1, color2) => {
    // Simple luminance calculation for HSL colors
    // Returns a value between 1 and 21
    const l1 = parseInt(color1.split(' ')[2].replace('%', '')) / 100;
    const l2 = parseInt(color2.split(' ')[2].replace('%', '')) / 100;
    
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    
    return (lighter + 0.05) / (darker + 0.05);
  };

  // Test theme accessibility
  const testTheme = (theme) => {
    const results = {
      name: theme.name,
      passed: 0,
      failed: 0,
      warnings: 0,
      tests: []
    };

    // Test 1: Primary text contrast
    const textContrast = getContrastRatio(theme.colors.foreground, theme.colors.background);
    results.tests.push({
      name: 'Primary Text Contrast',
      passed: textContrast >= 4.5,
      value: textContrast.toFixed(2) + ':1',
      required: '4.5:1 (AA)'
    });
    if (textContrast >= 4.5) results.passed++; else results.failed++;

    // Test 2: Muted text contrast
    const mutedContrast = getContrastRatio(theme.colors['muted-foreground'], theme.colors.background);
    results.tests.push({
      name: 'Muted Text Contrast',
      passed: mutedContrast >= 3,
      value: mutedContrast.toFixed(2) + ':1',
      required: '3:1 (AA Large)'
    });
    if (mutedContrast >= 3) results.passed++; else results.warnings++;

    // Test 3: Primary button contrast
    const buttonContrast = getContrastRatio(theme.colors['primary-foreground'], theme.colors.primary);
    results.tests.push({
      name: 'Button Text Contrast',
      passed: buttonContrast >= 4.5,
      value: buttonContrast.toFixed(2) + ':1',
      required: '4.5:1 (AA)'
    });
    if (buttonContrast >= 4.5) results.passed++; else results.failed++;

    // Test 4: Success color visibility
    const successContrast = getContrastRatio(theme.colors.success, theme.colors.background);
    results.tests.push({
      name: 'Success Color Visibility',
      passed: successContrast >= 3,
      value: successContrast.toFixed(2) + ':1',
      required: '3:1'
    });
    if (successContrast >= 3) results.passed++; else results.warnings++;

    // Test 5: Critical color visibility
    const criticalContrast = getContrastRatio(theme.colors.critical, theme.colors.background);
    results.tests.push({
      name: 'Critical Color Visibility',
      passed: criticalContrast >= 3,
      value: criticalContrast.toFixed(2) + ':1',
      required: '3:1'
    });
    if (criticalContrast >= 3) results.passed++; else results.warnings++;

    return results;
  };

  // Run tests on mount
  useEffect(() => {
    const results = {};
    themes.forEach(theme => {
      results[theme.id] = testTheme(theme);
    });
    setTestResults(results);
  }, []);

  const currentTheme = themes.find(t => t.id === currentThemeId);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Theme Tester</h1>
        <p className="text-[hsl(var(--muted-foreground))]">
          Test and preview all Parshu themes
        </p>
      </div>

      {/* Theme Selector */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Palette className="w-5 h-5" />
          Select Theme
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {themes.map(theme => (
            <button
              key={theme.id}
              onClick={() => handleThemeChange(theme.id)}
              className={cn(
                'p-4 rounded-lg border-2 text-left transition-all',
                currentThemeId === theme.id
                  ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5'
                  : 'border-[hsl(var(--border))] hover:border-[hsl(var(--primary))]/50'
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <div 
                  className="w-4 h-4 rounded-full"
                  style={{ background: `hsl(${theme.colors.primary})` }}
                />
                <span className="font-medium">{theme.name}</span>
              </div>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                {theme.description}
              </p>
            </button>
          ))}
        </div>
      </Card>

      {/* Accessibility Test Results */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Accessibility Test Results</h2>
        <div className="space-y-4">
          {Object.entries(testResults).map(([themeId, result]) => (
            <div 
              key={themeId}
              className={cn(
                'p-4 rounded-lg border',
                result?.failed > 0 ? 'border-[hsl(var(--critical))]/30 bg-[hsl(var(--critical))]/5' :
                result?.warnings > 0 ? 'border-[hsl(var(--warning))]/30 bg-[hsl(var(--warning))]/5' :
                'border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/5'
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">{result?.name}</h3>
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1 text-[hsl(var(--success))]">
                    <CheckCircle className="w-4 h-4" />
                    {result?.passed} passed
                  </span>
                  {result?.warnings > 0 && (
                    <span className="flex items-center gap-1 text-[hsl(var(--warning))]">
                      <AlertTriangle className="w-4 h-4" />
                      {result?.warnings} warnings
                    </span>
                  )}
                  {result?.failed > 0 && (
                    <span className="flex items-center gap-1 text-[hsl(var(--critical))]">
                      <XCircle className="w-4 h-4" />
                      {result?.failed} failed
                    </span>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                {result?.tests?.map((test, i) => (
                  <div 
                    key={i}
                    className="flex items-center justify-between text-sm py-1"
                  >
                    <span className="text-[hsl(var(--muted-foreground))]">{test.name}</span>
                    <span className={cn(
                      'flex items-center gap-2',
                      test.passed ? 'text-[hsl(var(--success))]' : 
                      test.value.includes('warning') ? 'text-[hsl(var(--warning))]' :
                      'text-[hsl(var(--critical))]'
                    )}>
                      {test.value} (requires {test.required})
                      {test.passed ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Component Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Buttons */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Buttons</h2>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="default">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm">Small</Button>
              <Button>Default</Button>
              <Button size="lg">Large</Button>
            </div>
          </div>
        </Card>

        {/* Badges */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Badges & Status</h2>
          <div className="flex flex-wrap gap-2">
            <span className="badge badge-primary">Primary</span>
            <span className="badge badge-success">Success</span>
            <span className="badge badge-warning">Warning</span>
            <span className="badge badge-critical">Critical</span>
            <span className="badge badge-info">Info</span>
          </div>
          <div className="mt-4 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="status-dot online" />
              <span className="text-sm">Online</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="status-dot warning" />
              <span className="text-sm">Warning</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="status-dot critical" />
              <span className="text-sm">Critical</span>
            </div>
          </div>
        </Card>

        {/* Cards */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Cards</h2>
          <div className="grid grid-cols-2 gap-4">
            <Card className="p-4">
              <h3 className="font-medium">Standard Card</h3>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">Default appearance</p>
            </Card>
            <Card glass className="p-4">
              <h3 className="font-medium">Glass Card</h3>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">With glassmorphism</p>
            </Card>
          </div>
        </Card>

        {/* Form Elements */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Form Elements</h2>
          <div className="space-y-4">
            <input 
              type="text" 
              placeholder="Text input" 
              className="input"
            />
            <input 
              type="text" 
              placeholder="Disabled input" 
              className="input"
              disabled
            />
          </div>
        </Card>
      </div>

      {/* Color Palette */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">
          Current Theme: {currentTheme?.name}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Object.entries(currentTheme?.colors || {}).map(([name, value]) => {
            // Only show color swatches, not other properties
            if (name === 'radius') return null;
            
            return (
              <div key={name} className="space-y-1">
                <div 
                  className="h-16 rounded-lg border border-[hsl(var(--border))]"
                  style={{ background: `hsl(${value})` }}
                />
                <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">
                  {name}
                </p>
                <p className="text-xs font-mono truncate">
                  hsl({value})
                </p>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Typography */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Typography</h2>
        <div className="space-y-4">
          <h1 className="text-4xl font-bold">Heading 1</h1>
          <h2 className="text-3xl font-bold">Heading 2</h2>
          <h3 className="text-2xl font-semibold">Heading 3</h3>
          <h4 className="text-xl font-semibold">Heading 4</h4>
          <p className="text-base">Regular paragraph text</p>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Muted text</p>
          <p className="text-xs uppercase tracking-wide">Small caps</p>
          <p className="text-gradient text-2xl font-bold">Gradient Text</p>
        </div>
      </Card>

      {/* Theme Features */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Theme Features</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(currentTheme?.features || {}).map(([feature, enabled]) => (
            <div 
              key={feature}
              className={cn(
                'p-4 rounded-lg border text-center',
                enabled 
                  ? 'border-[hsl(var(--success))] bg-[hsl(var(--success))]/5' 
                  : 'border-[hsl(var(--muted))] opacity-50'
              )}
            >
              <p className="font-medium capitalize">{feature.replace(/([A-Z])/g, ' $1').trim()}</p>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                {enabled ? 'Enabled' : 'Disabled'}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export default ThemeTester;
