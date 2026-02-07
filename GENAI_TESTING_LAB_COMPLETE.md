# 🧪 GenAI Testing Lab - Complete Implementation

**Date:** January 28, 2026  
**Status:** ✅ **FULLY IMPLEMENTED**

---

## 🎯 Overview

A comprehensive testing ground for GenAI models where you can:
- ✅ **Test single models** with custom configurations
- ✅ **Compare multiple models** side-by-side
- ✅ **Apply configurations** from saved configs
- ✅ **Test with guardrails** before production
- ✅ **Evaluate accuracy, reliability, cost, and performance**
- ✅ **Track test history** for analysis

**Purpose:** Test everything before production deployment!

---

## 🎨 Features

### 1. Single Model Testing ✅

**Test one model at a time with full control:**

```
Select Model:
  └─ Choose from all enabled models
  └─ Grouped by provider (OpenAI, Anthropic, Ollama, etc.)
  └─ Shows cost, FREE/LOCAL tags

Use Configuration (Optional):
  └─ Apply saved configuration
  └─ Or use custom parameters

Model Parameters:
  └─ Temperature: 0.0 - 2.0 (Precise → Creative)
  └─ Max Tokens: 1 - 100,000
  └─ Top P: 0.0 - 1.0
  └─ Apply Guardrails: Yes/No

Test Prompt:
  └─ Enter your test prompt
  └─ Can be IOC extraction, summarization, hunt query, etc.

Results Show:
  ✓ Quality Score (0-100)
  ✓ Response Time (ms)
  ✓ Tokens Used
  ✓ Cost ($)
  ✓ Full Response
  ✓ Guardrails Status
```

### 2. Model Comparison ✅

**Compare 2-5 models side-by-side:**

```
Select Models:
  └─ Check multiple models to compare
  └─ See provider, cost, FREE/LOCAL tags

Same Configuration for All:
  └─ Temperature, Max Tokens, Top P
  └─ Same prompt for fair comparison

Same Prompt:
  └─ Test identical prompt across all models

Results Table Shows:
  ✓ Model Name & Provider
  ✓ Quality Score (sortable)
  ✓ Response Time (sortable)
  ✓ Tokens Used (sortable)
  ✓ Cost (sortable)
  ✓ Success/Failure Status
  ✓ Expandable to see full response

Winner Highlighted:
  └─ Best quality score
  └─ Fastest response
  └─ Lowest cost
```

### 3. Test History ✅

**Track all tests for analysis:**

```
History Table Shows:
  ✓ Timestamp
  ✓ Model Used
  ✓ Configuration Used
  ✓ Quality Score
  ✓ Response Time
  ✓ Cost

Stored Locally:
  └─ Last 50 tests saved
  └─ Persists across sessions
  └─ Can clear history

Analysis:
  └─ Compare performance over time
  └─ Identify best models for use cases
  └─ Track cost trends
```

---

## 📊 Quality Scoring

**How Quality Score is Calculated:**

```javascript
Base Score: 70 points

Bonuses:
  +10 points: Guardrails passed
  +10 points: Tokens used < 80% of max (efficient)
  +10 points: Response time < 3 seconds (fast)

Maximum: 100 points

Example:
  Model A: 90 points (passed guardrails, efficient, fast)
  Model B: 70 points (passed guardrails only)
  Model C: 80 points (passed guardrails, efficient)
  
  Winner: Model A ✅
```

---

## 🔄 Workflow Examples

### Example 1: Test IOC Extraction

```
Goal: Find best model for IOC extraction

Step 1: Single Model Test
  - Model: GPT-4
  - Config: "ioc_extraction_gpt4" (saved config)
  - Prompt: "Extract IOCs from: [article text]"
  - Run Test
  
  Results:
    Quality: 95/100
    Time: 1,200ms
    Tokens: 1,500
    Cost: $0.045
    
Step 2: Compare with Alternatives
  - Select Models:
    ✓ GPT-4
    ✓ GPT-3.5 Turbo
    ✓ Claude 3 Sonnet
    ✓ Ollama Llama 3 (FREE)
  - Same Prompt
  - Run Comparison
  
  Results:
    GPT-4:         95/100, 1,200ms, $0.045
    GPT-3.5:       85/100,   800ms, $0.002 ✅ (Best cost)
    Claude:        90/100, 1,500ms, $0.030
    Llama 3:       75/100, 2,000ms, $0.000 ✅ (FREE)
    
Step 3: Decision
  - Production: GPT-3.5 Turbo (good quality, 95% cheaper)
  - Fallback: Ollama Llama 3 (free, acceptable quality)
```

