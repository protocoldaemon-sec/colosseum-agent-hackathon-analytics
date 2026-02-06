-- ============================================================================
-- BASE TABLES FOR COLOSSEUM AGENT ANALYTICS
-- ============================================================================

-- ============================================================================
-- AGENTS TABLE
-- Store agent profiles and statistics
-- ============================================================================
CREATE TABLE IF NOT EXISTS agents (
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
-- Store all posts and comments
-- ============================================================================
CREATE TABLE IF NOT EXISTS conversations (
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
-- Store conversation tags
-- ============================================================================
CREATE TABLE IF NOT EXISTS tags (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- CONVERSATION_TAGS TABLE
-- Many-to-many relationship between conversations and tags
-- ============================================================================
CREATE TABLE IF NOT EXISTS conversation_tags (
  id BIGSERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL,
  tag_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(conversation_id, tag_name)
);

-- ============================================================================
-- AI_CHAT_HISTORY TABLE
-- Store AI assistant chat history
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_chat_history (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ANALYTICS_SNAPSHOTS TABLE
-- Store periodic analytics snapshots
-- ============================================================================
CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id BIGSERIAL PRIMARY KEY,
  snapshot_type TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_agents_agent_id ON agents(agent_id);
CREATE INDEX IF NOT EXISTS idx_agents_agent_name ON agents(agent_name);
CREATE INDEX IF NOT EXISTS idx_agents_total_messages ON agents(total_messages DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_conversation_id ON conversations(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversations_agent_id ON conversations(agent_id);
CREATE INDEX IF NOT EXISTS idx_conversations_type ON conversations(type);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_tags_conversation_id ON conversation_tags(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_tags_tag_name ON conversation_tags(tag_name);
CREATE INDEX IF NOT EXISTS idx_ai_chat_history_session_id ON ai_chat_history(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_history_created_at ON ai_chat_history(created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_snapshots ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public read agents" ON agents FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read conversations" ON conversations FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read tags" ON tags FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read conversation_tags" ON conversation_tags FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read ai_chat_history" ON ai_chat_history FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read analytics_snapshots" ON analytics_snapshots FOR SELECT TO anon, authenticated USING (true);

-- Service role full access
CREATE POLICY "Service full agents" ON agents FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service full conversations" ON conversations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service full tags" ON tags FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service full conversation_tags" ON conversation_tags FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service full ai_chat_history" ON ai_chat_history FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service full analytics_snapshots" ON analytics_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- ENABLE REALTIME
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE agents;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE tags;
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_tags;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE agents IS 'Agent profiles and statistics';
COMMENT ON TABLE conversations IS 'All forum posts and comments';
COMMENT ON TABLE tags IS 'Conversation tags/topics';
COMMENT ON TABLE conversation_tags IS 'Many-to-many relationship between conversations and tags';
COMMENT ON TABLE ai_chat_history IS 'AI assistant chat history';
COMMENT ON TABLE analytics_snapshots IS 'Periodic analytics snapshots';
