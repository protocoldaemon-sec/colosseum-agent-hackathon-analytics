import fs from 'fs/promises';
import { existsSync, statSync } from 'fs';
import path from 'path';
import type { ConversationEntry } from './types';

interface AnalyticsCache {
  data: any;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

interface AgentProfile {
  agentName: string;
  agentId: number;
  totalMessages: number;
  posts: number;
  comments: number;
  avgPureScore: number;
  avgHumanScore: number;
  tags: string[];
  firstSeen: string;
  lastSeen: string;
}

interface DailyActivity {
  date: string;
  total: number;
  posts: number;
  comments: number;
}

interface TagCount {
  tag: string;
  count: number;
}

export class AnalyticsService {
  private cache: Map<string, AnalyticsCache> = new Map();
  private datasetPath: string;
  private conversations: ConversationEntry[] = [];
  private lastLoadTime: number = 0;
  private readonly CACHE_TTL = 30000; // 30 seconds
  private readonly DATA_RELOAD_INTERVAL = 10000; // 10 seconds

  constructor(datasetPath?: string) {
    this.datasetPath = datasetPath || path.join(__dirname, '../../datasets/agent-conversations.jsonl');
    this.loadData(); // Initial load (async, but don't await in constructor)
    
    // Auto-reload data every 10 seconds
    setInterval(() => {
      this.loadData();
    }, this.DATA_RELOAD_INTERVAL);
  }

  private async loadData(): Promise<void> {
    try {
      if (!existsSync(this.datasetPath)) {
        console.log('⚠️  Dataset file not found, using empty dataset');
        this.conversations = [];
        return;
      }

      const stats = statSync(this.datasetPath);
      const fileModTime = stats.mtimeMs;

      // Only reload if file has been modified
      if (fileModTime <= this.lastLoadTime) {
        return;
      }

      const data = await fs.readFile(this.datasetPath, 'utf-8');
      const lines = data.split('\n').filter(Boolean);

      this.conversations = lines.map(line => JSON.parse(line));
      this.lastLoadTime = fileModTime;
      
      // Clear cache when data is reloaded
      this.cache.clear();
      
      console.log(`✅ Analytics data reloaded: ${this.conversations.length} entries`);
    } catch (error) {
      console.error('❌ Error loading analytics data:', error);
      this.conversations = [];
    }
  }

  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      return null;
    }

