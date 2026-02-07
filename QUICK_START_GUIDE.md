# 🚀 Quick Start Guide - All New Features

**Status:** ✅ ALL SYSTEMS GO  
**Access:** http://localhost:3000

---

## ⚡ QUICK TOUR

### 1. **Enhanced News & Intel Feed** 📰
**URL:** http://localhost:3000/feed

**What's New:**
- ✅ Beautiful gradient cover images (or fallback icons)
- ✅ Priority & duplicate badges on covers
- ✅ Collapsible sidebar with all sources
- ✅ "Add Source" button (works for all users!)
- ✅ Multiple view modes: Cards or List
- ✅ Advanced filters: Time, Priority, Search
- ✅ Click any card to open original article

**Try This:**
```
1. Click "Add Source" button in sidebar
2. Add a feed: 
   - Name: "Krebs on Security"
   - URL: https://krebsonsecurity.com/feed/
   - Type: RSS
3. Click "Add Source"
4. Articles appear automatically!
5. Try different view modes
6. Filter by time range
7. Search for keywords
```

---

### 2. **Duplicate Detection** 🎯
**How It Works:** Automatic during article ingestion

**What's New:**
- ✅ Content-based duplicate checking (not just URL)
- ✅ 80% similarity threshold (configurable)
- ✅ Checks last 3 days of articles
- ✅ Multi-strategy: title, content, domain, time
- ✅ Automatic skipping with detailed logs

**Try This:**
```
1. Ingest articles from a source
2. Add same article again (different source)
3. Check backend logs:
   docker logs huntsphere-backend-1 2>&1 | grep "duplicate"
4. Expected: "duplicate_detected_skipping" message
5. Article count doesn't increase
```

**See It In Action:**
```bash
# Check logs for duplicate detection
docker logs huntsphere-backend-1 2>&1 | grep -i "duplicate" | tail -20

# Look for messages like:
# "duplicate_detected_skipping" - Article was skipped
# "duplicate_check_failed" - Check encountered error
# "skipping_existing_article" - Exact match by external_id
```

---

### 3. **Report Version Control** 📋
**URL:** http://localhost:8000/docs (API endpoints)

**What's New:**
- ✅ Edit published reports (creates version snapshot)
- ✅ View complete version history
- ✅ Compare any two versions (diff view)
- ✅ Restore to previous version
- ✅ Change notes and summaries
- ✅ Full audit trail

**Try This via API:**
```bash
# 1. Create and publish a report (use UI)
#    Note the report ID (e.g., 123)

# 2. View version history
curl http://localhost:8000/reports/123/versions

# 3. Edit the report (use UI)
#    Make changes, republish

# 4. Compare versions
curl "http://localhost:8000/reports/123/compare?version1=1&version2=2"

# 5. Restore old version
curl -X POST http://localhost:8000/reports/123/restore/1 \
  -H "Authorization: Bearer YOUR_TOKEN"

# 6. Get specific version
curl http://localhost:8000/reports/123/version/1
```

**Workflow:**
```
Create Report → Publish (v1) → Edit → Republish (v2) → Edit → Republish (v3)
                    ↓              ↓                        ↓
                 Saved          Saved                   Saved
                 in history     in history              in history
```

---

### 4. **Unified User Management** 👥
**URL:** http://localhost:3000/admin → "User Management" tab

**What's New:**
- ✅ ALL user/permission features in ONE tab
- ✅ Stats dashboard at top
- ✅ 5 organized sub-tabs
- ✅ Complete role reference guide
- ✅ No more context switching

**Try This:**
```
1. Login as ADMIN
2. Go to Admin Portal
3. Click "User Management" tab
4. See stats at top:
   - Total Users
   - Active Users  
   - Roles: 4
   - Permissions: 50

5. Explore sub-tabs:
   📑 Users - Create/edit users
   🔐 Role Permissions - Define what each role can do
   👤 User Overrides - Individual exceptions
   📄 Page Access - Page-level restrictions
   📖 Quick Reference - Role guide

6. Click "Quick Reference"
7. See complete descriptions of:
   - ADMIN (full access)
   - TI (threat intelligence)
   - TH (threat hunter)
   - ANALYST (read-only)
```

