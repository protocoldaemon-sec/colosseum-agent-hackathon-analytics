-- ============================================================================
-- FIX: Drop and recreate functions with correct column references
-- ============================================================================

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS update_agent_interaction() CASCADE;
DROP FUNCTION IF EXISTS detect_suspicious_patterns() CASCADE;
DROP FUNCTION IF EXISTS update_agent_growth() CASCADE;

-- ============================================================================
-- Function untuk update interaction strength (FIXED)
-- ============================================================================
CREATE OR REPLACE FUNCTION update_agent_interaction()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if there's a reply_to_agent
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

-- ============================================================================
-- Function untuk detect suspicious patterns (FIXED)
-- ============================================================================
CREATE OR REPLACE FUNCTION detect_suspicious_patterns()
RETURNS void AS $$
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

-- ============================================================================
-- Function untuk update growth tracking (FIXED)
-- ============================================================================
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
-- Create trigger for auto-update interactions
-- ============================================================================
DROP TRIGGER IF EXISTS trigger_update_agent_interaction ON conversations;
CREATE TRIGGER trigger_update_agent_interaction
  AFTER INSERT ON conversations
  FOR EACH ROW
  WHEN (NEW.reply_to_agent IS NOT NULL)
  EXECUTE FUNCTION update_agent_interaction();

-- ============================================================================
-- DONE
-- ============================================================================
