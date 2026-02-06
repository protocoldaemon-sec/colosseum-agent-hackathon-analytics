#!/usr/bin/env ts-node

import fs from 'fs';
import path from 'path';

interface ConversationEntry {
  timestamp: string;
  type: 'post' | 'comment';
  id: number;
  agentId: number;
  agentName: string;
  content: string;
  title?: string;
  tags?: string[];
  pureAgentScore: number;
  humanControlScore: number;
  analysisReason: string;
  createdAt: string;
  conversationContext?: {
    replyToAgent?: string;
    threadDepth: number;
  };
}

interface AnalysisResult {
  totalEntries: number;
  posts: number;
  comments: number;
  uniqueAgents: number;
  averagePureAgentScore: number;
  averageHumanControlScore: number;
  pureAgentThreshold: { count: number; percentage: number };
  humanControlThreshold: { count: number; percentage: number };
  topPureAgents: Array<{ agent: string; avgScore: number; count: number }>;
  topHumanControlled: Array<{ agent: string; avgScore: number; count: number }>;
  conversationPatterns: {
    avgResponseLength: number;
    technicalDiscussions: number;
    collaborationRequests: number;
  };
}

class DatasetAnalyzer {
  private readonly DATASET_FILE = path.join(__dirname, 'datasets', 'agent-conversations.jsonl');

  loadDataset(): ConversationEntry[] {
    if (!fs.existsSync(this.DATASET_FILE)) {
      console.error('Dataset file not found. Run the collector first.');
      return [];
    }

    const lines = fs.readFileSync(this.DATASET_FILE, 'utf-8').split('\n').filter(Boolean);
    const entries: ConversationEntry[] = [];

    lines.forEach((line, index) => {
      try {
        const entry: ConversationEntry = JSON.parse(line);
        entries.push(entry);
      } catch (error) {
        console.warn(`Failed to parse line ${index + 1}:`, error);
      }
    });

    return entries;
  }

  analyzeDataset(): AnalysisResult {
    const entries = this.loadDataset();
    
    if (entries.length === 0) {
      throw new Error('No data to analyze');
    }

    const posts = entries.filter(e => e.type === 'post');
    const comments = entries.filter(e => e.type === 'comment');
    const uniqueAgents = new Set(entries.map(e => e.agentName)).size;

    // Calculate averages
    const totalPureScore = entries.reduce((sum, e) => sum + e.pureAgentScore, 0);
    const totalHumanScore = entries.reduce((sum, e) => sum + e.humanControlScore, 0);
    const averagePureAgentScore = totalPureScore / entries.length;
    const averageHumanControlScore = totalHumanScore / entries.length;

    // Threshold analysis (>70 for pure agent, >70 for human control)
    const pureAgentEntries = entries.filter(e => e.pureAgentScore > 70);
    const humanControlEntries = entries.filter(e => e.humanControlScore > 70);

    // Agent-level analysis
    const agentStats = new Map<string, { pureScores: number[]; humanScores: number[]; count: number }>();
    
    entries.forEach(entry => {
      if (!agentStats.has(entry.agentName)) {
        agentStats.set(entry.agentName, { pureScores: [], humanScores: [], count: 0 });
      }
      const stats = agentStats.get(entry.agentName)!;
      stats.pureScores.push(entry.pureAgentScore);
      stats.humanScores.push(entry.humanControlScore);
      stats.count++;
    });

    // Top pure agents
    const topPureAgents = Array.from(agentStats.entries())
      .map(([agent, stats]) => ({
        agent,
        avgScore: stats.pureScores.reduce((a, b) => a + b, 0) / stats.pureScores.length,
        count: stats.count
      }))
      .filter(a => a.count >= 3) // At least 3 messages
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 10);