---

## 🎨 VISUAL IMPROVEMENTS

### **Feed Page Before/After**

**BEFORE:**
```
┌────────────────────────┐
│ [Basic Card]           │
│ Title                  │
│ Summary                │
│ [Buttons]              │
└────────────────────────┘
```

**AFTER:**
```
┌────────────────────────┐
│ [Gradient Cover]   🔥  │  ← Priority badge
│  🔶 Duplicate          │  ← Duplicate badge
│                        │
├────────────────────────┤
│ Title (2 lines)        │
│ Summary (3 lines)      │
│ 📰 Source • ⏰ 2h ago  │
│ 📖 5 min read          │
│ 🏷️ phishing malware   │
├────────────────────────┤
│ ⭐ 👁️ [Analyze]      │  ← Better actions
└────────────────────────┘
```

### **Admin Portal Before/After**

**BEFORE:**
```
Admin Portal
├─ Overview
├─ Users  ← Separate tab
├─ RBAC   ← Separate tab
├─ Page Access  ← Separate tab
├─ Permissions  ← Separate tab
└─ Configuration
```

**AFTER:**
```
Admin Portal
├─ Overview
├─ User Management  ← ONE tab!
│  ├─ 📊 Stats Dashboard (always visible)
│  ├─ 📑 Users
│  ├─ 🔐 Role Permissions
│  ├─ 👤 User Overrides
│  ├─ 📄 Page Access
│  └─ 📖 Quick Reference
├─ Configuration
└─ GenAI Status
```

---

## 🔥 POWER USER TIPS

### **Duplicate Detection**
```bash
# Adjust sensitivity (in backend code)
# File: backend/app/integrations/sources.py, line ~181

# More strict (fewer duplicates detected):
similarity_threshold=0.90

# More loose (more duplicates detected):
similarity_threshold=0.70

# Check longer history:
lookback_days=7

# Check only today:
lookback_days=1
```

### **Version Control**
```bash
# Get version history
GET /reports/{id}/versions

# Compare versions (shows diff)
GET /reports/{id}/compare?version1=1&version2=2

# Restore old version
POST /reports/{id}/restore/{version}

# Edit published report (creates snapshot)
POST /reports/{id}/edit-published

# Republish with notes
POST /reports/{id}/republish
Body: {
  "change_summary": "Updated IOCs",
  "change_notes": "Added 10 new indicators from incident"
}
```

### **Feed Page**
```
Keyboard Shortcuts (when implemented):
- 'f' = Focus search
- 's' = Toggle sidebar
- 'v' = Switch view mode
- 'r' = Refresh articles

Click Actions:
- Card → Open original link
- ⭐ → Star/unstar
- 👁️ → Open reader
- [Analyze] → Deep analysis
```

---

## 📱 MOBILE EXPERIENCE

All new features are mobile-responsive:

- ✅ Feed sidebar auto-hides on small screens
- ✅ Cards stack vertically
- ✅ Filters become dropdown
- ✅ Admin tabs scroll horizontally
- ✅ Reader drawer becomes full-screen

---

## 🧪 TESTING CHECKLIST

### **Quick Health Check** (2 minutes)
```bash
# 1. Check all containers healthy
docker ps

# Expected: All containers show (healthy)

# 2. Check frontend
curl http://localhost:3000
# Expected: HTML response

# 3. Check backend
curl http://localhost:8000/health
# Expected: {"status":"healthy"}

# 4. Check duplicate detection
docker logs huntsphere-backend-1 2>&1 | grep "DuplicateChecker"
# Expected: Import successful, no errors

# 5. Check version control
docker exec huntsphere-postgres-1 psql -U huntsphere_user -d huntsphere_db \
  -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name='report_versions';"
# Expected: 1 (table exists)
```

