import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Initialize Supabase client with service role for write operations
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey);

// ============================================================================
// AGENT OPERATIONS
// ============================================================================

export async function upsertAgent(agent: {
  agent_id: number;
  agent_name: string;
  x_username?: string;
  x_profile_image_url?: string;
  total_messages?: number;
  posts_count?: number;
  comments_count?: number;
  avg_pure_score?: number;
  avg_human_score?: number;
  first_seen?: string;
  last_seen?: string;
}) {
  const { data, error } = await supabase
    .from('agents')
    .upsert(agent, { onConflict: 'agent_id' })
    .select()
    .single();
  
  if (error) console.error('Error upserting agent:', error);
  return { data, error };
}

// ============================================================================
// CONVERSATION OPERATIONS
// ============================================================================

export async function storeConversation(conversation: {
  conversation_id: number;
  type: 'post' | 'comment';
  agent_id: number;
  content: string;
  title?: string;
  post_id?: number;
  upvotes?: number;
  downvotes?: number;
  score?: number;
  pure_agent_score?: number;
  human_control_score?: number;
  analysis_reason?: string;
  reply_to_agent?: string;
  thread_depth?: number;
  response_time?: number;
  created_at: string;
}) {
  const { data, error } = await supabase
    .from('conversations')
    .upsert(conversation, { onConflict: 'conversation_id' })
    .select()
    .single();
  
  if (error) console.error('Error storing conversation:', error);
  return { data, error };
}

// ============================================================================
// AGENT INTERACTION TRACKING
// ============================================================================

export async function trackInteraction(
  sourceAgentId: number,
  targetAgentId: number,
  interactionType: 'reply' | 'mention' | 'collaboration' | 'upvote',
  conversationId?: number
) {
  const { data, error } = await supabase
    .from('agent_interactions')
    .upsert({
      source_agent_id: sourceAgentId,
      target_agent_id: targetAgentId,
      interaction_type: interactionType,
      conversation_id: conversationId,
      last_interaction: new Date().toISOString()
    }, {
      onConflict: 'source_agent_id,target_agent_id,interaction_type',
      ignoreDuplicates: false
    });
  
  if (error) console.error('Error tracking interaction:', error);
  return { data, error };
}

// ============================================================================
// REAL-TIME METRICS UPDATE (Target: 1ms latency)
// ============================================================================

export async function updateRealtimeMetric(
  metricType: string,
  value: any
) {
  const startTime = Date.now();
  
  const { data, error } = await supabase
    .from('realtime_metrics')
    .update({
      value,
      updated_at: new Date().toISOString()
    })
    .eq('metric_type', metricType);
  
  const latency = Date.now() - startTime;
  if (latency > 10) {
    console.warn(`Metric update latency: ${latency}ms (target: 1ms)`);
  }
  
  if (error) console.error('Error updating metric:', error);
  return { data, error, latency };
}

// Batch update multiple metrics at once
export async function updateMultipleMetrics(metrics: Array<{
  metric_type: string;
  value: any;
}>) {
  const startTime = Date.now();
  
  const updates = metrics.map(m => ({
    metric_type: m.metric_type,
    value: m.value,
    updated_at: new Date().toISOString()
  }));
  
  const { data, error } = await supabase
    .from('realtime_metrics')
    .upsert(updates, { onConflict: 'metric_type' });
  
  const latency = Date.now() - startTime;
  console.log(`Batch metric update: ${latency}ms for ${metrics.length} metrics`);
  
  if (error) console.error('Error batch updating metrics:', error);
  return { data, error, latency };
}

// ============================================================================
// SUSPICIOUS PATTERN DETECTION
// ============================================================================

export async function runSuspiciousPatternDetection() {
  const { data, error } = await supabase.rpc('detect_suspicious_patterns');
  
  if (error) {
    console.error('Error running pattern detection:', error);
  } else {
    console.log('Suspicious pattern detection completed');
  }
  
  return { data, error };
}

export async function getSuspiciousPatterns(status: string = 'active') {
  const { data, error } = await supabase
    .from('suspicious_patterns')
    .select('*')
    .eq('status', status)
    .order('detected_at', { ascending: false });
  
  if (error) console.error('Error fetching suspicious patterns:', error);
  return { data, error };
}

// ============================================================================
// GROWTH TRACKING
// ============================================================================

export async function updateGrowthTracking() {
  const { data, error } = await supabase.rpc('update_agent_growth');
  
  if (error) {
    console.error('Error updating growth tracking:', error);
  } else {
    console.log('Growth tracking updated');
  }
  
  return { data, error };
}

