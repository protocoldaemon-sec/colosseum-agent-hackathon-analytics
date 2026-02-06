import { useState, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Conversation } from '../App';
import { useLanguage } from '../context/LanguageContext';

interface ConversationsProps {
  conversations: Conversation[];
}

const TAG_CATEGORIES = {
  purpose: ['Team formation', 'Product feedback', 'Ideation', 'Progress update'],
  category: ['DeFi', 'Stablecoins', 'RWAs', 'Infra', 'Privacy', 'Consumer', 'Payments', 'Trading', 'DePIN', 'Governance', 'New Markets', 'AI', 'Security', 'Identity']
};

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

const item = {
  hidden: { opacity: 0, x: -20 },
  show: { opacity: 1, x: 0 }
};

function Conversations({ conversations }: ConversationsProps) {
  const { t } = useLanguage();
  const [filter, setFilter] = useState<'all' | 'posts' | 'comments'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'pure' | 'human'>('recent');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showTagFilters, setShowTagFilters] = useState(false);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const clearTags = () => {
    setSelectedTags([]);
  };

  // Memoize filtered conversations to prevent recalculation on every render
  const filteredConversations = useMemo(() => 
    conversations
      .filter(conv => {
        // Filter by type
        if (filter !== 'all' && conv.type !== filter.slice(0, -1)) {
          return false;
        }
        
        // Filter by tags
        if (selectedTags.length > 0) {
          if (!conv.tags || conv.tags.length === 0) {
            return false;
          }
          return selectedTags.some(tag => conv.tags?.includes(tag));
        }
        
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'recent') {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        } else if (sortBy === 'pure') {
          return b.pureAgentScore - a.pureAgentScore;
        } else {
          return b.humanControlScore - a.humanControlScore;
        }
      }),
    [conversations, filter, selectedTags, sortBy]
  );

  return (
    <div className="conversations">
      <div className="section-header">
        <motion.h2
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <span className="material-symbols-outlined size-24">forum</span>
          {t('conversations.title')}
        </motion.h2>
        <motion.div 
          className="filters"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <select value={filter} onChange={(e) => setFilter(e.target.value as any)}>
            <option value="all">{t('conversations.all')}</option>
            <option value="posts">{t('conversations.postsOnly')}</option>
            <option value="comments">{t('conversations.commentsOnly')}</option>
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
            <option value="recent">{t('conversations.mostRecent')}</option>
            <option value="pure">{t('conversations.highestPure')}</option>
            <option value="human">{t('conversations.highestHuman')}</option>
          </select>
          <motion.button
            className="btn-filter-tags"
            onClick={() => setShowTagFilters(!showTagFilters)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <span className="material-symbols-outlined size-18">filter_list</span>
            Tags {selectedTags.length > 0 && `(${selectedTags.length})`}
          </motion.button>
        </motion.div>
      </div>

      {/* Tag Filters */}
      <AnimatePresence>
        {showTagFilters && (
          <motion.div
            className="tag-filters-panel"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="tag-filters-header">
              <h3>
                <span className="material-symbols-outlined size-20">label</span>
                Filter by Tags
              </h3>
              {selectedTags.length > 0 && (
                <motion.button
                  className="btn-clear-tags"
                  onClick={clearTags}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <span className="material-symbols-outlined size-18">close</span>
                  Clear All
                </motion.button>
              )}
            </div>

            {/* Purpose Tags */}
            <div className="tag-category">
              <h4>Purpose</h4>
              <div className="tag-list">
                {TAG_CATEGORIES.purpose.map(tag => (
                  <motion.button
                    key={tag}
                    className={`tag-filter-btn ${selectedTags.includes(tag) ? 'active' : ''}`}
                    onClick={() => toggleTag(tag)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {tag}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Category Tags */}
            <div className="tag-category">
              <h4>Category</h4>
              <div className="tag-list">
                {TAG_CATEGORIES.category.map(tag => (
                  <motion.button
                    key={tag}
                    className={`tag-filter-btn ${selectedTags.includes(tag) ? 'active' : ''}`}
                    onClick={() => toggleTag(tag)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {tag}
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selected Tags Display */}
      {selectedTags.length > 0 && (
        <motion.div
          className="selected-tags"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <span className="selected-tags-label">Filtering by:</span>
          {selectedTags.map(tag => (
            <motion.span
              key={tag}
              className="selected-tag"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}
            >
              {tag}
              <button onClick={() => toggleTag(tag)} aria-label={`Remove ${tag}`}>
                <span className="material-symbols-outlined size-16">close</span>
              </button>
            </motion.span>
          ))}
        </motion.div>
      )}

      {/* Results Count */}
      <motion.div
        className="results-count"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        Showing {filteredConversations.length} of {conversations.length} conversations
      </motion.div>

      <motion.div 
        className="conversation-list"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {filteredConversations.length === 0 ? (
          <motion.div
            className="empty-state"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <span className="material-symbols-outlined size-48">search_off</span>
            <h3>No conversations found</h3>
            <p>Try adjusting your filters or clearing tag selections</p>
            {selectedTags.length > 0 && (
              <button className="btn btn-primary" onClick={clearTags}>
                Clear Tag Filters
              </button>
            )}
          </motion.div>
        ) : (
          filteredConversations.map(conv => (
            <motion.div 
              key={`${conv.type}-${conv.id}`} 
              className="conversation-card"
              variants={item}
              whileHover={{ y: -2, scale: 1.01 }}
              transition={{ duration: 0.2 }}
            >
              <div className="conv-header">
                <div className="conv-meta">
                  <span className={`type-badge ${conv.type}`}>{conv.type}</span>
                  <span className="agent-name">{conv.agentName}</span>
                  <span className="timestamp">
                    {new Date(conv.createdAt).toLocaleDateString()} {new Date(conv.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>
              
              {conv.title && <h3 className="conv-title">{conv.title}</h3>}
              
              <p className="conv-content">
                {conv.content.length > 300 
                  ? conv.content.substring(0, 300) + '...' 
                  : conv.content}
              </p>
              
              {conv.tags && conv.tags.length > 0 && (
                <div className="conv-tags">
                  {conv.tags.map(tag => (
                    <span key={tag} className="tag">{tag}</span>
                  ))}
                </div>
              )}
            </motion.div>
          ))
        )}
      </motion.div>
    </div>
  );
}

export default memo(Conversations);
