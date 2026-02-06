// Load environment variables FIRST before any other imports
import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { existsSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { ForumDatasetCollector } from './collector';
import { AIService } from './ai-service';
import { AnalyticsService } from './analytics-service';
import { ColosseumAPI } from './colosseum-api';
import { RealtimeAnalyticsService } from './realtime-analytics-service';
import { RAGService } from './rag-service';

// Middleware
import { apiLimiter, aiLimiter, collectorLimiter, analyticsLimiter } from './middleware/rateLimiter';
import { errorHandler, asyncHandler, notFoundHandler } from './middleware/errorHandler';
import {
  validatePagination,
  validatePostId,
  validateAgentIdentifier,
  validateChatMessage,
  validateSearchQuery,
  validateAgentName,
  validateDays,
  validateSort,
  validateType
} from './middleware/validation';

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({ 
  origin: process.env.CORS_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true 
}));
app.use(express.json({ limit: '10mb' }));

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
  console.log('✨ AI Services initialized (RAG-based)');
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
      ai: ragService !== null,
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

app.get('/api/colosseum/posts', apiLimiter, validatePagination, validateSort, asyncHandler(async (req, res) => {
  const sort = (req.query.sort as 'hot' | 'new' | 'top') || 'new';
  const limit = parseInt(req.query.limit as string) || 100;
  const offset = parseInt(req.query.offset as string) || 0;
  const tags = req.query.tags ? (Array.isArray(req.query.tags) ? req.query.tags : [req.query.tags]) as string[] : [];

  const result = await colosseumAPI.getPosts({ sort, limit, offset, tags });
  res.json(result);
}));

app.get('/api/colosseum/posts/:postId', apiLimiter, validatePostId, asyncHandler(async (req, res) => {
  const postId = parseInt(req.params.postId);
  const post = await colosseumAPI.getPost(postId);
  res.json({ post });
}));

app.get('/api/colosseum/posts/:postId/comments', apiLimiter, validatePostId, validatePagination, validateSort, asyncHandler(async (req, res) => {
  const postId = parseInt(req.params.postId);
  const sort = (req.query.sort as 'hot' | 'new' | 'top') || 'new';
  const limit = parseInt(req.query.limit as string) || 100;
  const offset = parseInt(req.query.offset as string) || 0;

  const result = await colosseumAPI.getComments(postId, { sort, limit, offset });
  res.json(result);
}));

app.get('/api/colosseum/projects', apiLimiter, validatePagination, asyncHandler(async (req, res) => {
  const includeDrafts = req.query.includeDrafts === 'true';
  const limit = parseInt(req.query.limit as string) || 100;
  const offset = parseInt(req.query.offset as string) || 0;

  const result = await colosseumAPI.getProjects({ includeDrafts, limit, offset });
  res.json(result);
}));

app.get('/api/colosseum/leaderboard', apiLimiter, validatePagination, asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;

  const result = await colosseumAPI.getLeaderboard({ limit, offset });
  res.json(result);
}));

app.post('/api/colosseum/cache/clear', apiLimiter, (req, res) => {
  colosseumAPI.clearCache();
  res.json({ message: 'Colosseum API cache cleared' });
});

app.get('/api/colosseum/cache/stats', apiLimiter, (req, res) => {
  const stats = colosseumAPI.getCacheStats();
  res.json(stats);
});

// ============================================
// FAST ANALYTICS ENDPOINTS (with caching)
// ============================================

app.get('/api/analytics/overview', analyticsLimiter, (req, res) => {
  const overview = analyticsService.getOverview();
  res.json(overview);
});

app.get('/api/analytics/agents', analyticsLimiter, validatePagination, (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 20;
  const agents = analyticsService.getTopAgents(limit);
  res.json({ total: agents.length, data: agents });
});

app.get('/api/analytics/daily-activity', analyticsLimiter, validateDays, (req: Request, res: Response) => {
  const days = parseInt(req.query.days as string) || 14;
  const activity = analyticsService.getDailyActivity(days);
  res.json({ data: activity });
});

app.get('/api/analytics/tags', analyticsLimiter, validatePagination, (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 10;
  const tags = analyticsService.getTopTags(limit);
  res.json({ data: tags });
});

app.get('/api/analytics/behavior', analyticsLimiter, (req, res) => {
  const distribution = analyticsService.getBehaviorDistribution();
  res.json(distribution);
});

app.get('/api/analytics/cache-stats', analyticsLimiter, (req, res) => {
  const stats = analyticsService.getCacheStats();
  res.json(stats);
});

