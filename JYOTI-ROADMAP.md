# Jyoti Development Roadmap

## Current Status: ⚠️ Frontend Build Issues

**Problem:** Building frontend from scratch is taking too long (10+ minutes) and having issues.

**Solution:** Copy working login page from `New-look` branch and iterate from there.

---

## 🎯 Priority 1: Get Docker Working (TODAY)

### Step 1: Use New-look Frontend (15 min)
- [ ] Copy working `LoginPage.jsx` from New-look branch
- [ ] Copy working `Dashboard.jsx` from New-look branch
- [ ] Copy theme files from New-look branch
- [ ] Test login works at localhost:3000
- [ ] Verify backend API connection

**Files to copy:**
```bash
# From New-look branch to Jyoti branch
frontend/src/sections/LoginPage.jsx
frontend/src/sections/Dashboard.jsx
frontend/src/themes.js
frontend/src/styles/parshu-theme.css
```

### Step 2: Minimal Working Version (30 min)
- [ ] Login page works
- [ ] Shows "News" page after login (even if empty)
- [ ] Logout works
- [ ] No black screen errors

**Success Criteria:**
- ✅ Can login with admin credentials
- ✅ See a working UI (not black screen)
- ✅ Can navigate between pages
- ✅ Backend responds to API calls

---

## 🚀 Priority 2: Core Feed Features (Week 1)

### Phase 1: Custom Feed Management
**User Story:** As a user, I want to add my own RSS/web feeds

- [ ] **Add Feed UI**
  - Input: URL, Name, Category
  - Support: RSS, Atom, HTML scraping
  - Validation: Check URL is valid

- [ ] **Feed Categories**
  - User can create custom categories
  - Assign feeds to categories
  - Default categories: News, Blogs, Research, Other

- [ ] **Feed Organization**
  - Drag & drop feeds between categories
  - Right-click → "Move to Category"
  - Rename/delete categories

### Phase 2: Content Fetching
**User Story:** As a user, I want to fetch content from any URL

- [ ] **Multi-format Support**
  - HTML web pages (BeautifulSoup parsing)
  - PDF documents (pypdf extraction)
  - Word documents (.docx parsing)
  - CSV data (pandas parsing)

- [ ] **Backend Endpoints**
  ```python
  POST /api/fetch-content
  {
    "url": "https://example.com/article.pdf",
    "format": "auto"  # or "html", "pdf", "docx", "csv"
  }

  Response:
  {
    "title": "Article Title",
    "content": "Extracted text...",
    "format": "pdf",
    "metadata": {...}
  }
  ```

- [ ] **Storage**
  - Store fetched content in database
  - Tag with source category
  - Track fetch date & status

---

## 🤖 Priority 3: GenAI Integration (Week 2)

### Phase 1: Use Existing Prompts/Guardrails from New-look

**Copy these from New-look branch:**
- [ ] `backend/app/genai/prompts.py` - Personas & prompt templates
- [ ] `backend/app/genai/guardrails.py` - Safety checks
- [ ] `backend/app/genai/provider.py` - Ollama/API integration

### Phase 2: Content Analysis
**User Story:** As a user, I want AI summaries of articles

- [ ] **Executive Summary**
  - 2-3 sentence high-level overview
  - Key points & takeaways
  - Business impact

- [ ] **Technical Summary**
  - Detailed technical breakdown
  - Step-by-step explanation
  - Technical terms explained

- [ ] **IOC Extraction**
  - IPs, domains, URLs
  - File hashes (MD5, SHA256)
  - CVE numbers
  - Threat actor names

### Phase 3: Interactive Q&A
**User Story:** As a user, I want to ask questions about fetched content

- [ ] **Live Internet Search**
  - User asks question about article
  - GenAI searches internet (via Ollama + web plugin)
  - Synthesizes answer from multiple sources

- [ ] **Context-Aware Responses**
  - GenAI has context of article content
  - Can compare/contrast with other sources
  - Provides citations

**Example Flow:**
```
User reads article about Log4Shell vulnerability
User asks: "What are the latest patches for this?"
GenAI:
  1. Searches internet for Log4Shell patches (2026)
  2. Reads official Apache guidance
  3. Synthesizes response with citations
```

---

## 🔧 Priority 4: Admin Features (Week 3)

### Prompt & Guardrail Management

- [ ] **Admin UI for Prompts**
  - List all GenAI personas (Analyst, Executive, Technical)
  - Edit prompt templates
  - Add new personas
  - Test prompts with sample content

- [ ] **Admin UI for Guardrails**
  - List safety rules (no malicious code, no PII leaks)
  - Edit guardrail thresholds
  - Add custom guardrails
  - Test guardrails with sample outputs

- [ ] **Backend APIs**
  ```python
  GET    /api/admin/prompts
  POST   /api/admin/prompts
  PUT    /api/admin/prompts/{id}
  DELETE /api/admin/prompts/{id}

  GET    /api/admin/guardrails
  POST   /api/admin/guardrails
  PUT    /api/admin/guardrails/{id}
  DELETE /api/admin/guardrails/{id}
  ```

---

## 📁 Feature Breakdown

### Immediate (This Session)
1. ✅ Create automated troubleshooting scripts (DONE)
2. 🔄 Copy working frontend from New-look branch
3. 🔄 Get localhost:3000 showing login page
4. 🔄 Test login → news page flow

### Week 1: Core Feeds
- Custom feed URLs (RSS, Atom, HTML)
- User-defined categories
- Drag & drop organization
- Multi-format content fetching (PDF, Word, CSV)

### Week 2: GenAI Features
- Copy prompts/guardrails from New-look
- Executive & technical summaries
- IOC extraction
- Interactive Q&A with internet search

