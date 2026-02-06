-- ============================================================================
-- COMPLETE SCHEMA RESET AND RECREATION
-- This will drop all existing tables and recreate them properly
-- ============================================================================

-- Drop all existing tables (if they exist)
DROP TABLE IF EXISTS conversation_tags CASCADE;
DROP TABLE IF EXISTS ai_chat_history CASCADE;
DROP TABLE IF EXISTS analytics_snapshots CASCADE;
DROP TABLE IF EXISTS network_clusters CASCADE;
DROP TABLE IF EXISTS agent_growth_tracking CASCADE;
DROP TABLE IF EXISTS realtime_metrics CASCADE;
DROP TABLE IF EXISTS agent_activity_timeline CASCADE;
DROP TABLE IF EXISTS suspicious_patterns CASCADE;
DROP TABLE IF EXISTS agent_interactions CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS tags CASCADE;
DROP TABLE IF EXISTS agents CASCADE;

-- Drop all functions
DROP FUNCTION IF EXISTS update_agent_interaction() CASCADE;
DROP FUNCTION IF EXISTS detect_suspicious_patterns() CASCADE;
DROP FUNCTION IF EXISTS update_agent_growth() CASCADE;

-- ============================================================================
-- AGENTS TABLE
-- ============================================================================
CREATE TABLE agents (
  id BIGSERIAL PRIMARY KEY,
  agent_id INTEGER UNIQUE NOT NULL,
  agent_name TEXT NOT NULL,
  x_username TEXT,
  x_profile_image_url TEXT,
  total_messages INTEGER DEFAULT 0,
  posts_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  avg_pure_score NUMERIC(5,2) DEFAULT 0,
  avg_human_score NUMERIC(5,2) DEFAULT 0,
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- CONVERSATIONS TABLE
-- ============================================================================
CREATE TABLE conversations (
  id BIGSERIAL PRIMARY KEY,
  conversation_id INTEGER UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('post', 'comment')),
  agent_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  title TEXT,
  post_id INTEGER,
  upvotes INTEGER DEFAULT 0,
  downvotes INTEGER DEFAULT 0,
  score INTEGER DEFAULT 0,
  pure_agent_score NUMERIC(5,2),
  human_control_score NUMERIC(5,2),
  analysis_reason TEXT,
  reply_to_agent TEXT,
  thread_depth INTEGER,
  response_time INTEGER,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TAGS TABLE
-- ============================================================================
CREATE TABLE tags (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- CONVERSATION_TAGS TABLE
-- ============================================================================
CREATE TABLE conversation_tags (
  id BIGSERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL,
  tag_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(conversation_id, tag_name)
);

-- ============================================================================
-- AI_CHAT_HISTORY TABLE
-- ============================================================================
CREATE TABLE ai_chat_history (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ANALYTICS_SNAPSHOTS TABLE
-- ============================================================================
CREATE TABLE analytics_snapshots (
  id BIGSERIAL PRIMARY KEY,
  snapshot_type TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- AGENT_INTERACTIONS TABLE
-- ============================================================================
CREATE TABLE agent_interactions (
  id BIGSERIAL PRIMARY KEY,
  source_agent_id INTEGER NOT NULL,
  target_agent_id INTEGER NOT NULL,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('reply', 'mention', 'collaboration', 'upvote')),
  conversation_id BIGINT,
  strength INTEGER DEFAULT 1,
  first_interaction TIMESTAMPTZ DEFAULT NOW(),
  last_interaction TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_agent_id, target_agent_id, interaction_type)
);

-- ============================================================================
-- SUSPICIOUS_PATTERNS TABLE
-- ============================================================================
CREATE TABLE suspicious_patterns (
  id BIGSERIAL PRIMARY KEY,
  pattern_type TEXT NOT NULL CHECK (pattern_type IN (
    'coordinated_posting',
    'rapid_interaction',
    'identical_behavior',
    'network_cluster',
    'inorganic_growth',
    'spam_pattern',
    'vote_manipulation'
  )),
  agent_ids INTEGER[] NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  confidence_score NUMERIC(5,2) NOT NULL,
  description TEXT NOT NULL,
  evidence JSONB,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'investigating', 'resolved', 'false_positive')),
  resolved_at TIMESTAMPTZ,
  notes TEXT
);

-- ============================================================================
-- AGENT_ACTIVITY_TIMELINE TABLE
-- ============================================================================
CREATE TABLE agent_activity_timeline (
  id BIGSERIAL PRIMARY KEY,
  agent_id INTEGER NOT NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('post', 'comment', 'upvote', 'downvote')),
  activity_hour INTEGER NOT NULL,
  activity_day_of_week INTEGER NOT NULL,
  count INTEGER DEFAULT 1,
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, activity_type, activity_hour, activity_day_of_week)
);

-- ============================================================================
-- REALTIME_METRICS TABLE
-- ============================================================================
CREATE TABLE realtime_metrics (
  id SERIAL PRIMARY KEY,
  metric_type TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert initial metrics
INSERT INTO realtime_metrics (metric_type, value) VALUES
  ('top_agents', '[]'::jsonb),
  ('daily_activity', '[]'::jsonb),
  ('top_10_agents_activity', '[]'::jsonb),
  ('agent_behavior_distribution', '{}'::jsonb),
  ('agent_score_comparison', '[]'::jsonb),
  ('top_tags', '[]'::jsonb),
  ('summary_stats', '{}'::jsonb),
  ('most_comments_agents', '[]'::jsonb),
  ('most_posts_agents', '[]'::jsonb),
  ('network_graph', '{}'::jsonb);

-- ============================================================================
-- AGENT_GROWTH_TRACKING TABLE
-- ============================================================================
CREATE TABLE agent_growth_tracking (
  id BIGSERIAL PRIMARY KEY,
  agent_id INTEGER NOT NULL,
  date DATE NOT NULL,
  total_messages INTEGER DEFAULT 0,
  total_posts INTEGER DEFAULT 0,
  total_comments INTEGER DEFAULT 0,
  total_upvotes INTEGER DEFAULT 0,
  total_downvotes INTEGER DEFAULT 0,
  new_interactions INTEGER DEFAULT 0,
  growth_rate NUMERIC(10,2),
  is_organic BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, date)
);

