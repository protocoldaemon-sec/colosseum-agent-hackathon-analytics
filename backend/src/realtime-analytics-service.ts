import { supabase, updateMultipleMetrics, trackInteraction, upsertAgent, storeConversation } from './supabase-service';
import { AnalyticsService } from './analytics-service';
import type { ConversationEntry } from './types';

export class RealtimeAnalyticsService {
  private analyticsService: AnalyticsService;
  private updateInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private updateLatency: number[] = [];

  constructor(analyticsService: AnalyticsService) {
    this.analyticsService = analyticsService;
  }

  // Start real-time updates (optimal: 5 seconds interval)
  // This balances real-time feel with API/database performance
  start() {
    if (this.isRunning) {
      console.log('⚠️  Real-time service already running');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Starting real-time analytics service (5s update interval)');
    console.log('📊 Optimal RPS: 0.2 (1 update per 5 seconds)');

    // Update metrics every 5 seconds (0.2 RPS)
    // This ensures:
    // - Analytics data always fresh
    // - Supabase can handle this load easily
    // - Frontend gets real-time updates
    // - No connection timeouts
    // - Efficient database usage
    this.updateInterval = setInterval(async () => {
      await this.updateAllMetrics();
    }, 5000); // 5 seconds

    // Initial update immediately
    this.updateAllMetrics();

    // Log performance every 30 seconds
    setInterval(() => {
      if (this.updateLatency.length > 0) {
        const avg = this.updateLatency.reduce((a, b) => a + b, 0) / this.updateLatency.length;
        const max = Math.max(...this.updateLatency);
        const min = Math.min(...this.updateLatency);
        console.log(`📊 Latency stats - Avg: ${avg.toFixed(2)}ms, Min: ${min}ms, Max: ${max}ms`);
        this.updateLatency = []; // Reset
      }
    }, 30000);
  }

  stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.isRunning = false;
    console.log('🛑 Real-time analytics service stopped');
  }

  // Update all metrics in one batch
  private async updateAllMetrics() {
    const startTime = Date.now();

    try {
      // Get all data from analytics service (cached, so fast)
      const [
        overview,
        topAgents,
        dailyActivity,
        topTags,
        behavior,
        topCommenters,
        topPosters
      ] = await Promise.all([
        Promise.resolve(this.analyticsService.getOverview()),
        Promise.resolve(this.analyticsService.getTopAgents(10)),
        Promise.resolve(this.analyticsService.getDailyActivity(14)),
        Promise.resolve(this.analyticsService.getTopTags(10)),
        Promise.resolve(this.analyticsService.getBehaviorDistribution()),
        Promise.resolve(this.analyticsService.getTopAgents(10).sort((a, b) => b.comments - a.comments)),
        Promise.resolve(this.analyticsService.getTopAgents(10).sort((a, b) => b.posts - a.posts))
      ]);

      // Calculate score comparison
      const scoreComparison = topAgents.map(agent => ({
        agentName: agent.agentName,
        pureScore: agent.avgPureScore,
        humanScore: agent.avgHumanScore
      }));

      // Get network graph data
      const { data: networkData } = await supabase
        .from('agent_interactions')
        .select('*')
        .gte('strength', 3)
        .limit(100);

      const networkGraph = this.transformToNetworkGraph(networkData || []);

      // Batch update all metrics
      const { latency } = await updateMultipleMetrics([
        { metric_type: 'top_agents', value: topAgents },
        { metric_type: 'daily_activity', value: dailyActivity },
        { metric_type: 'top_10_agents_activity', value: topAgents },
        { metric_type: 'agent_behavior_distribution', value: behavior },
        { metric_type: 'agent_score_comparison', value: scoreComparison },
        { metric_type: 'top_tags', value: topTags },
        { metric_type: 'summary_stats', value: overview },
        { metric_type: 'most_comments_agents', value: topCommenters },
        { metric_type: 'most_posts_agents', value: topPosters },
        { metric_type: 'network_graph', value: networkGraph }
      ]);

      const totalLatency = Date.now() - startTime;
      this.updateLatency.push(totalLatency);

      // Warn if latency exceeds 3 seconds (reasonable threshold for 5s interval)
      if (totalLatency > 3000) {
        console.warn(`⚠️  High latency: ${totalLatency}ms (threshold: 3000ms)`);
      }
    } catch (error) {
      console.error('❌ Error updating metrics:', error);
    }
  }

