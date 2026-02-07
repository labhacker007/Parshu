# HuntSphere Requirements Checklist (Last 20 User Inputs)

## ADMIN PORTAL

### 1. Tab Navigation
- [x] **FIXED** Admin tab should NOT reset to Overview after making changes or saving settings
  - Issue: Early return when `loading=true` caused full re-render
  - Fix: Removed early return, show loading spinner inline instead

### 2. Ollama / GenAI Integration
- [x] Admin provides only URL and model name for setup
- [x] Auto-detection of working URL (tries `host.docker.internal`, `ollama`, provided URL)
- [x] Clear error messages explaining Docker networking
- [x] Check Status button doesn't spin continuously (has concurrent call prevention)
- [x] Model pull shows "in progress" status with polling until model available
- [x] Model preferences (primary/secondary) can be saved
- [x] Quick setup endpoint saves working URL to database

### 3. Knowledge Base (RAG)
- [x] Upload documents (PDF, CSV, Excel, Word)
- [x] Upload URLs with crawl depth option
- [x] Background crawling with status indicators (PENDING, PROCESSING, CRAWLING, READY, FAILED)
- [x] View all chunks (`/knowledge/chunks/all` endpoint)
- [x] Delete individual chunks (`/knowledge/chunks/{chunk_id}` DELETE endpoint)
- [x] Delete documents (`/knowledge/{doc_id}` DELETE endpoint)
- [x] "Fix Stuck" button to reset stuck PROCESSING/CRAWLING documents
- [x] Separate admin-managed vs user-managed knowledge bases
- [x] Chunks are used by GenAI for RAG context

### 4. Guardrails / Prompt Management
- [x] View guardrails by function (IOC extraction, summaries, hunt queries, etc.)
- [x] Global guardrails applied to all functions
- [x] Add new guardrails with name, description, category
- [x] Edit existing guardrails
- [x] Delete guardrails
- [x] Toggle guardrails on/off
- [x] Reset to defaults
- [x] Preview generated prompts with guardrails applied

### 5. Data Retention Policy
- [x] Edit data retention settings (article, audit, hunt retention days)

## ARTICLE MANAGEMENT

### 6. Article Queue & Detail Page
- [x] View articles by status (NEW, IN_ANALYSIS, NEED_TO_HUNT, REVIEWED, ARCHIVED)
- [x] Tags field visible for all article statuses
- [x] High priority articles matched by keywords
- [x] Polished executive and technical summaries with formatting
- [x] Export from article detail page (PDF, HTML, CSV)

### 7. Intelligence Extraction
- [x] Extract IOCs and TTPs (removed IOAs per user request)
- [x] Regex extraction available
- [x] GenAI extraction with guardrails
- [x] Multi-model comparison (use model that finds more IOCs)
- [x] Edit intelligence entries
- [x] Differentiate between file names, extensions, and domain names (guardrail)

## HUNT WORKBENCH

### 8. Hunt Queries
- [x] Generate hunt queries from article detail page
- [x] Select connector/platform (XSIAM, Defender, Splunk, Wiz)
- [x] Edit generated hunts
- [x] Delete hunts (single and batch)
- [x] Launch/execute hunts
- [x] View hunt execution results/API responses
- [x] Hunt status indicators (PENDING, RUNNING, COMPLETED, FAILED)
- [x] "Need to Hunt" status shows articles in hunt workbench
- [x] View original article link from hunt workbench
- [x] GenAI-generated hunt titles

## REPORTS

### 9. Report Generation
- [x] Generate reports (Executive, Technical, Comprehensive)
- [x] GenAI-enhanced summarization
- [x] Single report per request (double-submission prevention)
- [x] Delete reports (single and batch)
- [x] Report audit logging

### 10. Report Export
- [x] Export PDF with professional formatting
- [x] Export HTML (viewable in browser)
- [x] Export CSV

## CHATBOT

### 11. HuntSphere AI Chatbot
- [x] Uses GenAI provider (Ollama/OpenAI/Anthropic)
- [x] Uses knowledge base via RAG
- [x] Applies guardrails to responses
- [x] URL crawling from chatbot interface
- [x] User-level personal documents

## USER MANAGEMENT

### 12. User Operations
- [x] Create users
- [x] User already exists validation
- [x] Proper error messages

## CONNECTORS

### 13. Integration Connectors
- [x] Standard naming conventions for tools
- [x] XSIAM, Defender, Splunk, Wiz, VMRay integrations

## DASHBOARDS & FILTERING

### 14. Dashboard Tiles
- [x] Clickable tiles that filter data appropriately
- [x] Watchlist with high-priority article links
- [x] Dashboard data updates correctly

