# HANSEI - API Documentation

**Version:** 1.0.0
**Base URL:** `https://svc-01ka9za29rb1k3xhtqxxe8qn20.01ka4j4ktmq3vmg0nfmg652rkw.lmapp.run`
**Last Updated:** November 17, 2025

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Endpoints](#endpoints)
4. [Data Models](#data-models)
5. [Error Handling](#error-handling)
6. [Rate Limiting](#rate-limiting)
7. [Examples](#examples)

---

## Overview

The HANSEI API provides endpoints for:
- Voice transcription and entity extraction
- Text-based entity extraction
- Knowledge graph querying
- Health monitoring

### API Characteristics

- **Protocol:** HTTPS (REST)
- **Format:** JSON
- **Authentication:** None (public endpoints)
- **CORS:** Enabled for all origins
- **Rate Limiting:** 10 requests/second per IP

### Base URL

```
https://svc-01ka9za29rb1k3xhtqxxe8qn20.01ka4j4ktmq3vmg0nfmg652rkw.lmapp.run
```

---

## Authentication

Currently, the API does not require authentication. Future versions will implement JWT-based authentication.

### Headers

Required headers for all requests:

```http
Content-Type: application/json
Accept: application/json
```

For file uploads:

```http
Content-Type: multipart/form-data
```

---

## Endpoints

### Health Check

Check API health and availability.

**Endpoint:** `GET /health`

**Request:**
```http
GET /health HTTP/1.1
Host: svc-01ka9za29rb1k3xhtqxxe8qn20.01ka4j4ktmq3vmg0nfmg652rkw.lmapp.run
```

**Response:** `200 OK`
```json
{
  "status": "ok",
  "timestamp": "2025-11-17T23:00:00.000Z"
}
```

**cURL Example:**
```bash
curl -X GET https://svc-01ka9za29rb1k3xhtqxxe8qn20.01ka4j4ktmq3vmg0nfmg652rkw.lmapp.run/health
```

---

### Text Entity Extraction

Extract entities and relationships from text input.

**Endpoint:** `POST /infer`

**Request:**
```http
POST /infer HTTP/1.1
Host: svc-01ka9za29rb1k3xhtqxxe8qn20.01ka4j4ktmq3vmg0nfmg652rkw.lmapp.run
Content-Type: application/json

{
  "content": "I want to start running every morning to improve my health",
  "user_id": "user_12345"
}
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `content` | string | Yes | Text to analyze (max 10,000 chars) |
| `user_id` | string | No | User identifier for tracking |

**Response:** `200 OK`
```json
{
  "success": true,
  "objectId": "obj_abc123xyz",
  "extracted": {
    "entities": [
      {
        "type": "habit",
        "content": "running every morning",
        "weight": 0.9
      },
      {
        "type": "goal",
        "content": "improve health",
        "weight": 0.85
      }
    ],
    "relationships": [
      {
        "source": "running every morning",
        "target": "improve health",
        "type": "CAUSES"
      }
    ],
    "metadata": {
      "emotional_intensity": 7,
      "priority": "high"
    }
  }
}
```

**Error Responses:**

`400 Bad Request` - Missing required fields
```json
{
  "error": "Missing content/transcript"
}
```

`422 Unprocessable Entity` - Invalid JSON structure
```json
{
  "error": "Invalid JSON structure from model",
  "parsed": {...}
}
```

`500 Internal Server Error` - Processing failed
```json
{
  "error": "Inference failed",
  "message": "Error details..."
}
```

**cURL Example:**
```bash
curl -X POST https://svc-01ka9za29rb1k3xhtqxxe8qn20.01ka4j4ktmq3vmg0nfmg652rkw.lmapp.run/infer \
  -H "Content-Type: application/json" \
  -d '{
    "content": "I want to start running every morning",
    "user_id": "user_123"
  }'
```

**JavaScript Example:**
```javascript
const response = await fetch('https://svc-01ka9za29rb1k3xhtqxxe8qn20.01ka4j4ktmq3vmg0nfmg652rkw.lmapp.run/infer', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    content: 'I want to start running every morning',
    user_id: 'user_123'
  })
});

const data = await response.json();
console.log(data.extracted);
```

---

### Voice Ingestion

Process audio files, transcribe, and extract entities.

**Endpoint:** `POST /api/voice/ingest`

**Request:**
```http
POST /api/voice/ingest HTTP/1.1
Host: svc-01ka9za29rb1k3xhtqxxe8qn20.01ka4j4ktmq3vmg0nfmg652rkw.lmapp.run
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary

------WebKitFormBoundary
Content-Disposition: form-data; name="audio"; filename="recording.wav"
Content-Type: audio/wav

[Binary audio data]
------WebKitFormBoundary
Content-Disposition: form-data; name="user_id"

user_12345
------WebKitFormBoundary
Content-Disposition: form-data; name="audio_format"

wav
------WebKitFormBoundary--
```

**Form Data:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `audio` | file | Yes | Audio file (WAV, MP3, OGG) |
| `user_id` | string | No | User identifier |
| `audio_format` | string | No | Audio format (default: wav) |

**Supported Formats:**
- WAV (recommended)
- MP3
- OGG
- WEBM

**File Size Limit:** 10MB

**Response:** `200 OK`
```json
{
  "success": true,
  "objectId": "obj_def456uvw",
  "transcript": "I want to start running every morning",
  "extracted": {
    "entities": [
      {
        "type": "habit",
        "content": "running every morning",
        "weight": 0.9
      }
    ],
    "relationships": [
      {
        "source": "running every morning",
        "target": "improve health",
        "type": "CAUSES"
      }
    ],
    "metadata": {
      "emotional_intensity": 7,
      "priority": "high"
    }
  }
}
```

**Error Responses:**

`400 Bad Request` - Missing audio file
```json
{
  "error": "Missing audio file"
}
```

`500 Internal Server Error` - Transcription failed
```json
{
  "error": "Whisper transcription failed",
  "details": "Error message...",
  "audioSize": 524288,
  "audioFormat": "wav"
}
```

`502 Bad Gateway` - Empty transcription
```json
{
  "error": "Transcription returned empty",
  "result": {...},
  "audioSize": 524288
}
```

**cURL Example:**
```bash
curl -X POST https://svc-01ka9za29rb1k3xhtqxxe8qn20.01ka4j4ktmq3vmg0nfmg652rkw.lmapp.run/api/voice/ingest \
  -F "audio=@recording.wav" \
  -F "user_id=user_123" \
  -F "audio_format=wav"
```

**JavaScript Example:**
```javascript
const formData = new FormData();
formData.append('audio', audioBlob, 'recording.wav');
formData.append('user_id', 'user_123');
formData.append('audio_format', 'wav');

const response = await fetch('https://svc-01ka9za29rb1k3xhtqxxe8qn20.01ka4j4ktmq3vmg0nfmg652rkw.lmapp.run/api/voice/ingest', {
  method: 'POST',
  body: formData
});

const data = await response.json();
console.log('Transcript:', data.transcript);
console.log('Entities:', data.extracted.entities);
```

---

### Knowledge Graph Query

Retrieve entities and relationships from the knowledge graph.

**Endpoint:** `GET /api/graph`

**Request:**
```http
GET /api/graph?query=health&limit=50&user_id=user_123 HTTP/1.1
Host: svc-01ka9za29rb1k3xhtqxxe8qn20.01ka4j4ktmq3vmg0nfmg652rkw.lmapp.run
```

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | No | "all memories" | Search query |
| `limit` | integer | No | 50 | Max results (1-200) |
| `user_id` | string | No | null | Filter by user |

**Response:** `200 OK`
```json
{
  "success": true,
  "graph": {
    "nodes": [
      {
        "id": "running every morning",
        "type": "habit",
        "weight": 0.9,
        "label": "running every morning",
        "metadata": {
          "chunkSignature": "chunk_abc123",
          "score": 0.95
        }
      },
      {
        "id": "improve health",
        "type": "goal",
        "weight": 0.85,
        "label": "improve health",
        "metadata": {
          "chunkSignature": "chunk_abc123",
          "score": 0.95
        }
      }
    ],
    "edges": [
      {
        "source": "running every morning",
        "target": "improve health",
        "type": "CAUSES",
        "metadata": {
          "chunkSignature": "chunk_abc123"
        }
      }
    ],
    "metadata": {
      "totalNodes": 2,
      "totalEdges": 1,
      "query": "health",
      "userId": "user_123",
      "timestamp": "2025-11-17T23:00:00.000Z"
    }
  },
  "rawResults": [
    {
      "chunkSignature": "chunk_abc123",
      "score": 0.95,
      "text": "{\"type\":\"hansei_voice_extraction\",\"user_id\":\"user_123\",...}"
    }
  ]
}
```

**Error Responses:**

`500 Internal Server Error` - Query failed
```json
{
  "error": "Graph query failed",
  "message": "Error details..."
}
```

**cURL Example:**
```bash
curl -X GET "https://svc-01ka9za29rb1k3xhtqxxe8qn20.01ka4j4ktmq3vmg0nfmg652rkw.lmapp.run/api/graph?query=health&limit=50&user_id=user_123"
```

**JavaScript Example:**
```javascript
const params = new URLSearchParams({
  query: 'health',
  limit: '50',
  user_id: 'user_123'
});

const response = await fetch(`https://svc-01ka9za29rb1k3xhtqxxe8qn20.01ka4j4ktmq3vmg0nfmg652rkw.lmapp.run/api/graph?${params}`);
const data = await response.json();

console.log('Nodes:', data.graph.nodes);
console.log('Edges:', data.graph.edges);
```

---

## Data Models

### Entity

Represents a concept, object, or idea extracted from text.

```typescript
interface Entity {
  type: EntityType;
  content: string;
  weight: number;  // 0.0 - 1.0
}

type EntityType =
  | "person"
  | "goal"
  | "habit"
  | "project"
  | "emotion"
  | "object";
```

**Example:**
```json
{
  "type": "habit",
  "content": "morning meditation",
  "weight": 0.87
}
```

### Relationship

Represents a connection between two entities.

```typescript
interface Relationship {
  source: string;     // Entity content
  target: string;     // Entity content
  type: RelationType;
}

type RelationType =
  | "CAUSES"
  | "DEPENDS_ON"
  | "PART_OF"
  | "IMPACTS"
  | "RELATED_TO";
```

**Example:**
```json
{
  "source": "morning meditation",
  "target": "reduce stress",
  "type": "CAUSES"
}
```

### Metadata

Additional information about extracted content.

```typescript
interface Metadata {
  emotional_intensity: number;  // 1-10
  priority: Priority;
}

type Priority = "high" | "medium" | "low";
```

**Example:**
```json
{
  "emotional_intensity": 8,
  "priority": "high"
}
```

### Graph Node

A node in the knowledge graph visualization.

```typescript
interface GraphNode {
  id: string;
  type: EntityType;
  weight: number;
  label: string;
  metadata: {
    chunkSignature: string;
    score: number;
  };
}
```

### Graph Edge

An edge connecting two nodes in the knowledge graph.

```typescript
interface GraphEdge {
  source: string;
  target: string;
  type: RelationType;
  metadata: {
    chunkSignature: string;
  };
}
```

---

## Error Handling

### Error Response Format

All errors follow this structure:

```json
{
  "error": "Error message",
  "message": "Detailed error description",
  "details": {...}  // Optional additional context
}
```

### HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request successful |
| 400 | Bad Request | Invalid request parameters |
| 422 | Unprocessable Entity | Invalid data format |
| 500 | Internal Server Error | Server-side error |
| 502 | Bad Gateway | External service error |
| 503 | Service Unavailable | Service temporarily down |

### Common Errors

**Missing Required Field:**
```json
{
  "error": "Missing content/transcript"
}
```

**Invalid JSON:**
```json
{
  "error": "Invalid JSON structure from model",
  "parsed": {...}
}
```

**Transcription Failed:**
```json
{
  "error": "Whisper transcription failed",
  "details": "Model timeout",
  "audioSize": 524288,
  "audioFormat": "wav"
}
```

**Storage Failed:**
```json
{
  "error": "Failed to store semantic memory",
  "details": "Database connection error",
  "extracted": {...}
}
```

---

## Rate Limiting

### Current Limits

- **Rate:** 10 requests/second per IP
- **Burst:** 20 requests
- **Window:** 1 second

### Rate Limit Headers

Responses include rate limit information:

```http
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1700172000
```

### Rate Limit Exceeded

**Response:** `429 Too Many Requests`
```json
{
  "error": "Rate limit exceeded",
  "retry_after": 1
}
```

---

## Examples

### Complete Workflow Example

**1. Submit Text for Analysis:**
```javascript
// Submit text
const extractResponse = await fetch(API_BASE + '/infer', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    content: 'I want to start meditating daily to reduce stress',
    user_id: 'user_123'
  })
});