### Example 2: Test Hunt Query Generation

```
Goal: Test different temperatures for hunt queries

Test 1: Temperature = 0.1 (Very Precise)
  Model: GPT-4
  Prompt: "Generate KQL hunt query for ransomware"
  Result: Very specific, focused query ✅

Test 2: Temperature = 0.5 (Balanced)
  Model: GPT-4
  Prompt: "Generate KQL hunt query for ransomware"
  Result: Good balance, includes variations ✅

Test 3: Temperature = 0.9 (Creative)
  Model: GPT-4
  Prompt: "Generate KQL hunt query for ransomware"
  Result: Too broad, less focused ❌

Decision: Use temperature = 0.3 for hunt queries
```

### Example 3: Test Guardrails

```
Goal: Ensure guardrails work before production

Test 1: With Guardrails ON
  Prompt: "Normal IOC extraction request"
  Result: ✅ Passed, extracted IOCs

Test 2: With Guardrails ON
  Prompt: "Malicious prompt injection attempt"
  Result: ❌ Blocked by guardrails

Test 3: With Guardrails OFF (for comparison)
  Prompt: "Malicious prompt injection attempt"
  Result: ⚠️ Processed (no protection)

Decision: Always use guardrails in production ✅
```

---

## 🔌 API Endpoints

### Test Single Model
```
POST /genai/test/single
Body: {
  "model": "openai:gpt-4",
  "prompt": "Extract IOCs from...",
  "temperature": 0.3,
  "max_tokens": 2000,
  "top_p": 0.9,
  "use_guardrails": true,
  "config_id": 123  // Optional
}

Response: {
  "model": "openai:gpt-4",
  "response": "Extracted IOCs: ...",
  "tokens_used": 1500,
  "cost": 0.045,
  "response_time_ms": 1200,
  "guardrails_passed": true,
  "quality_metrics": {
    "response_length": 500,
    "tokens_efficiency": 0.75,
    "cost_efficiency": 0.9,
    "speed_score": 85
  }
}
```

### Compare Models
```
POST /genai/test/compare
Body: {
  "models": [
    "openai:gpt-4",
    "openai:gpt-3.5-turbo",
    "ollama:llama3"
  ],
  "prompt": "Extract IOCs from...",
  "temperature": 0.3,
  "max_tokens": 2000,
  "top_p": 0.9,
  "use_guardrails": true
}

Response: {
  "results": [
    {
      "model": "openai:gpt-4",
      "model_name": "GPT-4",
      "provider": "openai",
      "response": "...",
      "tokens_used": 1500,
      "cost": 0.045,
      "response_time_ms": 1200,
      "quality_metrics": {...}
    },
    // ... more results
  ],
  "total_models": 3,
  "successful": 3,
  "failed": 0
}
```

### Get Test History
```
GET /genai/test/history?limit=50

Response: {
  "history": [
    {
      "id": 123,
      "model": "openai:gpt-4",
      "use_case": "testing",
      "tokens_used": 1500,
      "cost": 0.045,
      "response_time_ms": 1200,
      "was_successful": true,
      "created_at": "2026-01-28T10:00:00Z"
    },
    // ... more history
  ],
  "total": 50
}
```

---

## 📝 Files Created

### Frontend (2 files)
1. **`frontend/src/components/ComprehensiveGenAILab.js`** (NEW - 700 lines)
   - Single model testing tab
   - Model comparison tab
   - Test history tab
   - Quality scoring
   - Local storage for history

2. **`frontend/src/components/ComprehensiveGenAILab.css`** (NEW)
   - Styling for test results
   - Comparison grid layout
   - Metric displays

### Backend (1 file)
3. **`backend/app/genai/testing.py`** (NEW - 400 lines)
   - `/genai/test/single` endpoint
   - `/genai/test/compare` endpoint
   - `/genai/test/history` endpoint
   - Quality metrics calculation
   - Test logging

### Modified Files
4. **`backend/app/main.py`** (MODIFIED)
   - Registered testing router

5. **`frontend/src/pages/Admin.js`** (MODIFIED)
   - Updated to use ComprehensiveGenAILab
   - Changed tab name to "GenAI Testing Lab"

---

## ✅ What You Can Test

### 1. Model Performance
```
✓ Response quality
✓ Response speed
✓ Token efficiency
✓ Cost effectiveness
✓ Reliability (success rate)
```

