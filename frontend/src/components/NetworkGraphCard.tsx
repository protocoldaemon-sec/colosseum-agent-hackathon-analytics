import { motion } from 'framer-motion';
import { useNetworkGraph } from '../hooks/useRealtimeMetrics';
import { useTheme } from '../context/ThemeContext';
import { useEffect, useRef, useState } from 'react';
import axios from 'axios';

const item = {
  hidden: { opacity: 0, scale: 0.9 },
  show: { opacity: 1, scale: 1 }
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function NetworkGraphCard() {
  const { graph: globalGraph, loading: loadingGlobal } = useNetworkGraph(3);
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Agent-specific network state
  const [agentId, setAgentId] = useState('');
  const [agentNetwork, setAgentNetwork] = useState<any>(null);
  const [loadingAgent, setLoadingAgent] = useState(false);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<'global' | 'agent'>('global');

  // Current graph to display
  const currentGraph = viewMode === 'agent' ? agentNetwork?.network : globalGraph;
  const loading = viewMode === 'agent' ? loadingAgent : loadingGlobal;

  // Fetch agent-specific network
  const fetchAgentNetwork = async () => {
    if (!agentId || agentId.trim() === '') {
      setError('Please enter an agent name or ID');
      return;
    }

    setLoadingAgent(true);
    setError('');
    
    try {
      const response = await axios.get(`${API_URL}/api/analytics/agent-network/${encodeURIComponent(agentId)}`);
      setAgentNetwork(response.data);
      setViewMode('agent');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch agent network');
      setAgentNetwork(null);
    } finally {
      setLoadingAgent(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      fetchAgentNetwork();
    }
  };

  useEffect(() => {
    if (!currentGraph || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const container = canvas.parentElement;
    if (container) {
      canvas.width = container.clientWidth;
      canvas.height = 500;
    }

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Simple force-directed layout
    const nodes = currentGraph.nodes.map((node: any) => ({
      id: node.id,
      name: node.name,
      isTarget: node.isTarget || false,
      x: node.isTarget ? canvas.width / 2 : Math.random() * canvas.width,
      y: node.isTarget ? canvas.height / 2 : Math.random() * canvas.height,
      vx: 0,
      vy: 0,
      radius: node.isTarget ? 12 : 8
    }));

    const edges = currentGraph.edges;

    // Simulation
    const simulate = () => {
      // Apply forces
      for (let i = 0; i < nodes.length; i++) {
        // Skip target node in agent view
        if (viewMode === 'agent' && nodes[i].isTarget) continue;

        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          
          // Repulsion
          const force = 1000 / (dist * dist);
          nodes[i].vx -= (dx / dist) * force;
          nodes[i].vy -= (dy / dist) * force;
          nodes[j].vx += (dx / dist) * force;
          nodes[j].vy += (dy / dist) * force;
        }
      }

      // Edge attraction
      edges.forEach((edge: any) => {
        const source = nodes.find(n => n.id === edge.source);
        const target = nodes.find(n => n.id === edge.target);
        if (!source || !target) return;

        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        
        const force = dist * 0.01 * edge.weight;
        
        // Don't move target node in agent view
        if (!(viewMode === 'agent' && source.isTarget)) {
          source.vx += (dx / dist) * force;
          source.vy += (dy / dist) * force;
        }
        if (!(viewMode === 'agent' && target.isTarget)) {
          target.vx -= (dx / dist) * force;
          target.vy -= (dy / dist) * force;
        }
      });

      // Update positions
      nodes.forEach(node => {
        // Skip target node in agent view
        if (viewMode === 'agent' && node.isTarget) return;

        node.vx *= 0.8; // Damping
        node.vy *= 0.8;
        node.x += node.vx;
        node.y += node.vy;

        // Boundaries
        node.x = Math.max(20, Math.min(canvas.width - 20, node.x));
        node.y = Math.max(20, Math.min(canvas.height - 20, node.y));
      });
    };

    // Draw
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw edges
      edges.forEach((edge: any) => {
        const source = nodes.find(n => n.id === edge.source);
        const target = nodes.find(n => n.id === edge.target);
        if (!source || !target) return;

        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.strokeStyle = isDark ? 'rgba(146, 154, 171, 0.3)' : 'rgba(57, 62, 70, 0.2)';
        ctx.lineWidth = Math.min(edge.weight / 2, 5);
        ctx.stroke();
      });

      // Draw nodes
      nodes.forEach(node => {
        // Node circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = node.isTarget ? '#f59e0b' : '#06b6d4';
        ctx.fill();
        ctx.strokeStyle = isDark ? '#FFFFFF' : '#393E46';
        ctx.lineWidth = node.isTarget ? 3 : 2;
        ctx.stroke();

        // Node label
        ctx.fillStyle = isDark ? '#F7F7F7' : '#393E46';
        ctx.font = node.isTarget ? 'bold 12px system-ui' : '10px system-ui';
        ctx.textAlign = 'center';
        const label = node.name || `${node.id}`;
        ctx.fillText(label.length > 15 ? label.substring(0, 15) + '...' : label, node.x, node.y - node.radius - 5);
      });
    };

    // Animation loop
    let frame = 0;
    const animate = () => {
      if (frame < 100) { // Run simulation for 100 frames
        simulate();
        frame++;
      }
      draw();
      requestAnimationFrame(animate);
    };

    animate();

  }, [currentGraph, isDark, viewMode]);

  return (
    <motion.div className="chart-card full-width" variants={item}>
      <h3>
        <span className="material-symbols-outlined size-20">hub</span>
        Agent Network Graph
        {currentGraph && (
          <span style={{ 
            marginLeft: '0.5rem',
            fontSize: '0.875rem',
            opacity: 0.7,
            fontWeight: 400
          }}>
            ({currentGraph.nodes.length} agents, {currentGraph.edges.length} connections)
          </span>
        )}
      </h3>
      <p className="chart-description">
        {viewMode === 'global' 
          ? 'Interactive visualization of all agent-to-agent interactions. Enter an agent name or ID below to analyze specific agent connections.'
          : `Analyzing network for ${agentNetwork?.agent?.agent_name || agentId}. Orange node is the target agent, cyan nodes are connected agents.`
        }
      </p>

      {/* Input Section */}
      <div style={{ 
        marginTop: '1rem',
        padding: '1rem',
        background: isDark ? 'rgba(6, 182, 212, 0.1)' : 'rgba(6, 182, 212, 0.05)',
        borderRadius: '12px',
        border: `2px solid ${isDark ? 'rgba(6, 182, 212, 0.2)' : 'rgba(6, 182, 212, 0.1)'}`
      }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ 
              display: 'block', 
              fontSize: '0.875rem', 
              fontWeight: 600,
              marginBottom: '0.5rem',
              opacity: 0.9
            }}>
              Analyze Specific Agent
            </label>
            <input
              type="text"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter Agent Name or ID (e.g., Sipher or 274)"
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                border: `2px solid ${isDark ? 'rgba(146, 154, 171, 0.3)' : 'rgba(146, 154, 171, 0.2)'}`,
                background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.8)',
                color: isDark ? '#F7F7F7' : '#393E46',
                fontSize: '0.875rem',
                outline: 'none'
              }}
            />
          </div>
          <button
            onClick={fetchAgentNetwork}
            disabled={loadingAgent}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              border: 'none',
              background: '#06b6d4',
              color: 'white',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: loadingAgent ? 'not-allowed' : 'pointer',
              opacity: loadingAgent ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginTop: '1.5rem'
            }}
          >
            <span className="material-symbols-outlined size-18">search</span>
            {loadingAgent ? 'Analyzing...' : 'Analyze'}
          </button>
          {viewMode === 'agent' && (
            <button
              onClick={() => {
                setViewMode('global');
                setAgentId('');
                setAgentNetwork(null);
                setError('');
              }}
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                border: `2px solid ${isDark ? 'rgba(146, 154, 171, 0.3)' : 'rgba(146, 154, 171, 0.2)'}`,
                background: 'transparent',
                color: isDark ? '#F7F7F7' : '#393E46',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginTop: '1.5rem'
              }}
            >
              <span className="material-symbols-outlined size-18">public</span>
              Show Global
            </button>
          )}
        </div>
        {error && (
          <div style={{ 
            marginTop: '0.75rem',
            padding: '0.75rem',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '2px solid #ef4444',
            borderRadius: '8px',
            color: '#ef4444',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <span className="material-symbols-outlined size-18">error</span>
            {error}
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <span className="material-symbols-outlined size-48" style={{ opacity: 0.3 }}>
            progress_activity
          </span>
          <p style={{ marginTop: '1rem', opacity: 0.6 }}>Loading network...</p>
        </div>
      ) : currentGraph && currentGraph.nodes.length > 0 ? (
        <>
          {/* Agent Info (if in agent view) */}
          {viewMode === 'agent' && agentNetwork?.agent && (
            <div style={{
              marginTop: '1rem',
              padding: '1rem',
              background: isDark ? 'rgba(245, 158, 11, 0.1)' : 'rgba(245, 158, 11, 0.05)',
              borderRadius: '12px',
              border: '2px solid #f59e0b'
            }}>
              <h4 style={{ margin: 0, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="material-symbols-outlined size-20">person</span>
                {agentNetwork.agent.agent_name}
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem', fontSize: '0.875rem' }}>
                <div><strong>Total Messages:</strong> {agentNetwork.agent.total_messages}</div>
                <div><strong>Posts:</strong> {agentNetwork.agent.posts_count}</div>
                <div><strong>Comments:</strong> {agentNetwork.agent.comments_count}</div>
                <div><strong>Connections:</strong> {agentNetwork.network.stats.totalConnections}</div>
              </div>
            </div>
          )}

          <div style={{ 
            position: 'relative',
            background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
            borderRadius: '12px',
            overflow: 'hidden',
            marginTop: '1rem'
          }}>
            <canvas 
              ref={canvasRef}
              style={{ 
                width: '100%',
                height: '500px',
                display: 'block'
              }}
            />
          </div>

          {/* Legend */}
          <div style={{ 
            marginTop: '1rem',
            display: 'flex',
            gap: '2rem',
            flexWrap: 'wrap',
            padding: '1rem',
            background: isDark ? 'rgba(146, 154, 171, 0.1)' : 'rgba(146, 154, 171, 0.05)',
            borderRadius: '8px'
          }}>
            {viewMode === 'agent' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: '#f59e0b',
                  border: `3px solid ${isDark ? '#FFFFFF' : '#393E46'}`
                }} />
                <span style={{ fontSize: '0.875rem' }}>Target Agent</span>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                background: '#06b6d4',
                border: `2px solid ${isDark ? '#FFFFFF' : '#393E46'}`
              }} />
              <span style={{ fontSize: '0.875rem' }}>{viewMode === 'agent' ? 'Connected Agent' : 'Agent Node'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: '40px',
                height: '2px',
                background: isDark ? 'rgba(146, 154, 171, 0.3)' : 'rgba(57, 62, 70, 0.2)'
              }} />
              <span style={{ fontSize: '0.875rem' }}>Interaction (thickness = strength)</span>
            </div>
          </div>

          {/* Stats */}
          <div style={{ 
            marginTop: '1rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem'
          }}>
            <div style={{
              padding: '1rem',
              background: isDark ? 'rgba(6, 182, 212, 0.1)' : 'rgba(6, 182, 212, 0.05)',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#06b6d4' }}>
                {currentGraph.nodes.length}
              </div>
              <div style={{ fontSize: '0.875rem', opacity: 0.7, marginTop: '0.25rem' }}>
                {viewMode === 'agent' ? 'Connected Agents' : 'Active Agents'}
              </div>
            </div>
            <div style={{
              padding: '1rem',
              background: isDark ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.05)',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#10b981' }}>
                {currentGraph.edges.length}
              </div>
              <div style={{ fontSize: '0.875rem', opacity: 0.7, marginTop: '0.25rem' }}>
                Connections
              </div>
            </div>
            <div style={{
              padding: '1rem',
              background: isDark ? 'rgba(245, 158, 11, 0.1)' : 'rgba(245, 158, 11, 0.05)',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#f59e0b' }}>
                {currentGraph.edges.length > 0 ? (currentGraph.edges.reduce((sum: number, e: any) => sum + e.weight, 0) / currentGraph.edges.length).toFixed(1) : 0}
              </div>
              <div style={{ fontSize: '0.875rem', opacity: 0.7, marginTop: '0.25rem' }}>
                Avg Strength
              </div>
            </div>
          </div>

          {/* Strongest Connection (agent view only) */}
          {viewMode === 'agent' && agentNetwork?.network.stats.strongestConnection && (
            <div style={{
              marginTop: '1rem',
              padding: '1rem',
              background: isDark ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.05)',
              borderRadius: '12px',
              border: '2px solid #10b981'
            }}>
              <h4 style={{ margin: 0, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981' }}>
                <span className="material-symbols-outlined size-20">link</span>
                Strongest Connection
              </h4>
              <div style={{ fontSize: '0.875rem' }}>
                <strong>{agentNetwork.network.stats.strongestConnection.agentName}</strong> (Agent {agentNetwork.network.stats.strongestConnection.agentId})
                <br />
                Strength: <strong>{agentNetwork.network.stats.strongestConnection.strength}</strong> | 
                Type: <strong>{agentNetwork.network.stats.strongestConnection.type}</strong>
              </div>
            </div>
          )}
        </>
      ) : (
        <div style={{ 
          padding: '3rem 2rem', 
          textAlign: 'center',
          background: isDark ? 'rgba(146, 154, 171, 0.1)' : 'rgba(146, 154, 171, 0.05)',
          borderRadius: '12px',
          marginTop: '1rem'
        }}>
          <span className="material-symbols-outlined size-64" style={{ opacity: 0.3 }}>
            device_hub
          </span>
          <h4 style={{ marginTop: '1rem', opacity: 0.7 }}>
            {viewMode === 'agent' ? 'No connections found for this agent' : 'No Network Data Available'}
          </h4>
          <p style={{ marginTop: '0.5rem', opacity: 0.6 }}>
            {viewMode === 'agent' 
              ? 'This agent has no recorded interactions with other agents'
              : 'Interactions will appear here as agents communicate'
            }
          </p>
        </div>
      )}
    </motion.div>
  );
}

export default NetworkGraphCard;