export async function getInorganicGrowthAgents() {
  const { data, error } = await supabase
    .from('agent_growth_tracking')
    .select('*')
    .eq('is_organic', false)
    .gte('growth_rate', 500)
    .order('growth_rate', { ascending: false });
  
  if (error) console.error('Error fetching inorganic growth:', error);
  return { data, error };
}

// ============================================================================
// NETWORK GRAPH DATA
// ============================================================================

export async function getNetworkGraphData(minStrength: number = 3) {
  const { data, error } = await supabase
    .from('agent_interactions')
    .select('*')
    .gte('strength', minStrength)
    .order('strength', { ascending: false });
  
  if (error) {
    console.error('Error fetching network data:', error);
    return { data: null, error };
  }
  
  // Transform to graph format
  const nodes = new Set<number>();
  const edges: Array<{
    source: number;
    target: number;
    weight: number;
    type: string;
  }> = [];
  
  data?.forEach(interaction => {
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
    data: {
      nodes: Array.from(nodes).map(id => ({ id })),
      edges
    },
    error: null
  };
}

// ============================================================================
// ANALYTICS QUERIES
// ============================================================================

export async function getTopAgents(limit: number = 10) {
  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .order('total_messages', { ascending: false })
    .limit(limit);
  
  if (error) console.error('Error fetching top agents:', error);
  return { data, error };
}

export async function getMostCommentsAgents(limit: number = 10) {
  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .order('comments_count', { ascending: false })
    .limit(limit);
  
  if (error) console.error('Error fetching top commenters:', error);
  return { data, error };
}

export async function getMostPostsAgents(limit: number = 10) {
  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .order('posts_count', { ascending: false })
    .limit(limit);
  
  if (error) console.error('Error fetching top posters:', error);
  return { data, error };
}

// ============================================================================
// REAL-TIME METRICS CALCULATOR
// ============================================================================

export async function calculateAndUpdateAllMetrics() {
  const startTime = Date.now();
  
  // Fetch all necessary data in parallel
  const [
    topAgentsResult,
    topCommentersResult,
    topPostersResult,
    networkResult
  ] = await Promise.all([
    getTopAgents(10),
    getMostCommentsAgents(10),
    getMostPostsAgents(10),
    getNetworkGraphData(3)
  ]);
  
  // Calculate summary stats
  const { data: allAgents } = await supabase
    .from('agents')
    .select('total_messages, posts_count, comments_count, avg_pure_score, avg_human_score');
  
  const summaryStats = {
    total_agents: allAgents?.length || 0,
    total_messages: allAgents?.reduce((sum, a) => sum + (a.total_messages || 0), 0) || 0,
    total_posts: allAgents?.reduce((sum, a) => sum + (a.posts_count || 0), 0) || 0,
    total_comments: allAgents?.reduce((sum, a) => sum + (a.comments_count || 0), 0) || 0,
    avg_pure_score: (allAgents?.reduce((sum, a) => sum + (a.avg_pure_score || 0), 0) || 0) / (allAgents?.length || 1),
    avg_human_score: (allAgents?.reduce((sum, a) => sum + (a.avg_human_score || 0), 0) || 0) / (allAgents?.length || 1)
  };
  
  // Batch update all metrics
  await updateMultipleMetrics([
    { metric_type: 'top_agents', value: topAgentsResult.data },
    { metric_type: 'most_comments_agents', value: topCommentersResult.data },
    { metric_type: 'most_posts_agents', value: topPostersResult.data },
    { metric_type: 'network_graph', value: networkResult.data },
    { metric_type: 'summary_stats', value: summaryStats }
  ]);
  
  const totalTime = Date.now() - startTime;
  console.log(`All metrics updated in ${totalTime}ms`);
  
  return { success: true, latency: totalTime };
}

// ============================================================================
// SCHEDULED TASKS
// ============================================================================

// Run every 1ms (adjust based on performance)
export function startRealtimeMetricsLoop() {
  setInterval(async () => {
    await calculateAndUpdateAllMetrics();
  }, 1); // 1ms interval
}

// Run every 5 minutes
export function startSuspiciousPatternDetection() {
  setInterval(async () => {
    await runSuspiciousPatternDetection();
  }, 5 * 60 * 1000); // 5 minutes
}

// Run daily at midnight
export function startDailyGrowthTracking() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  const msUntilMidnight = tomorrow.getTime() - now.getTime();
  
  setTimeout(() => {
    updateGrowthTracking();
    // Then run every 24 hours
    setInterval(updateGrowthTracking, 24 * 60 * 60 * 1000);
  }, msUntilMidnight);
}
