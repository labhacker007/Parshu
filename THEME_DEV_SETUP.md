# PARSHU Theme Development Setup

> **Status**: ✅ Ready for development  
> **Branch**: `feature/new-look-theme`  
> **Location**: `C:\Users\tarun\OneDrive\Master\Tarun\Documents\Pulser\Parshu`

---

## What's Been Set Up

### 1. Working Environment
- ✅ Main Parshu codebase (working stable base)
- ✅ Docker containers running (frontend + backend + database)
- ✅ Theme system integrated

### 2. Theme System
**3 Themes Available:**
- **🖥️ Hacker Mode**: Matrix green, terminal style, monospace font
- **🌙 Dark Mode**: Professional SOC (default)
- **☀️ Light Mode**: Clean enterprise interface

**How it works:**
- CSS variables in `frontend/src/styles/themes/theme-variables.css`
- React context in `frontend/src/styles/themes/ThemeContext.jsx`
- Theme toggle button added to navbar
- Instant switch (no page reload)

### 3. File Structure
```
frontend/src/
├── styles/themes/
│   ├── theme-variables.css    # Color definitions for 3 themes
│   ├── theme-components.css   # Component styles using vars
│   ├── ThemeContext.jsx       # React context for theme state
│   ├── ThemeToggle.jsx        # Toggle button component
│   └── ThemePreview.jsx       # Theme preview cards
├── components/layout/
│   ├── NewHeader.jsx          # Themed header
│   ├── NewSidebar.jsx         # Themed sidebar
│   └── layout.css             # Layout styles
└── App.js                     # Updated to use ThemeProvider
```

---

## Quick Start

### Option 1: Double-click
```
start-theme-dev.bat
```

### Option 2: Manual
```bash
cd C:\Users\tarun\OneDrive\Master\Tarun\Documents\Pulser\Parshu
docker-compose up -d
start http://localhost:3000
```

---

## How to Use

1. **Open**: http://localhost:3000
2. **Login**: Use existing admin credentials
3. **Switch Themes**: Click the 🌙/🖥️/☀️ button in top-right navbar
4. **See Changes**: Theme switches instantly

---

## Development Workflow

### To Modify a Theme
Edit `frontend/src/styles/themes/theme-variables.css`:

```css
/* Hacker Theme */
.theme-hacker {
  --bg-primary: #050505;
  --text-primary: #00ff41;
  --accent-primary: #00ff41;
}

/* Dark Theme */
.theme-dark {
  --bg-primary: #0f172a;
  --text-primary: #f1f5f9;
  --accent-primary: #3b82f6;
}

/* Light Theme */
.theme-light {
  --bg-primary: #ffffff;
  --text-primary: #0f172a;
  --accent-primary: #2563eb;
}
```

### To Apply Theme Changes
```bash
# Restart frontend container
docker-compose restart frontend

# Or rebuild if needed
docker-compose up -d --build frontend
```

---

## Testing Checklist

- [ ] Open http://localhost:3000
- [ ] Login works
- [ ] Theme toggle button visible in navbar
- [ ] Clicking toggle switches themes
- [ ] Hacker mode shows green colors
- [ ] Light mode shows white background
- [ ] Dark mode shows navy background
- [ ] All pages work with each theme

---

## Troubleshooting

### Frontend not loading
```bash
docker-compose restart frontend
```

### Theme not switching
- Check browser console for errors
- Ensure `ThemeProvider` wraps the app in App.js
- Verify CSS files are imported

### Full reset
```bash
docker-compose down
docker-compose up -d --build
```

---

## Next Steps (Your Choice)

### Option A: Refine Current Themes
- Adjust colors in `theme-variables.css`
- Add more visual effects (scanlines, glows)
- Test all components with each theme

### Option B: Add More Features
- Theme persistence (save to localStorage) ✅ Already done
- System-wide theme sync
- Custom user themes

### Option C: Integration
- Connect to backend user preferences
- Auto-detect system theme preference
- Theme scheduling (day/night mode)

---

## Key Files for Theme Development

| File | Purpose |
|------|---------|
| `frontend/src/styles/themes/theme-variables.css` | Theme color definitions |
| `frontend/src/styles/themes/theme-components.css` | Component styles |
| `frontend/src/components/NavBar.js` | Theme toggle button location |
| `frontend/src/App.js` | Theme provider wrapper |

---

**You're all set! Open http://localhost:3000 and start developing.**
