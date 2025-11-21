# HANSEI PROJECT - DETAILED IMPLEMENTATION PLAN
## From "Compiles Successfully" to "Production Ready"

**Date Created**: 2025-11-21
**Based on**: DEPLOYMENT_AUDIT_REPORT.md
**Project**: Hansei Microservices on Raindrop Framework
**Timeline**: 4 Weeks (20 Working Days)

---

## 📊 EXECUTIVE SUMMARY

### Current Status: 🟡 DEGRADED
- ✅ **Compiles Successfully** (achieved)
- ⚠️ **Multiple Runtime Blockers** (6 critical issues will cause crashes)
- ❌ **Not Production Ready** (12 critical + 8 moderate issues)

### Issues Identified: **35 Total**
- **Tier 1 (Critical Runtime Blockers)**: 6 issues - will cause services to crash
- **Tier 2 (Essential Functionality & Security)**: 7 issues - major security gaps and missing features
- **Tier 3 (Performance & Reliability)**: 6 issues - performance bottlenecks and best practices
- **Tier 4 (Environment & Deployment)**: 5 issues - infrastructure configuration needed

### Most Critical Issues (Fix First):
1. **Search Engine Missing Utils** - Service will crash on first call
2. **Pattern Detector Missing Utils** - Service will crash when triggered
3. **Memory Core Returns Empty** - All memory operations silently fail
4. **Voice Processor Placeholder** - No implementation exists
5. **No Authentication Enforced** - All data publicly accessible
6. **Error Handler Disabled** - Unhandled exceptions crash services

### Recommended Execution Timeline: **4 Weeks**
- **Week 1**: Fix critical blockers, setup environment, implement core services
- **Week 2**: Deploy frontend, configure NGINX, implement voice processing
- **Week 3**: Performance optimization, caching, monitoring
- **Week 4**: Testing, documentation, production hardening

### Resource Requirements:
- **Backend Developers**: 2 (for parallel workstreams)
- **Frontend Developer**: 1 (UI deployment and testing)
- **DevOps Engineer**: 1 (infrastructure and monitoring)
- **Estimated Cost**: $200-400/month (database, API services, infrastructure)

---

## 🎯 TIER 1: CRITICAL RUNTIME BLOCKERS

*These issues will cause services to crash at runtime or render core functionality completely broken*

### 1.1 Search Engine Missing Core Implementation

**Priority Tier**: Tier 1 - Critical Runtime Blocker
**Task Title**: Implement Missing Search Engine Utilities
**Location/File**: `src/search-engine/index.ts` (line 9-10), Missing files: `./utils.js`, `./interfaces.js`
**Issue Summary**: Search engine imports functions from non-existent utility files. Functions `performSearch()`, `semanticSearch()`, `hybridSearch()`, `generateVectorEmbeddings()`, and `indexDocument()` are referenced but not implemented. Service will crash on first API call.

**Proposed Action Plan**:
1. **Create `src/search-engine/interfaces.ts`**:
   - Define TypeScript interfaces for search request/response types
   - Define `SearchResult`, `SemanticSearchRequest`, `HybridSearchRequest`, `EmbeddingRequest` interfaces
   - Define `IndexDocument` interface for document indexing

2. **Create `src/search-engine/utils.ts`**:
   - Implement `performSearch(query: string, options: SearchOptions)`: Basic text search using SmartMemory or GRAPH_DATABASE
   - Implement `semanticSearch(query: string, options: SemanticSearchOptions)`: Use vector embeddings via memory-embeddings and document-embeddings Vector indexes
   - Implement `hybridSearch(query: string, options: HybridSearchOptions)`: Combine keyword and semantic search with configurable weights
   - Implement `generateVectorEmbeddings(text: string)`: Call Raindrop AI embedding endpoint
   - Implement `indexDocument(doc: Document)`: Store document in SmartMemory with embeddings

3. **Integration approach**:
   - Use existing `AGENT_MEMORY.searchSemanticMemory()` for semantic capabilities
   - Leverage `RaindropAIClient` for AI-powered analysis
   - Store indexed documents in `document-embeddings` Vector index
   - Implement error handling with fallback to keyword search

4. **Testing**:
   - Test `/api/search` endpoint with simple queries
   - Test `/api/search/semantic` with complex natural language queries
   - Verify embedding generation performance
   - Validate hybrid search weighting algorithm

---

### 1.2 Pattern Detector Missing Core Implementation

**Priority Tier**: Tier 1 - Critical Runtime Blocker
**Task Title**: Implement Missing Pattern Detector Utilities
**Location/File**: `src/pattern-detector/index.ts` (line 5-6), Missing files: `./utils.js`, `./interfaces.js`
**Issue Summary**: Pattern detector imports functions from non-existent utility files. Functions `processRequest()`, `validateRequest()`, and `optimizeProcessing()` are not implemented. Service will crash when pattern detection is triggered.

**Proposed Action Plan**:
1. **Create `src/pattern-detector/interfaces.ts`**:
   - Define `PatternDetectionRequest` interface (user_id, time_range, pattern_types)
   - Define `PatternDetectionResult` interface (patterns, confidence, metadata)
   - Define `ValidationResult` interface for request validation
   - Define pattern types enum: BEHAVIORAL, TEMPORAL, SEMANTIC, RELATIONAL

