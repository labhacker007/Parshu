# HuntSphere Enhancement Implementation Plan

## Overview
This document outlines the comprehensive enhancement plan for the HuntSphere threat intelligence platform based on user feedback and testing requirements.

---

## Phase 1: Article Queue Enhancements (HIGH PRIORITY)

### 1.1 Change "Published" to "Ingestion Date"
**Status:** ✅ COMPLETED
- **Frontend Changes:**
  - `ArticleQueue.js`: Column header changed from "Published" to "Ingestion Date"
  - Display `created_at` instead of `published_at`
  - Show when article was ingested into system

### 1.2 Add Status Change Option in Article Detail View
**Status:** 🔄 PENDING
- **Location:** Article Drawer in `ArticleQueue.js`
- **Changes Needed:**
  - Add dropdown select for status change at top of drawer
  - Allow analyst to change status to any available option:
    - NEW
    - TRIAGED
    - IN_ANALYSIS
    - REVIEWED
    - REPORTED
    - ARCHIVED
  - Add "Update Status" button
  - Show success/error messages
  - Refresh article list after status change
  - Update backend timestamp fields (analyzed_at, reviewed_at)

**Implementation:**
```javascript
// Add status change section in drawer
<Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
  <Text strong>Change Status:</Text>
  <Space>
    <Select value={statusChange} onChange={setStatusChange} style={{ width: 200 }}>
      <Option value="NEW">NEW</Option>
      <Option value="TRIAGED">TRIAGED</Option>
      <Option value="IN_ANALYSIS">IN_ANALYSIS</Option>
      <Option value="REVIEWED">REVIEWED</Option>
      <Option value="REPORTED">REPORTED</Option>
      <Option value="ARCHIVED">ARCHIVED</Option>
    </Select>
    <Button type="primary" onClick={handleStatusUpdate}>
      Update Status
    </Button>
  </Space>
</Space>
```

### 1.3 Fix High Priority Filter
**Status:** 🔄 PENDING
- **Issue:** High priority filter doesn't persist or work correctly
- **Fix:** 
  - When "High Priority Only" is clicked, it should ONLY show high priority articles
  - Filter should persist across page refreshes
  - Visual indicator should clearly show filter is active
  - Badge color should be more prominent

---

## Phase 2: Dashboard Enhancements (HIGH PRIORITY)

### 2.1 Make All Tiles Clickable with Filtering
**Status:** 🔄 PENDING
- **Location:** `Dashboard.js`
- **Tiles to Make Clickable:**

#### Statistics Tiles:
1. **Total Articles** → Navigate to `/articles` (all articles)
2. **New (Unread)** → Navigate to `/articles?status=NEW`
3. **In Analysis** → Navigate to `/articles?status=IN_ANALYSIS`
4. **High Priority** → Navigate to `/articles?high_priority=true`
5. **Reviewed This Week** → Navigate to `/articles?status=REVIEWED&period=week`

#### Feed Source Tiles:
6. **Under each source:**
   - "X new" → Navigate to `/articles?source_id=X&status=NEW`
   - "X reviewed" → Navigate to `/articles?source_id=X&status=REVIEWED`

**Implementation Approach:**
```javascript
// Add onClick handlers to Card/Statistic components
<Card 
  hoverable 
  onClick={() => navigate('/articles?status=NEW')}
  style={{ cursor: 'pointer' }}
>
  <Statistic title="New (Unread)" value={stats.new} />
</Card>

// ArticleQueue.js needs to read URL parameters on mount
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const status = params.get('status');
  const highPriority = params.get('high_priority');
  const sourceId = params.get('source_id');
  
  if (status) setStatusFilter(status);
  if (highPriority) setHighPriorityOnly(true);
  if (sourceId) setSourceFilter(parseInt(sourceId));
}, []);
```

### 2.2 Fix UI Issues

#### 2.2.1 Fix Green Color Indicator
**Status:** 🔄 PENDING
- **Issue:** Green active indicator is too sharp/bright
- **Fix:** Change from `#52c41a` to softer green `#95de64` or `#b7eb8f`
- **Location:** All status indicators showing "Active"

#### 2.2.2 Stop Auto-Rotation Animation
**Status:** 🔄 PENDING
- **Issue:** Automation button keeps rotating, making it less noticeable
- **Fix:** Remove continuous spin animation, only animate on click/action
- **Location:** `Dashboard.js` automation button

#### 2.2.3 Add Refresh Popup Messages
**Status:** 🔄 PENDING
- **Feature:** Show confirmation message after refresh
- **Implementation:**
```javascript
const handleRefresh = async () => {
  await fetchData();
  message.success('Dashboard refreshed! All sources and tiles updated.', 3);
};
```