### Week 3: Admin & Polish
- Admin prompt management UI
- Admin guardrail management UI
- Testing & bug fixes
- Documentation

---

## 🎨 UI/UX Design Principles

Based on your request for "less crowded, easy to navigate":

### Layout
- **Sidebar navigation** (already in New-look)
  - News (default landing)
  - My Feeds
  - Categories
  - Search
  - Settings (admin only)

- **Clean cards** for articles
  - Title, source, date
  - Summary preview
  - "Read more" / "Analyze with AI" buttons

### Feed Management
- **Simple table view**
  - Name | URL | Category | Actions
  - Add button (top-right)
  - Bulk actions (multi-select)

- **Category sidebar**
  - Drag feeds between categories
  - Right-click context menu

### GenAI Features
- **Inline summaries**
  - Expand/collapse sections
  - Executive vs. Technical toggle
  - Copy to clipboard

- **Q&A sidebar**
  - Chat-like interface
  - Ask questions about current article
  - Shows sources/citations

---

## 🛠️ Technical Architecture

### Frontend (React)
```
frontend/src/
├── sections/
│   ├── LoginPage.jsx        ← Copy from New-look
│   ├── Dashboard.jsx         ← Copy from New-look
│   ├── FeedManagement.jsx    ← NEW
│   ├── CategoryManager.jsx   ← NEW
│   └── AIAnalysis.jsx        ← NEW
├── components/
│   ├── FeedCard.jsx          ← NEW
│   ├── CategoryTree.jsx      ← NEW
│   └── AIChat.jsx            ← NEW
└── api/
    └── client.js             ← Extend with new endpoints
```

### Backend (FastAPI)
```
backend/app/
├── feeds/
│   ├── routes.py             ← Custom feed CRUD
│   ├── fetcher.py            ← Multi-format content fetching
│   └── parser.py             ← HTML/PDF/DOCX/CSV parsing
├── categories/
│   ├── routes.py             ← Category management
│   └── models.py             ← Category DB model
├── genai/
│   ├── prompts.py            ← Copy from New-look
│   ├── guardrails.py         ← Copy from New-look
│   ├── provider.py           ← Copy from New-look
│   └── admin.py              ← NEW: Admin management
└── analysis/
    ├── summarizer.py         ← GenAI summarization
    ├── ioc_extractor.py      ← IOC extraction
    └── qa_service.py         ← NEW: Interactive Q&A
```

---

## 📊 Database Schema Changes

### New Tables

**categories**
```sql
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  user_id INTEGER REFERENCES users(id),
  color VARCHAR(7),  -- Hex color for UI
  icon VARCHAR(50),  -- Icon name
  created_at TIMESTAMP DEFAULT NOW()
);
```

**user_feeds**
```sql
CREATE TABLE user_feeds (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  name VARCHAR(200) NOT NULL,
  url TEXT NOT NULL,
  feed_type VARCHAR(20),  -- 'rss', 'atom', 'html', 'custom'
  category_id INTEGER REFERENCES categories(id),
  is_active BOOLEAN DEFAULT true,
  fetch_interval_minutes INTEGER DEFAULT 60,
  last_fetched TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**fetched_content**
```sql
CREATE TABLE fetched_content (
  id SERIAL PRIMARY KEY,
  feed_id INTEGER REFERENCES user_feeds(id),
  url TEXT NOT NULL,
  title TEXT,
  content TEXT,
  content_format VARCHAR(20),  -- 'html', 'pdf', 'docx', 'csv'
  metadata JSONB,
  executive_summary TEXT,
  technical_summary TEXT,
  iocs JSONB,
  fetched_at TIMESTAMP DEFAULT NOW(),
  analyzed_at TIMESTAMP
);
```

**genai_prompts** (admin-managed)
```sql
CREATE TABLE genai_prompts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  persona VARCHAR(50),  -- 'analyst', 'executive', 'technical'
  template TEXT NOT NULL,
  variables JSONB,
  is_active BOOLEAN DEFAULT true,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**genai_guardrails** (admin-managed)
```sql
CREATE TABLE genai_guardrails (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  rule_type VARCHAR(50),  -- 'content_filter', 'output_validation', etc.
  config JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🧪 Testing Strategy

### Unit Tests
- Feed parsers (HTML, PDF, Word, CSV)
- GenAI prompt rendering
- Guardrail validation

### Integration Tests
- Feed fetching end-to-end
- GenAI analysis pipeline
- Category management

### E2E Tests (Playwright)
- Login flow
- Add custom feed
- Create category
- Drag & drop feed
- Request AI summary
- Ask Q&A question

---

## 📝 Next Actions

**RIGHT NOW (save tokens):**
1. Run this command to copy working frontend:
   ```bash
   git checkout New-look -- frontend/src/sections/LoginPage.jsx
   git checkout New-look -- frontend/src/sections/Dashboard.jsx
   git checkout New-look -- frontend/src/themes.js
   ```

2. Build and test:
   ```bash
   docker-compose build frontend
   docker-compose up -d
   ```

3. Test at http://localhost:3000

**AFTER LOGIN WORKS:**
1. Create feed management UI
2. Add category system
3. Integrate GenAI from New-look

---

## 💡 Key Decisions

| Decision | Rationale |
|----------|-----------|
| **Copy from New-look** | Working code > building from scratch |
| **Ollama + API toggle** | Support both local & cloud GenAI |
| **User categories** | Flexibility > predefined structure |
| **Drag & drop** | Better UX than manual forms |
| **Multi-format fetching** | Users need PDFs, Word docs, not just RSS |
| **Interactive Q&A** | Differentiates from basic RSS readers |

---

**Ready to proceed?**
1. Copy working frontend from New-look
2. Get Docker running
3. Then build features incrementally