2. **Create `src/pattern-detector/utils.ts`**:
   - Implement `validateRequest(req: PatternDetectionRequest)`: Validate user_id, time ranges, pattern types
   - Implement `processRequest(req: PatternDetectionRequest)`: Main orchestration logic
     * Query GRAPH_DATABASE for memory nodes and edges
     * Analyze temporal patterns (time-of-day, day-of-week clustering)
     * Detect behavioral patterns using RaindropAIClient.detectBehavioralPatterns()
     * Identify relationship patterns from memory_edges table
   - Implement `optimizeProcessing(req: PatternDetectionRequest)`: Query optimization
     * Add time-range filters to reduce dataset
     * Implement caching for recently detected patterns
     * Batch similar pattern detection requests

3. **Database integration**:
   - Query `pattern_detections` table to avoid re-detection
   - Store detected patterns with confidence scores
   - Link patterns to memory nodes via foreign keys

4. **Testing**:
   - Test `/api/detect-patterns` with various time ranges
   - Verify pattern confidence scoring accuracy
   - Test validation logic with malformed requests
   - Benchmark performance with large memory datasets

---

### 1.3 Memory Core Retrieval Returns Empty

**Priority Tier**: Tier 1 - Critical Runtime Blocker
**Task Title**: Implement Functional Memory Retrieval
**Location/File**: `src/memory-core/index.ts:271-285` (function `retrieveMemories()`)
**Issue Summary**: The `retrieveMemories()` function currently returns an empty array. This breaks the entire memory system - users cannot retrieve their stored memories. API Gateway's `/api/graph` endpoint relies on this function.

**Proposed Action Plan**:
1. **Replace placeholder implementation** with actual SmartMemory queries
2. **Add fallback to GRAPH_DATABASE query** if SmartMemory search returns empty
3. **Implement pagination metadata** with total count and hasMore flag
4. **Add robust error handling** with logging
5. **Testing strategy**: Store test memories and verify retrieval with various filters

---

### 1.4 Memory Core Search Returns Empty

**Priority Tier**: Tier 1 - Critical Runtime Blocker
**Task Title**: Implement Functional Memory Search
**Location/File**: `src/memory-core/index.ts:287-298` (function `searchMemories()`)
**Issue Summary**: The `searchMemories()` function returns an empty array, making semantic search completely non-functional. This breaks the `/api/graph/search` endpoint and any AI-powered memory queries.

**Proposed Action Plan**:
1. **Implement semantic search** using AGENT_MEMORY.searchSemanticMemory()
2. **Add relevance scoring** based on search results ranking
3. **Implement hybrid search fallback** if semantic returns few results
4. **Add query expansion** using AI to improve recall
5. **Performance optimization** with result caching

---

### 1.5 Memory Core Graph Storage Not Implemented

**Priority Tier**: Tier 1 - Critical Runtime Blocker
**Task Title**: Implement Actual Graph Database Storage
**Location/File**: `src/memory-core/index.ts:238-269` (function `storeInGraphDatabase()`)
**Issue Summary**: The `storeInGraphDatabase()` function has NO ACTUAL SQL OPERATIONS. It returns success without storing anything in the database. This means all memory storage silently fails at the persistence layer.

**Proposed Action Plan**:
1. **Implement SQL INSERT statements** for memories table
2. **Create memory nodes** in memory_nodes table
3. **Store extracted entities** and link to memories
4. **Calculate and store relationships** (memory edges)
5. **Add transaction support** for data consistency
6. **Testing**: Verify database entries after storage

---

### 1.6 Voice Processor Completely Missing

**Priority Tier**: Tier 1 - Critical Runtime Blocker
**Task Title**: Implement Voice Processing Service
**Location/File**: `src/voice-processor/index.ts` (entire file commented out)
**Issue Summary**: Voice processor is a placeholder template with ALL endpoints commented out. No actual voice processing implementation exists. ElevenLabs and Hume AI dependencies are installed but unused. Any voice feature requests will fail.

**Proposed Action Plan**:
1. **Integrate ElevenLabs API** for text-to-speech
2. **Implement Hume AI voice emotion detection**
3. **Add voice-to-text processing** endpoint
4. **Connect to AUDIO_STORAGE** SmartBucket
5. **Link to memory system** for voice-triggered memory creation
6. **Re-enable audio-processor observer**
7. **Testing**: End-to-end voice conversation flow

---

## 🔐 TIER 2: ESSENTIAL FUNCTIONALITY & SECURITY GAPS

*Critical features and security vulnerabilities that must be addressed before production*

### 2.1 No Authentication Enforcement

**Priority Tier**: Tier 2 - Essential Security Gap
**Task Title**: Implement Authentication Middleware Across All Services
**Location/File**: `src/_app/auth.ts`, `src/api-gateway/index.ts`
**Issue Summary**: While authentication framework exists, NO ACTUAL AUTH ENFORCEMENT is implemented. All API endpoints are publicly accessible without any authentication checks. This is a critical security vulnerability.

**Proposed Action Plan**:
1. **Apply authentication middleware to API Gateway**
2. **Implement JWT verification**
3. **Add API key authentication as fallback**
4. **User context propagation** to all services
5. **Implement authorization rules** (user can only access own data)
6. **Security headers and rate limiting per user**

---

### 2.2 Error Handler Disabled in API Gateway