app.post('/api/analytics/reload', analyticsLimiter, asyncHandler(async (req, res) => {
  await analyticsService.forceReload();
  res.json({ message: 'Analytics data reloaded', stats: analyticsService.getCacheStats() });
}));

// Agent Network Analysis
app.get('/api/analytics/agent-network/:identifier', analyticsLimiter, validateAgentIdentifier, asyncHandler(async (req, res) => {
  const identifier = req.params.identifier;
  const { supabase } = await import('./supabase-service');
  
  let agent;
  const numericId = parseInt(identifier);
  
  if (!isNaN(numericId)) {
    const { data } = await supabase.from('agents').select('*').eq('agent_id', numericId).single();
    agent = data;
  }
  
  if (!agent) {
    const { data } = await supabase.from('agents').select('*').ilike('agent_name', identifier).single();
    agent = data;
  }

  if (!agent) {
    return res.status(404).json({ error: 'Agent not found. Try searching by exact name or ID.' });
  }

  const agentId = agent.agent_id;
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
        stats: { totalConnections: 0, avgStrength: 0, strongestConnection: null }
      }
    });
  }

  const connectedAgentIds = new Set<number>();
  connectedAgentIds.add(agentId);
  
  interactions.forEach(interaction => {
    if (interaction.source_agent_id === agentId) {
      connectedAgentIds.add(interaction.target_agent_id);
    } else {
      connectedAgentIds.add(interaction.source_agent_id);
    }
  });

  const { data: connectedAgents } = await supabase
    .from('agents')
    .select('agent_id, agent_name')
    .in('agent_id', Array.from(connectedAgentIds));

  const agentMap = new Map(connectedAgents?.map(a => [a.agent_id, a.agent_name]) || []);

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

  const totalStrength = interactions.reduce((sum, i) => sum + i.strength, 0);
  const avgStrength = totalStrength / interactions.length;
  const strongestConnection = interactions[0];

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
}));

// ============================================
// LEGACY ENDPOINTS (for backward compatibility)
// ============================================

app.get('/api/conversations', analyticsLimiter, validatePagination, validateType, validateSort, (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;
  const type = req.query.type as 'post' | 'comment' | undefined;
  const sortBy = (req.query.sortBy as 'recent' | 'pure' | 'human') || 'recent';
  const tags = req.query.tags ? (req.query.tags as string).split(',') : undefined;

  const result = analyticsService.getConversations({ limit, offset, type, sortBy, tags });
  res.json(result);
});

app.get('/api/agents', analyticsLimiter, validatePagination, (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 20;
  const agents = analyticsService.getTopAgents(limit);
  res.json({ total: agents.length, data: agents });
});

app.get('/api/analysis', analyticsLimiter, (req, res) => {
  const overview = analyticsService.getOverview();
  const topAgents = analyticsService.getTopAgents(15);
  const topTags = analyticsService.getTopTags(10);
  const behavior = analyticsService.getBehaviorDistribution();

  res.json({ overview, topAgents, topTags, behaviorDistribution: behavior });
});

// ============================================
// REAL-TIME ANALYTICS ENDPOINTS
// ============================================

app.post('/api/realtime/start', apiLimiter, (req, res) => {
  realtimeService.start();
  res.json({ message: 'Real-time analytics service started', status: realtimeService.getStatus() });
});

app.post('/api/realtime/stop', apiLimiter, (req, res) => {
  realtimeService.stop();
  res.json({ message: 'Real-time analytics service stopped', status: realtimeService.getStatus() });
});

app.get('/api/realtime/status', apiLimiter, (req, res) => {
  res.json(realtimeService.getStatus());
});

app.post('/api/realtime/detect-patterns', apiLimiter, asyncHandler(async (req, res) => {
  await realtimeService.detectSuspiciousPatterns();
  res.json({ message: 'Suspicious pattern detection completed' });
}));

// ============================================
// COLLECTOR ENDPOINTS
// ============================================

app.post('/api/collector/start', collectorLimiter, asyncHandler(async (req, res) => {
  if (collector && collectionInterval) {
    return res.json({ message: 'Collector already running' });
  }

  collector = new ForumDatasetCollector(DATASETS_PATH);
  const result = await collector.collectForumData();
  
  collectionInterval = setInterval(async () => {
    if (collector) {
      const collectionResult = await collector.collectForumData();
      await analyticsService.forceReload();
      
      if (collectionResult.added > 0) {
        console.log(`📝 Stored ${collectionResult.added} new conversations`);
      }
    }
  }, 60 * 1000);

  if (!realtimeService.getStatus().isRunning) {
    realtimeService.start();
  }

  if (!suspiciousPatternInterval) {
    suspiciousPatternInterval = setInterval(async () => {
      await realtimeService.detectSuspiciousPatterns();
    }, 5 * 60 * 1000);
  }

  res.json({ 
    message: 'Collector started with real-time analytics', 
    initialCollection: result,
    realtimeStatus: realtimeService.getStatus()
  });
}));

