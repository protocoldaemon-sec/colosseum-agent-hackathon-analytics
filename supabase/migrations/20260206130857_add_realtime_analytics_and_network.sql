-- ============================================================================
-- REAL-TIME ANALYTICS & NETWORK ANALYSIS SCHEMA
-- Untuk deteksi pattern mencurigakan dan network graph
-- ============================================================================

-- ============================================================================
-- AGENT_INTERACTIONS TABLE
-- Track semua interaksi antar agent (replies, mentions, collaborations)
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_interactions (
  id BIGSERIAL PRIMARY KEY,
  source_agent_id INTEGER NOT NULL,
  target_agent_id INTEGER NOT NULL,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('reply', 'mention', 'collaboration', 'upvote')),
  conversation_id BIGINT,
  strength INTEGER DEFAULT 1, -- Jumlah interaksi
  first_interaction TIMESTAMPTZ DEFAULT NOW(),
  last_interaction TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_agent_id, target_agent_id, interaction_type)
);

-- ============================================================================
-- SUSPICIOUS_PATTERNS TABLE
-- Deteksi pattern mencurigakan (bot networks, coordinated behavior, dll)
-- ============================================================================
CREATE TABLE IF NOT EXISTS suspicious_patterns (
  id BIGSERIAL PRIMARY KEY,
  pattern_type TEXT NOT NULL CHECK (pattern_type IN (
    'coordinated_posting',      -- Posting bersamaan
    'rapid_interaction',        -- Interaksi terlalu cepat
    'identical_behavior',       -- Behavior pattern identik
    'network_cluster',          -- Cluster network mencurigakan
    'inorganic_growth',         -- Pertumbuhan tidak organik
    'spam_pattern',             -- Pattern spam
    'vote_manipulation'         -- Manipulasi voting
  )),
  agent_ids INTEGER[] NOT NULL,  -- Array agent IDs yang terlibat
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  confidence_score NUMERIC(5,2) NOT NULL, -- 0-100
  description TEXT NOT NULL,
  evidence JSONB,                -- Data pendukung
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'investigating', 'resolved', 'false_positive')),
  resolved_at TIMESTAMPTZ,
  notes TEXT
);

-- ============================================================================
-- AGENT_ACTIVITY_TIMELINE TABLE
-- Timeline aktivitas per agent untuk deteksi pattern
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_activity_timeline (
  id BIGSERIAL PRIMARY KEY,
  agent_id INTEGER NOT NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('post', 'comment', 'upvote', 'downvote')),
  activity_hour INTEGER NOT NULL, -- 0-23
  activity_day_of_week INTEGER NOT NULL, -- 0-6 (Sunday-Saturday)
  count INTEGER DEFAULT 1,
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, activity_type, activity_hour, activity_day_of_week)
);

-- ============================================================================
-- REALTIME_METRICS TABLE
-- Metrics real-time yang di-update setiap 1ms (via backend)
-- ============================================================================
CREATE TABLE IF NOT EXISTS realtime_metrics (
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
  ('network_graph', '{}'::jsonb)
ON CONFLICT (metric_type) DO NOTHING;

-- ============================================================================
-- AGENT_GROWTH_TRACKING TABLE
-- Track pertumbuhan agent untuk deteksi inorganic growth
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_growth_tracking (
  id BIGSERIAL PRIMARY KEY,
  agent_id INTEGER NOT NULL,
  date DATE NOT NULL,
  total_messages INTEGER DEFAULT 0,
  total_posts INTEGER DEFAULT 0,
  total_comments INTEGER DEFAULT 0,
  total_upvotes INTEGER DEFAULT 0,
  total_downvotes INTEGER DEFAULT 0,
  new_interactions INTEGER DEFAULT 0, -- Interaksi dengan agent baru
  growth_rate NUMERIC(10,2), -- Persentase pertumbuhan
  is_organic BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, date)
);

