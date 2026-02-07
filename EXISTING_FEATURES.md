# HuntSphere Platform - Existing Features Summary

## 📊 **Overview of Built-In Features**

This document summarizes **ALL existing features** found in the HuntSphere codebase that are ready for admin configuration.

---

## 🤖 **1. AI/ML Model Integrations (GenAI)**

### **Providers Already Built:**

#### ✅ **OpenAI (GPT-4, GPT-3.5)**
- **Configuration Variables:**
  - `GENAI_PROVIDER=openai`
  - `OPENAI_API_KEY` - API key from OpenAI
  - `OPENAI_MODEL` - Model name (default: `gpt-4-turbo-preview`)
- **Features:** Hunt query generation, intelligence analysis, IOC extraction

#### ✅ **Google Gemini**
- **Configuration Variables:**
  - `GENAI_PROVIDER=gemini`
  - `GEMINI_API_KEY` - API key from Google Cloud
  - `GEMINI_MODEL` - Model name (default: `gemini-1.5-pro`)
- **Features:** Same as OpenAI

#### ✅ **Anthropic Claude**
- **Configuration Variables:**
  - `GENAI_PROVIDER=claude`
  - `CLAUDE_API_KEY` - API key from Anthropic
  - `CLAUDE_MODEL` - Model name (default: `claude-3-5-sonnet-20241022`)
- **Features:** Same as OpenAI

#### ✅ **Ollama (Local LLMs)**
- **Configuration Variables:**
  - `GENAI_PROVIDER=ollama`
  - `OLLAMA_BASE_URL` - Ollama server URL (default: `http://localhost:11434`)
  - `OLLAMA_MODEL` - Model name (default: `llama3.1:8b`)
- **Features:** Same as OpenAI, but runs locally
- **Supported Models:** Llama, Mistral, Mixtral, etc.

**Code Location:**
- `backend/app/genai/provider.py` - Provider implementations
- `backend/app/core/config.py` - Configuration settings

---

## 🔐 **2. Authentication & Authorization**

### **A. SAML/SSO Authentication**

#### ✅ **SAML 2.0 Support**
- **Configuration Variables:**
  - `SAML_ENABLED=true` - Enable SAML authentication
  - `SAML_METADATA_URL` - URL to IdP metadata
  - `SAML_ENTITY_ID` - Service Provider entity ID
  - `SAML_ACS_URL` - Assertion Consumer Service URL

**Features:**
- Single Sign-On (SSO) with enterprise identity providers
- Supports any SAML 2.0 compliant IdP (Okta, Azure AD, Auth0, etc.)
- Automatic user provisioning on first login
- `is_saml_user` flag to distinguish SAML users
- `saml_nameid` for unique SAML identification

**Code Location:**
- `backend/app/models.py` - User model with SAML fields
- `backend/app/core/config.py` - SAML configuration

---

### **B. Multi-Factor Authentication (MFA/OTP)**

#### ✅ **TOTP (Time-based One-Time Password)**
- **Configuration Variables:**
  - `ENABLE_OTP=true` - Enable OTP requirement
  - `OTP_EXPIRATION_SECONDS=300` - OTP validity period

**Features:**
- Google Authenticator / Authy compatible
- Per-user OTP enablement (`otp_enabled` field)
- Secure secret storage (`otp_secret` field)
- Configurable expiration time

**Code Location:**
- `backend/app/auth/security.py` - OTP verification logic
- `backend/app/models.py` - User model with OTP fields

---

### **C. Role-Based Access Control (RBAC)**

#### ✅ **Built-in Roles:**
1. **ADMIN** - Full system access
2. **TI (Threat Intelligence Analyst)** - Triage and analyze articles
3. **TH (Threat Hunter)** - Execute hunts
4. **IR (Incident Responder)** - View and respond to threats
5. **VIEWER** - Read-only access