---

## Phase 3: Intelligence Extraction (CRITICAL)

### 3.1 Auto-Extract on Status Change
**Status:** 🔄 PENDING
- **Trigger:** When article status changes FROM "NEW" to any other status
- **Backend Changes Needed:**
  - `backend/app/articles/routes.py` - Add extraction trigger in status update endpoint
  - Call extraction service when status != "NEW"
  
**Flow:**
```
Article Status Update → NEW → TRIAGED
    ↓
Check if status changed from NEW
    ↓
Trigger extraction automatically
    ↓
Extract IOCs, TTPs, IOAs
    ↓
Save to ExtractedIntelligence table
```

### 3.2 Enhanced IOC Extraction
**Status:** 🔄 PENDING
- **Location:** `backend/app/extraction/extractor.py`

#### Current Extraction:
- Basic IOC extraction exists

#### Enhanced Extraction Needed:
1. **IP Addresses** (IPv4, IPv6)
   - Pattern: `\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b`
   - Validation: Check valid IP ranges

2. **Email Addresses**
   - Pattern: `\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b`

3. **Domains**
   - Pattern: `\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]\b`

4. **File Hashes**
   - MD5: `\b[a-f0-9]{32}\b`
   - SHA-1: `\b[a-f0-9]{40}\b`
   - SHA-256: `\b[a-f0-9]{64}\b`

5. **URLs**
   - Pattern: `https?://[^\s<>"{}|\\^`[\]]+`

6. **CVEs**
   - Pattern: `CVE-\d{4}-\d{4,7}`

7. **Filenames**
   - Pattern: `[a-zA-Z0-9_-]+\.(exe|dll|bat|ps1|sh|zip|rar|doc|docx|xls|xlsx|pdf)`

8. **Registry Keys**
   - Pattern: `HKEY_[A-Z_]+\\[^\s]+`

9. **ASN Numbers**
   - Pattern: `AS\d{1,10}`

10. **Windows Commands**
    - Detect: cmd.exe, powershell.exe, regsvr32, etc.

11. **TTPs - MITRE ATT&CK**
    - Use GenAI to identify techniques
    - Pattern: `T\d{4}(\.\d{3})?`

12. **IOAs - Behavioral Indicators**
    - Extract suspicious behaviors
    - Process creation patterns
    - Network connections
    - File modifications

**Implementation:**
```python
# backend/app/extraction/extractor.py
class IntelligenceExtractor:
    def extract_all(self, text: str) -> List[ExtractedIntel]:
        results = []
        results.extend(self.extract_ips(text))
        results.extend(self.extract_emails(text))
        results.extend(self.extract_hashes(text))
        results.extend(self.extract_domains(text))
        results.extend(self.extract_cves(text))
        results.extend(self.extract_filenames(text))
        results.extend(self.extract_registry_keys(text))
        results.extend(self.extract_asn(text))
        results.extend(self.extract_commands(text))
        results.extend(self.extract_ttps_with_genai(text))
        return results
```

### 3.3 Manual Extraction Button
**Status:** 🔄 PENDING
- **Location:** Hunt page and Article detail drawer
- **Feature:** "Extract Intelligence" button
- **Behavior:** 
  - Click to manually trigger extraction
  - Show progress indicator
  - Display extracted items immediately
  - Allow re-extraction if needed

---

## Phase 4: Reports Enhancement

### 4.1 Clean HTML Tags from Reports
**Status:** 🔄 PENDING
- **Issue:** Reports contain HTML tags making them hard to read
- **Backend Changes:** `backend/app/reports/routes.py`
- **Implementation:**
```python
from bs4 import BeautifulSoup

def clean_html(html_content: str) -> str:
    """Remove HTML tags and return clean text"""
    soup = BeautifulSoup(html_content, 'html.parser')
    return soup.get_text(separator='\n', strip=True)