-- ============================================================================
-- NETWORK_CLUSTERS TABLE
-- Identifikasi cluster/komunitas dalam network graph
-- ============================================================================
CREATE TABLE IF NOT EXISTS network_clusters (
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
-- INDEXES untuk Performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_agent_interactions_source ON agent_interactions(source_agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_interactions_target ON agent_interactions(target_agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_interactions_type ON agent_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_agent_interactions_strength ON agent_interactions(strength DESC);
CREATE INDEX IF NOT EXISTS idx_suspicious_patterns_severity ON suspicious_patterns(severity);
CREATE INDEX IF NOT EXISTS idx_suspicious_patterns_status ON suspicious_patterns(status);
CREATE INDEX IF NOT EXISTS idx_suspicious_patterns_detected ON suspicious_patterns(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_activity_timeline_agent ON agent_activity_timeline(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_growth_tracking_agent ON agent_growth_tracking(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_growth_tracking_date ON agent_growth_tracking(date DESC);
CREATE INDEX IF NOT EXISTS idx_realtime_metrics_type ON realtime_metrics(metric_type);

-- ============================================================================
-- FUNCTIONS untuk Auto-Update
-- ============================================================================

-- Function untuk update interaction strength
CREATE OR REPLACE FUNCTION update_agent_interaction()
RETURNS TRIGGER AS $$
BEGIN
  -- Update atau insert interaction record
  INSERT INTO agent_interactions (
    source_agent_id,
    target_agent_id,
    interaction_type,
    conversation_id,
    strength,
    last_interaction
  ) VALUES (
    NEW.agent_id,
    CASE 
      WHEN NEW.reply_to_agent IS NOT NULL THEN 
        (SELECT agent_id FROM agents WHERE agent_name = NEW.reply_to_agent LIMIT 1)
      ELSE NULL
    END,
    'reply',
    NEW.id,
    1,
    NEW.created_at
  )
  ON CONFLICT (source_agent_id, target_agent_id, interaction_type)
  DO UPDATE SET
    strength = agent_interactions.strength + 1,
    last_interaction = NEW.created_at;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function untuk detect suspicious patterns
CREATE OR REPLACE FUNCTION detect_suspicious_patterns()
RETURNS void AS $$
DECLARE
  suspicious_agents INTEGER[];
BEGIN
  -- Deteksi coordinated posting (posting dalam waktu < 5 detik)
  INSERT INTO suspicious_patterns (pattern_type, agent_ids, severity, confidence_score, description, evidence)
  SELECT 
    'coordinated_posting',
    array_agg(DISTINCT agent_id),
    'medium',
    75.0,
    'Multiple agents posting within 5 seconds',
    jsonb_build_object(
      'time_window', '5 seconds',
      'agent_count', count(DISTINCT agent_id)
    )
  FROM conversations
  WHERE created_at > NOW() - INTERVAL '1 hour'
  GROUP BY date_trunc('second', created_at)
  HAVING count(DISTINCT agent_id) >= 3
  ON CONFLICT DO NOTHING;
  
  -- Deteksi rapid interaction (response time < 2 detik)
  INSERT INTO suspicious_patterns (pattern_type, agent_ids, severity, confidence_score, description, evidence)
  SELECT 
    'rapid_interaction',
    array_agg(DISTINCT agent_id),
    'low',
    60.0,
    'Unusually fast response times detected',
    jsonb_build_object(
      'avg_response_time', avg(response_time),
      'min_response_time', min(response_time)
    )
  FROM conversations
  WHERE response_time < 2 AND response_time IS NOT NULL
  GROUP BY agent_id
  HAVING count(*) >= 5
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Function untuk update growth tracking
CREATE OR REPLACE FUNCTION update_agent_growth()
RETURNS void AS $$
BEGIN
  INSERT INTO agent_growth_tracking (
    agent_id,
    date,
    total_messages,
    total_posts,
    total_comments,
    total_upvotes,
    total_downvotes,
    new_interactions
  )
  SELECT 
    a.agent_id,
    CURRENT_DATE,
    a.total_messages,
    a.posts_count,
    a.comments_count,
    COALESCE(SUM(c.upvotes), 0),
    COALESCE(SUM(c.downvotes), 0),
    (SELECT COUNT(DISTINCT target_agent_id) 
     FROM agent_interactions 
     WHERE source_agent_id = a.agent_id 
     AND DATE(first_interaction) = CURRENT_DATE)
  FROM agents a
  LEFT JOIN conversations c ON c.agent_id = a.agent_id
  GROUP BY a.agent_id, a.total_messages, a.posts_count, a.comments_count
  ON CONFLICT (agent_id, date) 
  DO UPDATE SET
    total_messages = EXCLUDED.total_messages,
    total_posts = EXCLUDED.total_posts,
    total_comments = EXCLUDED.total_comments,
    total_upvotes = EXCLUDED.total_upvotes,
    total_downvotes = EXCLUDED.total_downvotes,
    new_interactions = EXCLUDED.new_interactions;
    
  -- Calculate growth rate
  UPDATE agent_growth_tracking agt
  SET growth_rate = (
    CASE 
      WHEN prev.total_messages > 0 THEN
        ((agt.total_messages - prev.total_messages)::NUMERIC / prev.total_messages) * 100
      ELSE 0
    END
  ),
  is_organic = (
    CASE 
      WHEN prev.total_messages > 0 AND 
           ((agt.total_messages - prev.total_messages)::NUMERIC / prev.total_messages) * 100 > 500 
      THEN false
      ELSE true
    END
  )
  FROM (
    SELECT agent_id, total_messages, date
    FROM agent_growth_tracking
    WHERE date = CURRENT_DATE - INTERVAL '1 day'
  ) prev
  WHERE agt.agent_id = prev.agent_id 
  AND agt.date = CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger untuk auto-update interactions saat ada conversation baru (akan dibuat setelah tabel conversations ada)
-- DROP TRIGGER IF EXISTS trigger_update_agent_interaction ON conversations;
-- CREATE TRIGGER trigger_update_agent_interaction
--   AFTER INSERT ON conversations
--   FOR EACH ROW
--   WHEN (NEW.reply_to_agent IS NOT NULL)
--   EXECUTE FUNCTION update_agent_interaction();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE agent_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE suspicious_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_activity_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE realtime_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_growth_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE network_clusters ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public read agent_interactions" ON agent_interactions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read suspicious_patterns" ON suspicious_patterns FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read agent_activity_timeline" ON agent_activity_timeline FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read realtime_metrics" ON realtime_metrics FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read agent_growth_tracking" ON agent_growth_tracking FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read network_clusters" ON network_clusters FOR SELECT TO anon, authenticated USING (true);

-- Service role full access
CREATE POLICY "Service full agent_interactions" ON agent_interactions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service full suspicious_patterns" ON suspicious_patterns FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service full agent_activity_timeline" ON agent_activity_timeline FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service full realtime_metrics" ON realtime_metrics FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service full agent_growth_tracking" ON agent_growth_tracking FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service full network_clusters" ON network_clusters FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- ENABLE REALTIME
-- Aktifkan Supabase Realtime untuk semua tabel
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE agent_interactions;
ALTER PUBLICATION supabase_realtime ADD TABLE suspicious_patterns;
ALTER PUBLICATION supabase_realtime ADD TABLE realtime_metrics;
ALTER PUBLICATION supabase_realtime ADD TABLE agent_growth_tracking;
ALTER PUBLICATION supabase_realtime ADD TABLE network_clusters;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE agent_interactions IS 'Track all agent-to-agent interactions for network analysis';
COMMENT ON TABLE suspicious_patterns IS 'Detected suspicious behavior patterns and bot networks';
COMMENT ON TABLE agent_activity_timeline IS 'Agent activity patterns by hour and day for anomaly detection';
COMMENT ON TABLE realtime_metrics IS 'Real-time metrics updated every 1ms via backend';
COMMENT ON TABLE agent_growth_tracking IS 'Daily agent growth tracking for organic vs inorganic detection';
COMMENT ON TABLE network_clusters IS 'Identified clusters/communities in agent network graph';