  // Transform interaction data to network graph format
  private transformToNetworkGraph(interactions: any[]) {
    const nodes = new Set<number>();
    const edges: Array<{
      source: number;
      target: number;
      weight: number;
      type: string;
    }> = [];

    interactions.forEach(interaction => {
      nodes.add(interaction.source_agent_id);
      nodes.add(interaction.target_agent_id);
      edges.push({
        source: interaction.source_agent_id,
        target: interaction.target_agent_id,
        weight: interaction.strength,
        type: interaction.interaction_type
      });
    });

    return {
      nodes: Array.from(nodes).map(id => ({ id })),
      edges,
      lastUpdate: new Date().toISOString()
    };
  }

  // Store conversation to database and track interactions
  async storeConversationToDatabase(conversation: ConversationEntry) {
    try {
      // 1. Upsert agent
      await upsertAgent({
        agent_id: conversation.agentId,
        agent_name: conversation.agentName,
        x_username: conversation.agentClaim?.xUsername,
        x_profile_image_url: conversation.agentClaim?.xProfileImageUrl,
        last_seen: conversation.createdAt
      });

      // 2. Store conversation
      await storeConversation({
        conversation_id: conversation.id,
        type: conversation.type,
        agent_id: conversation.agentId,
        content: conversation.content,
        title: conversation.title,
        post_id: conversation.postId,
        upvotes: conversation.upvotes,
        downvotes: conversation.downvotes,
        score: conversation.score,
        pure_agent_score: conversation.pureAgentScore,
        human_control_score: conversation.humanControlScore,
        analysis_reason: conversation.analysisReason,
        reply_to_agent: conversation.conversationContext?.replyToAgent,
        thread_depth: conversation.conversationContext?.threadDepth,
        response_time: conversation.conversationContext?.responseTime,
        created_at: conversation.createdAt
      });

      // 3. Track interaction if it's a reply
      if (conversation.conversationContext?.replyToAgent) {
        // Get target agent ID
        const { data: targetAgent } = await supabase
          .from('agents')
          .select('agent_id')
          .eq('agent_name', conversation.conversationContext.replyToAgent)
          .single();

        if (targetAgent) {
          await trackInteraction(
            conversation.agentId,
            targetAgent.agent_id,
            'reply',
            conversation.id
          );
        }
      }

      // 4. Store tags
      if (conversation.tags && conversation.tags.length > 0) {
        for (const tagName of conversation.tags) {
          // Upsert tag
          const { data: tag } = await supabase
            .from('tags')
            .upsert({ name: tagName }, { onConflict: 'name' })
            .select()
            .single();

          if (tag) {
            // Get conversation DB id
            const { data: conv } = await supabase
              .from('conversations')
              .select('id')
              .eq('conversation_id', conversation.id)
              .single();

            if (conv) {
              // Link tag to conversation
              await supabase
                .from('conversation_tags')
                .upsert({
                  conversation_id: conv.id,
                  tag_id: tag.id
                }, { onConflict: 'conversation_id,tag_id' });
            }
          }
        }
      }

      // 5. Update agent statistics
      await this.updateAgentStatistics(conversation.agentId);

    } catch (error) {
      console.error('❌ Error storing conversation to database:', error);
    }
  }