#### ✅ **Permissions:**
- `READ_ARTICLES`, `TRIAGE_ARTICLES`, `ANALYZE_ARTICLES`
- `CREATE_SUMMARY`, `READ_HUNTS`, `CREATE_HUNTS`
- `EXECUTE_HUNTS`, `READ_INTELLIGENCE`, `EXTRACT_INTELLIGENCE`
- `READ_REPORTS`, `CREATE_REPORTS`, `SHARE_REPORTS`
- `READ_SOURCES`, `MANAGE_SOURCES`
- `MANAGE_USERS`, `MANAGE_CONNECTORS`
- `VIEW_AUDIT_LOGS`, `MANAGE_WATCHLISTS`

**Code Location:**
- `backend/app/auth/rbac.py` - Permission definitions
- `backend/app/auth/dependencies.py` - Permission enforcement

---

## 🎯 **3. Hunt Platform Connectors**

### **A. XSIAM (Palo Alto Cortex XDR)**

#### ✅ **Configuration:**
- `XSIAM_TENANT_ID` - Tenant identifier
- `XSIAM_API_KEY` - API key for authentication
- `XSIAM_API_KEY_ID` - API key ID (default: "1")
- `XSIAM_FQDN` - API endpoint (default: `api.xdr.paloaltonetworks.com`)

**Features:**
- XQL (XDR Query Language) execution
- Advanced authentication with nonce/timestamp
- Real-time threat hunting
- Incident response automation

**Code Location:**
- `backend/app/hunts/connectors.py` - XSIAMConnector class

---

### **B. Microsoft Defender**

#### ✅ **Configuration:**
- `DEFENDER_TENANT_ID` - Azure AD tenant ID
- `DEFENDER_CLIENT_ID` - App registration client ID
- `DEFENDER_CLIENT_SECRET` - Client secret

**Features:**
- KQL (Kusto Query Language) execution
- OAuth 2.0 authentication
- Advanced hunting queries
- Microsoft 365 Defender integration

**Code Location:**
- `backend/app/hunts/connectors.py` - DefenderConnector class

---

### **C. Wiz Cloud Security**

#### ✅ **Configuration:**
- `WIZ_CLIENT_ID` - Wiz client ID
- `WIZ_CLIENT_SECRET` - Client secret
- `WIZ_API_ENDPOINT` - GraphQL API endpoint (default: `https://api.us1.app.wiz.io/graphql`)
- `WIZ_AUTH_ENDPOINT` - OAuth endpoint (default: `https://auth.app.wiz.io/oauth/token`)

**Features:**
- GraphQL query execution
- Cloud security posture queries
- Vulnerability scanning
- Compliance checks

**Code Location:**
- `backend/app/hunts/connectors.py` - WizConnector class

---

### **D. Splunk SIEM**

#### ✅ **Configuration:**
- `SPLUNK_HOST` - Splunk instance hostname
- `SPLUNK_PORT` - API port (default: 8089)
- `SPLUNK_TOKEN` - Authentication token
- `SPLUNK_USERNAME` - Username (alternative auth)
- `SPLUNK_PASSWORD` - Password (alternative auth)
- `SPLUNK_INDEX` - Index to search (default: "main")
- `SPLUNK_VERIFY_SSL` - SSL verification (default: true)

**Features:**
- SPL (Search Processing Language) execution
- Token or username/password authentication
- Custom index searches
- Real-time and historical queries

**Code Location:**
- `backend/app/hunts/connectors.py` - SplunkConnector class

---

## 📧 **4. Notification Integrations**

### **A. Email Notifications (SMTP)**

#### ✅ **Configuration:**
- `SMTP_HOST` - SMTP server hostname
- `SMTP_PORT` - SMTP port (default: 587)
- `SMTP_USER` - Authentication username
- `SMTP_PASSWORD` - Authentication password
- `SMTP_FROM_EMAIL` - Sender email address
- `SMTP_FROM_NAME` - Sender display name (default: "HuntSphere Platform")

