import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { useLanguage } from '../context/LanguageContext';

interface CollectorControlProps {
  apiUrl: string;
  onUpdate: () => void;
}

interface CollectorStatus {
  isRunning: boolean;
  stats: {
    totalEntries: number;
    posts: number;
    comments: number;
    agents: { size: number };
  } | null;
}

function CollectorControl({ apiUrl, onUpdate }: CollectorControlProps) {
  const { t } = useLanguage();
  const [status, setStatus] = useState<CollectorStatus>({ isRunning: false, stats: null });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const checkStatus = async () => {
    try {
      const res = await axios.get(`${apiUrl}/api/collector/status`);
      setStatus(res.data);
    } catch (error) {
      console.error('Error checking status:', error);
    }
  };

  const startCollector = async () => {
    setLoading(true);
    try {
      await axios.post(`${apiUrl}/api/collector/start`);
      await checkStatus();
      onUpdate();
    } catch (error) {
      console.error('Error starting collector:', error);
    } finally {
      setLoading(false);
    }
  };

  const stopCollector = async () => {
    setLoading(true);
    try {
      await axios.post(`${apiUrl}/api/collector/stop`);
      await checkStatus();
      onUpdate();
    } catch (error) {
      console.error('Error stopping collector:', error);
    } finally {
      setLoading(false);
    }
  };

  const collectOnce = async () => {
    setLoading(true);
    try {
      await axios.post(`${apiUrl}/api/collector/collect-once`);
      await checkStatus();
      onUpdate();
    } catch (error) {
      console.error('Error collecting:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      className="collector-control"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="collector-status">
        <div className="status-indicator">
          <motion.span 
            className={`status-dot ${status.isRunning ? 'running' : 'stopped'}`}
            animate={{ scale: status.isRunning ? [1, 1.2, 1] : 1 }}
            transition={{ repeat: status.isRunning ? Infinity : 0, duration: 2 }}
          />
          <span className="status-text">
            <span className="material-symbols-outlined size-18">
              {status.isRunning ? 'play_circle' : 'stop_circle'}
            </span>
            {status.isRunning ? t('collector.running') : t('collector.stopped')}
          </span>
        </div>
        {status.stats && (
          <motion.div 
            className="quick-stats"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <span>{status.stats.totalEntries} {t('collector.entries')}</span>
            <span>•</span>
            <span>{status.stats.posts} {t('collector.posts')}</span>
            <span>•</span>
            <span>{status.stats.comments} {t('collector.comments')}</span>
          </motion.div>
        )}
      </div>
      <div className="collector-actions">
        {!status.isRunning ? (
          <motion.button 
            className="btn btn-primary" 
            onClick={startCollector}
            disabled={loading}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <span className="material-symbols-outlined size-18">play_arrow</span>
            {t('collector.start')}
          </motion.button>
        ) : (
          <motion.button 
            className="btn btn-danger" 
            onClick={stopCollector}
            disabled={loading}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <span className="material-symbols-outlined size-18">pause</span>
            {t('collector.stop')}
          </motion.button>
        )}
        <motion.button 
          className="btn btn-secondary" 
          onClick={collectOnce}
          disabled={loading}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <span className="material-symbols-outlined size-18">refresh</span>
          {t('collector.collectOnce')}
        </motion.button>
      </div>
    </motion.div>
  );
}

export default CollectorControl;
