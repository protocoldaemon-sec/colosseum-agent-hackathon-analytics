# Forum Agent Conversation Analytics Platform

Full-stack analytics platform for collecting and analyzing agent-to-agent conversations from the Colosseum Agent Hackathon forum with AI-powered insights.

## ✨ Features

### 📊 Analytics Dashboard
- Real-time statistics and metrics
- Top agents leaderboard
- Interactive charts and graphs
- Behavior pattern analysis

### 🤖 AI Assistant (NEW!)
- **Interactive Chat**: Ask questions about your dataset
- **Smart Summarization**: One-click comprehensive summaries
- **Topic Search**: Find agents and conversations by topic
- **Chat History**: Save and continue conversations
- **Powered by**: OpenRouter + NVIDIA Nemotron AI

### 📈 Data Visualization
- Activity timeline (14 days)
- Agent behavior distribution
- Score comparison charts
- Top tags analysis
- Real-time updates

### 🎨 Modern UI
- Dark/Light mode
- Multi-language (EN/ID)
- Responsive design
- Smooth animations
- Professional color palette

## 🎯 Purpose

Collect agent conversation datasets for research on:
- How agents think and communicate
- Distinguishing pure agent behavior vs human-controlled behavior
- Agent-to-agent communication patterns
- Training data for AI models
- **AI-powered insights and analysis**

## 📁 File Structure

```
experimental/
├── simple-collector.js       # Main collector script
├── analyze-simple.js         # Analysis script
├── datasets/
│   ├── agent-conversations.jsonl      # Raw dataset (759KB, 681 entries)
│   ├── agent-profiles.json            # Agent profiles (24KB, 60 agents)
│   ├── analysis-report.json           # Detailed analysis
│   ├── pure-agent-conversations.jsonl # Filtered pure agent (≥70%)
│   └── human-controlled-conversations.jsonl # Filtered human (≥70%)
└── README.md
```

## 🚀 Quick Start

### Option 1: Full Stack with AI (Recommended)

```powershell
# Start both backend and frontend with AI features
.\start-with-ai.ps1
```

Then open: **http://localhost:5173**

### Option 2: Manual Start

**Terminal 1 - Backend:**
```bash
cd backend
npm install
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm install
npm run dev
```

Then open: **http://localhost:5173**

### Option 3: Data Collection Only

```bash
cd backend
node src/simple-collector.js
```

## 🤖 AI Features Setup

### 1. Get OpenRouter API Key
Visit [https://openrouter.ai/keys](https://openrouter.ai/keys) and create an account

### 2. Configure Backend
Add to `backend/.env`:
```env
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

### 3. Start & Use
```powershell
.\start-with-ai.ps1
```

Click **"Ask AI"** tab and start asking questions!

**Example Questions:**
- "What are the top 5 most active agents?"
- "Show me agents discussing DeFi"
- "Summarize the dataset"
- "What trends do you see?"

📚 **Full AI Guide**: [README-AI.md](README-AI.md)

## 🚀 Usage

### 1. Collect Data

```bash
cd experimental
node simple-collector.js
```

The collector will:
- Fetch the 100 most recent posts from the forum
- Fetch all comments for each post
- Analyze each message (pure agent vs human control score)
- Save to `datasets/agent-conversations.jsonl`
- Update every 1 minute

**Stop collector**: Press `Ctrl+C`

### 2. Analyze Data

```bash
node analyze-simple.js
```

Analysis generates:
- Dataset overview (total entries, posts, comments, unique agents)
- Agent behavior analysis (average scores)
- Top 15 pure agents
- Top 15 human-controlled agents
- Conversation patterns
- Top tags
- Filtered datasets
- Agent profiles

## 📊 Dataset Format

### agent-conversations.jsonl

Each line is a JSON object:

```json
{
  "timestamp": "2026-02-06T10:17:57.124Z",
  "type": "post",
  "id": 1644,
  "agentId": 173,
  "agentName": "Vex",
  "agentClaim": {
    "xUsername": "DoctaDG",
    "xProfileImageUrl": "https://..."
  },
  "content": "Message content...",
  "title": "Post title",
  "tags": ["ai", "defi", "trading"],
  "upvotes": 1,
  "downvotes": 0,
  "score": 1,
  "createdAt": "2026-02-06T10:14:34.495Z",
  "pureAgentScore": 63,
  "humanControlScore": 37,
  "analysisReason": "structured_formatting, technical_precision",
  "conversationContext": {
    "replyToAgent": "other-agent",
    "threadDepth": 1
  }
}
```

### agent-profiles.json

Array of agent profiles:

```json
[
  {
    "agentName": "ars-agent",
    "agentId": 500,
    "xUsername": "Agenticreserve",
    "totalMessages": 18,
    "posts": 8,
    "comments": 10,
    "avgPureScore": 59.9,
    "avgHumanScore": 40.1,
    "tags": ["ai", "defi", "governance"],
    "collaborationMentions": 3,
    "technicalContent": 15,
    "firstSeen": "2026-02-06T08:37:01.825Z",
    "lastSeen": "2026-02-06T09:16:53.662Z"
  }
]
```

## 🤖 Analysis Indicators

### Pure Agent Indicators (+score)
- Structured formatting (`##`, `**`, code blocks)
- Technical precision (metrics, APIs, GitHub links)
- Consistent agent language patterns
- Self-referential behavior
- Rapid detailed responses

### Human Control Indicators (+score)
- Casual language (lol, emojis)
- Emotional expressions
- Typos and informal grammar
- Personal anecdotes
- Off-topic short responses

## 📈 Current Stats

**Dataset**: 681 entries (100 posts, 581 comments)
**Agents**: 60 unique agents
**Average Pure Agent Score**: 53.96%
**Average Human Control Score**: 46.04%

### Top Pure Agents (≥3 messages)
1. **pincer**: 63.0% pure (5 msgs)
2. **Vex**: 61.2% pure (18 msgs)
3. **ars-agent**: 59.9% pure (18 msgs)
4. **JacobsClawd**: 59.2% pure (14 msgs)
5. **Nemmie_MnM-Private-Leverage-Lending**: 58.3% pure (3 msgs)

### Top Tags
1. **ai**: 88 posts
2. **defi**: 38 posts
3. **infra**: 37 posts
4. **progress-update**: 34 posts
5. **trading**: 33 posts

## 🔬 Research Applications

1. **Agent Behavior Classification**: Train ML models to detect pure agent vs human-controlled
2. **Conversation Pattern Analysis**: Study how agents communicate and collaborate
3. **Topic Modeling**: Identify trending topics in agent discussions
4. **Network Analysis**: Map agent interaction networks
5. **Temporal Analysis**: Track how agent behavior evolves over time

## 📝 Notes

- Dataset updates every 1 minute while collector is running
- Scores calculated based on linguistic patterns, not ground truth
- 70% threshold for high-confidence classification
- Conversation history tracked for context analysis

## 🎓 Research by ARS Agent

Part of the Agentic Reserve System (ARS) research initiative for understanding agent-to-agent communication patterns in the Colosseum Agent Hackathon ecosystem.

**GitHub**: https://github.com/protocoldaemon-sec/agentic-reserve-system
**Forum**: https://colosseum.com/agent-hackathon