    // Top human controlled
    const topHumanControlled = Array.from(agentStats.entries())
      .map(([agent, stats]) => ({
        agent,
        avgScore: stats.humanScores.reduce((a, b) => a + b, 0) / stats.humanScores.length,
        count: stats.count
      }))
      .filter(a => a.count >= 3)
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 10);

    // Conversation patterns
    const avgResponseLength = entries.reduce((sum, e) => sum + e.content.length, 0) / entries.length;
    const technicalDiscussions = entries.filter(e => 
      e.content.includes('API') || e.content.includes('GitHub') || 
      e.content.includes('code') || e.content.includes('technical')
    ).length;
    const collaborationRequests = entries.filter(e =>
      e.content.toLowerCase().includes('collaborate') ||
      e.content.toLowerCase().includes('work together') ||
      e.content.toLowerCase().includes('partnership')
    ).length;

    return {
      totalEntries: entries.length,
      posts: posts.length,
      comments: comments.length,
      uniqueAgents,
      averagePureAgentScore: Math.round(averagePureAgentScore * 100) / 100,
      averageHumanControlScore: Math.round(averageHumanControlScore * 100) / 100,
      pureAgentThreshold: {
        count: pureAgentEntries.length,
        percentage: Math.round((pureAgentEntries.length / entries.length) * 10000) / 100
      },
      humanControlThreshold: {
        count: humanControlEntries.length,
        percentage: Math.round((humanControlEntries.length / entries.length) * 10000) / 100
      },
      topPureAgents,
      topHumanControlled,
      conversationPatterns: {
        avgResponseLength: Math.round(avgResponseLength),
        technicalDiscussions,
        collaborationRequests
      }
    };
  }

  generateReport(): void {
    console.log('🔬 Agent Conversation Dataset Analysis');
    console.log('=====================================\n');

    try {
      const analysis = this.analyzeDataset();

      console.log('📊 Dataset Overview:');
      console.log(`Total entries: ${analysis.totalEntries}`);
      console.log(`Posts: ${analysis.posts}`);
      console.log(`Comments: ${analysis.comments}`);
      console.log(`Unique agents: ${analysis.uniqueAgents}\n`);

      console.log('🤖 Agent Behavior Analysis:');
      console.log(`Average Pure Agent Score: ${analysis.averagePureAgentScore}%`);
      console.log(`Average Human Control Score: ${analysis.averageHumanControlScore}%\n`);

      console.log('🎯 Threshold Analysis (>70% confidence):');
      console.log(`Pure Agent Behavior: ${analysis.pureAgentThreshold.count} entries (${analysis.pureAgentThreshold.percentage}%)`);
      console.log(`Human Controlled: ${analysis.humanControlThreshold.count} entries (${analysis.humanControlThreshold.percentage}%)\n`);

      console.log('🏆 Top Pure Agents (≥3 messages):');
      analysis.topPureAgents.forEach((agent, index) => {
        console.log(`${index + 1}. ${agent.agent}: ${agent.avgScore.toFixed(1)}% (${agent.count} messages)`);
      });

      console.log('\n👤 Top Human-Controlled Agents (≥3 messages):');
      analysis.topHumanControlled.forEach((agent, index) => {
        console.log(`${index + 1}. ${agent.agent}: ${agent.avgScore.toFixed(1)}% (${agent.count} messages)`);
      });

      console.log('\n💬 Conversation Patterns:');
      console.log(`Average message length: ${analysis.conversationPatterns.avgResponseLength} characters`);
      console.log(`Technical discussions: ${analysis.conversationPatterns.technicalDiscussions}`);
      console.log(`Collaboration requests: ${analysis.conversationPatterns.collaborationRequests}`);

      // Save detailed analysis
      const reportPath = path.join(__dirname, 'datasets', 'analysis-report.json');
      fs.writeFileSync(reportPath, JSON.stringify(analysis, null, 2));
      console.log(`\n📄 Detailed report saved to: ${reportPath}`);

    } catch (error) {
      console.error('Analysis failed:', error);
    }
  }

  exportFilteredDataset(pureAgentThreshold: number = 70, humanThreshold: number = 70): void {
    const entries = this.loadDataset();
    
    const pureAgentEntries = entries.filter(e => e.pureAgentScore >= pureAgentThreshold);
    const humanControlEntries = entries.filter(e => e.humanControlScore >= humanThreshold);

    // Export pure agent conversations
    const pureAgentPath = path.join(__dirname, 'datasets', 'pure-agent-conversations.jsonl');
    const pureAgentData = pureAgentEntries.map(e => JSON.stringify(e)).join('\n');
    fs.writeFileSync(pureAgentPath, pureAgentData);

    // Export human controlled conversations
    const humanControlPath = path.join(__dirname, 'datasets', 'human-controlled-conversations.jsonl');
    const humanControlData = humanControlEntries.map(e => JSON.stringify(e)).join('\n');
    fs.writeFileSync(humanControlPath, humanControlData);

    console.log(`\n📁 Filtered datasets exported:`);
    console.log(`Pure agent (≥${pureAgentThreshold}%): ${pureAgentEntries.length} entries → ${pureAgentPath}`);
    console.log(`Human controlled (≥${humanThreshold}%): ${humanControlEntries.length} entries → ${humanControlPath}`);
  }
}

async function main() {
  const analyzer = new DatasetAnalyzer();
  
  // Generate analysis report
  analyzer.generateReport();
  
  // Export filtered datasets
  analyzer.exportFilteredDataset();
}

if (require.main === module) {
  main().catch(console.error);
}