-- ============================================================================
-- NETWORK_CLUSTERS TABLE
-- ============================================================================
CREATE TABLE network_clusters (
  id SERIAL PRIMARY KEY,
  cluster_name TEXT,
  agent_ids INTEGER[] NOT NULL,
  cluster_size INTEGER NOT NULL,
  avg_interaction_strength NUMERIC(10,2),
  is_suspicious BOOLEAN DEFAULT false,
  suspicion_reason TEXT,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX idx_agents_agent_id ON agents(agent_id);
CREATE INDEX idx_agents_agent_name ON agents(agent_name);
CREATE INDEX idx_agents_total_messages ON agents(total_messages DESC);
CREATE INDEX idx_conversations_conversation_id ON conversations(conversation_id);
CREATE INDEX idx_conversations_agent_id ON conversations(agent_id);
CREATE INDEX idx_conversations_type ON conversations(type);
CREATE INDEX idx_conversations_created_at ON conversations(created_at DESC);
CREATE INDEX idx_conversation_tags_conversation_id ON conversation_tags(conversation_id);
CREATE INDEX idx_conversation_tags_tag_name ON conversation_tags(tag_name);
CREATE INDEX idx_ai_chat_history_session_id ON ai_chat_history(session_id);
CREATE INDEX idx_ai_chat_history_created_at ON ai_chat_history(created_at DESC);
CREATE INDEX idx_agent_interactions_source ON agent_interactions(source_agent_id);
CREATE INDEX idx_agent_interactions_target ON agent_interactions(target_agent_id);
CREATE INDEX idx_agent_interactions_type ON agent_interactions(interaction_type);
CREATE INDEX idx_agent_interactions_strength ON agent_interactions(strength DESC);
CREATE INDEX idx_suspicious_patterns_severity ON suspicious_patterns(severity);
CREATE INDEX idx_suspicious_patterns_status ON suspicious_patterns(status);
CREATE INDEX idx_suspicious_patterns_detected ON suspicious_patterns(detected_at DESC);
CREATE INDEX idx_agent_activity_timeline_agent ON agent_activity_timeline(agent_id);
CREATE INDEX idx_agent_growth_tracking_agent ON agent_growth_tracking(agent_id);
CREATE INDEX idx_agent_growth_tracking_date ON agent_growth_tracking(date DESC);
CREATE INDEX idx_realtime_metrics_type ON realtime_metrics(metric_type);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE suspicious_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_activity_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE realtime_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_growth_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE network_clusters ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public read agents" ON agents FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read conversations" ON conversations FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read tags" ON tags FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read conversation_tags" ON conversation_tags FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read ai_chat_history" ON ai_chat_history FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read analytics_snapshots" ON analytics_snapshots FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read agent_interactions" ON agent_interactions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read suspicious_patterns" ON suspicious_patterns FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read agent_activity_timeline" ON agent_activity_timeline FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read realtime_metrics" ON realtime_metrics FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read agent_growth_tracking" ON agent_growth_tracking FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read network_clusters" ON network_clusters FOR SELECT TO anon, authenticated USING (true);

-- Service role full access
CREATE POLICY "Service full agents" ON agents FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service full conversations" ON conversations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service full tags" ON tags FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service full conversation_tags" ON conversation_tags FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service full ai_chat_history" ON ai_chat_history FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service full analytics_snapshots" ON analytics_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service full agent_interactions" ON agent_interactions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service full suspicious_patterns" ON suspicious_patterns FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service full agent_activity_timeline" ON agent_activity_timeline FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service full realtime_metrics" ON realtime_metrics FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service full agent_growth_tracking" ON agent_growth_tracking FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service full network_clusters" ON network_clusters FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- ENABLE REALTIME
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE agents;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE tags;
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_tags;
ALTER PUBLICATION supabase_realtime ADD TABLE agent_interactions;
ALTER PUBLICATION supabase_realtime ADD TABLE suspicious_patterns;
ALTER PUBLICATION supabase_realtime ADD TABLE realtime_metrics;
ALTER PUBLICATION supabase_realtime ADD TABLE agent_growth_tracking;
ALTER PUBLICATION supabase_realtime ADD TABLE network_clusters;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_agent_interaction()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.reply_to_agent IS NOT NULL THEN
    INSERT INTO agent_interactions (
      source_agent_id,
      target_agent_id,
      interaction_type,
      conversation_id,
      strength,
      last_interaction
    ) VALUES (
      NEW.agent_id,
      (SELECT agent_id FROM agents WHERE agent_name = NEW.reply_to_agent LIMIT 1),
      'reply',
      NEW.conversation_id,
      1,
      NEW.created_at
    )
    ON CONFLICT (source_agent_id, target_agent_id, interaction_type)
    DO UPDATE SET
      strength = agent_interactions.strength + 1,
      last_interaction = NEW.created_at;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_agent_interaction
  AFTER INSERT ON conversations
  FOR EACH ROW
  WHEN (NEW.reply_to_agent IS NOT NULL)
  EXECUTE FUNCTION update_agent_interaction();

-- ============================================================================
-- DONE
-- ============================================================================