  // Update agent statistics after new conversation
  private async updateAgentStatistics(agentId: number) {
    try {
      // Get all conversations for this agent
      const { data: conversations } = await supabase
        .from('conversations')
        .select('*')
        .eq('agent_id', agentId);

      if (!conversations || conversations.length === 0) return;

      const totalMessages = conversations.length;
      const posts = conversations.filter(c => c.type === 'post').length;
      const comments = conversations.filter(c => c.type === 'comment').length;
      
      const avgPureScore = conversations.reduce((sum, c) => sum + (c.pure_agent_score || 0), 0) / totalMessages;
      const avgHumanScore = conversations.reduce((sum, c) => sum + (c.human_control_score || 0), 0) / totalMessages;

      const firstSeen = conversations.reduce((min, c) => {
        const date = new Date(c.created_at);
        return date < min ? date : min;
      }, new Date(conversations[0].created_at));

      const lastSeen = conversations.reduce((max, c) => {
        const date = new Date(c.created_at);
        return date > max ? date : max;
      }, new Date(conversations[0].created_at));

      // Update agent
      await supabase
        .from('agents')
        .update({
          total_messages: totalMessages,
          posts_count: posts,
          comments_count: comments,
          avg_pure_score: avgPureScore,
          avg_human_score: avgHumanScore,
          first_seen: firstSeen.toISOString(),
          last_seen: lastSeen.toISOString()
        })
        .eq('agent_id', agentId);

    } catch (error) {
      console.error('❌ Error updating agent statistics:', error);
    }
  }

  // Detect suspicious patterns
  async detectSuspiciousPatterns() {
    try {
      console.log('🔍 Running suspicious pattern detection...');
      
      // 1. Detect coordinated posting (multiple agents posting within 5 seconds)
      await this.detectCoordinatedPosting();
      
      // 2. Detect rapid interactions (response time < 2 seconds)
      await this.detectRapidInteractions();
      
      // 3. Detect inorganic growth (growth rate > 500%)
      await this.detectInorganicGrowth();
      
      // 4. Detect suspicious network clusters
      await this.detectSuspiciousClusters();
      
      console.log('✅ Suspicious pattern detection completed');
    } catch (error) {
      console.error('❌ Error detecting suspicious patterns:', error);
    }
  }

  private async detectCoordinatedPosting() {
    const { data: recentConversations } = await supabase
      .from('conversations')
      .select('*')
      .gte('created_at', new Date(Date.now() - 3600000).toISOString()) // Last hour
      .order('created_at', { ascending: true });

    if (!recentConversations || recentConversations.length < 3) return;

    // Group by 5-second windows
    const windows = new Map<number, number[]>();
    
    recentConversations.forEach(conv => {
      const timestamp = new Date(conv.created_at).getTime();
      const windowKey = Math.floor(timestamp / 5000); // 5-second windows
      
      if (!windows.has(windowKey)) {
        windows.set(windowKey, []);
      }
      windows.get(windowKey)!.push(conv.agent_id);
    });

    // Find windows with 3+ different agents
    for (const [windowKey, agentIds] of windows.entries()) {
      const uniqueAgents = [...new Set(agentIds)];
      
      if (uniqueAgents.length >= 3) {
        await supabase
          .from('suspicious_patterns')
          .insert({
            pattern_type: 'coordinated_posting',
            agent_ids: uniqueAgents,
            severity: 'medium',
            confidence_score: 75,
            description: `${uniqueAgents.length} agents posted within 5 seconds`,
            evidence: {
              window_start: new Date(windowKey * 5000).toISOString(),
              agent_count: uniqueAgents.length
            }
          });
      }
    }
  }

  private async detectRapidInteractions() {
    const { data: rapidResponses } = await supabase
      .from('conversations')
      .select('*')
      .lt('response_time', 2)
      .not('response_time', 'is', null)
      .gte('created_at', new Date(Date.now() - 3600000).toISOString());

    if (!rapidResponses || rapidResponses.length < 5) return;

    // Group by agent
    const agentResponses = new Map<number, number[]>();
    
    rapidResponses.forEach(conv => {
      if (!agentResponses.has(conv.agent_id)) {
        agentResponses.set(conv.agent_id, []);
      }
      agentResponses.get(conv.agent_id)!.push(conv.response_time);
    });

    // Flag agents with 5+ rapid responses
    for (const [agentId, responseTimes] of agentResponses.entries()) {
      if (responseTimes.length >= 5) {
        const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
        
        await supabase
          .from('suspicious_patterns')
          .insert({
            pattern_type: 'rapid_interaction',
            agent_ids: [agentId],
            severity: 'low',
            confidence_score: 60,
            description: `Agent has ${responseTimes.length} responses under 2 seconds`,
            evidence: {
              avg_response_time: avgResponseTime,
              rapid_response_count: responseTimes.length
            }
          });
      }
    }
  }

