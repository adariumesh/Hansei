# HANSEI - AI-Powered Memory & Knowledge Graph

## Production Documentation

**Version:** 1.0.0
**Last Updated:** November 17, 2025
**Status:** Production Ready

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Quick Start](#quick-start)
4. [Documentation Index](#documentation-index)
5. [Support](#support)

---

## Overview

HANSEI is an AI-powered memory system that transforms voice notes and text into an interactive 3D knowledge graph. It uses advanced AI for transcription and entity extraction, combined with semantic memory storage to help users visualize and explore their thoughts, ideas, and memories.

### Key Features

- 🎙️ **Voice-to-Text Transcription** - Real-time audio transcription using OpenAI Whisper
- 🧠 **AI Entity Extraction** - Automatic identification of entities and relationships using LLaMA 3.3 70B
- 💾 **Semantic Memory Storage** - Graph-based storage with intelligent search
- 🌌 **3D Visualization** - Interactive force-directed graph in 3D space
- 🔍 **Natural Language Search** - Query your knowledge graph conversationally
- 📊 **Relationship Mapping** - Automatic detection of connections between entities

### Use Cases

- **Personal Knowledge Management** - Capture and organize thoughts, ideas, and notes
- **Goal Tracking** - Track goals, habits, and progress over time
- **Project Planning** - Map project dependencies and relationships
- **Research Notes** - Build interconnected research databases
- **Brainstorming** - Visualize idea connections and patterns

---

## Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    USER INTERFACE                        │
│              Web Browser (Desktop/Mobile)                │
└────────────────────┬────────────────────────────────────┘
                     │ HTTPS
                     ▼
┌─────────────────────────────────────────────────────────┐
│                 FRONTEND (Vultr VPS)                     │
│  ┌────────────────────────────────────────────────┐     │
│  │ Nginx Web Server (Port 80/443)                 │     │
│  │ - Static HTML/CSS/JavaScript                   │     │
│  │ - Vis.js (2D Graph Visualization)              │     │
│  │ - 3D-Force-Graph (3D Visualization)            │     │
│  │ - WebRTC (Voice Recording)                     │     │
│  └────────────────────────────────────────────────┘     │
│  Server: 155.138.196.189                                │
└────────────────────┬────────────────────────────────────┘
                     │ REST API (HTTPS)
                     ▼
┌─────────────────────────────────────────────────────────┐
│              BACKEND (Raindrop Cloud)                    │
│  ┌────────────────────────────────────────────────┐     │
│  │ API Service (Hono.js)                          │     │
│  │ - /infer - Text entity extraction              │     │
│  │ - /api/voice/ingest - Audio processing         │     │
│  │ - /api/graph - Graph queries                   │     │
│  │ - /health - Health check                       │     │
│  └────────────────────────────────────────────────┘     │
│  ┌────────────────────────────────────────────────┐     │
│  │ AI Models                                      │     │
│  │ - Whisper-tiny (Audio → Text)                  │     │
│  │ - LLaMA 3.3 70B (Text → Entities)              │     │
│  └────────────────────────────────────────────────┘     │
│  ┌────────────────────────────────────────────────┐     │
│  │ SmartMemory (Semantic Storage)                 │     │
│  │ - Graph-based entity storage                   │     │
│  │ - Vector embeddings for search                 │     │
│  │ - Relationship management                      │     │
│  └────────────────────────────────────────────────┘     │
│  URL: svc-01ka9za29rb1k3xhtqxxe8qn20...lmapp.run        │
└─────────────────────────────────────────────────────────┘
```

### Technology Stack

**Frontend:**
- HTML5, CSS3, JavaScript (ES6+)
- Vis.js 9.1.2 (2D Network Visualization)
- 3D-Force-Graph (3D Visualization)
- WebRTC Media Recorder API
- Nginx 1.18.0

**Backend:**
- Raindrop Framework 0.10.0
- Hono.js 4.x (Web Framework)
- TypeScript 5.0.4
- Node.js 18+

**AI/ML:**
- OpenAI Whisper-tiny (Transcription)
- LLaMA 3.3 70B (Entity Extraction)
- SmartMemory (Semantic Storage)

**Infrastructure:**
- Raindrop Cloud (Backend Hosting)
- Vultr Cloud (Frontend Hosting)
- Ubuntu 22.04 LTS
- Let's Encrypt SSL (Optional)

---

## Quick Start

### Prerequisites

- Node.js 18+ installed
- Raindrop CLI (`npm install -g @liquidmetal-ai/raindrop`)
- Raindrop account and authentication
- Vultr account (for frontend hosting)
- SSH access to server

### Installation (5 Minutes)

**1. Clone Repository**
```bash
git clone <repository-url>
cd Hansei
```

**2. Deploy Backend**
```bash
npm install
raindrop build deploy --start
```

**3. Deploy Frontend**
```bash
# SSH into Vultr server
ssh root@YOUR_SERVER_IP

# Run deployment script
curl -sSL https://your-domain.com/deploy.sh | bash

# Upload frontend files
scp -r frontend/* root@YOUR_SERVER_IP:/var/www/hansei/
```

**4. Access Application**
```
http://YOUR_SERVER_IP/
```

---

## Documentation Index

### Getting Started
- [Installation Guide](./INSTALLATION.md) - Complete setup instructions
- [Quick Start Guide](./QUICK_START.md) - Get running in 5 minutes
- [Configuration](./CONFIGURATION.md) - Environment and settings

### Deployment
- [Production Deployment](./DEPLOYMENT.md) - Full production deployment guide
- [Vultr Deployment](./VULTR_DEPLOYMENT.md) - Vultr-specific instructions
- [Backend Deployment](./BACKEND_DEPLOYMENT.md) - Raindrop backend setup
- [SSL Configuration](./SSL_SETUP.md) - HTTPS/TLS setup

### Development
- [Development Guide](./DEVELOPMENT.md) - Local development setup
- [API Documentation](./API.md) - Complete API reference
- [Architecture Guide](./ARCHITECTURE.md) - System architecture details
- [Contributing](./CONTRIBUTING.md) - Contribution guidelines

### Operations
- [Monitoring Guide](./MONITORING.md) - Application monitoring
- [Backup & Recovery](./BACKUP.md) - Backup strategies
- [Security Guide](./SECURITY.md) - Security best practices
- [Troubleshooting](./TROUBLESHOOTING.md) - Common issues and fixes
- [Performance Tuning](./PERFORMANCE.md) - Optimization guide

### Reference
- [User Guide](./USER_GUIDE.md) - End-user documentation
- [FAQ](./FAQ.md) - Frequently asked questions
- [Changelog](./CHANGELOG.md) - Version history
- [License](../LICENSE) - License information

---

## Current Deployment

### Production Environment

**Backend:**
- **Platform:** Raindrop Cloud
- **URL:** `https://svc-01ka9za29rb1k3xhtqxxe8qn20.01ka4j4ktmq3vmg0nfmg652rkw.lmapp.run`
- **Status:** Active
- **Version:** 1.0.0

**Frontend:**
- **Platform:** Vultr VPS
- **IP:** 155.138.196.189
- **URL:** `http://155.138.196.189/`
- **Status:** Active
- **Server:** Ubuntu 22.04 LTS, Nginx 1.18.0

### Health Checks

```bash
# Backend health
curl https://svc-01ka9za29rb1k3xhtqxxe8qn20.01ka4j4ktmq3vmg0nfmg652rkw.lmapp.run/health

# Frontend health
curl http://155.138.196.189/
```

---

## Support

### Resources

- **Documentation:** `/docs` directory
- **Issues:** GitHub Issues
- **Raindrop Docs:** https://docs.liquidmetal.ai
- **Community:** [Discord/Slack Link]

### Getting Help

1. Check [Troubleshooting Guide](./TROUBLESHOOTING.md)
2. Review [FAQ](./FAQ.md)
3. Search existing issues
4. Contact support team

---

## License

MIT License - See [LICENSE](../LICENSE) file for details

---

## Acknowledgments

- **Raindrop Framework** by LiquidMetal AI
- **Whisper** by OpenAI
- **LLaMA** by Meta
- **Vis.js** Network Visualization
- **3D-Force-Graph** by Vasco Asturiano

---

**Ready to get started?** See the [Installation Guide](./INSTALLATION.md) →
