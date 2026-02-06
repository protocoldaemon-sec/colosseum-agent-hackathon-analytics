import { motion } from 'framer-motion';
import { useAgentGrowth } from '../hooks/useRealtimeMetrics';
import { useTheme } from '../context/ThemeContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const item = {
  hidden: { opacity: 0, scale: 0.9 },
  show: { opacity: 1, scale: 1 }
};

function TopOrganicGrowthCard() {
  const { growth, loading } = useAgentGrowth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const chartColors = {
    grid: isDark ? '#4a4f5a' : '#EEEEEE',
    text: isDark ? '#929AAB' : '#393E46',
    tooltip: isDark ? '#2a2e35' : '#FFFFFF',
    tooltipBorder: isDark ? '#4a4f5a' : '#EEEEEE'
  };

  if (loading) {
    return (
      <motion.div className="chart-card full-width" variants={item}>
        <h3>
          <span className="material-symbols-outlined size-20">trending_up</span>
          Top Organic Growth Agents
        </h3>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <span className="material-symbols-outlined size-48" style={{ opacity: 0.3 }}>
            progress_activity
          </span>
          <p style={{ marginTop: '1rem', opacity: 0.6 }}>Loading growth data...</p>
        </div>
      </motion.div>
    );
  }

  // Filter organic growth agents (natural agent-to-agent interactions)
  const organicGrowth = growth.filter(g => g.is_organic && g.growth_rate > 0);
  
  // Sort by growth rate and get top 10
  const topOrganic = organicGrowth
    .sort((a, b) => b.growth_rate - a.growth_rate)
    .slice(0, 10);
  
  // Prepare chart data (last 14 days of top organic agents)
  const chartData = growth
    .filter(g => g.is_organic)
    .slice(0, 14)
    .reverse()
    .map(g => ({
      date: new Date(g.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      growth_rate: g.growth_rate || 0,
      messages: g.total_messages,
      agent_id: g.agent_id
    }));

  return (
    <motion.div className="chart-card full-width" variants={item}>
      <h3>
        <span className="material-symbols-outlined size-20">trending_up</span>
        Top Organic Growth Agents
        {topOrganic.length > 0 && (
          <span className="badge" style={{ 
            background: '#10b981', 
            color: 'white',
            marginLeft: '0.5rem',
            padding: '0.25rem 0.75rem',
            borderRadius: '12px',
            fontSize: '0.875rem',
            fontWeight: 600
          }}>
            {topOrganic.length} organic
          </span>
        )}
      </h3>
      <p className="chart-description">
        Top agents with organic growth through natural agent-to-agent interactions and networking. These agents show healthy, sustainable growth patterns based on genuine engagement.
      </p>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
          <XAxis 
            dataKey="date" 
            stroke={chartColors.text} 
            style={{ fontSize: '12px' }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis 
            stroke={chartColors.text} 
            style={{ fontSize: '12px' }}
            label={{ 
              value: 'Growth Rate (%)', 
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
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}
            labelStyle={{ color: chartColors.text, fontWeight: 600 }}
          />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="growth_rate" 
            stroke="#10b981" 
            strokeWidth={3}
            name="Growth Rate (%)"
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Top Organic Agents */}
      {topOrganic.length > 0 ? (
        <div style={{ marginTop: '1.5rem' }}>
          <h4 style={{ 
            fontSize: '1rem', 
            fontWeight: 700,
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <span className="material-symbols-outlined size-20">eco</span>
            Top 10 Organic Growth Agents
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
            {topOrganic.map((g, index) => (
              <motion.div
                key={g.agent_id + g.date}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                style={{
                  padding: '1rem',
                  background: isDark ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.05)',
                  borderRadius: '12px',
                  border: '2px solid #10b981'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '1.125rem' }}>
                    Agent {g.agent_id}
                  </span>
                  <span style={{
                    padding: '0.25rem 0.5rem',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    background: '#10b981',
                    color: 'white'
                  }}>
                    +{g.growth_rate?.toFixed(0)}%
                  </span>
                </div>
                <div style={{ fontSize: '0.875rem', opacity: 0.8 }}>
                  <div style={{ marginBottom: '0.25rem' }}>
                    <strong>Messages:</strong> {g.total_messages}
                  </div>
                  <div style={{ marginBottom: '0.25rem' }}>
                    <strong>Posts:</strong> {g.total_posts} | <strong>Comments:</strong> {g.total_comments}
                  </div>
                  <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: '#10b981' }}>
                      check_circle
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>
                      Organic Growth
                    </span>
                  </div>
                  <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', opacity: 0.6 }}>
                    {new Date(g.date).toLocaleDateString()}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ 
          marginTop: '1.5rem',
          padding: '2rem', 
          textAlign: 'center',
          background: isDark ? 'rgba(146, 154, 171, 0.1)' : 'rgba(146, 154, 171, 0.05)',
          borderRadius: '12px',
          border: `2px dashed ${isDark ? 'rgba(146, 154, 171, 0.3)' : 'rgba(146, 154, 171, 0.2)'}`
        }}>
          <span className="material-symbols-outlined size-48" style={{ color: '#929AAB', opacity: 0.6 }}>
            info
          </span>
          <h4 style={{ marginTop: '1rem', color: '#929AAB' }}>No Organic Growth Data</h4>
          <p style={{ marginTop: '0.5rem', opacity: 0.7 }}>
            Waiting for agents to show organic growth patterns through natural interactions
          </p>
        </div>
      )}
    </motion.div>
  );
}

export default TopOrganicGrowthCard;