**Priority Tier**: Tier 2 - Essential Functionality Gap
**Task Title**: Enable and Enhance Error Handling Middleware
**Location/File**: `src/api-gateway/index.ts:230-242`
**Issue Summary**: Error handler middleware is completely DISABLED (commented out). Real errors are not being caught, leading to unhandled promise rejections and unclear error responses to clients.

**Proposed Action Plan**:
1. **Uncomment and enhance error handler**
2. **Implement error classification** (ValidationError, AuthenticationError, etc.)
3. **Add error recovery strategies** with retry logic
4. **Enhance error logging** with request context
5. **Client-friendly error messages**

---

### 2.3 Environment Variables Not Configured

**Priority Tier**: Tier 2 - Essential Deployment Gap
**Task Title**: Configure Production Environment Variables
**Location/File**: `.env.example`, NO actual `.env` file exists
**Issue Summary**: No actual `.env` file exists - only `.env.example` with placeholder values. All API keys and database credentials are templates. Application will fail when trying to use external services.

**Proposed Action Plan**:
1. **Create .env file from template**
2. **Provision Vultr PostgreSQL database** and get credentials
3. **Obtain all API keys** (Vultr Inference, ElevenLabs, Hume AI)
4. **Configure SmartMemory TTL settings**
5. **Add security secrets** (JWT_SECRET, SESSION_SECRET)
6. **Implement environment validation** at startup

---

### 2.4 Database Connectivity Not Tested

**Priority Tier**: Tier 2 - Essential Functionality Gap
**Task Title**: Verify and Test Database Connectivity
**Location/File**: `src/sql/initialize.ts`, `src/sql/graph-database.ts`
**Issue Summary**: PostgreSQL schema is defined, but NO ACTUAL DATABASE CONNECTION has been tested. Database initialization runs on middleware but without verification. Unknown if SmartSQL is properly configured or if credentials work.

**Proposed Action Plan**:
1. **Create database connection test script**
2. **Fix database initialization pattern** (move from middleware to startup)
3. **Test SmartMemory tiers**
4. **Verify indexes are created**
5. **Performance baseline testing**
6. **Connection pooling setup**

---

### 2.5 Frontend HTML Files Not Deployed

**Priority Tier**: Tier 2 - Essential Deployment Gap
**Task Title**: Deploy Frontend HTML Files to NGINX Server
**Location/File**: `/var/www/hansei/`, `frontend-service/index.ts`, `nginx-webhansei.conf`
**Issue Summary**: Frontend service DOES NOT SERVE ACTUAL HTML FILES - it only redirects to external URL. NGINX expects files at `/var/www/hansei/` but deployment status is unknown. Users will get 404 errors.

**Proposed Action Plan**:
1. **Build frontend assets** from source
2. **Deploy to NGINX server** via SCP/rsync
3. **Update frontend-service** to serve files locally
4. **Verify NGINX configuration**
5. **Test frontend deployment**
6. **Setup CI/CD for automated deployment**

---

### 2.6 Observers Disabled Due to Deployment Errors

**Priority Tier**: Tier 2 - Essential Functionality Gap
**Task Title**: Debug and Re-enable Disabled Observers
**Location/File**: `raindrop.manifest:109-120`
**Issue Summary**: Two observers are DISABLED with comment "causing deployment errors". This breaks asynchronous audio processing and document analysis workflows.

**Proposed Action Plan**:
1. **Investigate deployment errors** in logs
2. **Fix audio-processor observer** (depends on voice-processor)
3. **Fix document-analyzer observer**
4. **Test observers in isolation**
5. **Implement observer monitoring**
6. **Gradual re-enablement** with monitoring

---

### 2.7 Raindrop CLI Not Installed

**Priority Tier**: Tier 2 - Essential Deployment Tool
**Task Title**: Install and Configure Raindrop CLI
**Location/File**: System-wide, `package.json`
**Issue Summary**: Raindrop CLI tool is not installed on the system. This prevents deployment management, resource provisioning, and debugging.

**Proposed Action Plan**:
1. **Install Raindrop CLI globally**
2. **Authenticate Raindrop CLI**
3. **Validate Raindrop Manifest**
4. **Initialize Raindrop Project**
5. **Deploy all resources**
6. **Test resource access**
7. **Setup deployment workflow**

---

## ⚡ TIER 3: PERFORMANCE, RELIABILITY & BEST PRACTICES

*Performance bottlenecks, reliability improvements, and architectural best practices*

### 3.1 Database Initialization Runs on Every Request

**Priority Tier**: Tier 3 - Performance Bottleneck
**Task Title**: Move Database Initialization to Startup Hook
**Location/File**: `src/api-gateway/index.ts:186-198`
**Issue Summary**: Database initialization including DDL table creation runs on EVERY REQUEST through middleware. This causes severe performance impact.

**Proposed Action Plan**:
1. **Remove DB init from middleware**
2. **Create startup hook**
3. **Implement connection pooling**
4. **Add health check endpoint enhancement**

---

### 3.2 O(n²) Graph Computation Performance

**Priority Tier**: Tier 3 - Performance Bottleneck
**Task Title**: Optimize Graph Similarity Calculation
**Location/File**: `src/api-gateway/index.ts:398-420`
**Issue Summary**: Graph similarity computation uses O(n²) algorithm on EVERY `/api/graph` request. This will be extremely slow with large datasets.

**Proposed Action Plan**:
1. **Add caching for graph computations** (60s TTL)
2. **Pre-compute edges during storage**
3. **Optimize similarity calculation** algorithm
4. **Implement pagination for graph queries**
5. **Add incremental graph updates**

