import { motion } from 'framer-motion';
import { useSuspiciousPatterns } from '../hooks/useRealtimeMetrics';
import { useTheme } from '../context/ThemeContext';

const item = {
  hidden: { opacity: 0, scale: 0.9 },
  show: { opacity: 1, scale: 1 }
};

function SuspiciousPatternsCard() {
  const { patterns, loading } = useSuspiciousPatterns();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return '#ef4444';
      case 'high': return '#f59e0b';
      case 'medium': return '#eab308';
      case 'low': return '#06b6d4';
      default: return '#929AAB';
    }
  };

  const getPatternIcon = (type: string) => {
    switch (type) {
      case 'coordinated_posting': return 'group_work';
      case 'rapid_interaction': return 'speed';
      case 'inorganic_growth': return 'trending_up';
      case 'network_cluster': return 'hub';
      case 'spam_pattern': return 'report';
      case 'vote_manipulation': return 'how_to_vote';
      default: return 'warning';
    }
  };

  if (loading) {
    return (
      <motion.div className="chart-card full-width" variants={item}>
        <h3>
          <span className="material-symbols-outlined size-20">security</span>
          Suspicious Patterns Detected
        </h3>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <span className="material-symbols-outlined size-48" style={{ opacity: 0.3 }}>
            progress_activity
          </span>
          <p style={{ marginTop: '1rem', opacity: 0.6 }}>Loading patterns...</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div className="chart-card full-width" variants={item}>
      <h3>
        <span className="material-symbols-outlined size-20">security</span>
        Suspicious Patterns Detected
        {patterns.length > 0 && (
          <span className="badge" style={{ 
            background: '#ef4444', 
            color: 'white',
            marginLeft: '0.5rem',
            padding: '0.25rem 0.75rem',
            borderRadius: '12px',
            fontSize: '0.875rem',
            fontWeight: 600
          }}>
            {patterns.length}
          </span>
        )}
      </h3>
      <p className="chart-description">
        Real-time detection of suspicious agent behaviors including coordinated posting, rapid interactions, inorganic growth, and network clustering. Patterns are automatically flagged based on confidence scores.
      </p>

      {patterns.length === 0 ? (
        <div style={{ 
          padding: '3rem 2rem', 
          textAlign: 'center',
          background: isDark ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.05)',
          borderRadius: '12px',
          border: `2px dashed ${isDark ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.2)'}`
        }}>
          <span className="material-symbols-outlined size-64" style={{ color: '#10b981', opacity: 0.6 }}>
            verified_user
          </span>
          <h4 style={{ marginTop: '1rem', color: '#10b981' }}>No Suspicious Patterns Detected</h4>
          <p style={{ marginTop: '0.5rem', opacity: 0.7 }}>
            All agent activities appear normal. System is monitoring continuously.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
          {patterns.map((pattern, index) => (
            <motion.div
              key={pattern.id || index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              style={{
                padding: '1.25rem',
                background: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)',
                borderRadius: '12px',
                border: `2px solid ${getSeverityColor(pattern.severity)}`,
                position: 'relative'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                <span 
                  className="material-symbols-outlined size-32" 
                  style={{ color: getSeverityColor(pattern.severity) }}
                >
                  {getPatternIcon(pattern.pattern_type)}
                </span>
                
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <h4 style={{ margin: 0, fontSize: '1.125rem' }}>
                      {pattern.pattern_type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                    </h4>
                    <span style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      background: getSeverityColor(pattern.severity),
                      color: 'white'
                    }}>
                      {pattern.severity}
                    </span>
                    <span style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: isDark ? 'rgba(146, 154, 171, 0.2)' : 'rgba(146, 154, 171, 0.1)',
                      color: '#929AAB'
                    }}>
                      {pattern.confidence_score}% confidence
                    </span>
                  </div>
                  
                  <p style={{ margin: '0.5rem 0', opacity: 0.9 }}>
                    {pattern.description}
                  </p>
                  
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '1rem',
                    marginTop: '0.75rem',
                    fontSize: '0.875rem',
                    opacity: 0.7
                  }}>
                    <span>
                      <strong>Agents:</strong> {pattern.agent_ids.join(', ')}
                    </span>
                    <span>
                      <strong>Detected:</strong> {new Date(pattern.detected_at).toLocaleString()}
                    </span>
                  </div>

                  {pattern.evidence && (
                    <details style={{ marginTop: '0.75rem' }}>
                      <summary style={{ 
                        cursor: 'pointer', 
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        opacity: 0.8
                      }}>
                        View Evidence
                      </summary>
                      <pre style={{
                        marginTop: '0.5rem',
                        padding: '0.75rem',
                        background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        overflow: 'auto'
                      }}>
                        {JSON.stringify(pattern.evidence, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

export default SuspiciousPatternsCard;