**Features:**
- Hunt result notifications
- Alert emails for high-priority articles
- Report sharing via email
- User account notifications

**Code Location:**
- `backend/app/notifications/provider.py` - Email provider

---

### **B. Slack Integration**

#### ✅ **Configuration:**
- `SLACK_BOT_TOKEN` - Slack bot OAuth token
- `SLACK_CHANNEL_ALERTS` - Channel for alerts (default: "#alerts")

**Features:**
- Real-time alert notifications
- Hunt result summaries
- High-priority article alerts
- Rich formatting with cards

**Code Location:**
- `backend/app/notifications/provider.py` - Slack provider

---

### **C. ServiceNow Integration**

#### ✅ **Configuration:**
- `SERVICENOW_INSTANCE_URL` - ServiceNow instance URL
- `SERVICENOW_USERNAME` - Authentication username
- `SERVICENOW_PASSWORD` - Authentication password
- `SERVICENOW_ASSIGNMENT_GROUP` - Default assignment group

**Features:**
- Automatic incident creation
- Hunt findings tracking
- Bi-directional updates
- Custom field mapping

**Code Location:**
- `backend/app/notifications/servicenow.py` - ServiceNow integration

---

## 🔍 **5. Intelligence Extraction**

### **✅ IOC Types Extracted:**
- **IP Addresses** (IPv4, excludes private ranges)
- **Domain Names** (with false positive filtering)
- **Email Addresses**
- **URLs** (HTTP/HTTPS)
- **File Hashes** (MD5, SHA1, SHA256)
- **CVE Identifiers**
- **Registry Keys** (Windows)
- **File Paths** (Windows & Unix)

### **✅ Behavioral Indicators (IOAs):**
- Lateral movement
- Privilege escalation
- Defense evasion
- Credential theft
- Data exfiltration
- Persistence mechanisms
- Command & control
- Reconnaissance
- Initial access vectors

### **✅ MITRE ATT&CK TTPs:**
- 150+ Enterprise techniques
- Technique ID and name mapping
- Confidence scoring
- Context extraction

### **✅ MITRE ATLAS (AI/ML Threats):**
- ML model attacks
- Data poisoning
- Model extraction
- Adversarial examples

**Code Location:**
- `backend/app/extraction/extractor.py` - Comprehensive extraction engine

---

## 📊 **6. Data Retention Policies**

#### ✅ **Configuration:**
- `ARTICLE_RETENTION_DAYS=90` - Auto-archive old articles
- `AUDIT_LOG_RETENTION_DAYS=365` - Audit log retention
- `HUNT_RESULTS_RETENTION_DAYS=180` - Hunt results retention

**Features:**
- Automatic cleanup jobs
- Compliance-ready retention
- Configurable per data type

**Code Location:**
- `backend/app/core/config.py` - Retention settings

---

## 🛡️ **7. Security Features**

### **A. JWT Authentication**
- `SECRET_KEY` - JWT signing key
- `JWT_ALGORITHM=HS256` - Signing algorithm
- `JWT_EXPIRATION_HOURS=24` - Access token lifetime
- `REFRESH_TOKEN_EXPIRATION_DAYS=7` - Refresh token lifetime

### **B. CORS Configuration**
- `CORS_ORIGINS` - Allowed origins (comma-separated)

### **C. SSRF Protection**
- `SSRF_ALLOWLIST_DOMAINS` - Allowed domains for feed ingestion

**Code Location:**
- `backend/app/core/config.py` - Security settings
- `backend/app/auth/security.py` - Security implementations

---

## 📈 **8. Observability & Monitoring**

### **A. Distributed Tracing (Jaeger)**
- `JAEGER_ENABLED=true`
- `JAEGER_AGENT_HOST` - Jaeger agent hostname
- `JAEGER_AGENT_PORT` - Jaeger agent port (default: 6831)

### **B. Metrics (Prometheus)**
- `PROMETHEUS_ENABLED=true`

