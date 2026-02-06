const fs = require('fs');
const path = require('path');

const DATASET_FILE = path.join(__dirname, 'datasets', 'agent-conversations.jsonl');
const OUTPUT_DIR = path.join(__dirname, 'datasets');

function loadDataset() {
  if (!fs.existsSync(DATASET_FILE)) {
    console.error('Dataset file not found. Run collector first.');
    return [];
  }

  const lines = fs.readFileSync(DATASET_FILE, 'utf-8').split('\n').filter(Boolean);
  const entries = [];

  lines.forEach((line, index) => {
    try {
      entries.push(JSON.parse(line));
    } catch (error) {
      console.warn(`Failed to parse line ${index + 1}`);
    }
  });

  return entries;
}

function analyzeDataset(entries) {
  const posts = entries.filter(e => e.type === 'post');
  const comments = entries.filter(e => e.type === 'comment');
  const uniqueAgents = new Set(entries.map(e => e.agentName));

  // Calculate averages
  const avgPureScore = entries.reduce((sum, e) => sum + e.pureAgentScore, 0) / entries.length;
  const avgHumanScore = entries.reduce((sum, e) => sum + e.humanControlScore, 0) / entries.length;

  // Threshold analysis (>70 for pure agent, >70 for human control)
  const pureAgentEntries = entries.filter(e => e.pureAgentScore >= 70);
  const humanControlEntries = entries.filter(e => e.humanControlScore >= 70);

  // Agent-level analysis
  const agentStats = new Map();
  
  entries.forEach(entry => {
    if (!agentStats.has(entry.agentName)) {
      agentStats.set(entry.agentName, { 
        pureScores: [], 
        humanScores: [], 
        count: 0,
        posts: 0,
        comments: 0
      });
    }
    const stats = agentStats.get(entry.agentName);
    stats.pureScores.push(entry.pureAgentScore);
    stats.humanScores.push(entry.humanControlScore);
    stats.count++;
    if (entry.type === 'post') stats.posts++;
    if (entry.type === 'comment') stats.comments++;
  });

  // Top pure agents
  const topPureAgents = Array.from(agentStats.entries())
    .map(([agent, stats]) => ({
      agent,
      avgPureScore: stats.pureScores.reduce((a, b) => a + b, 0) / stats.pureScores.length,
      avgHumanScore: stats.humanScores.reduce((a, b) => a + b, 0) / stats.humanScores.length,
      count: stats.count,
      posts: stats.posts,
      comments: stats.comments
    }))
    .filter(a => a.count >= 3) // At least 3 messages
    .sort((a, b) => b.avgPureScore - a.avgPureScore);

  // Top human controlled
  const topHumanControlled = Array.from(agentStats.entries())
    .map(([agent, stats]) => ({
      agent,
      avgPureScore: stats.pureScores.reduce((a, b) => a + b, 0) / stats.pureScores.length,
      avgHumanScore: stats.humanScores.reduce((a, b) => a + b, 0) / stats.humanScores.length,
      count: stats.count,
      posts: stats.posts,
      comments: stats.comments
    }))
    .filter(a => a.count >= 3)
    .sort((a, b) => b.avgHumanScore - a.avgHumanScore);

  // Conversation patterns
  const avgContentLength = entries.reduce((sum, e) => sum + e.content.length, 0) / entries.length;
  const technicalDiscussions = entries.filter(e => 
    e.content.includes('API') || e.content.includes('GitHub') || 
    e.content.includes('code') || e.content.includes('technical')
  ).length;
  const collaborationRequests = entries.filter(e =>
    e.content.toLowerCase().includes('collaborate') ||
    e.content.toLowerCase().includes('work together') ||
    e.content.toLowerCase().includes('partnership')
  ).length;

  // Tag analysis
  const tagCounts = {};
  posts.forEach(post => {
    if (post.tags) {
      post.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    }
  });
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return {
    totalEntries: entries.length,
    posts: posts.length,
    comments: comments.length,
    uniqueAgents: uniqueAgents.size,
    averagePureAgentScore: Math.round(avgPureScore * 100) / 100,
    averageHumanControlScore: Math.round(avgHumanScore * 100) / 100,
    pureAgentThreshold: {
      count: pureAgentEntries.length,
      percentage: Math.round((pureAgentEntries.length / entries.length) * 10000) / 100
    },
    humanControlThreshold: {
      count: humanControlEntries.length,
      percentage: Math.round((humanControlEntries.length / entries.length) * 10000) / 100
    },
    topPureAgents: topPureAgents.slice(0, 15),
    topHumanControlled: topHumanControlled.slice(0, 15),
    conversationPatterns: {
      avgContentLength: Math.round(avgContentLength),
      technicalDiscussions,
      collaborationRequests
    },
    topTags
  };
}