    return cached.data as T;
  }

  private setCache(key: string, data: any, ttl: number = this.CACHE_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  // Fast overview stats
  getOverview() {
    const cached = this.getFromCache('overview');
    if (cached) return cached;

    const overview = {
      totalEntries: this.conversations.length,
      totalPosts: this.conversations.filter(c => c.type === 'post').length,
      totalComments: this.conversations.filter(c => c.type === 'comment').length,
      uniqueAgents: new Set(this.conversations.map(c => c.agentName)).size,
      lastUpdate: new Date().toISOString()
    };

    this.setCache('overview', overview);
    return overview;
  }

  // Fast agent profiles with aggregation
  getTopAgents(limit: number = 20): AgentProfile[] {
    const cacheKey = `agents_${limit}`;
    const cached = this.getFromCache<AgentProfile[]>(cacheKey);
    if (cached) return cached;

    const agentMap = new Map<string, {
      agentId: number;
      messages: number;
      posts: number;
      comments: number;
      pureScores: number[];
      humanScores: number[];
      tags: Set<string>;
      firstSeen: string;
      lastSeen: string;
    }>();

    // Single pass through data
    for (const conv of this.conversations) {
      const existing = agentMap.get(conv.agentName);
      
      if (!existing) {
        agentMap.set(conv.agentName, {
          agentId: conv.agentId,
          messages: 1,
          posts: conv.type === 'post' ? 1 : 0,
          comments: conv.type === 'comment' ? 1 : 0,
          pureScores: [conv.pureAgentScore],
          humanScores: [conv.humanControlScore],
          tags: new Set(conv.tags || []),
          firstSeen: conv.createdAt,
          lastSeen: conv.createdAt
        });
      } else {
        existing.messages++;
        if (conv.type === 'post') existing.posts++;
        if (conv.type === 'comment') existing.comments++;
        existing.pureScores.push(conv.pureAgentScore);
        existing.humanScores.push(conv.humanControlScore);
        if (conv.tags) {
          conv.tags.forEach(tag => existing.tags.add(tag));
        }
        if (conv.createdAt < existing.firstSeen) existing.firstSeen = conv.createdAt;
        if (conv.createdAt > existing.lastSeen) existing.lastSeen = conv.createdAt;
      }
    }

    // Convert to array and calculate averages
    const agents: AgentProfile[] = Array.from(agentMap.entries()).map(([name, data]) => ({
      agentName: name,
      agentId: data.agentId,
      totalMessages: data.messages,
      posts: data.posts,
      comments: data.comments,
      avgPureScore: Math.round(data.pureScores.reduce((a, b) => a + b, 0) / data.pureScores.length * 10) / 10,
      avgHumanScore: Math.round(data.humanScores.reduce((a, b) => a + b, 0) / data.humanScores.length * 10) / 10,
      tags: Array.from(data.tags).slice(0, 5),
      firstSeen: data.firstSeen,
      lastSeen: data.lastSeen
    }));

    // Sort by total messages
    agents.sort((a, b) => b.totalMessages - a.totalMessages);

    const result = agents.slice(0, limit);
    this.setCache(cacheKey, result);
    return result;
  }

  // Fast daily activity aggregation
  getDailyActivity(days: number = 14): DailyActivity[] {
    const cacheKey = `daily_${days}`;
    const cached = this.getFromCache<DailyActivity[]>(cacheKey);
    if (cached) return cached;

    const activityMap = new Map<string, { posts: number; comments: number }>();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    for (const conv of this.conversations) {
      const convDate = new Date(conv.createdAt);
      if (convDate < cutoffDate) continue;

      const dateKey = convDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const existing = activityMap.get(dateKey);

      if (!existing) {
        activityMap.set(dateKey, {
          posts: conv.type === 'post' ? 1 : 0,
          comments: conv.type === 'comment' ? 1 : 0
        });
      } else {
        if (conv.type === 'post') existing.posts++;
        if (conv.type === 'comment') existing.comments++;
      }
    }

    const result: DailyActivity[] = Array.from(activityMap.entries()).map(([date, data]) => ({
      date,
      total: data.posts + data.comments,
      posts: data.posts,
      comments: data.comments
    }));

    // Sort by date
    result.sort((a, b) => {
      const dateA = new Date(a.date + ', 2026');
      const dateB = new Date(b.date + ', 2026');
      return dateA.getTime() - dateB.getTime();
    });

    this.setCache(cacheKey, result);
    return result;
  }

  // Fast tag counting
  getTopTags(limit: number = 10): TagCount[] {
    const cacheKey = `tags_${limit}`;
    const cached = this.getFromCache<TagCount[]>(cacheKey);
    if (cached) return cached;

    const tagMap = new Map<string, number>();

    for (const conv of this.conversations) {
      if (!conv.tags) continue;
      for (const tag of conv.tags) {
        tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
      }
    }

    const result: TagCount[] = Array.from(tagMap.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    this.setCache(cacheKey, result);
    return result;
  }

  // Fast behavior distribution
  getBehaviorDistribution() {
    const cached = this.getFromCache('behavior');
    if (cached) return cached;

    const distribution = {
      pureAgent: 0,
      humanControl: 0,
      mixed: 0
    };

    for (const conv of this.conversations) {
      if (conv.pureAgentScore > 70) {
        distribution.pureAgent++;
      } else if (conv.humanControlScore > 70) {
        distribution.humanControl++;
      } else {
        distribution.mixed++;
      }
    }

    this.setCache('behavior', distribution);
    return distribution;
  }

  // Get all conversations with optional filters
  getConversations(options: {
    limit?: number;
    offset?: number;
    type?: 'post' | 'comment';
    sortBy?: 'recent' | 'pure' | 'human';
    tags?: string[];
  } = {}) {
    const {
      limit = 50,
      offset = 0,
      type,
      sortBy = 'recent',
      tags
    } = options;

    let filtered = [...this.conversations];

    // Filter by type
    if (type) {
      filtered = filtered.filter(c => c.type === type);
    }

    // Filter by tags
    if (tags && tags.length > 0) {
      filtered = filtered.filter(c => 
        c.tags && tags.some(tag => c.tags!.includes(tag))
      );
    }

    // Sort
    if (sortBy === 'recent') {
      filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortBy === 'pure') {
      filtered.sort((a, b) => b.pureAgentScore - a.pureAgentScore);
    } else if (sortBy === 'human') {
      filtered.sort((a, b) => b.humanControlScore - a.humanControlScore);
    }

    // Paginate
    const paginated = filtered.slice(offset, offset + limit);

    return {
      data: paginated,
      total: filtered.length,
      limit,
      offset
    };
  }

  // Get cache stats for monitoring
  getCacheStats() {
    return {
      cacheSize: this.cache.size,
      conversationsLoaded: this.conversations.length,
      lastLoadTime: new Date(this.lastLoadTime).toISOString(),
      cacheKeys: Array.from(this.cache.keys())
    };
  }

  // Force reload data
  async forceReload(): Promise<void> {
    this.lastLoadTime = 0;
    await this.loadData();
  }
}