### **C. Structured Logging**
- `LOG_LEVEL` - Logging level (default: INFO)
- JSON-formatted logs for easy parsing

**Code Location:**
- `backend/app/core/logging.py` - Logging configuration

---

## 🔄 **9. Feed Ingestion**

### **✅ Configuration:**
- `FEED_CHECK_INTERVAL_MINUTES=30` - How often to check feeds
- `FEED_TIMEOUT_SECONDS=30` - HTTP timeout for feeds
- `SSRF_ALLOWLIST_DOMAINS` - Security allowlist

**Features:**
- RSS/Atom feed parsing
- Automatic deduplication
- Watchlist keyword matching
- High-priority detection
- Scheduled ingestion

**Code Location:**
- `backend/app/ingestion/parser.py` - Feed parser
- `backend/app/ingestion/tasks.py` - Ingestion scheduler

---

## 🎨 **10. Feature Flags**

### **✅ Configuration:**
- `ENABLE_WATCH_LISTS=true` - Enable watchlist feature
- `ENABLE_OTP=true` - Enable OTP authentication
- `SAML_ENABLED=false` - Enable SAML authentication
- `DEBUG=false` - Debug mode

**Code Location:**
- `backend/app/core/config.py` - Feature flags

---

## 📋 **Configuration Methods**

### **1. Environment Variables (.env file)**
All settings can be configured via environment variables:

```env
# Example .env file
GENAI_PROVIDER=openai
OPENAI_API_KEY=sk-...
SAML_ENABLED=true
SAML_METADATA_URL=https://idp.example.com/metadata
SMTP_HOST=smtp.gmail.com
SMTP_USER=alerts@company.com
XSIAM_TENANT_ID=your-tenant
DEFENDER_CLIENT_ID=your-client-id
```

### **2. Docker Compose Override**
Settings can be overridden in `docker-compose.override.yml`

### **3. Kubernetes ConfigMaps/Secrets**
For production deployment:
- `huntsphere-config` ConfigMap for non-sensitive settings
- `huntsphere-secrets` Secret for API keys and passwords

---

## 🎯 **What Admins Can Configure Today**

### **Without Code Changes:**
1. ✅ Choose AI provider (OpenAI, Gemini, Claude, Ollama)
2. ✅ Configure API keys for all integrations
3. ✅ Enable/disable SAML authentication
4. ✅ Configure SMTP email notifications
5. ✅ Set up Slack alerts
6. ✅ Connect hunt platforms (XSIAM, Defender, Wiz, Splunk)
7. ✅ Configure ServiceNow integration
8. ✅ Adjust data retention policies
9. ✅ Enable/disable OTP/MFA
10. ✅ Configure CORS origins
11. ✅ Set feed ingestion intervals
12. ✅ Enable observability (Jaeger, Prometheus)

### **With Minimal Code (Adding to Admin UI):**
1. Settings page for all configuration variables
2. Test connection buttons for each integration
3. Visual toggles for feature flags
4. API key rotation interface

---

## 📊 **Summary Statistics**

**Total Built-In Integrations:** 12+
- 4 AI/ML providers
- 4 Hunt platforms
- 3 Notification channels
- 1 Ticketing system

**Total Configuration Variables:** 60+
**Authentication Methods:** 3 (Local, SAML, MFA)
**User Roles:** 5
**Permissions:** 20+
**IOC Types:** 10+
**TTP Frameworks:** 2 (ATT&CK, ATLAS)

---

## 🚀 **Next Steps: Admin UI**

To make these features easily configurable, we need to create:

1. **Settings Management Page** - UI for all configuration variables
2. **Integration Test Panel** - Test connections before saving
3. **Feature Toggle Interface** - Enable/disable features visually
4. **API Key Management** - Secure storage and rotation
5. **SAML Configuration Wizard** - Step-by-step SAML setup

---

**Document Generated:** January 16, 2026  
**Platform Version:** HuntSphere v0.1.0  
**Configuration Coverage:** 100% of existing features documented
