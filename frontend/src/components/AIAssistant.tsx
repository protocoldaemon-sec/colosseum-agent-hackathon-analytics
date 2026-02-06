import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ChatHistory {
  id: string;
  title?: string;
  messages: Message[];
  updatedAt: string;
}

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
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 }
};

function AIAssistant() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatHistories, setChatHistories] = useState<ChatHistory[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'summarize' | 'search'>('chat');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState('');
  const [summary, setSummary] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadChatHistories();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Keyboard shortcut: Ctrl+I to focus textarea
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'i') {
        e.preventDefault();
        textareaRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChatHistories = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/ai/chats`);
      setChatHistories(response.data.data || []);
    } catch (error) {
      console.error('Failed to load chat histories:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() || loading) return;

    const userMessage: Message = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setMessage('');
    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/api/ai/chat`, {
        message: message,
        chatId: currentChatId
      });

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.data.response,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, assistantMessage]);
      setCurrentChatId(response.data.chatId);
      loadChatHistories();
    } catch (error: any) {
      const errorMessage: Message = {
        role: 'assistant',
        content: `Error: ${error.response?.data?.error || 'Failed to get response'}`,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleSummarize = async () => {
    setLoading(true);
    setSummary('');
    try {
      const response = await axios.post(`${API_URL}/api/ai/summarize`);
      setSummary(response.data.summary);
    } catch (error: any) {
      setSummary(`Error: ${error.response?.data?.error || 'Failed to generate summary'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || loading) return;

    setLoading(true);
    setSearchResult('');
    try {
      const response = await axios.post(`${API_URL}/api/ai/search`, {
        query: searchQuery
      });
      setSearchResult(response.data.result);
    } catch (error: any) {
      setSearchResult(`Error: ${error.response?.data?.error || 'Failed to search'}`);
    } finally {
      setLoading(false);
    }
  };

  const loadChatHistory = async (chatId: string) => {
    try {
      const response = await axios.get(`${API_URL}/api/ai/chat/${chatId}`);
      const history = response.data;
      
      // Filter out system messages and convert to display format
      const displayMessages = history.messages
        .filter((m: any) => m.role !== 'system')
        .map((m: any) => ({
          role: m.role,
          content: m.content,
          timestamp: history.updatedAt
        }));
      
      setMessages(displayMessages);
      setCurrentChatId(chatId);
      setActiveTab('chat');
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  };

  const deleteChatHistory = async (chatId: string) => {
    try {
      await axios.delete(`${API_URL}/api/ai/chat/${chatId}`);
      loadChatHistories();
      if (currentChatId === chatId) {
        setMessages([]);
        setCurrentChatId(null);
      }
    } catch (error) {
      console.error('Failed to delete chat history:', error);
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setCurrentChatId(null);
    setActiveTab('chat');
  };

  const quickPrompts = [
    'Summarize the top 5 most active agents',
    'What are the most discussed topics?',
    'Show me agents with high pure agent scores',
    'What trends do you see in the data?',
    'Compare agent behavior patterns'
  ];

  return (
    <div className="ai-assistant">
      <div className="ai-layout">
        {/* Sidebar - Chat Histories */}
        <motion.div 
          className="ai-sidebar"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <div className="sidebar-header">
            <h3>
              <span className="material-symbols-outlined size-24">history</span>
              Chat History
            </h3>
            <motion.button
              className="btn-icon"
              onClick={startNewChat}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              title="New Chat"
            >
              <span className="material-symbols-outlined size-20">add</span>
            </motion.button>
          </div>
          
          <div className="chat-list">
            {chatHistories.length === 0 ? (
              <p className="empty-state">No chat history yet</p>
            ) : (
              chatHistories.map(chat => (
                <motion.div
                  key={chat.id}
                  className={`chat-item ${currentChatId === chat.id ? 'active' : ''}`}
                  onClick={() => loadChatHistory(chat.id)}
                  whileHover={{ x: 4 }}
                >
                  <div className="chat-item-content">
                    <span className="chat-title">{chat.title || 'Untitled Chat'}</span>
                    <span className="chat-date">
                      {new Date(chat.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <motion.button
                    className="btn-icon-small"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteChatHistory(chat.id);
                    }}
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.8 }}
                  >
                    <span className="material-symbols-outlined size-18">delete</span>
                  </motion.button>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>

        {/* Main Content */}
        <div className="ai-main">
          {/* Tabs */}
          <div className="ai-tabs">
            {(['chat', 'summarize', 'search'] as const).map(tab => (
              <motion.button
                key={tab}
                className={`ai-tab ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {tab === 'chat' && (
                  <>
                    <span className="material-symbols-outlined size-20">chat</span>
                    Chat
                  </>
                )}
                {tab === 'summarize' && (
                  <>
                    <span className="material-symbols-outlined size-20">summarize</span>
                    Summarize
                  </>
                )}
                {tab === 'search' && (
                  <>
                    <span className="material-symbols-outlined size-20">search</span>
                    Search Topics
                  </>
                )}
              </motion.button>
            ))}
          </div>

          {/* Chat Tab */}
          {activeTab === 'chat' && (
            <div className="chat-container">
              <div className="messages-container">
                {messages.length === 0 ? (
                  <motion.div 
                    className="welcome-screen"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <span className="material-symbols-outlined size-48">smart_toy</span>
                    <h3>AI Assistant</h3>
                    <p>Ask me anything about the agent conversation dataset!</p>
                    
                    <div className="quick-prompts">
                      <p className="quick-prompts-label">Quick prompts:</p>
                      {quickPrompts.map((prompt, i) => (
                        <motion.button
                          key={i}
                          className="quick-prompt-btn"
                          onClick={() => {
                            setMessage(prompt);
                            setTimeout(() => handleSendMessage(), 100);
                          }}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          {prompt}
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    className="messages-list"
                    variants={container}
                    initial="hidden"
                    animate="show"
                  >
                    {messages.map((msg, index) => (
                      <motion.div
                        key={index}
                        className={`message ${msg.role}`}
                        variants={item}
                      >
                        <div className="message-icon">
                          <span className="material-symbols-outlined size-24">
                            {msg.role === 'user' ? 'person' : 'smart_toy'}
                          </span>
                        </div>
                        <div className="message-content">
                          <div className="message-text">{msg.content}</div>
                          <div className="message-time">
                            {new Date(msg.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                    {loading && (
                      <motion.div
                        className="message assistant"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      >
                        <div className="message-icon">
                          <span className="material-symbols-outlined size-24">smart_toy</span>
                        </div>
                        <div className="message-content">
                          <div className="typing-indicator">
                            <span></span>
                            <span></span>
                            <span></span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                    <div ref={messagesEndRef} />
                  </motion.div>
                )}
              </div>

              <div className="chat-input-container">
                <div className="chat-input-wrapper">
                  <textarea
                    ref={textareaRef}
                    id="chat-assistant-textarea"
                    className="chat-input-textarea"
                    placeholder="Ask me anything about the dataset..."
                    value={message}
                    onChange={(e) => {
                      setMessage(e.target.value);
                      // Auto-resize
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    disabled={loading}
                    rows={1}
                  />
                  <span className="chat-input-hint">
                    Ctrl+I
                  </span>
                  <motion.button
                    className="chat-send-button"
                    onClick={handleSendMessage}
                    disabled={loading || !message.trim()}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    aria-label="Send message"
                  >
                    <span className="material-symbols-outlined">arrow_upward</span>
                  </motion.button>
                </div>
              </div>
            </div>
          )}

          {/* Summarize Tab */}
          {activeTab === 'summarize' && (
            <motion.div 
              className="summarize-container"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="summarize-header">
                <h3>
                  <span className="material-symbols-outlined size-24">summarize</span>
                  Dataset Summary
                </h3>
                <motion.button
                  className="btn btn-primary"
                  onClick={handleSummarize}
                  disabled={loading}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {loading ? 'Generating...' : 'Generate Summary'}
                </motion.button>
              </div>

              {summary && (
                <motion.div 
                  className="summary-result"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="result-content">{summary}</div>
                </motion.div>
              )}

              {loading && (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Analyzing dataset and generating summary...</p>
                </div>
              )}
            </motion.div>
          )}

          {/* Search Tab */}
          {activeTab === 'search' && (
            <motion.div 
              className="search-container"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="search-header">
                <h3>
                  <span className="material-symbols-outlined size-24">search</span>
                  Search Agent Topics
                </h3>
              </div>

              <div className="search-input-container">
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search for topics, agents, or keywords..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  disabled={loading}
                />
                <motion.button
                  className="btn btn-primary"
                  onClick={handleSearch}
                  disabled={loading || !searchQuery.trim()}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <span className="material-symbols-outlined size-20">search</span>
                  Search
                </motion.button>
              </div>

              {searchResult && (
                <motion.div 
                  className="search-result"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="result-header">
                    <span className="material-symbols-outlined size-20">check_circle</span>
                    Search Results for: "{searchQuery}"
                  </div>
                  <div className="result-content">{searchResult}</div>
                </motion.div>
              )}

              {loading && (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Searching dataset...</p>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AIAssistant;