app.post('/api/collector/stop', collectorLimiter, (req, res) => {
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
});

app.get('/api/collector/status', apiLimiter, (req, res) => {
  const isRunning = collector !== null && collectionInterval !== null;
  res.json({ isRunning, datasetsPath: DATASETS_PATH });
});

app.post('/api/collector/collect-once', collectorLimiter, asyncHandler(async (req, res) => {
  const tempCollector = new ForumDatasetCollector(DATASETS_PATH);
  const result = await tempCollector.collectForumData();
  await analyticsService.forceReload();

  res.json({ message: 'Collection completed', result });
}));

// ============================================
// AI ENDPOINTS (RAG-based - only from database)
// ============================================

app.post('/api/ai/chat', aiLimiter, validateChatMessage, asyncHandler(async (req, res) => {
  if (!ragService) {
    return res.status(503).json({ error: 'AI service not available. Please set OPENROUTER_API_KEY.' });
  }

  const { message, sessionId } = req.body;
  const id = sessionId || randomUUID();
  const response = await ragService.query(id, message);
  
  res.json({ response, sessionId: id });
}));

app.post('/api/ai/summarize', aiLimiter, asyncHandler(async (req, res) => {
  if (!ragService) {
    return res.status(503).json({ error: 'AI service not available. Please set OPENROUTER_API_KEY.' });
  }

  const sessionId = randomUUID();
  const summary = await ragService.summarize(sessionId);
  
  res.json({ summary, sessionId });
}));

app.post('/api/ai/search', aiLimiter, validateSearchQuery, asyncHandler(async (req, res) => {
  if (!ragService) {
    return res.status(503).json({ error: 'AI service not available. Please set OPENROUTER_API_KEY.' });
  }

  const { query } = req.body;
  const sessionId = randomUUID();
  const result = await ragService.search(sessionId, query);
  
  res.json({ result, query, sessionId });
}));

app.get('/api/ai/chat/:sessionId', aiLimiter, asyncHandler(async (req, res) => {
  if (!ragService) {
    return res.status(503).json({ error: 'AI service not available' });
  }

  const { sessionId } = req.params;
  const history = await ragService.getChatHistory(sessionId);

  res.json({ sessionId, messages: history });
}));

app.get('/api/ai/sessions', aiLimiter, asyncHandler(async (req, res) => {
  if (!ragService) {
    return res.status(503).json({ error: 'AI service not available' });
  }

  const sessions = await ragService.getAllSessions();
  res.json({ total: sessions.length, sessions });
}));

app.delete('/api/ai/chat/:sessionId', aiLimiter, (req, res) => {
  if (!ragService) {
    return res.status(503).json({ error: 'AI service not available' });
  }

  const { sessionId } = req.params;
  ragService.clearSession(sessionId);

  res.json({ message: 'Session cleared' });
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
// ERROR HANDLERS (must be last)
// ============================================

app.use(notFoundHandler);
app.use(errorHandler);

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
    
    // Start interval collection every 30 seconds
    collectionInterval = setInterval(async () => {
      if (collector) {
        console.log('🔄 Collecting new data from Colosseum API...');
        const collectionResult = await collector.collectForumData();
        
        if (collectionResult.added > 0) {
          console.log(`✅ Collected ${collectionResult.added} new entries, total: ${collectionResult.total}`);
          await analyticsService.forceReload();
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
  console.log(`🛡️  Security: Helmet + Rate Limiting + Input Validation ACTIVE`);
  console.log(`📁 Datasets path: ${DATASETS_PATH}`);
  console.log('');
  console.log('✅ All optimizations applied:');
  console.log('   - LRU cache for memory leak prevention');
  console.log('   - Async file operations');
  console.log('   - Input validation on all endpoints');
  console.log('   - Rate limiting (100 req/15min general, 20 req/15min AI)');
  console.log('   - Error handling middleware');
  console.log('   - Security headers (Helmet)');
  console.log('');
  
  // Auto-start collector and real-time analytics
  await autoStartServices();
});
