import { motion } from 'framer-motion';
import { Agent, Analysis } from '../App';
import { useLanguage } from '../context/LanguageContext';
import { useRealtimeMetrics } from '../hooks/useRealtimeMetrics';
import CountUp from './ui/CountUp';
import SpotlightCard from './ui/SpotlightCard';
import { useMemo, memo } from 'react';

interface DashboardProps {
  agents: Agent[];
  analysis: Analysis | null;
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

function Dashboard({ agents, analysis }: DashboardProps) {
  const { t } = useLanguage();
  
  // Use real-time metrics for summary stats
  const { data: realtimeStats } = useRealtimeMetrics('summary_stats');
  const { data: realtimeTopAgents } = useRealtimeMetrics('top_agents');
  
  // Use real-time data if available, fallback to props
  const summaryStats = realtimeStats || analysis?.overview;
  
  // Memoize displayAgents to prevent unnecessary recalculations
  const displayAgents = useMemo(() => 
    (realtimeTopAgents || agents).slice(0, 6),
    [realtimeTopAgents, agents]
  );

  // Memoize stats array to prevent recreation on every render
  const stats = useMemo(() => [
    { icon: 'description', value: summaryStats?.totalEntries || 0, label: t('dashboard.totalEntries'), color: '#393E46' },
    { icon: 'article', value: summaryStats?.totalPosts || 0, label: t('dashboard.posts'), color: '#929AAB' },
    { icon: 'chat_bubble', value: summaryStats?.totalComments || 0, label: t('dashboard.comments'), color: '#10b981' },
    { icon: 'smart_toy', value: summaryStats?.uniqueAgents || 0, label: t('dashboard.uniqueAgents'), color: '#06b6d4' }
  ], [summaryStats, t]);

  return (
    <div className="dashboard">
      <motion.div 
        className="stats-grid"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {stats.map((stat, index) => (
          <motion.div 
            key={index}
            variants={item}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
          >
            <SpotlightCard className="stat-card">
              <div className="stat-icon">
                <span className="material-symbols-outlined size-48" style={{ color: stat.color }}>{stat.icon}</span>
              </div>
              <div className="stat-content">
                <motion.h3
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 + index * 0.1 }}
                >
                  <CountUp end={stat.value} duration={1500} separator="," />
                </motion.h3>
                <p>{stat.label}</p>
              </div>
            </SpotlightCard>
          </motion.div>
        ))}
      </motion.div>

      <div className="section">
        <motion.h2
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <span className="material-symbols-outlined size-32" style={{ display: 'inline-flex' }}>emoji_events</span>
          Top Agents by Activity
        </motion.h2>
        <p style={{ opacity: 0.7, marginTop: '0.5rem', marginBottom: '1rem', fontSize: '0.9rem' }}>
          Ranked by total messages (posts + comments) from collected forum data
        </p>
        <motion.div 
          className="agent-grid"
          variants={container}
          initial="hidden"
          animate="show"
        >
          {displayAgents.map((agent: Agent, index: number) => (
            <SpotlightCard key={agent.agentId}>
              <motion.div 
                className="agent-card"
                variants={item}
                whileHover={{ y: -4, scale: 1.02 }}
                transition={{ duration: 0.2 }}
              >
              <motion.div 
                className="agent-rank"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3 + index * 0.05, type: "spring" }}
              >
                #{index + 1}
              </motion.div>
              <h3>{agent.agentName}</h3>
              <div className="agent-stats">
                <div className="stat-item">
                  <span className="label">{t('dashboard.messages')}</span>
                  <span className="value">
                    <CountUp end={agent.totalMessages} duration={1000} separator="," />
                  </span>
                </div>
                <div className="stat-item">
                  <span className="label">{t('dashboard.posts')}</span>
                  <span className="value">
                    <CountUp end={agent.posts} duration={1000} separator="," />
                  </span>
                </div>
                <div className="stat-item">
                  <span className="label">{t('dashboard.comments')}</span>
                  <span className="value">
                    <CountUp end={agent.comments} duration={1000} separator="," />
                  </span>
                </div>
              </div>
              <div className="score-bars">
                <div className="score-bar">
                  <div className="score-label">
                    <span>{t('dashboard.pureAgent')}</span>
                    <span className="score-value">{agent.avgPureScore.toFixed(1)}%</span>
                  </div>
                  <div className="progress-bar">
                    <motion.div 
                      className="progress-fill pure"
                      initial={{ width: 0 }}
                      animate={{ width: `${agent.avgPureScore}%` }}
                      transition={{ delay: 0.5 + index * 0.05, duration: 0.8 }}
                    />
                  </div>
                </div>
                <div className="score-bar">
                  <div className="score-label">
                    <span>{t('dashboard.humanControl')}</span>
                    <span className="score-value">{agent.avgHumanScore.toFixed(1)}%</span>
                  </div>
                  <div className="progress-bar">
                    <motion.div 
                      className="progress-fill human"
                      initial={{ width: 0 }}
                      animate={{ width: `${agent.avgHumanScore}%` }}
                      transition={{ delay: 0.5 + index * 0.05, duration: 0.8 }}
                    />
                  </div>
                </div>
              </div>
              {agent.tags && agent.tags.length > 0 && (
                <div className="agent-tags">
                  {agent.tags.slice(0, 3).map((tag: string, i: number) => (
                    <motion.span 
                      key={tag} 
                      className="tag"
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.7 + index * 0.05 + i * 0.05 }}
                    >
                      {tag}
                    </motion.span>
                  ))}
                </div>
              )}
              </motion.div>
            </SpotlightCard>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

export default memo(Dashboard);
