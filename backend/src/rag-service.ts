import axios from 'axios';
import { supabase } from './supabase-service';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatSession {
  id: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

export class RAGService {
  private apiKey: string;
  private baseURL = 'https://openrouter.ai/api/v1/chat/completions';
  private model = 'nvidia/nemotron-3-nano-30b-a3b:free';
  private sessions: Map<string, ChatSession> = new Map();

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  // Load relevant data from Supabase based on query
  private async loadRelevantData(query: string) {
    try {
      // Get all agents
      const { data: agents } = await supabase
        .from('agents')
        .select('*')
        .order('total_messages', { ascending: false })
        .limit(50);

      // Get recent conversations
      const { data: conversations } = await supabase
        .from('conversations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      // Get top tags
      const { data: tags } = await supabase
        .from('tags')
        .select('*')
        .order('usage_count', { ascending: false })
        .limit(20);

      // Get suspicious patterns
      const { data: suspiciousPatterns } = await supabase
        .from('suspicious_patterns')
        .select('*')
        .eq('status', 'active')
        .order('detected_at', { ascending: false })
        .limit(10);

      // Get network interactions
      const { data: interactions } = await supabase
        .from('agent_interactions')
        .select('*')
        .gte('strength', 5)
        .order('strength', { ascending: false })
        .limit(50);

      // Get growth tracking
      const { data: growth } = await supabase
        .from('agent_growth_tracking')
        .select('*')
        .order('date', { ascending: false })
        .limit(30);

      return {
        agents: agents || [],
        conversations: conversations || [],
        tags: tags || [],
        suspiciousPatterns: suspiciousPatterns || [],
        interactions: interactions || [],
        growth: growth || []
      };
    } catch (error) {
      console.error('Error loading data from Supabase:', error);
      return {
        agents: [],
        conversations: [],
        tags: [],
        suspiciousPatterns: [],
        interactions: [],
        growth: []
      };
    }
  }

  // Build context from loaded data
  private buildContext(data: any): string {
    const { agents, conversations, tags, suspiciousPatterns, interactions, growth } = data;

    let context = `You are an AI assistant analyzing agent conversation data. Answer ONLY based on the data provided below. Do not make assumptions or use external knowledge.\n\n`;

    // Statistics
    context += `## Dataset Statistics\n`;
    context += `- Total Agents: ${agents.length}\n`;
    context += `- Total Conversations: ${conversations.length}\n`;
    context += `- Active Tags: ${tags.length}\n`;
    context += `- Suspicious Patterns Detected: ${suspiciousPatterns.length}\n`;
    context += `- Network Interactions: ${interactions.length}\n\n`;

    // Top Agents
    if (agents.length > 0) {
      context += `## Top 10 Agents\n`;
      agents.slice(0, 10).forEach((agent: any, i: number) => {
        context += `${i + 1}. ${agent.agent_name}\n`;
        context += `   - Messages: ${agent.total_messages} (${agent.posts_count} posts, ${agent.comments_count} comments)\n`;
        context += `   - Pure Agent Score: ${agent.avg_pure_score?.toFixed(1)}%\n`;
        context += `   - Human Control Score: ${agent.avg_human_score?.toFixed(1)}%\n`;
        context += `   - First Seen: ${new Date(agent.first_seen).toLocaleDateString()}\n`;
        context += `   - Last Seen: ${new Date(agent.last_seen).toLocaleDateString()}\n`;
      });
      context += `\n`;
    }

    // Top Tags
    if (tags.length > 0) {
      context += `## Top Tags\n`;
      tags.slice(0, 10).forEach((tag: any, i: number) => {
        context += `${i + 1}. ${tag.name} (${tag.usage_count} uses)\n`;
      });
      context += `\n`;
    }

    // Recent Conversations Sample
    if (conversations.length > 0) {
      context += `## Recent Conversations (Last 20)\n`;
      conversations.slice(0, 20).forEach((conv: any) => {
        const preview = conv.content.substring(0, 150).replace(/\n/g, ' ');
        context += `- [${conv.type}] ${conv.agent_id}: "${preview}..."\n`;
        context += `  Pure: ${conv.pure_agent_score}%, Human: ${conv.human_control_score}%\n`;
      });
      context += `\n`;
    }

    // Suspicious Patterns
    if (suspiciousPatterns.length > 0) {
      context += `## Suspicious Patterns Detected\n`;
      suspiciousPatterns.forEach((pattern: any) => {
        context += `- [${pattern.severity.toUpperCase()}] ${pattern.pattern_type}: ${pattern.description}\n`;
        context += `  Agents involved: ${pattern.agent_ids.join(', ')}\n`;
        context += `  Confidence: ${pattern.confidence_score}%\n`;
      });
      context += `\n`;
    }

    // Network Interactions
    if (interactions.length > 0) {
      context += `## Strong Agent Interactions\n`;
      interactions.slice(0, 10).forEach((interaction: any) => {
        context += `- Agent ${interaction.source_agent_id} → Agent ${interaction.target_agent_id}\n`;
        context += `  Type: ${interaction.interaction_type}, Strength: ${interaction.strength}\n`;
      });
      context += `\n`;
    }

    // Growth Patterns
    if (growth.length > 0) {
      const inorganicGrowth = growth.filter((g: any) => !g.is_organic);
      if (inorganicGrowth.length > 0) {
        context += `## Inorganic Growth Detected\n`;
        inorganicGrowth.slice(0, 5).forEach((g: any) => {
          context += `- Agent ${g.agent_id}: ${g.growth_rate?.toFixed(1)}% growth on ${new Date(g.date).toLocaleDateString()}\n`;
        });
        context += `\n`;
      }
    }

    context += `\nIMPORTANT: Answer questions ONLY using the data above. If information is not available in the data, say "I don't have that information in the current dataset."\n`;

    return context;
  }

  // Main query function - simple and direct
  async query(sessionId: string, userQuery: string): Promise<string> {
    try {
      // Load relevant data
      const data = await this.loadRelevantData(userQuery);
      
      // Build context
      const context = this.buildContext(data);

      // Get or create session
      let session = this.sessions.get(sessionId);
      if (!session) {
        session = {
          id: sessionId,
          messages: [
            {
              role: 'system',
              content: context
            }
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        this.sessions.set(sessionId, session);
      } else {
        // Update context with fresh data
        session.messages[0] = {
          role: 'system',
          content: context
        };
      }

      // Add user message
      session.messages.push({
        role: 'user',
        content: userQuery
      });

      // Call AI
      const response = await axios.post(
        this.baseURL,
        {
          model: this.model,
          messages: session.messages,
          reasoning: { enabled: true }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const aiMessage = response.data.choices[0].message;

      // Add AI response to session
      session.messages.push({
        role: 'assistant',
        content: aiMessage.content
      });

      session.updatedAt = new Date().toISOString();

      // Store to Supabase
      await supabase
        .from('ai_chat_history')
        .insert({
          session_id: sessionId,
          user_message: userQuery,
          ai_response: aiMessage.content,
          mode: 'chat',
          metadata: {
            reasoning: aiMessage.reasoning_details
          }
        });

      return aiMessage.content;

    } catch (error: any) {
      console.error('RAG Query Error:', error.response?.data || error.message);
      throw new Error('Failed to process query');
    }
  }

  // Summarize dataset - only from retrieved data
  async summarize(sessionId: string): Promise<string> {
    try {
      // Load all relevant data
      const data = await this.loadRelevantData('summary');
      
      // Build context
      const context = this.buildContext(data);

      const messages: Message[] = [
        {
          role: 'system',
          content: context
        },
        {
          role: 'user',
          content: `Please provide a comprehensive summary of the agent conversation dataset based ONLY on the data provided above. Include:

1. Overall statistics and key metrics
2. Top performing agents and their characteristics
3. Most discussed topics and popular tags
4. Agent behavior patterns (Pure Agent vs Human Control scores)
5. Suspicious patterns detected (if any)
6. Network interaction insights
7. Growth trends and anomalies
8. Key insights and interesting findings

Make it detailed, well-structured, and easy to understand. Use bullet points and sections.`
        }
      ];

      // Call AI
      const response = await axios.post(
        this.baseURL,
        {
          model: this.model,
          messages,
          reasoning: { enabled: true }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const aiMessage = response.data.choices[0].message;

      // Store to Supabase
      await supabase
        .from('ai_chat_history')
        .insert({
          session_id: sessionId,
          user_message: 'Summarize dataset',
          ai_response: aiMessage.content,
          mode: 'summarize',
          metadata: {
            reasoning: aiMessage.reasoning_details,
            data_stats: {
              agents_count: data.agents.length,
              conversations_count: data.conversations.length,
              tags_count: data.tags.length,
              suspicious_patterns: data.suspiciousPatterns.length
            }
          }
        });

      return aiMessage.content;

    } catch (error: any) {
      console.error('RAG Summarize Error:', error.response?.data || error.message);
      throw new Error('Failed to generate summary');
    }
  }

  // Search specific topic - only from retrieved data
  async search(sessionId: string, searchQuery: string): Promise<string> {
    try {
      // Load relevant data
      const data = await this.loadRelevantData(searchQuery);
      
      // Build context
      const context = this.buildContext(data);

      const messages: Message[] = [
        {
          role: 'system',
          content: context
        },
        {
          role: 'user',
          content: `Search the dataset for: "${searchQuery}"

Based ONLY on the data provided above, please provide:
1. Relevant agents discussing this topic
2. Related conversations and posts
3. Associated tags and themes
4. Frequency and trends
5. Key insights about this topic

Be specific and cite examples from the data. If the topic is not found in the data, clearly state that.`
        }
      ];

      // Call AI
      const response = await axios.post(
        this.baseURL,
        {
          model: this.model,
          messages,
          reasoning: { enabled: true }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const aiMessage = response.data.choices[0].message;

      // Store to Supabase
      await supabase
        .from('ai_chat_history')
        .insert({
          session_id: sessionId,
          user_message: `Search: ${searchQuery}`,
          ai_response: aiMessage.content,
          mode: 'search',
          metadata: {
            reasoning: aiMessage.reasoning_details,
            search_query: searchQuery
          }
        });

      return aiMessage.content;

    } catch (error: any) {
      console.error('RAG Search Error:', error.response?.data || error.message);
      throw new Error('Failed to search');
    }
  }

  // Get chat history
  async getChatHistory(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (session) {
      return session.messages.filter(m => m.role !== 'system');
    }

    // Load from Supabase
    const { data } = await supabase
      .from('ai_chat_history')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (data && data.length > 0) {
      const messages: Message[] = [];
      data.forEach(record => {
        messages.push(
          { role: 'user', content: record.user_message },
          { role: 'assistant', content: record.ai_response }
        );
      });
      return messages;
    }

    return [];
  }

  // Clear session
  clearSession(sessionId: string) {
    this.sessions.delete(sessionId);
  }

  // Get all sessions
  async getAllSessions() {
    const { data } = await supabase
      .from('ai_chat_history')
      .select('session_id, created_at')
      .order('created_at', { ascending: false });

    if (!data) return [];

    // Group by session_id
    const sessions = new Map<string, any>();
    data.forEach(record => {
      if (!sessions.has(record.session_id)) {
        sessions.set(record.session_id, {
          id: record.session_id,
          createdAt: record.created_at
        });
      }
    });

    return Array.from(sessions.values());
  }
}