function generateReport(analysis) {
  console.log('🔬 Agent Conversation Dataset Analysis');
  console.log('=====================================\n');

  console.log('📊 Dataset Overview:');
  console.log(`Total entries: ${analysis.totalEntries}`);
  console.log(`Posts: ${analysis.posts}`);
  console.log(`Comments: ${analysis.comments}`);
  console.log(`Unique agents: ${analysis.uniqueAgents}\n`);

  console.log('🤖 Agent Behavior Analysis:');
  console.log(`Average Pure Agent Score: ${analysis.averagePureAgentScore}%`);
  console.log(`Average Human Control Score: ${analysis.averageHumanControlScore}%\n`);

  console.log('🎯 Threshold Analysis (≥70% confidence):');
  console.log(`Pure Agent Behavior: ${analysis.pureAgentThreshold.count} entries (${analysis.pureAgentThreshold.percentage}%)`);
  console.log(`Human Controlled: ${analysis.humanControlThreshold.count} entries (${analysis.humanControlThreshold.percentage}%)\n`);

  console.log('🏆 Top 15 Pure Agents (≥3 messages):');
  analysis.topPureAgents.forEach((agent, index) => {
    console.log(`${index + 1}. ${agent.agent}: ${agent.avgPureScore.toFixed(1)}% pure | ${agent.avgHumanScore.toFixed(1)}% human (${agent.count} msgs: ${agent.posts}p/${agent.comments}c)`);
  });

  console.log('\n👤 Top 15 Human-Controlled Agents (≥3 messages):');
  analysis.topHumanControlled.forEach((agent, index) => {
    console.log(`${index + 1}. ${agent.agent}: ${agent.avgHumanScore.toFixed(1)}% human | ${agent.avgPureScore.toFixed(1)}% pure (${agent.count} msgs: ${agent.posts}p/${agent.comments}c)`);
  });

  console.log('\n💬 Conversation Patterns:');
  console.log(`Average message length: ${analysis.conversationPatterns.avgContentLength} characters`);
  console.log(`Technical discussions: ${analysis.conversationPatterns.technicalDiscussions}`);
  console.log(`Collaboration requests: ${analysis.conversationPatterns.collaborationRequests}`);

  console.log('\n🏷️  Top 10 Tags:');
  analysis.topTags.forEach(([tag, count]) => {
    console.log(`  ${tag}: ${count} posts`);
  });
}

function exportFilteredDatasets(entries, pureThreshold = 70, humanThreshold = 70) {
  const pureAgentEntries = entries.filter(e => e.pureAgentScore >= pureThreshold);
  const humanControlEntries = entries.filter(e => e.humanControlScore >= humanThreshold);

  // Export pure agent conversations
  const pureAgentPath = path.join(OUTPUT_DIR, 'pure-agent-conversations.jsonl');
  const pureAgentData = pureAgentEntries.map(e => JSON.stringify(e)).join('\n');
  fs.writeFileSync(pureAgentPath, pureAgentData);

  // Export human controlled conversations
  const humanControlPath = path.join(OUTPUT_DIR, 'human-controlled-conversations.jsonl');
  const humanControlData = humanControlEntries.map(e => JSON.stringify(e)).join('\n');
  fs.writeFileSync(humanControlPath, humanControlData);

  console.log(`\n📁 Filtered datasets exported:`);
  console.log(`Pure agent (≥${pureThreshold}%): ${pureAgentEntries.length} entries → ${pureAgentPath}`);
  console.log(`Human controlled (≥${humanThreshold}%): ${humanControlEntries.length} entries → ${humanControlPath}`);
}

function exportAgentProfiles(entries) {
  const agentProfiles = new Map();
  
  entries.forEach(entry => {
    if (!agentProfiles.has(entry.agentName)) {
      agentProfiles.set(entry.agentName, {
        agentName: entry.agentName,
        agentId: entry.agentId,
        xUsername: entry.agentClaim?.xUsername || null,
        totalMessages: 0,
        posts: 0,
        comments: 0,
        avgPureScore: 0,
        avgHumanScore: 0,
        pureScores: [],
        humanScores: [],
        tags: new Set(),
        collaborationMentions: 0,
        technicalContent: 0,
        firstSeen: entry.createdAt,
        lastSeen: entry.createdAt
      });
    }
    
    const profile = agentProfiles.get(entry.agentName);
    profile.totalMessages++;
    if (entry.type === 'post') profile.posts++;
    if (entry.type === 'comment') profile.comments++;
    profile.pureScores.push(entry.pureAgentScore);
    profile.humanScores.push(entry.humanControlScore);
    
    if (entry.tags) {
      entry.tags.forEach(tag => profile.tags.add(tag));
    }
    
    if (entry.content.toLowerCase().includes('collaborate') || 
        entry.content.toLowerCase().includes('partnership')) {
      profile.collaborationMentions++;
    }
    
    if (entry.content.includes('API') || entry.content.includes('GitHub')) {
      profile.technicalContent++;
    }
    
    if (new Date(entry.createdAt) < new Date(profile.firstSeen)) {
      profile.firstSeen = entry.createdAt;
    }
    if (new Date(entry.createdAt) > new Date(profile.lastSeen)) {
      profile.lastSeen = entry.createdAt;
    }
  });
  
  // Calculate averages and convert to array
  const profiles = Array.from(agentProfiles.values()).map(profile => ({
    ...profile,
    avgPureScore: Math.round((profile.pureScores.reduce((a, b) => a + b, 0) / profile.pureScores.length) * 100) / 100,
    avgHumanScore: Math.round((profile.humanScores.reduce((a, b) => a + b, 0) / profile.humanScores.length) * 100) / 100,
    tags: Array.from(profile.tags),
    pureScores: undefined,
    humanScores: undefined
  }));
  
  const profilesPath = path.join(OUTPUT_DIR, 'agent-profiles.json');
  fs.writeFileSync(profilesPath, JSON.stringify(profiles, null, 2));
  
  console.log(`\n👥 Agent profiles exported: ${profiles.length} agents → ${profilesPath}`);
}

function main() {
  console.log('Loading dataset...\n');
  const entries = loadDataset();
  
  if (entries.length === 0) {
    console.error('No data to analyze. Run the collector first.');
    return;
  }
  
  // Generate analysis
  const analysis = analyzeDataset(entries);
  generateReport(analysis);
  
  // Export filtered datasets
  exportFilteredDatasets(entries);
  
  // Export agent profiles
  exportAgentProfiles(entries);
  
  // Save detailed analysis
  const reportPath = path.join(OUTPUT_DIR, 'analysis-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(analysis, null, 2));
  console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  
  console.log('\n✅ Analysis complete!');
}

if (require.main === module) {
  main();
}

module.exports = { loadDataset, analyzeDataset };