  private async detectInorganicGrowth() {
    const { data: growthData } = await supabase
      .from('agent_growth_tracking')
      .select('*')
      .eq('is_organic', false)
      .gte('growth_rate', 500)
      .order('growth_rate', { ascending: false });

    if (!growthData || growthData.length === 0) return;

    for (const growth of growthData) {
      await supabase
        .from('suspicious_patterns')
        .insert({
          pattern_type: 'inorganic_growth',
          agent_ids: [growth.agent_id],
          severity: 'high',
          confidence_score: 85,
          description: `Agent growth rate: ${growth.growth_rate.toFixed(1)}% (threshold: 500%)`,
          evidence: {
            growth_rate: growth.growth_rate,
            date: growth.date,
            total_messages: growth.total_messages
          }
        });
    }
  }

  private async detectSuspiciousClusters() {
    // Get strong interactions (strength >= 10)
    const { data: strongInteractions } = await supabase
      .from('agent_interactions')
      .select('*')
      .gte('strength', 10);

    if (!strongInteractions || strongInteractions.length < 3) return;

    // Simple clustering: find groups of agents with mutual strong interactions
    const clusters = this.findClusters(strongInteractions);

    for (const cluster of clusters) {
      if (cluster.size >= 3) {
        const avgStrength = cluster.totalStrength / cluster.interactionCount;
        
        await supabase
          .from('suspicious_patterns')
          .insert({
            pattern_type: 'network_cluster',
            agent_ids: Array.from(cluster.agents),
            severity: cluster.size >= 5 ? 'high' : 'medium',
            confidence_score: Math.min(95, 60 + (cluster.size * 5)),
            description: `Detected cluster of ${cluster.size} agents with strong mutual interactions`,
            evidence: {
              cluster_size: cluster.size,
              avg_interaction_strength: avgStrength,
              total_interactions: cluster.interactionCount
            }
          });

        // Also store in network_clusters table
        await supabase
          .from('network_clusters')
          .insert({
            cluster_name: `Cluster-${Date.now()}`,
            agent_ids: Array.from(cluster.agents),
            cluster_size: cluster.size,
            avg_interaction_strength: avgStrength,
            is_suspicious: true,
            suspicion_reason: 'High mutual interaction strength'
          });
      }
    }
  }

  private findClusters(interactions: any[]) {
    const graph = new Map<number, Set<number>>();
    
    // Build adjacency list
    interactions.forEach(interaction => {
      if (!graph.has(interaction.source_agent_id)) {
        graph.set(interaction.source_agent_id, new Set());
      }
      if (!graph.has(interaction.target_agent_id)) {
        graph.set(interaction.target_agent_id, new Set());
      }
      graph.get(interaction.source_agent_id)!.add(interaction.target_agent_id);
      graph.get(interaction.target_agent_id)!.add(interaction.source_agent_id);
    });

    const visited = new Set<number>();
    const clusters: Array<{
      agents: Set<number>;
      size: number;
      totalStrength: number;
      interactionCount: number;
    }> = [];

    // DFS to find connected components
    const dfs = (node: number, cluster: Set<number>) => {
      visited.add(node);
      cluster.add(node);
      
      const neighbors = graph.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor, cluster);
        }
      }
    };

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        const cluster = new Set<number>();
        dfs(node, cluster);
        
        // Calculate cluster metrics
        const clusterInteractions = interactions.filter(i =>
          cluster.has(i.source_agent_id) && cluster.has(i.target_agent_id)
        );
        
        const totalStrength = clusterInteractions.reduce((sum, i) => sum + i.strength, 0);
        
        clusters.push({
          agents: cluster,
          size: cluster.size,
          totalStrength,
          interactionCount: clusterInteractions.length
        });
      }
    }

    return clusters;
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      avgLatency: this.updateLatency.length > 0
        ? this.updateLatency.reduce((a, b) => a + b, 0) / this.updateLatency.length
        : 0,
      latencySamples: this.updateLatency.length
    };
  }
}