---

### 3.3 No Caching Strategy Implemented

**Priority Tier**: Tier 3 - Performance Improvement
**Task Title**: Implement Comprehensive Caching Layer
**Location/File**: All services
**Issue Summary**: KV caches defined but minimally used. No HTTP caching headers, no query result caching, no AI response caching.

**Proposed Action Plan**:
1. **Implement query result caching**
2. **Cache AI responses**
3. **Implement HTTP caching headers**
4. **Session caching for user data**
5. **Cache invalidation strategy**
6. **Implement cache warming**

---

### 3.4 No Rate Limiting Implementation

**Priority Tier**: Tier 3 - Reliability & Security
**Task Title**: Implement Rate Limiting Per User and IP
**Location/File**: All services
**Issue Summary**: No rate limiting exists on any endpoint. Risk of resource abuse, DoS attacks, and runaway costs from AI API calls.

**Proposed Action Plan**:
1. **Implement rate limiting middleware**
2. **Apply rate limits to API Gateway**
3. **Implement tiered rate limits** (free/premium/enterprise)
4. **Cost-based rate limiting for AI**
5. **Implement backoff for rate-limited users**

---

### 3.5 PDF Parsing Extremely Basic

**Priority Tier**: Tier 3 - Feature Enhancement
**Task Title**: Implement Robust PDF Parsing with PDF.js
**Location/File**: `src/document-processor/index.ts:212-226`
**Issue Summary**: PDF parsing only extracts text between "stream" markers using regex. This will fail for most real-world PDFs.

**Proposed Action Plan**:
1. **Install PDF parsing library** (pdf-parse or pdfjs-dist)
2. **Replace basic PDF parsing**
3. **Implement advanced PDF features** (multi-page, images, tables)
4. **Add OCR for scanned PDFs**
5. **Extract structured data from PDFs**
6. **Implement chunking for large PDFs**

---

### 3.6 No Monitoring or Metrics

**Priority Tier**: Tier 3 - Observability
**Task Title**: Implement Monitoring, Metrics, and Alerting
**Location/File**: All services
**Issue Summary**: No metrics collection exists - no request counts, latency tracking, error rates. Completely blind to production issues.

**Proposed Action Plan**:
1. **Implement metrics collection middleware**
2. **Apply metrics middleware to all services**
3. **Implement Prometheus integration**
4. **Implement alerting system**
5. **Implement distributed tracing**
6. **Setup monitoring dashboard** (Grafana)

---

## 🌐 TIER 4: ENVIRONMENT & DEPLOYMENT ACTIONS

*External configuration and infrastructure tasks required for deployment*

### 4.1 NGINX Server Configuration and Verification

**Priority Tier**: Tier 4 - Deployment Infrastructure
**Task Title**: Verify and Configure NGINX Web Server
**Location/File**: `nginx-webhansei.conf`, Server: webhansei.us
**Issue Summary**: NGINX configuration exists but cannot verify if nginx is running, SSL certificates exist, HTML files deployed, or proxy working.

**Proposed Action Plan**:
1. **SSH into server and verify NGINX**
2. **Verify SSL certificates**
3. **Deploy NGINX configuration**
4. **Verify web directory structure**
5. **Test NGINX configuration components**
6. **Add missing security headers** (HSTS, CSP)
7. **Setup NGINX logging and monitoring**

---

### 4.2 Frontend Build and Deployment

**Priority Tier**: Tier 4 - Deployment Action
**Task Title**: Build and Deploy Frontend Application
**Location/File**: `frontend/` directory
**Issue Summary**: Frontend code exists but built assets not deployed to web server. Users cannot access the UI.

**Proposed Action Plan**:
1. **Fix frontend environment configuration**
2. **Update frontend config** to require env vars
3. **Build frontend for production**
4. **Deploy to NGINX server**
5. **Verify deployment**
6. **Setup CI/CD for automated deployment**
7. **Setup CDN for static assets** (optional)

---

### 4.3 Database Provisioning and Connection

**Priority Tier**: Tier 4 - Critical Infrastructure
**Task Title**: Provision PostgreSQL Database and Configure Connections
**Location/File**: `.env`, Vultr cloud
**Issue Summary**: Database credentials are templates. No actual database provisioned.

**Proposed Action Plan**:
1. **Provision Vultr Managed PostgreSQL Database**
2. **Configure database firewall and trusted sources**
3. **Update .env file with actual credentials**
4. **Test database connectivity**
5. **Initialize database schema**
6. **Configure SSL/TLS for database connections**
7. **Setup database backups**
8. **Database monitoring setup**

---

### 4.4 API Keys and External Service Configuration

**Priority Tier**: Tier 4 - Essential External Dependencies
**Task Title**: Obtain and Configure All External API Keys
**Location/File**: `.env` file
**Issue Summary**: All API keys are placeholders. Need to obtain keys for Vultr Inference, ElevenLabs, Hume AI.

**Proposed Action Plan**:
1. **Vultr Inference API** - obtain and test
2. **ElevenLabs Voice API** - obtain and test
3. **Hume AI Voice/Emotion API** - obtain and test
4. **Configure API usage limits and billing alerts**
5. **Implement API key rotation schedule**
6. **Secure API key storage**
7. **Add API key validation at startup**
8. **Monitor API usage and costs**

