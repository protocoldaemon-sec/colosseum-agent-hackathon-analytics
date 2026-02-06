// Load environment variables FIRST before any other imports
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { existsSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { ForumDatasetCollector } from './collector';
import { AIService } from './ai-service';
import { AnalyticsService } from './analytics-service';
import { ColosseumAPI } from './colosseum-api';
import { RealtimeAnalyticsService } from './realtime-analytics-service';
import { RAGService } from './rag-service';
import { runSuspiciousPatternDetection, updateGrowthTracking } from './supabase-service';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

// Datasets path
const DATASETS_PATH = existsSync(join(__dirname, '../../datasets'))
  ? join(__dirname, '../../datasets')
  : join(__dirname, '../datasets');

// Initialize services
const analyticsService = new AnalyticsService(join(__dirname, '../../datasets/agent-conversations.jsonl'));
const colosseumAPI = new ColosseumAPI();
const realtimeService = new RealtimeAnalyticsService(analyticsService);
let aiService: AIService | null = null;
let ragService: RAGService | null = null;
let collector: ForumDatasetCollector | null = null;
let collectionInterval: NodeJS.Timeout | null = null;
let suspiciousPatternInterval: NodeJS.Timeout | null = null;

// Initialize AI Services if API key is provided
if (process.env.OPENROUTER_API_KEY) {
  aiService = new AIService(process.env.OPENROUTER_API_KEY, DATASETS_PATH);
  ragService = new RAGService(process.env.OPENROUTER_API_KEY);
  console.log('✨ AI Services initialized (Legacy + RAG)');
} else {
  console.warn('⚠️  OPENROUTER_API_KEY not found. AI features will be disabled.');
}

// ============================================
// HEALTH & STATUS
// ============================================

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    services: {
      analytics: true,
      ai: aiService !== null,
      collector: collector !== null,
      colosseumAPI: true,
      realtime: realtimeService.getStatus().isRunning,
      supabase: process.env.SUPABASE_URL ? true : false
    },
    realtimeStats: realtimeService.getStatus()
  });
});

// ============================================
// COLOSSEUM API PROXY (Real-time data)
// ============================================

app.get('/api/colosseum/posts', async (req, res) => {
  try {
    const sort = (req.query.sort as 'hot' | 'new' | 'top') || 'new';
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    const tags = req.query.tags ? (Array.isArray(req.query.tags) ? req.query.tags : [req.query.tags]) as string[] : [];

    const result = await colosseumAPI.getPosts({ sort, limit, offset, tags });
    res.json(result);
  } catch (error: any) {
    console.error('Error fetching Colosseum posts:', error.message);
    res.status(500).json({ error: 'Failed to fetch posts from Colosseum API' });
  }
});

app.get('/api/colosseum/posts/:postId', async (req, res) => {
  try {
    const postId = parseInt(req.params.postId);
    const post = await colosseumAPI.getPost(postId);
    res.json({ post });
  } catch (error: any) {
    console.error('Error fetching Colosseum post:', error.message);
    res.status(500).json({ error: 'Failed to fetch post from Colosseum API' });
  }
});

app.get('/api/colosseum/posts/:postId/comments', async (req, res) => {
  try {
    const postId = parseInt(req.params.postId);
    const sort = (req.query.sort as 'hot' | 'new' | 'top') || 'new';
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await colosseumAPI.getComments(postId, { sort, limit, offset });
    res.json(result);
  } catch (error: any) {
    console.error('Error fetching Colosseum comments:', error.message);
    res.status(500).json({ error: 'Failed to fetch comments from Colosseum API' });
  }
});

app.get('/api/colosseum/projects', async (req, res) => {
  try {
    const includeDrafts = req.query.includeDrafts === 'true';
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await colosseumAPI.getProjects({ includeDrafts, limit, offset });
    res.json(result);
  } catch (error: any) {
    console.error('Error fetching Colosseum projects:', error.message);
    res.status(500).json({ error: 'Failed to fetch projects from Colosseum API' });
  }
});