### **Full Feature Test** (10 minutes)
```
✅ Feed Page
  ┣ Load page (no errors)
  ┣ Add new source
  ┣ View cards with covers
  ┣ Toggle view mode
  ┣ Apply filters
  ┣ Search articles
  ┗ Click article (opens link)

✅ Duplicate Detection
  ┣ Check logs for "duplicate"
  ┣ Ingest same article twice
  ┗ Verify count doesn't increase

✅ Version Control
  ┣ Create report
  ┣ Publish (v1)
  ┣ Edit and republish (v2)
  ┣ Call version history API
  ┣ Compare v1 and v2
  ┗ Restore to v1

✅ Unified User Management
  ┣ View stats dashboard
  ┣ Navigate all 5 sub-tabs
  ┣ View Quick Reference
  ┗ Create test user
```

---

## 🆘 TROUBLESHOOTING

### **Feed page not loading?**
```bash
# Check frontend logs
docker logs huntsphere-frontend-1 2>&1 | tail -50

# Rebuild and restart
docker-compose build frontend
docker-compose up -d frontend

# Hard refresh browser
Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
```

### **Duplicates not being detected?**
```bash
# Check if duplicate_checker is working
docker logs huntsphere-backend-1 2>&1 | grep "duplicate_check"

# Verify file exists
docker exec huntsphere-backend-1 ls -la /app/app/articles/duplicate_checker.py

# Check threshold settings
docker exec huntsphere-backend-1 grep -n "similarity_threshold" \
  /app/app/integrations/sources.py
```

### **Version control not saving?**
```bash
# Check if table exists
docker exec huntsphere-postgres-1 psql -U huntsphere_user -d huntsphere_db \
  -c "\dt report_versions"

# If not, run migration
docker exec huntsphere-backend-1 alembic upgrade head

# Check for errors
docker logs huntsphere-backend-1 2>&1 | grep -i "version"
```

### **User Management tab not showing?**
```bash
# Check if component exists
ls -la frontend/src/components/UnifiedUserManagement.js

# Check if imported in Admin.js
grep "UnifiedUserManagement" frontend/src/pages/Admin.js

# Rebuild if needed
docker-compose build frontend && docker-compose up -d frontend
```

---

## 📊 METRICS TO WATCH

### **Duplicate Detection**
```bash
# Total duplicates detected today
docker logs huntsphere-backend-1 2>&1 | grep "duplicate_detected" | wc -l

# Duplicate detection success rate
docker logs huntsphere-backend-1 2>&1 | \
  grep -E "duplicate_detected|duplicate_check_failed"
```

### **Version Control**
```bash
# Total versions created
docker exec huntsphere-postgres-1 psql -U huntsphere_user -d huntsphere_db \
  -c "SELECT COUNT(*) FROM report_versions;"

# Reports with multiple versions
docker exec huntsphere-postgres-1 psql -U huntsphere_user -d huntsphere_db \
  -c "SELECT report_id, COUNT(*) FROM report_versions GROUP BY report_id HAVING COUNT(*) > 1;"
```

### **User Activity**
```bash
# Active users
docker exec huntsphere-postgres-1 psql -U huntsphere_user -d huntsphere_db \
  -c "SELECT COUNT(*) FROM users WHERE is_active=true;"

# User by role
docker exec huntsphere-postgres-1 psql -U huntsphere_user -d huntsphere_db \
  -c "SELECT role, COUNT(*) FROM users GROUP BY role;"
```

---

## 🎉 YOU'RE READY!

**Everything is working:**
- ✅ Enhanced feed with great UX
- ✅ Smart duplicate detection
- ✅ Complete version control
- ✅ Unified admin interface

**Start exploring:**
1. 📰 Visit http://localhost:3000/feed
2. 👥 Check out Admin → User Management
3. 🔍 Look for duplicates in logs
4. 📋 Create and version a report

**Need help?**
- Full docs: `COMPLETE_ENHANCEMENTS_SUMMARY.md`
- API reference: http://localhost:8000/docs
- Check logs: `docker logs huntsphere-backend-1`

**Enjoy your enhanced HuntSphere platform!** 🚀