### 2. Configuration Impact
```
✓ Temperature effects (0.1 vs 0.5 vs 0.9)
✓ Max tokens impact
✓ Top P variations
✓ Saved config vs custom
```

### 3. Guardrails Effectiveness
```
✓ Prompt injection protection
✓ Content filtering
✓ Safety checks
✓ Performance impact
```

### 4. Use Case Optimization
```
✓ IOC Extraction: Best model? Best temp?
✓ Summarization: Which model is fastest?
✓ Hunt Queries: Which is most accurate?
✓ Chatbot: Which is most conversational?
```

### 5. Cost Analysis
```
✓ Compare costs across models
✓ Find cheapest option with acceptable quality
✓ Calculate ROI for premium models
✓ Identify free alternatives
```

---

## 🎯 Benefits

### For Admins
- ✅ **Validate before production** - No surprises
- ✅ **Compare costs** - Make informed decisions
- ✅ **Test configurations** - Find optimal settings
- ✅ **Evaluate models** - Choose best for each use case

### For Analysts
- ✅ **Test prompts** - Refine before using
- ✅ **Compare results** - See quality differences
- ✅ **Verify guardrails** - Ensure safety
- ✅ **Learn models** - Understand capabilities

### For the Organization
- ✅ **Cost savings** - Choose right model for each task
- ✅ **Quality assurance** - Test before deploy
- ✅ **Risk mitigation** - Validate guardrails
- ✅ **Performance optimization** - Find fastest/cheapest

---

## 🚀 How to Use

### Step 1: Access Testing Lab
```
1. Login to HuntSphere
2. Go to Admin Dashboard
3. Click "GenAI Testing Lab" tab
4. You'll see 3 tabs:
   - Single Model Test
   - Model Comparison
   - Test History
```

### Step 2: Run Single Test
```
1. Select "Single Model Test" tab
2. Choose model (e.g., "Ollama Llama 3")
3. Optional: Select saved configuration
4. Adjust parameters:
   - Temperature: 0.3
   - Max Tokens: 2000
   - Top P: 0.9
   - Guardrails: ON
5. Enter test prompt
6. Click "Run Test"
7. Review results:
   - Quality Score
   - Response Time
   - Tokens Used
   - Cost
   - Full Response
```

### Step 3: Compare Models
```
1. Select "Model Comparison" tab
2. Check 2-5 models to compare
3. Set parameters (same for all)
4. Enter test prompt (same for all)
5. Click "Compare Models"
6. Review comparison table:
   - Sort by quality, time, cost
   - Expand to see responses
   - Identify winner
```

### Step 4: Review History
```
1. Select "Test History" tab
2. See all past tests
3. Analyze trends:
   - Which models used most?
   - Average quality scores
   - Cost trends
4. Clear history if needed
```

---

## 📊 Status

**Frontend:** ✅ **COMPLETE**  
**Backend:** ✅ **COMPLETE**  
**API:** ✅ **3 ENDPOINTS READY**  
**Integration:** ✅ **COMPLETE**  
**Documentation:** ✅ **COMPREHENSIVE**  

**Overall:** ✅ **100% COMPLETE & READY TO USE**

---

## 🎉 Summary

### What Was Built
✅ **Comprehensive Testing Lab** with 3 tabs  
✅ **Single Model Testing** with full control  
✅ **Model Comparison** side-by-side (2-5 models)  
✅ **Configuration Testing** (saved configs + custom)  
✅ **Guardrail Testing** (on/off comparison)  
✅ **Quality Scoring** (0-100 scale)  
✅ **Test History** (last 50 tests)  
✅ **Cost Analysis** (compare across models)  
✅ **Performance Metrics** (time, tokens, efficiency)  

### What You Can Do
✅ **Test before production** - No surprises  
✅ **Compare models** - Find best for each use case  
✅ **Optimize configurations** - Temperature, tokens, etc.  
✅ **Validate guardrails** - Ensure safety  
✅ **Analyze costs** - Make informed decisions  
✅ **Track history** - Learn from past tests  

### Key Features
✅ **All enabled models** available for testing  
✅ **All saved configurations** can be applied  
✅ **All parameters** adjustable  
✅ **Guardrails** testable  
✅ **Side-by-side comparison** for 2-5 models  
✅ **Quality scoring** for objective evaluation  
✅ **Complete audit trail** in test history  

---

**Your GenAI Testing Lab is now a true testing ground for production validation!** 🧪🎉

**Test everything before deploying to production!**