const extractData = await extractResponse.json();
console.log('Entities:', extractData.extracted.entities);
// [{ type: "habit", content: "meditating daily", weight: 0.9 }, ...]
```

**2. Query Knowledge Graph:**
```javascript
// Query graph
const graphResponse = await fetch(
  API_BASE + '/api/graph?query=meditation&limit=20&user_id=user_123'
);

const graphData = await graphResponse.json();
console.log('Nodes:', graphData.graph.nodes);
console.log('Edges:', graphData.graph.edges);

// Visualize in frontend
updateGraph(graphData.graph.nodes, graphData.graph.edges);
```

### Voice Recording Workflow

```javascript
// 1. Start recording
const mediaRecorder = new MediaRecorder(stream);
const audioChunks = [];

mediaRecorder.ondataavailable = (event) => {
  audioChunks.push(event.data);
};

mediaRecorder.start();

// 2. Stop recording
mediaRecorder.stop();

mediaRecorder.onstop = async () => {
  // 3. Create audio blob
  const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });

  // 4. Upload to API
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.wav');
  formData.append('user_id', USER_ID);

  const response = await fetch(API_BASE + '/api/voice/ingest', {
    method: 'POST',
    body: formData
  });

  const data = await response.json();

  // 5. Display results
  console.log('Transcript:', data.transcript);
  console.log('Entities:', data.extracted.entities);

  // 6. Update graph
  await loadGraph();
};
```

### Error Handling Example

```javascript
async function submitText(content, userId) {
  try {
    const response = await fetch(API_BASE + '/infer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, user_id: userId })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Request failed');
    }

    const data = await response.json();
    return data;

  } catch (error) {
    if (error.message.includes('network')) {
      console.error('Network error - check connection');
    } else if (error.message.includes('Rate limit')) {
      console.error('Too many requests - wait and retry');
    } else {
      console.error('Error:', error.message);
    }
    throw error;
  }
}
```

### Batch Processing Example

```javascript
async function processBatch(texts, userId) {
  const results = [];

  for (const text of texts) {
    try {
      const response = await fetch(API_BASE + '/infer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: text,
          user_id: userId
        })
      });

      const data = await response.json();
      results.push(data);

      // Rate limiting: wait 100ms between requests
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error(`Failed to process: ${text}`, error);
      results.push({ error: error.message });
    }
  }

  return results;
}
```

---

## SDKs and Libraries

### JavaScript/TypeScript SDK

```typescript
// hansei-client.ts
class HanseiClient {
  constructor(private baseUrl: string) {}

