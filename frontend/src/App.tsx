import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { useTheme } from './context/ThemeContext';
import { useLanguage } from './context/LanguageContext';
import Dashboard from './components/Dashboard';
import Conversations from './components/Conversations';
import Analytics from './components/Analytics';
import AIAssistant from './components/AIAssistant';
import Footer from './components/Footer';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface Agent {
  agentName: string;
  agentId: number;
  totalMessages: number;
  posts: number;
  comments: number;
  avgPureScore: number;
  avgHumanScore: number;
  tags?: string[];
  firstSeen?: string;
  lastSeen?: string;
}

export interface Analysis {
  overview: {
    totalEntries: number;
    totalPosts: number;
    totalComments: number;
    uniqueAgents: number;
  };
  topAgents?: Agent[];
  topTags?: Array<{ tag: string; count: number }>;
}

export interface Conversation {
  id: number;
  type: 'post' | 'comment';
  agentName: string;
  content: string;
  title?: string;
  tags?: string[];
  pureAgentScore: number;
  humanControlScore: number;
  createdAt: string;
  upvotes: number;
  downvotes: number;
  score: number;
}

function App() {
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'conversations' | 'analytics'>('dashboard');
  const [showAIChat, setShowAIChat] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      setError(null);
      const [agentsRes, analysisRes, conversationsRes] = await Promise.all([
        axios.get(`${API_URL}/api/agents`).catch(() => ({ data: { data: [] } })),
        axios.get(`${API_URL}/api/analysis`).catch(() => ({ 
          data: { 
            overview: { totalEntries: 0, totalPosts: 0, totalComments: 0, uniqueAgents: 0 } 
          } 
        })),
        axios.get(`${API_URL}/api/conversations?limit=50`).catch(() => ({ data: { data: [] } }))
      ]);
      
      setAgents(agentsRes.data.data || []);
      setAnalysis(analysisRes.data);
      setConversations(conversationsRes.data.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to connect to backend. Please make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const logoSrc = theme === 'dark' 
    ? '/Symbol-White.png' 
    : '/Symbol-Black.png';

  const navItems = [
    {
      label: t('nav.dashboard'),
      onClick: () => setActiveTab('dashboard'),
      active: activeTab === 'dashboard'
    },
    {
      label: t('nav.analytics'),
      onClick: () => setActiveTab('analytics'),
      active: activeTab === 'analytics'
    },
    {
      label: t('nav.conversations'),
      onClick: () => setActiveTab('conversations'),
      active: activeTab === 'conversations'
    }
  ];

  if (loading) {
    return (
      <div className="loading-screen">
        <motion.div 
          className="spinner"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {t('loading.text')}
        </motion.p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-screen">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="error-icon">
            <span className="material-symbols-outlined" style={{ fontSize: '4rem', color: 'var(--color-danger)' }}>error</span>
          </div>
          <h2>Connection Error</h2>
          <p>{error}</p>
          <div className="error-details">
            <p><strong>Backend URL:</strong> {API_URL}</p>
            <p><strong>Steps to fix:</strong></p>
            <ol>
              <li>Make sure backend is running: <code>cd backend && npm run dev</code></li>
              <li>Check backend is accessible: <code>curl {API_URL}/api/health</code></li>
              <li>Verify CORS settings in backend .env</li>
              <li>Start collector to generate data: <code>curl -X POST {API_URL}/api/collector/start</code></li>
            </ol>
          </div>
          <motion.button
            className="btn btn-primary"
            onClick={() => {
              setLoading(true);
              setError(null);
              fetchData();
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <span className="material-symbols-outlined size-18">refresh</span>
            Retry Connection
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="app">
      <nav className="navbar">
        <motion.div 
          className="nav-brand"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <div className="nav-logo-wrapper">
            <img src={logoSrc} alt="ARS Analytics" className="nav-logo" />
          </div>
          <div className="nav-brand-text">
            <h1>{t('nav.title')}</h1>
            <span className="subtitle">{t('nav.subtitle')}</span>
          </div>
        </motion.div>
        
        <div className="nav-center">
          <div className="nav-tabs">
            {navItems.map((item, index) => (
              <motion.button
                key={item.label}
                className={`nav-tab ${item.active ? 'active' : ''}`}
                onClick={item.onClick}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
              >
                <span className="nav-tab-text">{item.label}</span>
                {item.active && (
                  <motion.div
                    className="nav-tab-indicator"
                    layoutId="activeTab"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </motion.button>
            ))}
          </div>
        </div>

        <div className="nav-actions">
          <div className="language-toggle">
            <motion.button
              className={`lang-btn ${language === 'en' ? 'active' : ''}`}
              onClick={() => setLanguage('en')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              EN
            </motion.button>
            <motion.button
              className={`lang-btn ${language === 'id' ? 'active' : ''}`}
              onClick={() => setLanguage('id')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              ID
            </motion.button>
          </div>
          
          <motion.button
            className="theme-toggle"
            onClick={toggleTheme}
            whileHover={{ scale: 1.1, rotate: 180 }}
            whileTap={{ scale: 0.9 }}
            transition={{ duration: 0.3 }}
            aria-label="Toggle theme"
          >
            <span className="material-symbols-outlined size-20">
              {theme === 'light' ? 'dark_mode' : 'light_mode'}
            </span>
          </motion.button>
        </div>
      </nav>

      <div className="container">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {activeTab === 'dashboard' && (
              <Dashboard agents={agents} analysis={analysis} />
            )}
            
            {activeTab === 'analytics' && (
              <Analytics agents={agents} conversations={conversations} analysis={analysis} />
            )}
            
            {activeTab === 'conversations' && (
              <Conversations conversations={conversations} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      
      {/* Floating AI Chat Button */}
      <AnimatePresence>
        {!showAIChat && (
          <motion.button
            className="floating-ai-button"
            onClick={() => setShowAIChat(true)}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            title="Ask AI Assistant"
          >
            <span className="material-symbols-outlined size-32">smart_toy</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Floating AI Chat Window */}
      <AnimatePresence>
        {showAIChat && (
          <motion.div
            className="floating-ai-chat"
            initial={{ opacity: 0, y: 100, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.8 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            <div className="floating-ai-header">
              <div className="floating-ai-title">
                <span className="material-symbols-outlined size-24">smart_toy</span>
                <span>AI Assistant</span>
              </div>
              <motion.button
                className="btn-close-ai"
                onClick={() => setShowAIChat(false)}
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
              >
                <span className="material-symbols-outlined size-24">close</span>
              </motion.button>
            </div>
            <div className="floating-ai-content">
              <AIAssistant />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <Footer />
    </div>
  );
}

export default App;