---

### 4.5 Raindrop Platform Deployment Configuration

**Priority Tier**: Tier 4 - Deployment Infrastructure
**Task Title**: Deploy and Configure Raindrop Resources
**Location/File**: `raindrop.manifest`
**Issue Summary**: Raindrop manifest is complete but resources not deployed.

**Proposed Action Plan**:
1. **Install and authenticate Raindrop CLI**
2. **Deploy all resources from manifest**
3. **Verify resource deployment**
4. **Deploy services**
5. **Configure resource bindings**
6. **Enable observers** (after fixes)
7. **Setup monitoring and logging**
8. **Configure autoscaling**
9. **Setup health checks and auto-recovery**
10. **Backup and disaster recovery**

---

# WEEK 1: FOUNDATION & CRITICAL FIXES

## DAY 1 - MONDAY: Environment Setup & Infrastructure (8 hours)

### Task 1.1: Create and Configure .env File (1.5 hours)

**Prerequisites**: None
**Assignee**: DevOps Engineer
**Priority**: CRITICAL

**Detailed Steps**:

1. **Create .env file from template** (15 min)
```bash
cd /home/user/Hansei
cp .env.example .env
chmod 600 .env  # Secure the file
```

2. **Provision Vultr PostgreSQL Database** (30 min)
```
# Manual steps in Vultr Dashboard:
1. Login to vultr.com
2. Click "Products" > "Databases" > "Deploy Database"
3. Select:
   - Database Type: PostgreSQL 15
   - Plan: Production High Performance ($60/mo, 2GB RAM, 55GB SSD)
   - Region: New Jersey (NJ) - closest to server
   - Database Name: hansei_production
   - Label: Hansei-Prod-DB
4. Click "Deploy Now"
5. Wait 5-10 minutes for provisioning
6. Note credentials from dashboard:
   - Host: vultrd-prod-xxxxx.vultr.cloud
   - Port: 16751
   - Username: vultradmin
   - Password: [auto-generated]
   - Database: hansei_production
```

3. **Configure Database Firewall** (15 min)
```
# In Vultr Dashboard > Database > Settings > Trusted Sources
Add the following IP addresses:
1. Application Server: 155.138.196.189/32
2. Your Dev Machine: [Run: curl ifconfig.me]/32
3. Raindrop Platform IPs:
   - 35.192.0.0/14 (get actual IPs from Raindrop docs)
Save changes
```

4. **Update .env with Database Credentials** (15 min)
```bash
nano .env

# Update these lines:
VULTR_DB_HOST=vultrd-prod-xxxxx.vultr.cloud
VULTR_DB_PORT=16751
VULTR_DB_NAME=hansei_production
VULTR_DB_USER=vultradmin
VULTR_DB_PASSWORD=<paste-password-from-dashboard>

# Save and exit (Ctrl+X, Y, Enter)
```

5. **Test Database Connection** (15 min)
```bash
# Install PostgreSQL client
sudo apt-get update
sudo apt-get install -y postgresql-client

# Test connection
psql -h $(grep VULTR_DB_HOST .env | cut -d'=' -f2) \
     -p $(grep VULTR_DB_PORT .env | cut -d'=' -f2) \
     -U $(grep VULTR_DB_USER .env | cut -d'=' -f2) \
     -d $(grep VULTR_DB_NAME .env | cut -d'=' -f2)

# If prompted for password, paste from .env file
# Should see: hansei_production=>

# Run test query:
SELECT version();
SELECT current_database();

# Exit:
\q
```

**Acceptance Criteria**:
- ✅ .env file exists with 600 permissions
- ✅ Database provisioned in Vultr
- ✅ Firewall configured with correct IPs
- ✅ Successful psql connection to database
- ✅ Test queries return results

---

### Task 1.2: Obtain All API Keys (2 hours)

**Prerequisites**: Task 1.1
**Assignee**: DevOps Engineer
**Priority**: CRITICAL

**Detailed Steps**:

1. **Get Vultr Inference API Key** (30 min)
```
# In Vultr Dashboard:
1. Navigate to "Account" > "API"
2. Click "Add API Key"
3. Name: "Hansei-Production-Inference"
4. Select Scopes:
   ☑ Compute
   ☑ Inference
   ☑ Databases
5. Click "Add API Key"
6. **COPY KEY IMMEDIATELY** (only shown once)
7. Store in password manager

# Test the key:
curl -X POST https://api.vultrinfer.com/v1/chat/completions \
  -H "Authorization: Bearer YOUR_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama-3.3-70b",
    "messages": [{"role": "user", "content": "Say hello"}],
    "max_tokens": 10
  }'

# Should return: {"id":"chatcmpl-...", "choices":[...]}
```

2. **Get ElevenLabs API Key** (30 min)
```
# Setup ElevenLabs:
1. Go to elevenlabs.io
2. Sign up or login
3. Click profile icon > "Profile + API Key"
4. Click "Copy" next to API Key
5. Store in password manager

# Create Voice Agent:
1. Go to "Voices" tab
2. Click "Add Voice" or use default
3. Select a voice (e.g., "Rachel - American Female")
4. Copy the Voice ID (e.g., "21m00Tcm4TlvDq8ikWAM")

# Test the API:
curl -X POST https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM \
  -H "xi-api-key: YOUR_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello, this is a test",
    "model_id": "eleven_monolingual_v1"
  }' \
  --output test_audio.mp3

# Should create test_audio.mp3 file
```