# Apply to report generation
report_content = clean_html(article.normalized_content)
```

### 4.2 Fix Download Functionality
**Status:** 🔄 PENDING
- **Issue:** Download buttons not working
- **Location:** `frontend/src/pages/Reports.js`
- **Formats to Support:**
  - CSV Export
  - DOCX Export
  - PDF Export (future)

**Implementation:**
```javascript
const handleDownload = async (reportId, format) => {
  try {
    const response = await reportsAPI.exportCsv(reportId); // or exportDocx
    const blob = new Blob([response.data], { 
      type: format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `report-${reportId}.${format}`;
    link.click();
    message.success('Report downloaded successfully!');
  } catch (error) {
    message.error('Failed to download report');
  }
};
```

---

## Phase 5: Feed Sources Page Enhancement

### 5.1 Make Article Count Badges Clickable
**Status:** 🔄 PENDING
- **Location:** `frontend/src/pages/Sources.js`
- **Changes:**
  - "X new" badge → Click → Navigate to articles filtered by source + NEW status
  - "X reviewed" badge → Click → Navigate to articles filtered by source + REVIEWED status
  - Update counts dynamically based on actual article statuses

**Implementation:**
```javascript
<Space>
  <Tag 
    color="blue" 
    style={{ cursor: 'pointer' }}
    onClick={() => navigate(`/articles?source_id=${source.id}&status=NEW`)}
  >
    {source.new_count} new
  </Tag>
  <Tag 
    color="green"
    style={{ cursor: 'pointer' }}
    onClick={() => navigate(`/articles?source_id=${source.id}&status=REVIEWED`)}
  >
    {source.reviewed_count} reviewed
  </Tag>
</Space>
```

### 5.2 Dynamic Status Counts
**Status:** 🔄 PENDING
- **Backend API:** Add endpoint to get article counts by source and status
- **Endpoint:** `GET /sources/{id}/stats`
- **Response:**
```json
{
  "source_id": 1,
  "total": 100,
  "new": 45,
  "triaged": 20,
  "in_analysis": 10,
  "reviewed": 20,
  "reported": 5,
  "archived": 0
}
```

---

## Phase 6: Admin Panel Updates

### 6.1 Add Popup Confirmations
**Status:** 🔄 PENDING
- **Feature:** Show confirmation popups for connector operations
- **Location:** `frontend/src/pages/Admin.js`
- **Scenarios:**
  - Test Connection → "Connection successful! ✓" or "Connection failed ✗"
  - Save Configuration → "Configuration saved successfully!"
  - Delete Connector → "Are you sure?"

### 6.2 Remove Configuration Display
**Status:** 🔄 PENDING
- **Issue:** Sensitive configuration details shown in UI
- **Fix:** Remove or mask sensitive fields like API keys, passwords
- **Implementation:**
```javascript
// Mask sensitive fields
const maskSensitive = (value) => {
  if (!value) return '';
  return '*'.repeat(Math.min(value.length, 20));
};
```

---

## Phase 7: Hunt Page Enhancement

### 7.1 Integration with Auto-Extraction
**Status:** 🔄 PENDING
- **Feature:** Show extracted IOCs, TTPs, IOAs on Hunt page
- **Location:** `frontend/src/pages/Hunts.js`
- **Display:**
  - Group by intelligence type
  - Show confidence scores
  - Allow filtering
  - Export to CSV

### 7.2 Manual Extraction Button
**Status:** 🔄 PENDING
- **Location:** Hunt page article selection
- **Button:** "Extract Intelligence"
- **Behavior:** 
  - Select multiple articles
  - Click "Extract Intelligence"
  - Show progress
  - Display results

---

## Phase 8: Testing & Quality Assurance

### 8.1 Functional Testing Checklist

#### Article Queue:
- [ ] Ingestion date displays correctly
- [ ] Status can be changed from article drawer
- [ ] High priority filter shows only high priority articles
- [ ] Filters persist across page navigation
- [ ] All articles load correctly
- [ ] Pagination works
- [ ] Search functionality works

#### Dashboard:
- [ ] All statistic tiles are clickable
- [ ] Clicking tile navigates to filtered article view
- [ ] Feed source tiles are clickable
- [ ] Green color is softer/more pleasant
- [ ] Rotation animation stops or is removed
- [ ] Refresh shows success message
- [ ] All data loads correctly

#### Intelligence Extraction:
- [ ] Auto-extraction triggers on status change
- [ ] Manual extraction button works
- [ ] All IOC types are extracted correctly:
  - [ ] IP addresses
  - [ ] Email addresses
  - [ ] Domains
  - [ ] File hashes (MD5, SHA-1, SHA-256)
  - [ ] URLs
  - [ ] CVEs
  - [ ] Filenames
  - [ ] Registry keys
  - [ ] ASN numbers
  - [ ] Commands
- [ ] TTPs are identified correctly
- [ ] IOAs are extracted
- [ ] Extracted data displays in UI
- [ ] Confidence scores are calculated

#### Reports:
- [ ] HTML tags are removed from report content
- [ ] Reports are readable
- [ ] CSV download works
- [ ] DOCX download works
- [ ] Report generation completes successfully
- [ ] Reports contain correct data

#### Feed Sources:
- [ ] Article count badges are clickable
- [ ] Clicking badge navigates to filtered view
- [ ] Counts update dynamically
- [ ] Status counts are accurate

#### Admin Panel:
- [ ] Connector test shows popup confirmation
- [ ] Save operations show success message
- [ ] Sensitive data is masked
- [ ] Configuration changes persist
- [ ] Delete confirmations work

### 8.2 UI/UX Testing
- [ ] All colors are consistent and pleasant
- [ ] No jarring animations
- [ ] Loading states are clear
- [ ] Error messages are helpful
- [ ] Success messages are shown
- [ ] Navigation is intuitive
- [ ] Buttons are clearly labeled
- [ ] Tooltips provide context

### 8.3 Performance Testing
- [ ] Page load times are acceptable
- [ ] Large article lists load without lag
- [ ] Extraction doesn't block UI
- [ ] Filter changes are fast
- [ ] No memory leaks
- [ ] API responses are quick

### 8.4 Security Testing
- [ ] Sensitive data is not exposed
- [ ] API keys are masked
- [ ] SQL injection prevention
- [ ] XSS prevention
- [ ] CSRF protection
- [ ] Authentication works correctly
- [ ] Authorization enforced

---

## Implementation Order & Timeline

### Week 1: Critical Functionality
1. ✅ Article Queue: Ingestion Date (DONE)
2. Article Queue: Status Change in Drawer
3. Article Queue: Fix High Priority Filter
4. Dashboard: Make Tiles Clickable

### Week 2: Intelligence & Extraction
5. Backend: Enhanced IOC Extraction
6. Backend: Auto-Extraction on Status Change
7. Frontend: Display Extracted Intelligence
8. Hunt Page: Manual Extraction Button

### Week 3: Reports & UI Polish
9. Reports: Clean HTML Tags
10. Reports: Fix Download Functionality
11. Dashboard: Fix Colors & Animation
12. Dashboard: Add Refresh Popups

### Week 4: Feed Sources & Admin
13. Feed Sources: Clickable Badges
14. Feed Sources: Dynamic Counts
15. Admin: Add Popups
16. Admin: Mask Sensitive Data

### Week 5: Testing & Bug Fixes
17. Comprehensive testing of all features
18. Bug fixes and refinements
19. Performance optimization
20. Documentation updates

---

## Technical Considerations

### Backend Requirements:
- Python regex patterns for IOC extraction
- GenAI integration for TTP identification
- New API endpoints for status updates
- Enhanced article filtering
- Report generation improvements

### Frontend Requirements:
- React Router navigation with query parameters
- State management for filters
- Async extraction handling
- Download blob handling
- Toast/message notifications
- Color theme consistency

### Database Requirements:
- No schema changes needed
- Index optimization for filtering
- Query performance tuning

### External Services:
- GenAI API for TTP extraction
- No additional services required

---

## Risk Assessment

### High Risk:
- Auto-extraction might slow down status changes (mitigation: async processing)
- Large articles might cause extraction timeouts (mitigation: chunking)

### Medium Risk:
- Regex patterns might have false positives (mitigation: confidence scoring)
- Filter persistence might conflict with user preferences (mitigation: clear filters option)

### Low Risk:
- UI color changes
- Button text changes
- Navigation updates

---

## Success Criteria

### Functionality:
- All tiles are clickable and navigate correctly
- Extraction identifies all IOC types with >80% accuracy
- Status changes trigger appropriate workflows
- Reports are clean and downloadable

### Performance:
- Page loads < 2 seconds
- Extraction completes < 5 seconds
- No UI freezing or lag

### User Experience:
- Intuitive navigation
- Clear feedback on all actions
- Consistent visual design
- No confusing elements

### Quality:
- Zero critical bugs
- All tests passing
- Code reviewed and approved
- Documentation updated

---

## Post-Implementation

### Monitoring:
- Track extraction accuracy
- Monitor page load times
- Collect user feedback
- Log errors and issues

### Maintenance:
- Update regex patterns as needed
- Refine GenAI prompts
- Optimize database queries
- Update documentation

### Future Enhancements:
- Machine learning for IOC classification
- Advanced filtering options
- Bulk operations on articles
- Export to STIX format
- Integration with SIEM platforms

---

## Notes

- All changes should be backward compatible
- Maintain existing API contracts
- Add feature flags for gradual rollout
- Document all new endpoints
- Update test coverage
- Keep security in mind for all changes

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-16  
**Status:** Ready for Implementation

