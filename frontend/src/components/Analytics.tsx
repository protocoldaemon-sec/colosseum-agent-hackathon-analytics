import { motion } from 'framer-motion';
import { Agent, Conversation, Analysis } from '../App';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { requestNotificationPermission, useRealtimeMetrics } from '../hooks/useRealtimeMetrics';
import { useEffect, useMemo, memo } from 'react';

interface AnalyticsProps {
  agents: Agent[];
  conversations: Conversation[];
  analysis: Analysis | null;
}

const COLORS = ['#393E46', '#929AAB', '#10b981', '#f59e0b', '#06b6d4', '#ec4899'];

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
  hidden: { opacity: 0, scale: 0.9 },
  show: { opacity: 1, scale: 1 }
};

function Analytics({ agents, conversations, analysis }: AnalyticsProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const isDark = theme === 'dark';

  // Use real-time metrics for dynamic data
  const { data: realtimeAgents } = useRealtimeMetrics('top_agents');
  const { data: dailyActivity } = useRealtimeMetrics('daily_activity');
  const { data: topTags } = useRealtimeMetrics('top_tags');

  // Request notification permission on mount
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  const chartColors = {
    grid: isDark ? '#4a4f5a' : '#EEEEEE',
    text: isDark ? '#929AAB' : '#393E46',
    tooltip: isDark ? '#2a2e35' : '#FFFFFF',
    tooltipBorder: isDark ? '#4a4f5a' : '#EEEEEE'
  };

  // Use real-time data if available, fallback to props
  const currentAgents = realtimeAgents || agents;

  // Memoize all chart data transformations to prevent recalculation on every render
  const topAgentsData = useMemo(() => 
    currentAgents.slice(0, 10).map((agent: any) => ({
      name: agent.agentName?.length > 12 ? agent.agentName.substring(0, 12) + '...' : agent.agentName || agent.agent_name?.substring(0, 12) + '...' || 'Unknown',
      messages: agent.totalMessages || agent.total_messages || 0,
      posts: agent.posts || agent.posts_count || 0,
      comments: agent.comments || agent.comments_count || 0
    })),
    [currentAgents]
  );

  const activityData = useMemo(() => {
    // Use real-time daily activity if available
    if (dailyActivity && Array.isArray(dailyActivity) && dailyActivity.length > 0) {
      return dailyActivity.slice(-14).map((day: any) => ({
        date: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        total: day.total || 0,
        posts: day.posts || 0,
        comments: day.comments || 0
      }));
    }
    
    // Fallback to conversations data
    return conversations.reduce((acc: any[], conv) => {
      const date = new Date(conv.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const existing = acc.find(item => item.date === date);
      if (existing) {
        existing.total++;
        if (conv.type === 'post') existing.posts++;
        else existing.comments++;
      } else {
        acc.push({
          date,
          total: 1,
          posts: conv.type === 'post' ? 1 : 0,
          comments: conv.type === 'comment' ? 1 : 0
        });
      }
      return acc;
    }, []).slice(-14);
  }, [dailyActivity, conversations]);

  const tagCounts = useMemo(() => {
    // Use real-time tags if available
    if (topTags && Array.isArray(topTags) && topTags.length > 0) {
      return topTags.reduce((acc: any, tag: any) => {
        acc[tag.tag || tag.name] = tag.count;
        return acc;
      }, {});
    }
    
    // Fallback to conversations data
    return conversations.reduce((acc: any, conv) => {
      if (conv.tags) {
        conv.tags.forEach(tag => {
          acc[tag] = (acc[tag] || 0) + 1;
        });
      }
      return acc;
    }, {});
  }, [topTags, conversations]);

  const topTagsData = useMemo(() => 
    Object.entries(tagCounts)
      .sort((a: any, b: any) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count })),
    [tagCounts]
  );

  const agentScoreData = useMemo(() => 
    currentAgents.slice(0, 10).map((agent: any) => ({
      name: agent.agentName?.length > 10 ? agent.agentName.substring(0, 10) + '...' : agent.agentName || agent.agent_name?.substring(0, 10) + '...' || 'Unknown',
      pure: agent.avgPureScore || agent.avg_pure_score || 0,
      human: agent.avgHumanScore || agent.avg_human_score || 0
    })),
    [currentAgents]
  );

  return (
    <div className="analytics">
      <motion.h2
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <span className="material-symbols-outlined size-32">analytics</span>
        {t('analytics.title') || 'Analytics Dashboard'}
      </motion.h2>

      <motion.div 
        className="charts-grid"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {/* Activity Timeline - Stacked Bar Chart */}
        <motion.div className="chart-card full-width" variants={item}>
          <h3>
            <span className="material-symbols-outlined size-20">bar_chart</span>
            Daily Activity Volume (Last 14 Days)
          </h3>
          <p className="chart-description">
            Track daily agent activity trends showing posts and comments over the past two weeks. Stacked bars reveal the composition of activity types per day.
          </p>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={activityData} margin={{ top: 20, right: 30, left: 20, bottom: 70 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
              <XAxis 
                dataKey="date" 
                stroke={chartColors.text} 
                style={{ fontSize: '12px', fontWeight: 600 }}
                angle={-45}
                textAnchor="end"
                height={90}
              />
              <YAxis 
                stroke={chartColors.text} 
                style={{ fontSize: '13px', fontWeight: 500 }}
                label={{ 
                  value: 'Activities', 
                  angle: -90, 
                  position: 'insideLeft', 
                  style: { fill: chartColors.text, fontSize: '13px', fontWeight: 700 } 
                }}
              />
              <Tooltip 
                contentStyle={{ 
                  background: chartColors.tooltip, 
                  border: `1px solid ${chartColors.tooltipBorder}`,
                  borderRadius: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  padding: '12px'
                }}
                labelStyle={{ color: chartColors.text, fontWeight: 700, marginBottom: '8px' }}
                cursor={{ fill: 'rgba(57, 62, 70, 0.05)' }}
              />
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="circle"
              />
              <Bar 
                dataKey="posts" 
                stackId="a"
                fill="#10b981" 
                name="Posts" 
                radius={[0, 0, 0, 0]}
                barSize={40}
              />
              <Bar 
                dataKey="comments" 
                stackId="a"
                fill="#06b6d4" 
                name="Comments" 
                radius={[8, 8, 0, 0]}
                barSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Top Agents by Activity */}
        <motion.div className="chart-card" variants={item}>
          <h3>
            <span className="material-symbols-outlined size-20">leaderboard</span>
            Top 10 Agents by Activity
          </h3>
          <p className="chart-description">
            Compare the most active agents by their post and comment contributions. Grouped bars show the breakdown of each agent's activity type.
          </p>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={topAgentsData}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
              <XAxis dataKey="name" stroke={chartColors.text} style={{ fontSize: '11px' }} angle={-45} textAnchor="end" height={80} />
              <YAxis stroke={chartColors.text} style={{ fontSize: '12px' }} />
              <Tooltip 
                contentStyle={{ 
                  background: chartColors.tooltip, 
                  border: `1px solid ${chartColors.tooltipBorder}`,
                  borderRadius: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}
                labelStyle={{ color: chartColors.text, fontWeight: 600 }}
              />
              <Legend />
              <Bar dataKey="posts" fill="#10b981" name="Posts" radius={[8, 8, 0, 0]} />
              <Bar dataKey="comments" fill="#06b6d4" name="Comments" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Most Discussed Topics by Agents */}
        <motion.div className="chart-card" variants={item}>
          <h3>
            <span className="material-symbols-outlined size-20">pie_chart</span>
            Most Discussed Topics by Agents
          </h3>
          <p className="chart-description">
            Distribution of topics most frequently discussed by agents based on conversation tags. Shows which categories agents are most engaged with.
          </p>
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={topTagsData.slice(0, 8)}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ tag, count }) => `${tag}: ${count}`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="count"
              >
                {topTagsData.slice(0, 8).map((_entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  background: chartColors.tooltip, 
                  border: `1px solid ${chartColors.tooltipBorder}`,
                  borderRadius: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Agent Score Comparison */}
        <motion.div className="chart-card full-width" variants={item}>
          <h3>
            <span className="material-symbols-outlined size-20">compare_arrows</span>
            Agent Score Comparison (Pure vs Human Control)
          </h3>
          <p className="chart-description">
            Compare pure agent scores versus human control scores for top agents. Line trends reveal behavioral patterns and autonomy levels.
          </p>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={agentScoreData}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
              <XAxis dataKey="name" stroke={chartColors.text} style={{ fontSize: '11px' }} angle={-45} textAnchor="end" height={80} />
              <YAxis stroke={chartColors.text} style={{ fontSize: '12px' }} domain={[0, 100]} />
              <Tooltip 
                contentStyle={{ 
                  background: chartColors.tooltip, 
                  border: `1px solid ${chartColors.tooltipBorder}`,
                  borderRadius: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}
                labelStyle={{ color: chartColors.text, fontWeight: 600 }}
              />
              <Legend />
              <Line type="monotone" dataKey="pure" stroke="#10b981" strokeWidth={3} name="Pure Agent Score" dot={{ r: 5 }} activeDot={{ r: 7 }} />
              <Line type="monotone" dataKey="human" stroke="#ef4444" strokeWidth={3} name="Human Control Score" dot={{ r: 5 }} activeDot={{ r: 7 }} />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Top Tags */}
        <motion.div className="chart-card full-width" variants={item}>
          <h3>
            <span className="material-symbols-outlined size-20">label</span>
            Top 10 Tags
          </h3>
          <p className="chart-description">
            Discover the most popular conversation topics and categories. Horizontal bars rank tags by frequency of use across all conversations.
          </p>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={topTagsData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
              <XAxis type="number" stroke={chartColors.text} style={{ fontSize: '12px' }} />
              <YAxis dataKey="tag" type="category" stroke={chartColors.text} width={120} style={{ fontSize: '11px' }} />
              <Tooltip 
                contentStyle={{ 
                  background: chartColors.tooltip, 
                  border: `1px solid ${chartColors.tooltipBorder}`,
                  borderRadius: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}
                labelStyle={{ color: chartColors.text, fontWeight: 600 }}
              />
              <Bar dataKey="count" fill="#929AAB" name="Count" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </motion.div>

      <motion.div 
        className="stats-summary"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <h3>
          <span className="material-symbols-outlined size-24">summarize</span>
          Summary Statistics
        </h3>
        <div className="summary-grid">
          <motion.div 
            className="summary-item"
            whileHover={{ scale: 1.05 }}
          >
            <span className="summary-label">Avg Pure Score</span>
            <span className="summary-value">
              {conversations.length > 0 ? (conversations.reduce((sum, c) => sum + c.pureAgentScore, 0) / conversations.length).toFixed(1) : 0}%
            </span>
          </motion.div>
          <motion.div 
            className="summary-item"
            whileHover={{ scale: 1.05 }}
          >
            <span className="summary-label">Avg Human Score</span>
            <span className="summary-value">
              {conversations.length > 0 ? (conversations.reduce((sum, c) => sum + c.humanControlScore, 0) / conversations.length).toFixed(1) : 0}%
            </span>
          </motion.div>
          <motion.div 
            className="summary-item"
            whileHover={{ scale: 1.05 }}
          >
            <span className="summary-label">Most Active Agent</span>
            <span className="summary-value" style={{ fontSize: '1.25rem' }}>
              {currentAgents[0]?.agentName || currentAgents[0]?.agent_name || 'N/A'}
            </span>
          </motion.div>
          <motion.div 
            className="summary-item"
            whileHover={{ scale: 1.05 }}
          >
            <span className="summary-label">Total Messages</span>
            <span className="summary-value">
              {currentAgents.reduce((sum, agent) => sum + (agent.totalMessages || agent.total_messages || 0), 0).toLocaleString()}
            </span>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

export default memo(Analytics);