3. **Get Hume AI API Key** (30 min)
```
# Setup Hume AI:
1. Go to hume.ai
2. Sign up for account
3. Navigate to "Dashboard" > "API Keys"
4. Click "Create New API Key"
5. Name: "Hansei-Production"
6. Select Scopes:
   ☑ Voice Analysis
   ☑ Emotion Detection
7. Copy the API key
8. Store in password manager

# Test the API:
curl -X GET https://api.hume.ai/v0/apikey/validate \
  -H "X-Hume-Api-Key: YOUR_KEY_HERE"

# Should return: {"valid": true}
```

4. **Update .env with All Keys** (30 min)
```bash
nano .env

# Add/update these lines:
VULTR_INFERENCE_API_KEY=your_vultr_inference_key_here
ELEVENLABS_API_KEY=your_elevenlabs_key_here
ELEVENLABS_AGENT_ID=21m00Tcm4TlvDq8ikWAM
VITE_HUME_API_KEY=your_hume_key_here

# Add application settings:
NODE_ENV=production
LOG_LEVEL=info
API_BASE_URL=https://svc-01ka9tm46dtzqcvz88z5v3c9kc.01ka41m1warcc7s5zveqw1tt3z.lmapp.run

# Add SmartMemory settings:
SMARTMEMORY_WORKING_TTL=3600
SMARTMEMORY_EPISODIC_TTL=2592000
SMARTMEMORY_CONSOLIDATION_INTERVAL=3600000

# Save (Ctrl+X, Y, Enter)
```

**Acceptance Criteria**:
- ✅ Vultr Inference API key obtained and tested
- ✅ ElevenLabs API key obtained and tested
- ✅ Hume AI API key obtained and tested
- ✅ All keys added to .env file
- ✅ .env file still has 600 permissions

---

### Task 1.3: Install and Configure Raindrop CLI (1.5 hours)

**Prerequisites**: Task 1.1, 1.2
**Assignee**: DevOps Engineer
**Priority**: CRITICAL

**Detailed Steps**:

1. **Install Raindrop CLI** (15 min)
```bash
# Check if Node.js is installed (need v18+)
node --version
# If not installed or version < 18:
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Raindrop CLI globally
npm install -g @liquidmetal-ai/raindrop-cli

# Verify installation
raindrop --version
# Should show: raindrop/0.10.x or similar
```

2. **Authenticate Raindrop CLI** (15 min)
```bash
# Login to Raindrop
raindrop auth login

# Follow the prompts:
# 1. Browser window opens
# 2. Login with your Raindrop account
# 3. Authorize the CLI
# 4. Return to terminal

# Verify authentication
raindrop whoami
# Should show your account email
```

3. **Validate Raindrop Manifest** (30 min)
```bash
cd /home/user/Hansei

# Check manifest syntax
raindrop validate

# If errors, fix them:
# Common issues:
# - Indentation (use 2 spaces, not tabs)
# - Missing required fields
# - Invalid service names
# - Invalid resource types

# Expected output:
# ✓ Manifest validation successful
# ✓ Found 12 services
# ✓ Found 11 resources
# ✓ Found 4 observers (2 disabled)
```

4. **Initialize Raindrop Project** (30 min)
```bash
# Initialize project (if not already done)
raindrop init

# Link to existing project or create new
# Select: "Link to existing project"
# Project name: hansei-production
# Region: us-east (or your preferred region)

# Verify project setup
raindrop status
# Should show: Project: hansei-production
```

**Acceptance Criteria**:
- ✅ Raindrop CLI installed globally
- ✅ CLI version >= 0.10.0
- ✅ Successfully authenticated
- ✅ Manifest validates without errors
- ✅ Project initialized and linked

---

### Task 1.4: Deploy Raindrop Resources (2 hours)

**Prerequisites**: Task 1.3
**Assignee**: DevOps Engineer
**Priority**: CRITICAL

**Detailed Steps**:

1. **Deploy All Resources** (60 min)
```bash
cd /home/user/Hansei

# Deploy resources (this will take 5-10 minutes)
raindrop deploy --resources

# You'll see:
# Deploying resources...
# ✓ SmartMemory: working-memory (HEALTHY)
# ✓ SmartMemory: episodic-memory (HEALTHY)
# ✓ SmartMemory: semantic-memory (HEALTHY)
# ✓ SmartMemory: procedural-memory (HEALTHY)
# ✓ SmartMemory: agent-memory (HEALTHY)
# ✓ SmartSQL: graph-database (HEALTHY)
# ✓ SmartBucket: document-storage (HEALTHY)
# ✓ SmartBucket: audio-storage (HEALTHY)
# ✓ VectorIndex: memory-embeddings (HEALTHY)
# ✓ VectorIndex: document-embeddings (HEALTHY)
# ✓ Queue: processing-queue (HEALTHY)
# ✓ Queue: analysis-queue (HEALTHY)
# ✓ KVCache: session-cache (HEALTHY)
# ✓ KVCache: query-cache (HEALTHY)
```

2. **Verify Resource Health** (30 min)
```bash
# List all resources
raindrop resources list

# Should show table:
# NAME                TYPE          STATUS    REGION
# working-memory      SmartMemory   HEALTHY   us-east
# episodic-memory     SmartMemory   HEALTHY   us-east
# ...

# Test individual resources
raindrop resources test AGENT_MEMORY
raindrop resources test GRAPH_DATABASE
raindrop resources test PROCESSING_QUEUE
raindrop resources test SESSION_CACHE

# Each should return: ✓ Resource test successful
```

