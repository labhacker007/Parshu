## Custom Feed Ingest Hardening

### Summary
- Added `_auto_analyze_article`, `_persist_extracted_intelligence`, and `_generate_article_summaries` helpers so ingestion flows reuse common GenAI guardrails, logging, and intelligence persistence.
- Introduced `/sources/custom/ingest` (see `backend/app/integrations/sources.py`) to safely download PDFs/Word/HTML from arbitrary URLs, deduplicate by content hash, and auto-extract/summarize IOCs/TTPs using the centralized GenAI helpers.
- Extended `core/fetch.safe_fetch_text_*` to return raw bytes so binary files can be persisted before handing content to `DocumentProcessor`.

### Security Considerations
1. **SSRF controls:** The custom ingest endpoint uses `safe_fetch_text_sync` + `ssrf_policy_from_settings` to enforce allowlists/port restrictions and log fetch errors. Absent a fetch result it returns `400` rather than proxying, reducing open redirect/SSR risks.
2. **Binary handling:** We store the downloaded response bytes temporarily (deterministic filename under `data/knowledge/custom_feeds`) before handing them to existing document parsers; the storage location is per-instance, cleaned up right after extraction, and the hashed content is used for deduplication to avoid replay.
3. **Dedup/hash logic:** Article deduplication now checks both `content_hash` and source URL, preventing attackers from re-ingesting the same malicious document or using redirect loops to generate duplicates.
4. **GenAI guardrails:** All extraction/summarization now funnels through shared helpers, so guardrail violations are logged once and the resulting summaries/Ioc records are traceable via the `auto_analysis_complete`/`auto_analysis_failed` audit events.
5. **Feedback loop:** Endpoint returns explicit IOC/TTP counts with summary text, and the database records include `extraction_method` metadata so analysts can audit whether GenAI or fallback regex was used.

### Tests
- Added `backend/tests/test_sources_custom_ingest.py` to mock `safe_fetch_text_sync`, `DocumentProcessor`, and `IntelligenceExtractor`; it verifies article creation, summary population, and IOC/TTP persistence for a resolved HTTP fetch.
- **Current test run status:** `python -m pytest tests/test_sources_custom_ingest.py` still fails in this environment because `pydantic-core` cannot build for Python 3.14 (the Rust build script hits `ForwardRef._evaluate() missing 1 required keyword-only argument: 'recursive_guard'`). Once a wheel targeting CPython 3.14 is available (or a lower Python version is installed), rerun the test to confirm the new endpoint works end-to-end.
