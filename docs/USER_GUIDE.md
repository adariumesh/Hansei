# HANSEI - User Guide

**Version:** 1.0.0
**Last Updated:** November 17, 2025

---

## Welcome to HANSEI

HANSEI is your AI-powered second brain - a system that transforms your voice notes and text into an interactive knowledge graph. Speak your thoughts, and watch them become meaningful connections in 3D space.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Recording Voice Notes](#recording-voice-notes)
3. [Adding Text Notes](#adding-text-notes)
4. [Exploring Your Knowledge Graph](#exploring-your-knowledge-graph)
5. [Understanding the Visualization](#understanding-the-visualization)
6. [Tips & Best Practices](#tips--best-practices)
7. [FAQ](#faq)

---

## Getting Started

### Accessing HANSEI

1. **Open your web browser**
2. **Navigate to:** `http://155.138.196.189/`
3. **You'll see:**
   - Purple gradient background
   - Large "⏺ HANSEI" title
   - Microphone button (🎙️)
   - Graph visualization area
   - Text input box

### First Time Setup

**Enable Microphone (for voice notes):**

1. Click the microphone button
2. Browser will ask for permission
3. Click "Allow" to enable voice recording

That's it! You're ready to start capturing your thoughts.

---

## Recording Voice Notes

### How to Record

1. **Click the red microphone button** 🎙️
2. **The button turns red** - recording has started
3. **Speak clearly** - say what's on your mind
4. **Click again to stop** - recording stops

### What Happens Next

After you stop recording:

1. **Transcription:** Your voice is converted to text (takes 1-2 seconds)
2. **AI Analysis:** Entities and relationships are extracted (takes 2-4 seconds)
3. **Graph Update:** New nodes and connections appear in the visualization
4. **Results Display:** You'll see:
   - Your transcript
   - Extracted entities (goals, habits, projects, etc.)
   - Relationships between concepts

### Example Voice Note

**What to say:**
> "I want to start running every morning to improve my cardiovascular health and lose weight"

**What HANSEI extracts:**
- **Habit:** "running every morning"
- **Goal:** "improve cardiovascular health"
- **Goal:** "lose weight"
- **Relationships:**
  - running → CAUSES → improve health
  - running → CAUSES → lose weight

### Tips for Better Results

✅ **DO:**
- Speak clearly and at normal pace
- Mention specific goals, habits, or projects
- Describe relationships ("to improve...", "because...", "in order to...")
- Use complete sentences

❌ **DON'T:**
- Speak too fast or mumble
- Record in noisy environments
- Use overly complex jargon
- Make recordings longer than 30 seconds (for best results)

---

## Adding Text Notes

### How to Add Text

1. **Find the text input box** (below the microphone)
2. **Type your thought** - any length, any topic
3. **Click "💾 Save"**
4. **Wait for processing** (2-4 seconds)
5. **See results** in the graph

### Example Text Note

**What to type:**
```
I need to finish the project proposal by Friday.
This depends on getting feedback from the team.
```

**What HANSEI extracts:**
- **Project:** "project proposal"
- **Person:** "team"
- **Relationship:** proposal → DEPENDS_ON → team feedback

---

## Exploring Your Knowledge Graph

### 2D Graph View (Default)

**Features:**
- **Nodes:** Circles representing entities (goals, habits, projects)
- **Edges:** Lines showing relationships
- **Colors:** Different colors for different entity types
- **Interactive:** Click and drag nodes to arrange them

**How to Use:**
- **Zoom:** Mouse wheel or pinch gesture
- **Pan:** Click and drag background
- **Select Node:** Click on any circle
- **Move Node:** Drag circles around

### 3D Graph View

**Access:** `http://155.138.196.189/index-3d.html`

**Features:**
- **3D Space:** Nodes float in 3D space
- **Force Physics:** Nodes naturally organize
- **Rotation:** Drag to rotate the entire graph
- **Zoom:** Scroll to zoom in/out

**How to Navigate:**
- **Rotate:** Click and drag
- **Zoom:** Mouse wheel
- **Pan:** Right-click and drag
- **Reset View:** Refresh page

### Graph Statistics

At the bottom of the graph, you'll see:
- **Total Nodes:** Number of entities in your knowledge base
- **Total Edges:** Number of relationships
- **Last Updated:** Timestamp of latest update

---

## Understanding the Visualization

### Node Types (Colors)

| Color | Type | Example |
|-------|------|---------|
| 🔵 Blue | **Goal** | "improve health", "learn guitar" |
| 🟢 Green | **Habit** | "morning meditation", "daily reading" |
| 🟠 Orange | **Project** | "website redesign", "book writing" |
| 🔴 Red | **Person** | "team", "mentor", "client" |
| 🟡 Yellow | **Emotion** | "happiness", "stress", "motivation" |
| 🟣 Purple | **Object** | "laptop", "notebook", "course" |

### Relationship Types (Edge Labels)

| Type | Meaning | Example |
|------|---------|---------|
| **CAUSES** | A leads to B | exercise → health |
| **DEPENDS_ON** | A needs B | project → team feedback |
| **PART_OF** | A is component of B | chapter → book |
| **IMPACTS** | A affects B | stress → productivity |
| **RELATED_TO** | A is connected to B | coding → software |

### Node Size

- **Larger nodes** = More connections (more important in your knowledge graph)
- **Smaller nodes** = Fewer connections

---

## Tips & Best Practices

### For Better Entity Extraction

1. **Be Specific:**
   - ✅ "I want to run 5km three times per week"
   - ❌ "I want to exercise more"

2. **Mention Relationships:**
   - ✅ "Learning Python will help me build web apps"
   - ❌ "I'm learning Python"

3. **Include Context:**
   - ✅ "Daily meditation reduces my work stress"
   - ❌ "Meditation"

### Organizing Your Knowledge

1. **Regular Input:**
   - Add notes daily for best results
   - Short, frequent notes > long, rare notes

2. **Review Regularly:**
   - Check your graph weekly
   - Look for unexpected connections
   - Identify patterns

3. **Clean Up:**
   - If graph gets too crowded, you can:
     - Use search to filter (coming soon)
     - Export specific topics (coming soon)
     - Start fresh with new user_id

### Privacy & Data

- **User IDs:** Each browser gets a unique ID
- **Data Storage:** Securely stored in SmartMemory
- **Privacy:** Your data is not shared
- **Deletion:** Contact admin to delete all your data

---

## FAQ

### General

**Q: Do I need to create an account?**
A: No! HANSEI works immediately without sign-up. Your browser gets a unique ID automatically.

**Q: Can I use HANSEI on my phone?**
A: Yes! The interface works on mobile browsers. Voice recording requires microphone permission.

**Q: Is my data private?**
A: Yes. Your notes are stored securely and not shared with anyone.

**Q: Can I export my data?**
A: Currently no, but this feature is planned for future release.

### Voice Recording

**Q: Why isn't my microphone working?**
A:
1. Check browser permissions (Settings → Privacy → Microphone)
2. Ensure microphone is connected
3. Try a different browser (Chrome/Edge recommended)

**Q: What languages are supported?**
A: Currently English only. Other languages coming soon.

**Q: How long can my recording be?**
A: Technically unlimited, but 10-30 seconds gives best results.

**Q: Why is transcription slow?**
A: AI transcription takes 1-2 seconds. Longer recordings take more time.

### Knowledge Graph

**Q: Why don't I see my note in the graph?**
A:
1. Wait a few seconds for processing
2. Check for error messages
3. Try refreshing the page
4. Ensure your note had entities (goals, habits, etc.)

**Q: Can I delete nodes?**
A: Not currently. This feature is planned.

**Q: Can I edit node labels?**
A: Not currently. The AI determines node content.

**Q: How do I search the graph?**
A: Search functionality coming in next release.

### Technical

**Q: Which browsers are supported?**
A: Chrome, Firefox, Edge, Safari (latest versions)

**Q: Do I need internet connection?**
A: Yes, HANSEI requires internet to work.

**Q: Why is the site slow?**
A:
1. AI processing takes 2-4 seconds
2. Large graphs (>100 nodes) may render slowly
3. Try the 3D view for better performance with large graphs

**Q: Can I use HANSEI offline?**
A: Not currently. Offline mode is being considered.

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **Space** | Start/stop recording |
| **Enter** | Submit text note |
| **Esc** | Cancel recording |
| **F** | Focus on text input |
| **R** | Refresh graph |

---

## Getting Help

### Troubleshooting

**If something doesn't work:**

1. **Refresh the page** (F5)
2. **Check your internet connection**
3. **Try a different browser**
4. **Clear browser cache** (Ctrl+Shift+Delete)
5. **Check browser console** (F12) for error messages

### Support

- **Email:** support@your-domain.com
- **Documentation:** See technical docs
- **Report Bugs:** GitHub Issues

---

## What's Next?

### Planned Features

- 🔍 **Search:** Find specific nodes and topics
- 📥 **Export:** Download your graph as JSON/CSV
- 🎨 **Themes:** Customize colors and appearance
- 👥 **Sharing:** Share specific subgraphs
- 📱 **Mobile App:** Native iOS/Android apps
- 🌍 **Multi-language:** Support for more languages
- 🤖 **Smart Suggestions:** AI-powered insights
- 📊 **Analytics:** Track your thinking patterns

### Stay Updated

- Follow our blog for announcements
- Join our community
- Subscribe to newsletter

---

## Example Use Cases

### Personal Development

**Track goals and progress:**
1. Record daily reflections
2. Note achievements and challenges
3. See connections between habits and goals
4. Identify what works for you

### Project Management

**Organize project tasks:**
1. Add project milestones
2. Note dependencies
3. Track team involvement
4. Visualize project structure

### Learning & Research

**Build knowledge base:**
1. Add concepts as you learn
2. Note relationships between ideas
3. Identify knowledge gaps
4. Review connections

### Creative Brainstorming

**Explore ideas:**
1. Record random thoughts
2. Let AI find connections
3. Discover unexpected patterns
4. Develop ideas further

---

## Tips from Power Users

> "I record a 10-second thought every morning about my priorities. After a month, I can see patterns in what matters to me." - Sarah, Product Manager

> "The 3D view helps me see my project dependencies clearly. It's like a mind map that builds itself." - Mike, Developer

> "I use HANSEI to track my fitness journey. The connections between exercise, nutrition, and energy levels are eye-opening." - Jennifer, Athlete

---

## Glossary

**Entity:** A concept, person, goal, or object extracted from your notes
**Node:** Visual representation of an entity in the graph
**Edge:** Connection line between two nodes
**Relationship:** Type of connection (causes, depends on, etc.)
**Knowledge Graph:** Your entire network of entities and relationships
**Transcription:** Converting voice to text
**SmartMemory:** The AI system that stores your data

---

**Welcome to your second brain!** Start capturing your thoughts and watch your knowledge graph grow. 🧠✨
