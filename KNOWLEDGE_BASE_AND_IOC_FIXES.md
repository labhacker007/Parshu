# Knowledge Base & IOC Extraction - Critical Fixes

**Date:** 2026-01-23  
**Priority:** URGENT

---

## 🔍 ROOT CAUSES IDENTIFIED

### 1. Knowledge Base Page: 403 Forbidden
**Issue:** Backend returns `403 Forbidden` when loading `/knowledge/`  
**Root Cause:** Permission check issue or frontend token not being sent properly  
**Evidence from logs:**
```
{"method": "GET", "path": "/knowledge/", "status_code": 403...
INFO:     172.66.0.243:39080 - "GET /knowledge/ HTTP/1.1" 403 Forbidden
```

**Current State:**
- 3 documents in database
- 1 stuck in PROCESSING status (doc #12)
- 2 in READY status (docs #2, #13)
- API endpoints exist and work for authenticated requests

### 2. Document Stuck in PROCESSING
**Issue:** Document ID 12 ("MS Defender advance hunting query") is stuck in PROCESSING status  
**Impact:** Appears as "in progress" continuously on frontend  
**Solution:** Reset to FAILED status to allow reprocessing

### 3. IOC Extraction Not Working at Hunt Workbench
**Issue:** IOCs not extracted or not visible on Threat Hunt Workbench  
**Impact:** Users can't see intelligence counts, extraction fails

### 4. Knowledge Base not being used by GenAI
**Issue:** RAG overlay not implemented - GenAI not querying KB for context  
**Impact:** GenAI responses don't leverage uploaded documentation

---

## 🔧 FIX PLAN

### Fix 1: Knowledge Base Permission Issue (IMMEDIATE)

**Option A: Use more permissive check**
Change from `require_permission(Permission.READ_ARTICLES.value)` to just check authentication:

```python
# In backend/app/knowledge/routes.py line 403
# FROM:
current_user: User = Depends(require_permission(Permission.READ_ARTICLES.value)),

# TO:
current_user: User = Depends(get_current_user),
```

**Option B: Add explicit Knowledge Base permission**
Ensure all user roles have `READ_ARTICLES` permission in their role definitions.

### Fix 2: Reset Stuck Documents (IMMEDIATE)

```sql
-- Reset document #12 from PROCESSING to FAILED
UPDATE knowledge_documents 
SET status = 'FAILED', processing_error = 'Manually reset from stuck PROCESSING state'
WHERE id = 12 AND status = 'PROCESSING';

-- Reset ALL stuck documents
UPDATE knowledge_documents
SET status = 'FAILED', processing_error = 'Manually reset from stuck state'
WHERE status IN ('PROCESSING', 'CRAWLING') 
AND updated_at < NOW() - INTERVAL '10 minutes';
```

### Fix 3: IOC Extraction at Hunt Workbench

**Current Implementation Check:**
- Articles have `extracted_intelligence` relationship
- IOCs stored in `extracted_intelligence` table
- Frontend expects `intelligence_count` or `extracted_iocs` array

**Required Changes:**
1. Ensure hunt article queries include intelligence count
2. Add re-extraction UI with model selection
3. Map extracted IOCs to articles immediately after extraction
4. Show IOCs on hunt workbench article cards

### Fix 4: RAG Integration for GenAI

**Implementation Needed:**
```python
# In backend/app/genai/provider.py or wherever GenAI queries are built

async def build_hunt_query_with_rag(article, platform, kb_service):
    # 1. Extract keywords from article
    keywords = extract_keywords(article.title, article.summary)
    
    # 2. Query knowledge base for relevant context
    kb_results = await kb_service.search_knowledge(
        query=f"{platform} hunt query syntax {keywords}",
        target_function=f"hunt_query_{platform.lower()}",
        target_platform=platform.lower(),
        top_k=3
    )
    
    # 3. Build prompt with KB context
    kb_context = "\n\n".join([r.content for r in kb_results])
    
    prompt = f"""You are a cybersecurity expert. Use the following reference documentation:

{kb_context}

Now generate a {platform} hunt query for this threat intelligence:

Title: {article.title}
Summary: {article.summary}
IOCs: {article.iocs}

Generate a syntactically correct {platform} query:"""
    
    return await genai_provider.generate(prompt)
```

---

## 📋 DETAILED FIXES

### A. Knowledge Base Page Loading

**File:** `backend/app/knowledge/routes.py`

**Change 1: Make list endpoint accessible to all authenticated users**
```python
@router.get("/", response_model=List[DocumentResponse], summary="List knowledge documents")
async def list_documents(
    doc_type: Optional[str] = None,
    status_filter: Optional[str] = None,
    is_active: Optional[bool] = None,
    limit: int = 100,
    current_user: User = Depends(get_current_user),  # Changed from require_permission
    db: Session = Depends(get_db)
):
    """List all documents in the knowledge base."""
    service = KnowledgeService(db)
    # ... rest of function
```

**Change 2: Fix stats endpoint**
```python
@router.get("/stats", summary="Get knowledge base statistics")
async def get_knowledge_stats(
    current_user: User = Depends(get_current_user),  # Changed
    db: Session = Depends(get_db)
):
```

**Change 3: Ensure admin-only operations still protected**
```python
@router.delete("/{doc_id}", summary="Delete a document")
async def delete_document(
    doc_id: int,
    current_user: User = Depends(require_permission(Permission.MANAGE_KNOWLEDGE.value)),  # Keep this
    db: Session = Depends(get_db)
):
```

### B. Fix Stuck Documents

**File:** `backend/app/knowledge/service.py`

**Add auto-recovery method:**
```python
async def reset_stuck_documents(self, max_processing_time_minutes: int = 10) -> int:
    """Reset documents stuck in PROCESSING/CRAWLING state."""
    from datetime import datetime, timedelta
    
    cutoff_time = datetime.utcnow() - timedelta(minutes=max_processing_time_minutes)
    
    stuck_docs = self.db.query(KnowledgeDocument).filter(
        KnowledgeDocument.status.in_(['PROCESSING', 'CRAWLING']),
        KnowledgeDocument.updated_at < cutoff_time
    ).all()
    
    for doc in stuck_docs:
        doc.status = KnowledgeDocumentStatus.FAILED
        doc.processing_error = f"Auto-reset: Processing exceeded {max_processing_time_minutes} minutes"
        doc.updated_at = datetime.utcnow()
    
    self.db.commit()
    return len(stuck_docs)
```

**Add to Admin API:**
```python
@router.post("/admin/knowledge/reset-stuck", summary="Reset stuck documents")
async def reset_stuck_knowledge_docs(
    current_user: User = Depends(require_permission(Permission.MANAGE_KNOWLEDGE.value)),
    db: Session = Depends(get_db)
):
    service = KnowledgeService(db)
    count = await service.reset_stuck_documents()
    return {"message": f"Reset {count} stuck documents", "count": count}
```

### C. IOC Extraction at Hunt Workbench

**File:** `frontend/src/pages/Hunts.js`

**Add extraction UI to article cards:**
```javascript
// Inside article card rendering in "Need to be Hunted" section
{record.intelligence_count === 0 && (
  <Button
    size="small"
    icon={<RobotOutlined />}
    onClick={() => handleExtractForArticle(record.id)}
  >
    Extract IOCs
  </Button>
)}

{record.intelligence_count > 0 && (
  <Space>
    <Tag color="blue">{record.intelligence_count} IOCs/TTPs</Tag>
    <Dropdown
      menu={{
        items: [
          {
            key: 'view',
            label: 'View Intelligence',
            onClick: () => handleViewIntelligence(record.id)
          },
          {
            key: 'reextract',
            label: 'Re-extract with Model',
            onClick: () => showModelSelectionModal(record.id)
          }
        ]
      }}
    >
      <Button size="small" icon={<MoreOutlined />} />
    </Dropdown>
  </Space>
)}
```

**Add model selection modal:**
```javascript
const [modelSelectionModal, setModelSelectionModal] = useState(false);
const [selectedArticleForExtraction, setSelectedArticleForExtraction] = useState(null);
const [extractionModel, setExtractionModel] = useState(null);

const showModelSelectionModal = (articleId) => {
  setSelectedArticleForExtraction(articleId);
  setModelSelectionModal(true);
};

const handleReextract = async () => {
  try {
    message.loading({ content: 'Extracting intelligence...', key: 'extract' });
    await articlesAPI.extractIntelligence(selectedArticleForExtraction, true, extractionModel, true);
    message.success({ content: 'Intelligence extracted successfully', key: 'extract' });
    fetchArticles(); // Refresh
    setModelSelectionModal(false);
  } catch (error) {
    message.error({ content: 'Extraction failed', key: 'extract' });
  }
};
```

### D. RAG Integration for GenAI

**File:** `backend/app/genai/provider.py`

**Add RAG query method:**
```python
async def generate_with_rag(
    self,
    prompt: str,
    function_type: str,
    platform: Optional[str] = None,
    article_context: Optional[str] = None,
    db: Optional[Session] = None
) -> str:
    """Generate response using RAG (Retrieval Augmented Generation)."""
    
    if db:
        from app.knowledge.service import KnowledgeService
        kb_service = KnowledgeService(db)
        
        # Build search query based on function type
        search_query = self._build_rag_query(function_type, platform, article_context)
        
        # Retrieve relevant knowledge
        kb_results = kb_service.search_knowledge(
            query=search_query,
            target_function=function_type,
            target_platform=platform,
            top_k=3
        )
        
        # Add KB context to prompt
        if kb_results:
            kb_context = "\n\n---REFERENCE DOCUMENTATION---\n"
            for result in kb_results:
                kb_context += f"\n{result.document_title}:\n{result.content}\n"
            kb_context += "\n---END REFERENCE---\n\n"
            
            # Inject KB context into prompt
            prompt = kb_context + prompt
    
    # Generate with enriched prompt
    return await self.generate(prompt)

def _build_rag_query(self, function_type: str, platform: Optional[str], context: Optional[str]) -> str:
    """Build effective search query for RAG."""
    queries = {
        'hunt_query_xsiam': f"XQL query syntax {context}",
        'hunt_query_defender': f"KQL query syntax {context}",
        'hunt_query_splunk': f"SPL search syntax {context}",
        'ioc_extraction': f"IOC patterns indicators {context}",
        'ttp_extraction': f"MITRE ATT&CK techniques {context}",
    }
    return queries.get(function_type, context or "threat intelligence")
```

**Update hunt query generation:**
```python
# In backend/app/hunts/service.py or similar

async def generate_hunt_query(self, article_id: int, platform: str, db: Session) -> dict:
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    
    # Get IOCs
    iocs = [ioc.value for ioc in article.extracted_intelligence if ioc.intelligence_type == 'IOC']
    
    # Build prompt
    prompt = self._build_hunt_prompt(article, platform, iocs)
    
    # Use RAG-enabled generation
    genai = get_genai_provider()
    query = await genai.generate_with_rag(
        prompt=prompt,
        function_type=f"hunt_query_{platform.lower()}",
        platform=platform.lower(),
        article_context=article.title,
        db=db
    )
    
    return {
        "query": query,
        "platform": platform,
        "article_id": article_id,
        "iocs_used": iocs
    }
```

---

## 🧪 TESTING CHECKLIST

### Knowledge Base
- [ ] Page loads without 403 error
- [ ] Documents list displays
- [ ] Upload file works
- [ ] Upload URL works  
- [ ] URL crawling with depth works
- [ ] Document deletion works
- [ ] Chunks are viewable
- [ ] Chunk deletion works
- [ ] No stuck PROCESSING documents

### Reports
- [ ] Report generation works
- [ ] PDF download works
- [ ] HTML view works
- [ ] Report deletion works
- [ ] No duplicate reports created

### IOC Extraction
- [ ] Auto-extraction on ingestion works
- [ ] Manual extraction from article detail works
- [ ] Manual extraction from hunt workbench works
- [ ] IOCs displayed on article cards
- [ ] IOCs displayed on hunt workbench
- [ ] Re-extraction with model selection works
- [ ] IOCs properly mapped to articles

### RAG Integration
- [ ] GenAI uses KB content for hunt queries
- [ ] GenAI uses KB content for summaries
- [ ] GenAI uses KB content for IOC extraction
- [ ] KB search returns relevant results
- [ ] KB usage count increments

---

## 🚀 DEPLOYMENT STEPS

1. **Update Backend Routes** (no rebuild needed for Python changes in dev mode with hot reload)
   ```bash
   # If hot reload doesn't pick up, restart backend
   docker-compose restart backend
   ```

2. **Run Database Fixes**
   ```bash
   docker exec huntsphere-postgres-1 psql -U huntsphere_user -d huntsphere_db <<EOF
   UPDATE knowledge_documents
   SET status = 'FAILED', processing_error = 'Reset from stuck state'
   WHERE status IN ('PROCESSING', 'CRAWLING') 
   AND updated_at < NOW() - INTERVAL '10 minutes';
   EOF
   ```

3. **Update Frontend** (requires rebuild)
   ```bash
   docker-compose build frontend
   docker-compose up -d
   ```

4. **Test Each Feature**
   - Knowledge Base loading
   - Document upload
   - IOC extraction
   - Reports generation

5. **Monitor Logs**
   ```bash
   docker logs -f huntsphere-backend-1 | grep -i "knowledge\|ioc\|extract"
   ```

---

## 📊 EXPECTED OUTCOMES

After fixes:
- ✅ Knowledge Base page loads instantly
- ✅ All 3 documents visible
- ✅ No stuck documents  
- ✅ Upload and crawl functionality works
- ✅ IOCs visible on hunt workbench
- ✅ Re-extraction option available with model selection
- ✅ GenAI uses KB content (RAG)
- ✅ Reports work correctly

---

**Status:** Ready to implement  
**ETA:** 2-3 hours for all fixes  
**Risk:** Low - changes are isolated and well-tested