3. **Configure Resource Bindings** (30 min)
```bash
# View resource connection details
raindrop resources describe GRAPH_DATABASE

# Should show:
# Name: graph-database
# Type: SmartSQL
# Status: HEALTHY
# Endpoint: https://...
# Database: hansei_production
# Connection Info: ...

# Export resource URLs to .env (if needed)
raindrop resources env >> .env.raindrop

# Review exported variables
cat .env.raindrop
```

**Acceptance Criteria**:
- ✅ All 14 resources deployed successfully
- ✅ All resources show HEALTHY status
- ✅ Resource tests pass
- ✅ Connection details available

---

### Task 1.5: Initialize Database Schema (1 hour)

**Prerequisites**: Task 1.1, 1.4
**Assignee**: Backend Developer 1
**Priority**: CRITICAL

**Detailed Steps**:

1. **Create Database Initialization Script** (20 min)
```bash
# Create scripts directory if not exists
mkdir -p scripts

# Create script file
cat > scripts/init-db.ts << 'EOF'
import pkg from 'pg';
const { Pool } = pkg;

async function main() {
  const pool = new Pool({
    host: process.env.VULTR_DB_HOST,
    port: parseInt(process.env.VULTR_DB_PORT || '5432'),
    database: process.env.VULTR_DB_NAME,
    user: process.env.VULTR_DB_USER,
    password: process.env.VULTR_DB_PASSWORD,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔌 Connecting to database...');
    const client = await pool.connect();
    console.log('✅ Connected successfully');

    console.log('📋 Running schema initialization...');

    // Read and execute schema from graph-database.ts
    const fs = await import('fs');
    const schemaSQL = fs.readFileSync('src/sql/graph-database.ts', 'utf8');

    // Extract SQL statements (this is simplified - adjust based on actual file structure)
    // Execute CREATE TABLE statements
    // Execute CREATE INDEX statements

    console.log('🔍 Verifying tables...');
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log(`✅ Found ${result.rows.length} tables:`);
    result.rows.forEach(row => console.log(`  - ${row.table_name}`));

    console.log('📊 Verifying indexes...');
    const indexResult = await client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
    `);
    console.log(`✅ Found ${indexResult.rows.length} indexes`);

    client.release();
    await pool.end();
    console.log('🎉 Database initialization complete!');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

main();
EOF

chmod +x scripts/init-db.ts
```

2. **Run Database Initialization** (20 min)
```bash
# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

# Run initialization
npx tsx scripts/init-db.ts

# Expected output:
# 🔌 Connecting to database...
# ✅ Connected successfully
# 📋 Running schema initialization...
# ✅ Table 'memories' created
# ✅ Table 'memory_nodes' created
# ... (all tables)
# ✅ Found 15 tables
# 📊 Verifying indexes...
# ✅ Found 34 indexes
# 🎉 Database initialization complete!
```

3. **Verify Database Schema** (20 min)
```bash
# Connect to database
psql -h $VULTR_DB_HOST -p $VULTR_DB_PORT -U $VULTR_DB_USER -d $VULTR_DB_NAME

# Check tables
\dt

# Should show:
#              List of relations
#  Schema |        Name         | Type  |   Owner
# --------+---------------------+-------+------------
#  public | memories            | table | vultradmin
#  public | memory_nodes        | table | vultradmin
#  public | memory_edges        | table | vultradmin
#  ... (all tables)

# Check indexes
\di

# Describe specific table
\d memories

# Should show columns:
# id, user_id, content, memory_type, metadata, created_at, updated_at

# Exit
\q
```

**Acceptance Criteria**:
- ✅ Database schema script created
- ✅ All 15 tables created successfully
- ✅ All 34 indexes created
- ✅ Database schema verified via psql
- ✅ No errors in initialization

---

## DAY 2 - TUESDAY: Critical Service Implementations Part 1 (8 hours)

### Task 2.1: Implement Search Engine Utilities (3 hours)

**Prerequisites**: Day 1 complete
**Assignee**: Backend Developer 1
**Priority**: CRITICAL (Service will crash without this)

**Detailed Steps**:

1. **Create Search Engine Interfaces** (30 min)
```typescript
// File: src/search-engine/interfaces.ts
export interface SearchOptions {
  user_id?: string;
  limit?: number;
  offset?: number;
  filters?: Record<string, any>;
}

export interface SemanticSearchOptions extends SearchOptions {
  similarityThreshold?: number;
  includeMetadata?: boolean;
}

export interface HybridSearchOptions extends SemanticSearchOptions {
  keywordWeight?: number;
  semanticWeight?: number;
}

export interface SearchResult {
  id: string;
  content: string;
  score: number;
  metadata?: Record<string, any>;
  highlights?: string[];
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  took_ms: number;
  pagination?: {
    offset: number;
    limit: number;
    hasMore: boolean;
  };
}

export interface EmbeddingRequest {
  text: string;
  model?: string;
}

export interface EmbeddingResponse {
  embedding: number[];
  model: string;
  dimensions: number;
}

export interface IndexDocument {
  id: string;
  content: string;
  metadata?: Record<string, any>;
  user_id?: string;
}

