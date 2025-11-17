# HANSEI - AI-Powered Memory & Knowledge Graph

⏺ **Voice notes → Whisper transcription → AI entity extraction → SmartMemory storage → 3D knowledge graph visualization**

## Overview

HANSEI transforms how you capture and visualize information through natural language. Speak your thoughts, and watch them become an interactive 3D knowledge graph that reveals connections, patterns, and insights.

## Features

- 🎙️ **Voice Input** - Record thoughts via microphone, transcribed with Whisper
- 🧠 **Entity Extraction** - AI extracts entities (goals, habits, projects) and relationships
- 💾 **Smart Memory** - Persistent graph-based storage with semantic search
- 🌌 **3D Visualization** - Interactive hierarchical force-graph in 3D space
- 🔍 **Semantic Search** - Natural language queries across your memory
- 📊 **Relationship Mapping** - Automatic detection of causes, dependencies, impacts

## Architecture

Built on Raindrop framework with:
- **SmartMemory** - Graph storage with entity resolution
- **AI Models** - Whisper (transcription) + LLaMA 3.3 70B (extraction)
- **Service Layer** - Public API for voice/text ingestion and graph queries
- **MCP Integration** - Model Context Protocol for Claude Code integration

## Quick Start

### Backend (Raindrop)

```bash
cd hansei-memory-core
npm install
raindrop build deploy --start
```

### Frontend

```bash
cd frontend
python3 -m http.server 8081
```

Open http://localhost:8081 for 2D graph or http://localhost:8081/index-3d.html for 3D visualization.

## API Endpoints

**Base URL:** `https://svc-01ka9tm46dtzqcvz88z5v3c9kc.01ka41m1warcc7s5zveqw1tt3z.lmapp.run`

### POST `/infer`
Extract entities from text
```json
{
  "content": "I want to start running every morning",
  "user_id": "your_user_id"
}
```

### POST `/api/voice/ingest`
Process voice recording
```bash
curl -X POST {BASE_URL}/api/voice/ingest \
  -F "audio=@recording.wav" \
  -F "user_id=your_id"
```

### GET `/api/graph`
Query knowledge graph
```
GET /api/graph?query=health&limit=50&user_id=your_id
```

## Project Structure

```
hansei-memory-core/
├── raindrop.manifest          # App configuration
├── src/
│   ├── hansei-intelligence-processor/
│   │   └── index.ts          # Voice/text processing + graph API
│   └── hansei-intel-mcp/
│       └── index.ts          # MCP tool for Claude integration
└── frontend/
    ├── index.html            # 2D graph visualization
    └── index-3d.html         # 3D hierarchical graph
```

## Tech Stack

- **Backend:** Raindrop Framework, Hono.js, TypeScript
- **AI:** Whisper-tiny, LLaMA 3.3 70B
- **Storage:** SmartMemory (graph-based semantic memory)
- **Frontend:** Vis.js (2D), 3D-Force-Graph (3D)

## Development

```bash
# Build
raindrop build generate

# Deploy
raindrop build deploy --start

# Check status
raindrop build status

# View logs
raindrop logs tail -f
```

## License

MIT

## Vision

HANSEI aims to be your second brain - capturing fleeting thoughts, connecting disparate ideas, and surfacing insights through an evolving knowledge graph that grows with you.
