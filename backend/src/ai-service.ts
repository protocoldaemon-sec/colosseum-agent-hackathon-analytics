import axios from 'axios';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { LRUCache } from './lru-cache';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  reasoning_details?: any;
}

interface ChatHistory {
  id: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
  title?: string;
}

export class AIService {
  private apiKey: string;
  private baseURL = 'https://openrouter.ai/api/v1/chat/completions';
  private model = 'nvidia/nemotron-3-nano-30b-a3b:free';
  private datasetsPath: string;
  private chatHistories: LRUCache<string, ChatHistory> = new LRUCache(100); // Limit to 100 sessions

  constructor(apiKey: string, datasetsPath: string) {
    this.apiKey = apiKey;
    this.datasetsPath = datasetsPath;
  }

  private async callOpenRouter(messages: Message[], enableReasoning = true) {
    try {
      const response = await axios.post(
        this.baseURL,
        {
          model: this.model,
          messages,
          reasoning: {
            enabled: enableReasoning
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.choices[0].message;
    } catch (error: any) {
      console.error('OpenRouter API Error:', error.response?.data || error.message);
      throw new Error('Failed to get AI response');
    }
  }

  private loadDatasets() {
    const datasets: any = {
      conversations: [],
      agents: [],
      analysis: null
    };

    try {
      // Load conversations
      const conversationsPath = join(this.datasetsPath, 'agent-conversations.jsonl');
      if (existsSync(conversationsPath)) {
        const data = readFileSync(conversationsPath, 'utf-8');
        datasets.conversations = data.trim().split('\n').map(line => JSON.parse(line));
      }

      // Load agents
      const agentsPath = join(this.datasetsPath, 'agent-profiles.json');
      if (existsSync(agentsPath)) {
        const data = readFileSync(agentsPath, 'utf-8');
        datasets.agents = JSON.parse(data);
      }

      // Load analysis
      const analysisPath = join(this.datasetsPath, 'analysis-report.json');
      if (existsSync(analysisPath)) {
        const data = readFileSync(analysisPath, 'utf-8');
        datasets.analysis = JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading datasets:', error);
    }

    return datasets;
  }

  private buildContextPrompt(datasets: any): string {
    const { conversations, agents, analysis } = datasets;

    let context = `You are an AI assistant analyzing agent conversation data from a forum. Here's the dataset context:\n\n`;

    // Overview
    if (analysis?.overview) {
      context += `## Overview\n`;
      context += `- Total Entries: ${analysis.overview.totalEntries}\n`;
      context += `- Total Posts: ${analysis.overview.totalPosts}\n`;
      context += `- Total Comments: ${analysis.overview.totalComments}\n`;
      context += `- Unique Agents: ${analysis.overview.uniqueAgents}\n\n`;
    }

    // Top Agents
    if (agents.length > 0) {
      context += `## Top 10 Agents\n`;
      agents.slice(0, 10).forEach((agent: any, i: number) => {
        context += `${i + 1}. ${agent.agentName} - ${agent.totalMessages} messages (${agent.posts} posts, ${agent.comments} comments)\n`;
        context += `   Pure Agent Score: ${agent.avgPureScore.toFixed(1)}%, Human Control: ${agent.avgHumanScore.toFixed(1)}%\n`;
        if (agent.tags && agent.tags.length > 0) {
          context += `   Tags: ${agent.tags.slice(0, 5).join(', ')}\n`;
        }
      });
      context += `\n`;
    }

    // Recent conversations sample
    if (conversations.length > 0) {
      context += `## Recent Conversations Sample (Last 20)\n`;
      conversations.slice(-20).forEach((conv: any) => {
        context += `- [${conv.type}] ${conv.agentName}: "${conv.content.substring(0, 100)}..."\n`;
        if (conv.tags && conv.tags.length > 0) {
          context += `  Tags: ${conv.tags.join(', ')}\n`;
        }
      });
      context += `\n`;
    }

    context += `Use this data to answer questions about agent behavior, topics, trends, and insights.\n`;
    context += `When searching for topics or agents, be thorough and provide specific examples from the data.\n`;

    return context;
  }

  async summarizeDataset(): Promise<string> {
    const datasets = this.loadDatasets();
    const contextPrompt = this.buildContextPrompt(datasets);

    const messages: Message[] = [
      {
        role: 'system',
        content: contextPrompt
      },
      {
        role: 'user',
        content: `Please provide a comprehensive summary of the agent conversation dataset. Include:
1. Overall statistics and trends
2. Top performing agents and their characteristics
3. Most discussed topics and tags
4. Agent behavior patterns (Pure Agent vs Human Control)
5. Key insights and interesting findings

Make it detailed but easy to understand.`
      }
    ];

    const response = await this.callOpenRouter(messages);
    return response.content;
  }

  async searchAgentTopics(query: string): Promise<string> {
    const datasets = this.loadDatasets();
    const contextPrompt = this.buildContextPrompt(datasets);

    const messages: Message[] = [
      {
        role: 'system',
        content: contextPrompt
      },
      {
        role: 'user',
        content: `Search the dataset for: "${query}"

Please provide:
1. Relevant agents discussing this topic
2. Related conversations and posts
3. Associated tags and themes
4. Frequency and trends
5. Key insights about this topic

Be specific and cite examples from the data.`
      }
    ];

    const response = await this.callOpenRouter(messages);
    return response.content;
  }

  async chat(chatId: string, userMessage: string): Promise<{ response: string; chatId: string }> {
    const datasets = this.loadDatasets();
    const contextPrompt = this.buildContextPrompt(datasets);

    // Get or create chat history
    let chatHistory = this.chatHistories.get(chatId);
    if (!chatHistory) {
      chatHistory = {
        id: chatId,
        messages: [
          {
            role: 'system',
            content: contextPrompt
          }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.chatHistories.set(chatId, chatHistory);
    }

    // Add user message
    chatHistory.messages.push({
      role: 'user',
      content: userMessage
    });

    // Get AI response
    const aiResponse = await this.callOpenRouter(chatHistory.messages);

    // Add assistant message with reasoning details
    chatHistory.messages.push({
      role: 'assistant',
      content: aiResponse.content,
      reasoning_details: aiResponse.reasoning_details
    });

    chatHistory.updatedAt = new Date().toISOString();

    // Auto-generate title from first message
    if (!chatHistory.title && chatHistory.messages.length === 3) {
      chatHistory.title = userMessage.substring(0, 50) + (userMessage.length > 50 ? '...' : '');
    }

    return {
      response: aiResponse.content,
      chatId: chatHistory.id
    };
  }

  getChatHistory(chatId: string): ChatHistory | null {
    return this.chatHistories.get(chatId) || null;
  }

  getAllChatHistories(): ChatHistory[] {
    return Array.from(this.chatHistories.values()).sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  deleteChatHistory(chatId: string): boolean {
    return this.chatHistories.delete(chatId);
  }

  clearAllChatHistories(): void {
    this.chatHistories.clear();
  }

  async analyzeAgent(agentName: string): Promise<string> {
    const datasets = this.loadDatasets();
    const agent = datasets.agents.find((a: any) => 
      a.agentName.toLowerCase() === agentName.toLowerCase()
    );

    if (!agent) {
      return `Agent "${agentName}" not found in the dataset.`;
    }

    const agentConversations = datasets.conversations.filter((c: any) => 
      c.agentName.toLowerCase() === agentName.toLowerCase()
    );

    const contextPrompt = this.buildContextPrompt(datasets);

    const messages: Message[] = [
      {
        role: 'system',
        content: contextPrompt
      },
      {
        role: 'user',
        content: `Analyze the agent "${agentName}" in detail:

Agent Profile:
- Total Messages: ${agent.totalMessages}
- Posts: ${agent.posts}
- Comments: ${agent.comments}
- Pure Agent Score: ${agent.avgPureScore.toFixed(1)}%
- Human Control Score: ${agent.avgHumanScore.toFixed(1)}%
- Tags: ${agent.tags?.join(', ') || 'None'}

Recent Conversations (${agentConversations.length} total):
${agentConversations.slice(-10).map((c: any) => `- [${c.type}] "${c.content.substring(0, 100)}..."`).join('\n')}

Please provide:
1. Agent behavior analysis
2. Communication style and patterns
3. Main topics and interests
4. Engagement metrics
5. Unique characteristics
6. Comparison with other agents`
      }
    ];

    const response = await this.callOpenRouter(messages);
    return response.content;
  }
}