  async extractEntities(content: string, userId?: string) {
    const response = await fetch(`${this.baseUrl}/infer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, user_id: userId })
    });
    return response.json();
  }

  async processVoice(audioBlob: Blob, userId?: string) {
    const formData = new FormData();
    formData.append('audio', audioBlob);
    if (userId) formData.append('user_id', userId);

    const response = await fetch(`${this.baseUrl}/api/voice/ingest`, {
      method: 'POST',
      body: formData
    });
    return response.json();
  }

  async queryGraph(query: string, limit = 50, userId?: string) {
    const params = new URLSearchParams({ query, limit: String(limit) });
    if (userId) params.append('user_id', userId);

    const response = await fetch(`${this.baseUrl}/api/graph?${params}`);
    return response.json();
  }
}

// Usage
const client = new HanseiClient('https://your-backend-url.lmapp.run');
const result = await client.extractEntities('I want to learn guitar');
```

---

## Webhooks (Future Feature)

Planned webhook support for real-time notifications:

```json
{
  "event": "entity.created",
  "timestamp": "2025-11-17T23:00:00.000Z",
  "data": {
    "entity": {...},
    "user_id": "user_123"
  }
}
```

---

## Changelog

### Version 1.0.0 (2025-11-17)

- Initial API release
- `/health` endpoint
- `/infer` endpoint for text extraction
- `/api/voice/ingest` endpoint for voice processing
- `/api/graph` endpoint for graph queries

---

## Support

- **Documentation:** https://github.com/your-repo/docs
- **Issues:** https://github.com/your-repo/issues
- **Email:** support@your-domain.com

---

**API Version:** 1.0.0
**Last Updated:** November 17, 2025
