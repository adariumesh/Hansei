# HANSEI - AI-Powered Memory & Knowledge Graph

⏺ **Voice notes → Whisper transcription → AI entity extraction → SmartMemory storage → 3D knowledge graph visualization**

## 🌟 Overview

HANSEI transforms how you capture and visualize information through natural language. Speak your thoughts, and watch them become an interactive 3D knowledge graph that reveals connections, patterns, and insights.

**Live Demo**: [https://svc-01ka9tm46dtzqcvz88z5v3c9kc.01ka41m1warcc7s5zveqw1tt3z.lmapp.run](https://svc-01ka9tm46dtzqcvz88z5v3c9kc.01ka41m1warcc7s5zveqw1tt3z.lmapp.run)  
**3D Visualization**: [https://svc-01ka9tm46dtzqcvz88z5v3c9kc.01ka41m1warcc7s5zveqw1tt3z.lmapp.run/3d](https://svc-01ka9tm46dtzqcvz88z5v3c9kc.01ka41m1warcc7s5zveqw1tt3z.lmapp.run/3d)

## ✨ Features

- 🎙️ **Voice Input** - Record thoughts via microphone, transcribed with Whisper
- 🧠 **Entity Extraction** - AI extracts entities (goals, habits, projects) and relationships
- 💾 **Smart Memory** - Persistent graph-based storage with semantic search
- 🌌 **3D Visualization** - Interactive hierarchical force-graph in 3D space
- 🔍 **Semantic Search** - Natural language queries across your memory
- 📊 **Relationship Mapping** - Automatic detection of causes, dependencies, impacts
- 🤖 **MCP Integration** - Model Context Protocol for Claude Code integration

## 🏗️ Architecture

Built on Raindrop Framework with modern AI infrastructure:

- **Backend**: Raindrop Framework, Hono.js, TypeScript
- **AI Models**: Whisper-tiny (transcription) + LLaMA 3.3 70B (extraction)
- **Storage**: SmartMemory (graph-based semantic memory)
- **Frontend**: Vis.js (2D), 3D-Force-Graph (3D)
- **Deployment**: Raindrop Cloud (backend) + VPS (frontend)

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Raindrop CLI (`npm install -g @liquidmetal-ai/raindrop-cli`)

### Backend Deployment

```bash
# Clone repository
git clone <repository-url>
cd hansei

# Install dependencies
npm install

# Authenticate with Raindrop
raindrop auth login

# Deploy backend
raindrop build deploy --start

# Check status
raindrop build status
```

### Frontend Deployment

#### Option 1: Local Development
```bash
# Navigate to frontend
cd frontend

# Start local server
python3 -m http.server 8081
# Or use any static file server

# Open browser
open http://localhost:8081
```

#### Option 2: Production Deployment (VPS)

1. **Create VPS** (Ubuntu 22.04 LTS)
2. **Run deployment script**:
   ```bash
   # On your VPS
   ./deploy.sh
   ```
3. **Upload frontend files**:
   ```bash
   # From local machine
   scp -r frontend/* root@YOUR_SERVER_IP:/var/www/hansei/
   ```

## 📡 API Reference

### Base URL
Production: `https://svc-01ka9tm46dtzqcvz88z5v3c9kc.01ka41m1warcc7s5zveqw1tt3z.lmapp.run`

### Endpoints

#### POST `/infer`
Extract entities from text
```json
{
  "content": "I want to start running every morning",
  "user_id": "your_user_id"
}
```

#### POST `/api/voice/ingest`
Process voice recording
```bash
curl -X POST {BASE_URL}/api/voice/ingest \
  -F "audio=@recording.wav" \
  -F "user_id=your_id"
```

#### GET `/api/graph`
Query knowledge graph
```
GET /api/graph?query=health&limit=50&user_id=your_id
```

#### POST `/api/chat`
Chat with your memory
```json
{
  "message": "What are my health goals?",
  "user_id": "your_user_id"
}
```

#### GET `/health`
Health check endpoint
```
GET /health
```

## 📁 Project Structure

```
hansei/
├── raindrop.manifest          # App configuration
├── deploy.sh                  # Unified deployment script
├── src/
│   ├── _app/                  # Auth and CORS middleware
│   ├── api-gateway/           # Public API gateway
│   ├── hansei-intelligence-processor/  # Core processing
│   ├── hansei-intel-mcp/      # MCP integration
│   ├── memory-core/           # Memory management
│   ├── intelligence-pipeline/ # AI processing pipeline
│   ├── search-engine/         # Graph search
│   ├── entity-resolver/       # Entity resolution
│   ├── pattern-detector/      # Pattern recognition
│   ├── voice-processor/       # Voice processing
│   ├── document-processor/    # Document analysis
│   ├── batch-processor/       # Background processing
│   ├── insight-generator/     # Insight generation
│   ├── audio-processor/       # Audio handling
│   ├── document-analyzer/     # Document analysis
│   ├── shared/               # Shared utilities
│   └── sql/                  # Database schemas
├── frontend/
│   ├── index.html           # 2D graph visualization
│   └── index-3d.html        # 3D hierarchical graph
├── package.json
├── tsconfig.json
└── README.md
```

## 🛠️ Development

### Build Commands
```bash
# Build the project
npm run build

# Start development server
npm run start

# Run tests
npm test

# Format code
npm run format

# Lint code
npm run lint
```

### Raindrop Commands
```bash
# Build and deploy
raindrop build deploy --start

# Check status
raindrop build status

# View logs
raindrop logs tail -f

# Stop service
raindrop build stop
```

## 🔧 Configuration

### Environment Variables
```bash
# Set via Raindrop dashboard or CLI
OPENAI_API_KEY=your_key_here
WHISPER_MODEL=whisper-tiny
```

### Manifest Configuration
The `raindrop.manifest` file defines:
- Services and their visibility
- Storage systems (SmartMemory, SmartSQL, SmartBucket)
- Vector indices for embeddings
- Processing queues and observers
- Caching layers

## 📋 Deployment Checklist

### Backend (Raindrop Cloud) ✅
- [x] Dependencies installed
- [x] Authenticated with Raindrop
- [x] Manifest validated
- [x] Backend deployed and running
- [x] Health endpoint responding

### Frontend Deployment
- [ ] VPS created and configured
- [ ] Nginx installed and configured
- [ ] Frontend files uploaded
- [ ] Domain/SSL configured (optional)
- [ ] Testing completed

### Testing
- [ ] Voice recording works
- [ ] Text input processes correctly
- [ ] Graph visualization loads
- [ ] API endpoints respond
- [ ] Cross-platform compatibility

## 🐛 Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Can't access site | Check `systemctl status nginx` |
| 404 errors | Verify files: `ls /var/www/hansei/` |
| API errors | Test backend: `curl BACKEND_URL/health` |
| Permission errors | `chown -R www-data:www-data /var/www/hansei` |
| CORS issues | Check backend CORS configuration |

### Logs
```bash
# Backend logs
raindrop logs tail -f

# Nginx logs (VPS)
tail -f /var/log/nginx/hansei-access.log
tail -f /var/log/nginx/hansei-error.log
```

## 🔒 Security

### Best Practices
- Use HTTPS in production
- Configure proper CORS headers
- Validate all user inputs
- Rate limit API endpoints
- Regular security updates

### Hardening Checklist
- [ ] SSL/TLS certificate configured
- [ ] Security headers implemented
- [ ] Firewall properly configured
- [ ] Regular security audits
- [ ] Backup and recovery plan

## 📊 Performance

### Optimization
- Response caching for frequent queries
- Vector index optimization
- Graph query optimization
- CDN for static assets
- Gzip/Brotli compression

### Monitoring
- Health check endpoints
- Error rate monitoring
- Response time tracking
- Resource usage monitoring

## 🤝 Contributing

### Development Setup
1. Fork the repository
2. Create feature branch
3. Install dependencies: `npm install`
4. Run tests: `npm test`
5. Submit pull request

### Code Standards
- TypeScript for all source code
- ESLint + Prettier for formatting
- Comprehensive test coverage
- Clear commit messages

## 📄 License

MIT License - see [LICENSE](LICENSE) for details

## 🎯 Vision

HANSEI aims to be your second brain - capturing fleeting thoughts, connecting disparate ideas, and surfacing insights through an evolving knowledge graph that grows with you.

## 📞 Support

- **Documentation**: This README
- **Raindrop Support**: [https://docs.liquidmetal.ai](https://docs.liquidmetal.ai)
- **Issues**: Create GitHub issue
- **Community**: Join our discussions

---

**Built with ❤️ using Raindrop Framework**