## API ENDPOINTS VERIFIED

### Admin Routes (`/admin`)
- GET `/admin/settings` - Get admin settings
- GET `/admin/stats` - Dashboard statistics
- POST `/admin/genai/ollama/setup` - Quick Ollama setup
- GET `/admin/genai/ollama/status` - Check Ollama status
- POST `/admin/genai/ollama/pull-model` - Pull Ollama model
- GET/PUT/DELETE `/admin/guardrails/{function}` - Manage guardrails
- GET `/admin/guardrails/preview/{function}` - Preview prompt

### Knowledge Routes (`/knowledge`)
- POST `/knowledge/upload/file` - Upload document
- POST `/knowledge/upload/url` - Add URL
- POST `/knowledge/crawl` - Crawl website
- GET `/knowledge/` - List documents
- GET `/knowledge/{doc_id}` - Get document details
- PATCH `/knowledge/{doc_id}` - Update document (includes status override)
- DELETE `/knowledge/{doc_id}` - Delete document
- GET `/knowledge/chunks/all` - Get all chunks
- DELETE `/knowledge/chunks/{chunk_id}` - Delete chunk

### Articles Routes (`/articles`)
- GET `/articles/` - List articles
- GET `/articles/{id}` - Get article
- PATCH `/articles/{id}` - Update article
- GET `/articles/{id}/export/pdf` - Export PDF
- GET `/articles/{id}/export/html` - Export HTML
- GET `/articles/{id}/export/csv` - Export CSV

### Hunts Routes (`/hunts`)
- POST `/hunts/generate` - Generate hunt query
- POST `/hunts/{id}/execute` - Execute hunt
- GET `/hunts/{id}/executions` - Get execution results
- PATCH `/hunts/{id}` - Update/edit hunt
- DELETE `/hunts/{id}` - Delete hunt
- DELETE `/hunts/batch/delete` - Batch delete

### Reports Routes (`/reports`)
- POST `/reports/` - Create report
- GET `/reports/` - List reports
- GET `/reports/{id}` - Get report
- DELETE `/reports/{id}` - Delete report
- POST `/reports/batch-delete` - Batch delete
- GET `/reports/{id}/export/pdf` - Export PDF
- GET `/reports/{id}/export/html` - Export HTML
- GET `/reports/{id}/export/csv` - Export CSV

## FIXES APPLIED IN THIS SESSION

### 1. Admin Tab Reset - FIXED ✅
**Issue:** Tabs reset to Overview after actions
**Solution:** Remove loading state that caused full re-render, use inline spinner instead

### 2. Health Status Degraded - FIXED ✅
**Issue:** SQL text() declaration error showing "Degraded"
**Solution:** Added `from sqlalchemy import text` and wrapped SQL in `text("SELECT 1")`

### 3. Knowledge Base Delete - FIXED ✅
**Issue:** Delete failing with NotNullViolation on chunks
**Solution:** 
- Changed relationship to `passive_deletes=True`
- Use raw SQL in delete endpoint to bypass ORM tracking
- Database CASCADE handles chunk deletion

### 4. Hunt Status - FIXED ✅
**Issue:** Hunts marked COMPLETED even when connection failed
**Solution:** Wrap connector in try-catch, check result status, only mark COMPLETED on success

### 5. Hunt-Article Association - FIXED ✅
**Issue:** Article status not updated when hunts launched/completed
**Solution:**
- On generate: Update to NEED_TO_HUNT, save extracted intel
- On complete: Update to REVIEWED, set reviewed_by/reviewed_at

### 6. Hunt Workbench UI - FIXED ✅
**Issue:** Executive summary instead of technical, intel/hunt icons not populated
**Solution:** 
- Changed to `technical_summary`
- Fixed icon logic to use `intelligence_count` and `hunt_status.length`

### 7. Model Preferences - FIXED ✅
**Issue:** Preferences reset after refresh
**Solution:** Only update state on initial load, preserve user selections

### 8. Ollama Setup - ENHANCED ✅
**Features Added:**
- Auto-check status on page load
- Always show recommended models
- One-click Docker install command
- Better pull progress feedback
- Connection check before pull attempt

### 9. Intel Feed Page - FIXED ✅
**Issue:** Page not loading, navigation broken
**Solution:**
- Added `/feeds` route alias
- Improved error handling with retry button
- Fixed useEffect dependencies

### 10. User Edit Dialog - FIXED ✅
**Issue:** Text alignment issues, unprofessional appearance
**Solution:** Proper Typography import, larger inputs, better layout