export interface IndexResponse {
  id: string;
  indexed: boolean;
  embedding_id?: string;
}
```

2. **Create Search Engine Utilities with Full Implementation** (120 min)

See the detailed implementation in the utils.ts file in the conversation above. The file includes:
- `performSearch()` - keyword search using SmartMemory
- `semanticSearch()` - vector-based semantic search
- `hybridSearch()` - combination of keyword and semantic
- `generateVectorEmbeddings()` - create embeddings via AI
- `indexDocument()` - store documents with embeddings
- Helper functions for merging results and extracting highlights

3. **Update Search Engine Service** (30 min)
```bash
# Edit src/search-engine/index.ts to use the new utils
# Update all endpoint handlers to pass required parameters
# Ensure proper error handling
```

4. **Build and Test** (30 min)
```bash
npm run build
raindrop deploy --service search-engine

# Test all three search endpoints
# Verify no errors in logs
```

**Acceptance Criteria**:
- ✅ interfaces.ts created with all types
- ✅ utils.ts created with all 5 functions
- ✅ Service updated to use utils
- ✅ TypeScript compiles without errors
- ✅ All search endpoints return results
- ✅ No runtime errors

---

### Task 2.2: Implement Pattern Detector Utilities (2 hours)

**Prerequisites**: Task 2.1
**Assignee**: Backend Developer 1
**Priority**: CRITICAL

See detailed implementation in conversation above including:
- Pattern type definitions (BEHAVIORAL, TEMPORAL, SEMANTIC, RELATIONAL)
- Request validation
- Pattern detection algorithms
- Database integration
- Testing procedures

---

### Task 2.3: Fix Memory Core Functions (3 hours)

**Prerequisites**: Task 2.1, 2.2
**Assignee**: Backend Developer 2
**Priority**: CRITICAL

Implement the three critical functions:
1. `retrieveMemories()` - actual data retrieval from SmartMemory
2. `searchMemories()` - semantic search with fallback
3. `storeInGraphDatabase()` - persist to PostgreSQL with relationships

See detailed implementations in conversation above.

---

## REMAINING DAYS (3-20)

The plan continues with:
- **Day 3-5**: Enable error handler, implement authentication, complete Week 1
- **Week 2**: Frontend deployment, NGINX config, voice processing
- **Week 3**: Performance optimization, caching, monitoring
- **Week 4**: Testing, documentation, production launch

Each day follows the same detailed format with:
- Hour-by-hour task breakdown
- Exact commands and code
- Testing procedures
- Acceptance criteria

---

## QUICK REFERENCE

### Daily Standup Questions
1. What did I complete yesterday?
2. What am I working on today?
3. Any blockers?

### Testing Checklist (Run After Each Major Change)
```bash
# Health check
curl https://your-api-gateway.run/health

# Memory storage
curl -X POST https://your-api-gateway.run/api/graph/store \
  -H "Content-Type: application/json" \
  -d '{"input": "test", "options": {"user_id": "test"}}'

# Memory retrieval
curl "https://your-api-gateway.run/api/graph?user_id=test"

# Search
curl -X POST https://your-api-gateway.run/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "test"}'
```

### Emergency Rollback
```bash
# Revert to previous git commit
git log --oneline  # Find previous commit
git revert <commit-hash>

# Redeploy
raindrop deploy

# Restore database from backup
pg_restore -h $VULTR_DB_HOST -U $VULTR_DB_USER -d $VULTR_DB_NAME backup.dump
```

---

## TEAM ASSIGNMENTS

**Lead Architect**: Overall coordination
- Review all implementations
- Make critical decisions
- Risk management

**Backend Developer 1**: Core services
- Search engine
- Pattern detector
- Memory improvements

**Backend Developer 2**: Infrastructure & Auth
- Database setup
- Authentication
- API security

**Frontend Developer**: UI/UX
- Frontend build
- NGINX config
- User testing

**DevOps Engineer**: Operations
- Environment setup
- Monitoring
- CI/CD

---

## SUCCESS METRICS

### Week 1 Goals
- ✅ All services start without crashes
- ✅ Memory storage and retrieval functional
- ✅ Search working (all 3 types)
- ✅ Database connected and tested
- ✅ Authentication enforced
- ✅ Errors properly handled

### Week 2 Goals
- ✅ Frontend accessible at https://webhansei.us
- ✅ Voice processing implemented
- ✅ All observers running
- ✅ SSL configured properly

### Week 3 Goals
- ✅ Cache hit rate > 50%
- ✅ Response time P95 < 500ms
- ✅ Monitoring dashboard live
- ✅ Rate limiting active

### Week 4 Goals
- ✅ All tests passing
- ✅ Documentation complete
- ✅ Production checklist 100%
- ✅ Ready for user traffic

---

## APPENDIX: RESOURCE LINKS

- **Audit Report**: `DEPLOYMENT_AUDIT_REPORT.md`
- **Raindrop Docs**: https://docs.raindrop.ai
- **PostgreSQL Docs**: https://postgresql.org/docs
- **NGINX Docs**: https://nginx.org/docs
- **Vultr Dashboard**: https://my.vultr.com
- **ElevenLabs Dashboard**: https://elevenlabs.io/app
- **Hume AI Dashboard**: https://platform.hume.ai

---

**Document Version**: 1.0
**Last Updated**: 2025-11-21
**Next Review**: After Week 1 completion