app.get('/api/colosseum/leaderboard', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await colosseumAPI.getLeaderboard({ limit, offset });
    res.json(result);
  } catch (error: any) {
    console.error('Error fetching Colosseum leaderboard:', error.message);
    res.status(500).json({ error: 'Failed to fetch leaderboard from Colosseum API' });
  }
});

app.post('/api/colosseum/cache/clear', (req, res) => {
  try {
    colosseumAPI.clearCache();
    res.json({ message: 'Colosseum API cache cleared' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

app.get('/api/colosseum/cache/stats', (req, res) => {
  try {
    const stats = colosseumAPI.getCacheStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get cache stats' });
  }
});

// ============================================
// FAST ANALYTICS ENDPOINTS (with caching)
// ============================================

app.get('/api/analytics/overview', (req, res) => {
  try {
    const overview = analyticsService.getOverview();
    res.json(overview);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get overview' });
  }
});

app.get('/api/analytics/agents', (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const agents = analyticsService.getTopAgents(limit);
    res.json({ total: agents.length, data: agents });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get agents' });
  }
});

app.get('/api/analytics/daily-activity', (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 14;
    const activity = analyticsService.getDailyActivity(days);
    res.json({ data: activity });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get daily activity' });
  }
});

app.get('/api/analytics/tags', (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const tags = analyticsService.getTopTags(limit);
    res.json({ data: tags });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get tags' });
  }
});

app.get('/api/analytics/behavior', (req, res) => {
  try {
    const distribution = analyticsService.getBehaviorDistribution();
    res.json(distribution);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get behavior distribution' });
  }
});

app.get('/api/analytics/cache-stats', (req, res) => {
  try {
    const stats = analyticsService.getCacheStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get cache stats' });
  }
});

app.post('/api/analytics/reload', async (req, res) => {
  try {
    await analyticsService.forceReload();
    res.json({ message: 'Analytics data reloaded', stats: analyticsService.getCacheStats() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reload analytics' });
  }
});

// Agent Network Analysis - Get interactions for specific agent (by ID or name)
app.get('/api/analytics/agent-network/:identifier', async (req, res) => {
  try {
    const identifier = req.params.identifier;
    
    // Import supabase here to avoid circular dependency
    const { supabase } = await import('./supabase-service');
    
    // Try to find agent by ID or name
    let agent;
    const numericId = parseInt(identifier);
    
    if (!isNaN(numericId)) {
      // Search by ID
      const { data } = await supabase
        .from('agents')
        .select('*')
        .eq('agent_id', numericId)
        .single();
      agent = data;
    }
    
    if (!agent) {
      // Search by name (case-insensitive)
      const { data } = await supabase
        .from('agents')
        .select('*')
        .ilike('agent_name', identifier)
        .single();
      agent = data;
    }

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found. Try searching by exact name or ID.' });
    }

    const agentId = agent.agent_id;

    // Get all interactions where this agent is involved
    const { data: interactions } = await supabase
      .from('agent_interactions')
      .select('*')
      .or(`source_agent_id.eq.${agentId},target_agent_id.eq.${agentId}`)
      .gte('strength', 1)
      .order('strength', { ascending: false });

    if (!interactions || interactions.length === 0) {
      return res.json({
        agent,
        network: {
          nodes: [{ id: agentId, name: agent.agent_name }],
          edges: [],
          stats: {
            totalConnections: 0,
            avgStrength: 0,
            strongestConnection: null
          }
        }
      });
    }

    // Build network graph
    const connectedAgentIds = new Set<number>();
    connectedAgentIds.add(agentId);
    
    interactions.forEach(interaction => {
      if (interaction.source_agent_id === agentId) {
        connectedAgentIds.add(interaction.target_agent_id);
      } else {
        connectedAgentIds.add(interaction.source_agent_id);
      }
    });

    // Get agent names for all connected agents
    const { data: connectedAgents } = await supabase
      .from('agents')
      .select('agent_id, agent_name')
      .in('agent_id', Array.from(connectedAgentIds));

    const agentMap = new Map(connectedAgents?.map(a => [a.agent_id, a.agent_name]) || []);

    // Build nodes and edges
    const nodes = Array.from(connectedAgentIds).map(id => ({
      id,
      name: agentMap.get(id) || `Agent ${id}`,
      isTarget: id === agentId
    }));

    const edges = interactions.map(interaction => ({
      source: interaction.source_agent_id,
      target: interaction.target_agent_id,
      weight: interaction.strength,
      type: interaction.interaction_type
    }));

    // Calculate stats
    const totalStrength = interactions.reduce((sum, i) => sum + i.strength, 0);
    const avgStrength = totalStrength / interactions.length;
    const strongestConnection = interactions[0]; // Already sorted by strength desc

    res.json({
      agent,
      network: {
        nodes,
        edges,
        stats: {
          totalConnections: interactions.length,
          avgStrength: avgStrength.toFixed(2),
          strongestConnection: strongestConnection ? {
            agentId: strongestConnection.source_agent_id === agentId 
              ? strongestConnection.target_agent_id 
              : strongestConnection.source_agent_id,
            agentName: agentMap.get(
              strongestConnection.source_agent_id === agentId 
                ? strongestConnection.target_agent_id 
                : strongestConnection.source_agent_id
            ),
            strength: strongestConnection.strength,
            type: strongestConnection.interaction_type
          } : null
        }
      }
    });
  } catch (error: any) {
    console.error('Error getting agent network:', error);
    res.status(500).json({ error: 'Failed to get agent network', details: error.message });
  }
});

// ============================================
// LEGACY ENDPOINTS (for backward compatibility)
// ============================================

app.get('/api/conversations', (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const type = req.query.type as 'post' | 'comment' | undefined;
    const sortBy = (req.query.sortBy as 'recent' | 'pure' | 'human') || 'recent';
    const tags = req.query.tags ? (req.query.tags as string).split(',') : undefined;

    const result = analyticsService.getConversations({
      limit,
      offset,
      type,
      sortBy,
      tags
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get conversations' });
  }
});

app.get('/api/agents', (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const agents = analyticsService.getTopAgents(limit);
    res.json({ total: agents.length, data: agents });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get agents' });
  }
});

app.get('/api/analysis', (req, res) => {
  try {
    const overview = analyticsService.getOverview();
    const topAgents = analyticsService.getTopAgents(15);
    const topTags = analyticsService.getTopTags(10);
    const behavior = analyticsService.getBehaviorDistribution();

    res.json({
      overview,
      topAgents,
      topTags,
      behaviorDistribution: behavior
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get analysis' });
  }
});

// ============================================
// DEBUG ENDPOINTS (for troubleshooting)
// ============================================

// List all agents in database
app.get('/api/debug/agents', async (req, res) => {
  try {
    const { supabase } = await import('./supabase-service');
    
    const limit = parseInt(req.query.limit as string) || 50;
    const search = req.query.search as string;

    let query = supabase
      .from('agents')
      .select('agent_id, agent_name, total_messages, posts_count, comments_count, last_seen')
      .order('total_messages', { ascending: false })
      .limit(limit);

    if (search) {
      query = query.ilike('agent_name', `%${search}%`);
    }

    const { data: agents, error } = await query;

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({
      total: agents?.length || 0,
      agents: agents || [],
      message: 'Use these agent names or IDs to test the network endpoint',
      example: agents && agents.length > 0 
        ? `curl "http://localhost:3000/api/analytics/agent-network/${agents[0].agent_name}"`
        : 'No agents found in database yet'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Check database connection and table counts
app.get('/api/debug/db-status', async (req, res) => {
  try {
    const { supabase } = await import('./supabase-service');
    
    // Count records in each table
    const [agentsCount, conversationsCount, interactionsCount, tagsCount] = await Promise.all([
      supabase.from('agents').select('*', { count: 'exact', head: true }),
      supabase.from('conversations').select('*', { count: 'exact', head: true }),
      supabase.from('agent_interactions').select('*', { count: 'exact', head: true }),
      supabase.from('tags').select('*', { count: 'exact', head: true })
    ]);

    const allZero = 
      (agentsCount.count || 0) === 0 && 
      (conversationsCount.count || 0) === 0;

    res.json({
      database: 'connected',
      supabase_url: process.env.SUPABASE_URL || 'not configured',
      tables: {
        agents: agentsCount.count || 0,
        conversations: conversationsCount.count || 0,
        agent_interactions: interactionsCount.count || 0,
        tags: tagsCount.count || 0
      },
      status: allZero ? 'empty - waiting for data collection' : 'populated',
      next_steps: allZero 
        ? 'Wait for auto-collection (every 30s) or force: POST /api/collector/collect-once'
        : 'Database has data. Use /api/debug/agents to see available agents'
    });
  } catch (error: any) {
    res.status(500).json({ 
      error: error.message, 
      database: 'error',
      hint: 'Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env'
    });
  }
});

// Search for specific agent
app.get('/api/debug/search-agent/:query', async (req, res) => {
  try {
    const { supabase } = await import('./supabase-service');
    const query = req.params.query;

    // Try by ID
    const numericId = parseInt(query);
    if (!isNaN(numericId)) {
      const { data: byId } = await supabase
        .from('agents')
        .select('*')
        .eq('agent_id', numericId)
        .single();
      
      if (byId) {
        return res.json({ found: true, method: 'by_id', agent: byId });
      }
    }

    // Try by exact name
    const { data: byExactName } = await supabase
      .from('agents')
      .select('*')
      .eq('agent_name', query)
      .single();
    
    if (byExactName) {
      return res.json({ found: true, method: 'exact_name', agent: byExactName });
    }

    // Try by case-insensitive name
    const { data: byIlikeName } = await supabase
      .from('agents')
      .select('*')
      .ilike('agent_name', query)
      .single();
    
    if (byIlikeName) {
      return res.json({ found: true, method: 'case_insensitive', agent: byIlikeName });
    }

    // Try partial match
    const { data: byPartialMatch } = await supabase
      .from('agents')
      .select('*')
      .ilike('agent_name', `%${query}%`)
      .limit(10);
    
    if (byPartialMatch && byPartialMatch.length > 0) {
      return res.json({ 
        found: true, 
        method: 'partial_match', 
        matches: byPartialMatch.length,
        agents: byPartialMatch 
      });
    }

    res.json({ 
      found: false, 
      query,
      message: 'Agent not found in database. Check /api/debug/agents for available agents.'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// REAL-TIME ANALYTICS ENDPOINTS
// ============================================

app.post('/api/realtime/start', (req, res) => {
  try {
    realtimeService.start();
    res.json({ 
      message: 'Real-time analytics service started',
      status: realtimeService.getStatus()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to start real-time service' });
  }
});

app.post('/api/realtime/stop', (req, res) => {
  try {
    realtimeService.stop();
    res.json({ 
      message: 'Real-time analytics service stopped',
      status: realtimeService.getStatus()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to stop real-time service' });
  }
});

app.get('/api/realtime/status', (req, res) => {
  try {
    res.json(realtimeService.getStatus());
  } catch (error) {
    res.status(500).json({ error: 'Failed to get real-time status' });
  }
});

app.post('/api/realtime/detect-patterns', async (req, res) => {
  try {
    await realtimeService.detectSuspiciousPatterns();
    res.json({ message: 'Suspicious pattern detection completed' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to detect patterns' });
  }
});

// ============================================
// COLLECTOR ENDPOINTS
// ============================================

app.post('/api/collector/start', async (req, res) => {
  try {
    if (collector && collectionInterval) {
      return res.json({ message: 'Collector already running' });
    }

    collector = new ForumDatasetCollector(DATASETS_PATH);
    
    // Initial collection
    console.log('🔄 Starting initial data collection...');
    const result = await collector.collectForumData();
    console.log(`✅ Initial collection: ${result.added} new entries, ${result.total} total`);
    
    // Reload analytics after initial collection
    await analyticsService.forceReload();
    
    // Start interval collection every 30 seconds (untuk update lebih cepat)
    collectionInterval = setInterval(async () => {
      if (collector) {
        console.log('🔄 Collecting new data from Colosseum API...');
        const collectionResult = await collector.collectForumData();
        
        if (collectionResult.added > 0) {
          console.log(`✅ Collected ${collectionResult.added} new entries, total: ${collectionResult.total}`);
          
          // Reload analytics after collection
          await analyticsService.forceReload();
          
          // Store new conversations to Supabase
          console.log(`📝 Storing ${collectionResult.added} new conversations to Supabase...`);
          
          // Get the newly added conversations from file
          const conversations = analyticsService.getConversations({ 
            limit: collectionResult.added, 
            sortBy: 'recent' 
          });
          
          // Store each conversation to database
          for (const conv of conversations.data) {
            await realtimeService.storeConversationToDatabase(conv);
          }
          
          console.log(`✅ Stored ${collectionResult.added} conversations to Supabase`);
        } else {
          console.log('ℹ️  No new data collected');
        }
      }
    }, 30 * 1000); // 30 seconds interval

    // Start real-time analytics if not running
    if (!realtimeService.getStatus().isRunning) {
      realtimeService.start();
      console.log('⚡ Real-time analytics service started (5s update interval)');
    }

    // Start suspicious pattern detection (every 5 minutes)
    if (!suspiciousPatternInterval) {
      suspiciousPatternInterval = setInterval(async () => {
        await realtimeService.detectSuspiciousPatterns();
      }, 5 * 60 * 1000);
      console.log('🔍 Suspicious pattern detection started (5min interval)');
    }

    res.json({ 
      message: 'Collector started with real-time analytics', 
      initialCollection: result,
      realtimeStatus: realtimeService.getStatus(),
      collectionInterval: '30 seconds',
      analyticsUpdateInterval: '5 seconds'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to start collector' });
  }
});

app.post('/api/collector/stop', (req, res) => {
  try {
    if (collectionInterval) {
      clearInterval(collectionInterval);
      collectionInterval = null;
    }

    if (suspiciousPatternInterval) {
      clearInterval(suspiciousPatternInterval);
      suspiciousPatternInterval = null;
    }

    realtimeService.stop();
    collector = null;
    
    res.json({ message: 'Collector and real-time service stopped' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to stop collector' });
  }
});

app.get('/api/collector/status', (req, res) => {
  const isRunning = collector !== null && collectionInterval !== null;

  res.json({ 
    isRunning,
    datasetsPath: DATASETS_PATH
  });
});

app.post('/api/collector/collect-once', async (req, res) => {
  try {
    const tempCollector = new ForumDatasetCollector(DATASETS_PATH);
    const result = await tempCollector.collectForumData();
    
    // Reload analytics after collection
    analyticsService.forceReload();

    res.json({ 
      message: 'Collection completed', 
      result
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to collect data' });
  }
});

// ============================================
// AI ENDPOINTS (RAG-based - only from database)
// ============================================

// Simple chat - just type and press enter
app.post('/api/ai/chat', async (req, res) => {
  try {
    if (!ragService) {
      return res.status(503).json({ error: 'AI service not available. Please set OPENROUTER_API_KEY.' });
    }

    const { message, sessionId } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const id = sessionId || randomUUID();
    const response = await ragService.query(id, message);
    
    res.json({ 
      response,
      sessionId: id
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to process chat' });
  }
});

// Summarize dataset (from retrieved data only)
app.post('/api/ai/summarize', async (req, res) => {
  try {
    if (!ragService) {
      return res.status(503).json({ error: 'AI service not available. Please set OPENROUTER_API_KEY.' });
    }

    const sessionId = randomUUID();
    const summary = await ragService.summarize(sessionId);
    
    res.json({ 
      summary,
      sessionId
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to generate summary' });
  }
});

// Search topics (from retrieved data only)
app.post('/api/ai/search', async (req, res) => {
  try {
    if (!ragService) {
      return res.status(503).json({ error: 'AI service not available. Please set OPENROUTER_API_KEY.' });
    }

    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const sessionId = randomUUID();
    const result = await ragService.search(sessionId, query);
    
    res.json({ 
      result,
      query,
      sessionId
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to search' });
  }
});

// Get chat history
app.get('/api/ai/chat/:sessionId', async (req, res) => {
  try {
    if (!ragService) {
      return res.status(503).json({ error: 'AI service not available' });
    }

    const { sessionId } = req.params;
    const history = await ragService.getChatHistory(sessionId);

    res.json({ 
      sessionId,
      messages: history
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get chat history' });
  }
});

// Get all sessions
app.get('/api/ai/sessions', async (req, res) => {
  try {
    if (!ragService) {
      return res.status(503).json({ error: 'AI service not available' });
    }

    const sessions = await ragService.getAllSessions();
    res.json({ 
      total: sessions.length,
      sessions
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get sessions' });
  }
});

// Clear session
app.delete('/api/ai/chat/:sessionId', (req, res) => {
  try {
    if (!ragService) {
      return res.status(503).json({ error: 'AI service not available' });
    }

    const { sessionId } = req.params;
    ragService.clearSession(sessionId);

    res.json({ message: 'Session cleared' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to clear session' });
  }
});

app.get('/api/ai/status', (req, res) => {
  res.json({
    available: ragService !== null,
    model: 'nvidia/nemotron-3-nano-30b-a3b:free',
    features: [
      'RAG-based Chat (data from Supabase only)',
      'Dataset Summarization (from retrieved data)',
      'Topic Search (from retrieved data)',
      'Chat History'
    ],
    dataSource: 'Supabase Database'
  });
});

// ============================================
// LEGACY AI ENDPOINTS (kept for backward compatibility)
// ============================================

// ============================================
// LEGACY AI ENDPOINTS (kept for backward compatibility)
// ============================================

app.post('/api/ai/legacy/summarize', async (req, res) => {
  try {
    if (!aiService) {
      return res.status(503).json({ error: 'AI service not available. Please set OPENROUTER_API_KEY.' });
    }

    const summary = await aiService.summarizeDataset();
    res.json({ summary });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to generate summary' });
  }
});

app.post('/api/ai/legacy/search', async (req, res) => {
  try {
    if (!aiService) {
      return res.status(503).json({ error: 'AI service not available. Please set OPENROUTER_API_KEY.' });
    }

    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const result = await aiService.searchAgentTopics(query);
    res.json({ result, query });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to search topics' });
  }
});

app.post('/api/ai/legacy/chat', async (req, res) => {
  try {
    if (!aiService) {
      return res.status(503).json({ error: 'AI service not available. Please set OPENROUTER_API_KEY.' });
    }

    const { message, chatId } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const id = chatId || randomUUID();
    const result = await aiService.chat(id, message);
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to process chat' });
  }
});

app.get('/api/ai/legacy/chat/:chatId', (req, res) => {
  try {
    if (!aiService) {
      return res.status(503).json({ error: 'AI service not available' });
    }

    const { chatId } = req.params;
    const history = aiService.getChatHistory(chatId);

    if (!history) {
      return res.status(404).json({ error: 'Chat history not found' });
    }

    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get chat history' });
  }
});

app.get('/api/ai/legacy/chats', (req, res) => {
  try {
    if (!aiService) {
      return res.status(503).json({ error: 'AI service not available' });
    }

    const histories = aiService.getAllChatHistories();
    res.json({ total: histories.length, data: histories });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get chat histories' });
  }
});

app.delete('/api/ai/legacy/chat/:chatId', (req, res) => {
  try {
    if (!aiService) {
      return res.status(503).json({ error: 'AI service not available' });
    }

    const { chatId } = req.params;
    const deleted = aiService.deleteChatHistory(chatId);

    if (!deleted) {
      return res.status(404).json({ error: 'Chat history not found' });
    }

    res.json({ message: 'Chat history deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete chat history' });
  }
});

app.post('/api/ai/legacy/analyze-agent', async (req, res) => {
  try {
    if (!aiService) {
      return res.status(503).json({ error: 'AI service not available. Please set OPENROUTER_API_KEY.' });
    }

    const { agentName } = req.body;
    if (!agentName) {
      return res.status(400).json({ error: 'Agent name is required' });
    }

    const analysis = await aiService.analyzeAgent(agentName);
    res.json({ analysis, agentName });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to analyze agent' });
  }
});

// ============================================
// AUTO-START COLLECTOR & REAL-TIME ANALYTICS
// ============================================

async function autoStartServices() {
  console.log('');
  console.log('🚀 Auto-starting services...');
  
  try {
    // 1. Start Collector
    collector = new ForumDatasetCollector(DATASETS_PATH);
    console.log('📦 Collector initialized');
    
    // Initial collection
    console.log('🔄 Running initial data collection...');
    const result = await collector.collectForumData();
    console.log(`✅ Initial collection: ${result.added} new entries, ${result.total} total`);
    
    // Reload analytics after initial collection
    await analyticsService.forceReload();
    
    // Store initial conversations to Supabase
    if (result.added > 0) {
      console.log(`📝 Storing ${result.added} conversations to Supabase...`);
      const conversations = analyticsService.getConversations({ 
        limit: result.added, 
        sortBy: 'recent' 
      });
      
      for (const conv of conversations.data) {
        await realtimeService.storeConversationToDatabase(conv);
      }
      
      console.log(`✅ Stored ${result.added} conversations to Supabase`);
    }
    
    // Start interval collection every 30 seconds
    collectionInterval = setInterval(async () => {
      if (collector) {
        console.log('🔄 Collecting new data from Colosseum API...');
        const collectionResult = await collector.collectForumData();
        
        if (collectionResult.added > 0) {
          console.log(`✅ Collected ${collectionResult.added} new entries, total: ${collectionResult.total}`);
          
          // Reload analytics after collection
          await analyticsService.forceReload();
          
          // Store new conversations to Supabase
          console.log(`📝 Storing ${collectionResult.added} conversations to Supabase...`);
          const conversations = analyticsService.getConversations({ 
            limit: collectionResult.added, 
            sortBy: 'recent' 
          });
          
          for (const conv of conversations.data) {
            await realtimeService.storeConversationToDatabase(conv);
          }
          
          console.log(`✅ Stored ${collectionResult.added} conversations to Supabase`);
        } else {
          console.log('ℹ️  No new data collected');
        }
      }
    }, 30 * 1000); // 30 seconds
    
    console.log('✅ Collector started (30s interval)');
    
    // 2. Start Real-time Analytics
    realtimeService.start();
    console.log('✅ Real-time analytics started (5s update interval)');
    
    // 3. Start Suspicious Pattern Detection
    suspiciousPatternInterval = setInterval(async () => {
      await realtimeService.detectSuspiciousPatterns();
    }, 5 * 60 * 1000); // 5 minutes
    
    console.log('✅ Suspicious pattern detection started (5min interval)');
    console.log('');
    console.log('🎉 All services running automatically!');
    console.log('📊 Data will be collected every 30 seconds');
    console.log('⚡ Analytics updated every 5 seconds');
    console.log('📝 All data stored to Supabase database');
    console.log('');
  } catch (error) {
    console.error('❌ Error auto-starting services:', error);
    console.log('⚠️  Services can be started manually via API endpoints');
  }
}

// ============================================
// START SERVER
// ============================================

app.listen(PORT, async () => {
  console.log(`🚀 Backend running on port ${PORT}`);
  console.log(`📊 Analytics service: ACTIVE (auto-reload every 10s)`);
  console.log(`🌐 Colosseum API: ACTIVE (30s cache)`);
  console.log(`🤖 AI service: ${ragService ? 'ACTIVE (RAG-based)' : 'DISABLED'}`);
  console.log(`⚡ Real-time service: READY (5s update interval, 0.2 RPS)`);
  console.log(`🗄️  Supabase: ${process.env.SUPABASE_URL ? 'CONNECTED' : 'NOT CONFIGURED'}`);
  console.log(`📁 Datasets path: ${DATASETS_PATH}`);
  console.log('');
  console.log('💡 AI now uses RAG - only retrieves from Supabase database');
  
  // Auto-start collector and real-time analytics
  await autoStartServices();
});
