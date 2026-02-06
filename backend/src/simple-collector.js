const fs = require('fs');
const path = require('path');
const axios = require('axios');

const API_BASE = 'https://agents.colosseum.com/api';
const OUTPUT_DIR = path.join(__dirname, 'datasets');
const DATASET_FILE = path.join(OUTPUT_DIR, 'agent-conversations.jsonl');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function fetchAllPosts(limit = 100) {
  try {
    const response = await axios.get(`${API_BASE}/forum/posts`, {
      params: { sort: 'new', limit }
    });
    return response.data.posts || [];
  } catch (error) {
    console.error('Error fetching posts:', error.message);
    return [];
  }
}

async function fetchPostComments(postId) {
  try {
    const response = await axios.get(`${API_BASE}/forum/posts/${postId}/comments`, {
      params: { sort: 'new', limit: 100 }
    });
    return response.data.comments || [];
  } catch (error) {
    console.error(`Error fetching comments for post ${postId}:`, error.message);
    return [];
  }
}

function analyzeAgentBehavior(content, agentName, type) {
  let pureAgentScore = 50;
  let humanControlScore = 50;
  const reasons = [];

  // Pure Agent Indicators
  if (content.includes('##') || content.includes('**') || content.includes('```')) {
    pureAgentScore += 10;
    reasons.push('structured_formatting');
  }

  const technicalPatterns = [
    /\d+\+?\s*(lines of code|LOC)/i,
    /\d+\.\d+%/,
    /\d+ms|seconds|minutes/,
    /API|SDK|REST|JSON/i,
    /GitHub|repo|repository/i
  ];
  const technicalMatches = technicalPatterns.filter(p => p.test(content)).length;
  if (technicalMatches >= 2) {
    pureAgentScore += 15;
    reasons.push('technical_precision');
  }

  const agentPatterns = [
    /we're building|we built|our system/i,
    /autonomous|algorithmic|real-time/i,
    /would love to|interested in collaborating/i
  ];
  if (agentPatterns.some(p => p.test(content))) {
    pureAgentScore += 10;
    reasons.push('agent_language_patterns');
  }

  // Human Control Indicators
  const casualPatterns = [/lol|haha|😂|🤣/i, /tbh|honestly|personally/i];
  if (casualPatterns.some(p => p.test(content))) {
    humanControlScore += 15;
    reasons.push('casual_language');
  }

  const emotionalPatterns = [/excited|thrilled|frustrated/i, /love this|hate when/i];
  if (emotionalPatterns.some(p => p.test(content))) {
    humanControlScore += 12;
    reasons.push('emotional_expression');
  }

  // Normalize scores
  const total = pureAgentScore + humanControlScore;
  pureAgentScore = Math.round((pureAgentScore / total) * 100);
  humanControlScore = 100 - pureAgentScore;

  return { pureAgentScore, humanControlScore, analysisReason: reasons.join(', ') || 'neutral' };
}

async function collectForumData() {
  console.log(`[${new Date().toISOString()}] Starting collection...`);
  
  const posts = await fetchAllPosts();
  console.log(`Fetched ${posts.length} posts`);
  
  const allEntries = [];
  const knownEntries = new Set();
  
  // Load existing entries
  if (fs.existsSync(DATASET_FILE)) {
    const lines = fs.readFileSync(DATASET_FILE, 'utf-8').split('\n').filter(Boolean);
    lines.forEach(line => {
      try {
        const entry = JSON.parse(line);
        knownEntries.add(`${entry.type}-${entry.id}`);
      } catch (e) {}
    });
    console.log(`Loaded ${knownEntries.size} existing entries`);
  }
  
  // Process posts
  for (const post of posts) {
    const postKey = `post-${post.id}`;
    if (!knownEntries.has(postKey)) {
      const entry = {
        timestamp: new Date().toISOString(),
        type: 'post',
        id: post.id,
        agentId: post.agentId,
        agentName: post.agentName,
        agentClaim: post.agentClaim,
        content: post.body,
        title: post.title,
        tags: post.tags,
        upvotes: post.upvotes,
        downvotes: post.downvotes,
        score: post.score,
        createdAt: post.createdAt,
        ...analyzeAgentBehavior(post.body, post.agentName, 'post')
      };
      allEntries.push(entry);
      knownEntries.add(postKey);
    }
    
    // Fetch comments
    const comments = await fetchPostComments(post.id);
    for (const comment of comments) {
      const commentKey = `comment-${comment.id}`;
      if (!knownEntries.has(commentKey)) {
        const entry = {
          timestamp: new Date().toISOString(),
          type: 'comment',
          id: comment.id,
          postId: post.id,
          agentId: comment.agentId,
          agentName: comment.agentName,
          agentClaim: comment.agentClaim,
          content: comment.body,
          upvotes: comment.upvotes,
          downvotes: comment.downvotes,
          score: comment.score,
          createdAt: comment.createdAt,
          conversationContext: {
            replyToAgent: post.agentName,
            threadDepth: 1
          },
          ...analyzeAgentBehavior(comment.body, comment.agentName, 'comment')
        };
        allEntries.push(entry);
        knownEntries.add(commentKey);
      }
    }
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Save new entries
  if (allEntries.length > 0) {
    const jsonlData = allEntries.map(e => JSON.stringify(e)).join('\n') + '\n';
    fs.appendFileSync(DATASET_FILE, jsonlData);
    console.log(`✅ Added ${allEntries.length} new entries`);
  } else {
    console.log('No new entries found');
  }
  
  return allEntries.length;
}

async function getStats() {
  if (!fs.existsSync(DATASET_FILE)) {
    return { totalEntries: 0, posts: 0, comments: 0, agents: new Set() };
  }
  
  const lines = fs.readFileSync(DATASET_FILE, 'utf-8').split('\n').filter(Boolean);
  let posts = 0, comments = 0;
  const agents = new Set();
  
  lines.forEach(line => {
    try {
      const entry = JSON.parse(line);
      if (entry.type === 'post') posts++;
      if (entry.type === 'comment') comments++;
      agents.add(entry.agentName);
    } catch (e) {}
  });
  
  return { totalEntries: lines.length, posts, comments, agents };
}

async function main() {
  console.log('🤖 Forum Agent Conversation Dataset Collector');
  console.log('===========================================\n');
  
  // Initial collection
  await collectForumData();
  
  // Show stats
  const stats = await getStats();
  console.log('\n📊 Dataset Stats:');
  console.log(`Total entries: ${stats.totalEntries}`);
  console.log(`Posts: ${stats.posts}`);
  console.log(`Comments: ${stats.comments}`);
  console.log(`Unique agents: ${stats.agents.size}`);
  
  if (stats.agents.size > 0) {
    console.log('\n🤖 Sample agents:');
    Array.from(stats.agents).slice(0, 10).forEach(agent => console.log(`  - ${agent}`));
  }
  
  console.log('\n✅ Collection complete!');
  console.log(`📁 Dataset: ${DATASET_FILE}`);
  
  // Start continuous collection
  console.log('\n⏰ Starting continuous collection (every 1 minute)...');
  console.log('Press Ctrl+C to stop\n');
  
  setInterval(async () => {
    await collectForumData();
    const newStats = await getStats();
    console.log(`📊 Total: ${newStats.totalEntries} entries | Agents: ${newStats.agents.size}`);
  }, 60 * 1000);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { collectForumData, getStats };