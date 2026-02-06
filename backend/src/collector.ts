import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import axios from 'axios';
import { LRUCache } from './lru-cache';
import { storeConversation, upsertAgent } from './supabase-service';
import type {
  AgentClaim,
  ForumPost,
  ForumComment,
  ConversationHistoryEntry,
  ConversationEntry
} from './types';

export class ForumDatasetCollector {
  private readonly API_BASE = 'https://agents.colosseum.com/api';
  private readonly OUTPUT_DIR: string;
  private readonly DATASET_FILE: string;
  private lastCollectionTime: Date = new Date(0);
  private knownEntries: Set<string> = new Set();
  private conversationThreads: LRUCache<number, ConversationHistoryEntry[]> = new LRUCache(1000); // Limit to 1000 threads
  private isCollecting = false;

  constructor(outputDir?: string) {
    this.OUTPUT_DIR = outputDir || path.join(__dirname, '../../datasets');
    this.DATASET_FILE = path.join(this.OUTPUT_DIR, 'agent-conversations.jsonl');
    this.ensureOutputDir();
    this.loadExistingData();
  }

  private async ensureOutputDir(): Promise<void> {
    if (!existsSync(this.OUTPUT_DIR)) {
      await fs.mkdir(this.OUTPUT_DIR, { recursive: true });
    }
  }

  private async loadExistingData(): Promise<void> {
    if (existsSync(this.DATASET_FILE)) {
      const data = await fs.readFile(this.DATASET_FILE, 'utf-8');
      const lines = data.split('\n').filter(Boolean);
      lines.forEach((line: string) => {
        try {
          const entry: ConversationEntry = JSON.parse(line);
          const key = `${entry.type}-${entry.id}`;
          this.knownEntries.add(key);
          
          const entryTime = new Date(entry.createdAt);
          if (entryTime > this.lastCollectionTime) {
            this.lastCollectionTime = entryTime;
          }
        } catch (error) {
          console.warn('Failed to parse existing entry:', error);
        }
      });
      
      console.log(`✅ Loaded ${this.knownEntries.size} existing entries`);
    }
  }

  async collectForumData(): Promise<{ added: number; total: number }> {
    if (this.isCollecting) {
      console.log('⏳ Collection already in progress...');
      return { added: 0, total: this.knownEntries.size };
    }

    this.isCollecting = true;
    console.log(`[${new Date().toISOString()}] 🔄 Starting collection...`);
    
    try {
      const posts = await this.fetchAllPosts();
      const allEntries: ConversationEntry[] = [];
      
      for (const post of posts) {
        const postEntry = this.convertPostToEntry(post);
        const key = `${postEntry.type}-${postEntry.id}`;
        
        if (!this.knownEntries.has(key)) {
          allEntries.push(postEntry);
          this.knownEntries.add(key);
        }
        
        const comments = await this.fetchPostComments(post.id);
        
        for (const comment of comments) {
          const commentEntry = this.convertCommentToEntry(comment, post);
          const commentKey = `${commentEntry.type}-${commentEntry.id}`;
          
          if (!this.knownEntries.has(commentKey)) {
            allEntries.push(commentEntry);
            this.knownEntries.add(commentKey);
          }
        }
        
        await this.sleep(100);
      }
      
      allEntries.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      
      if (allEntries.length > 0) {
        // Save to local file (for backup)
        const jsonlData = allEntries.map(entry => JSON.stringify(entry)).join('\n') + '\n';
        await fs.appendFile(this.DATASET_FILE, jsonlData);
        console.log(`✅ Added ${allEntries.length} new entries`);
        
        // Save to Supabase database
        console.log(`📝 Storing ${allEntries.length} conversations to Supabase...`);
        let storedCount = 0;
        for (const entry of allEntries) {
          try {
            // Store conversation
            await storeConversation({
              conversation_id: entry.id,
              type: entry.type,
              agent_id: entry.agentId,
              content: entry.content,
              title: entry.title,
              post_id: entry.type === 'comment' ? entry.id : undefined,
              upvotes: entry.upvotes,
              downvotes: entry.downvotes,
              score: entry.score,
              pure_agent_score: entry.pureAgentScore,
              human_control_score: entry.humanControlScore,
              analysis_reason: entry.analysisReason,
              reply_to_agent: entry.conversationContext?.replyToAgent,
              thread_depth: entry.conversationContext?.threadDepth,
              created_at: entry.createdAt
            });
            
            // Upsert agent
            await upsertAgent({
              agent_id: entry.agentId,
              agent_name: entry.agentName,
              x_username: entry.agentClaim?.xUsername,
              x_profile_image_url: entry.agentClaim?.xProfileImageUrl,
              first_seen: entry.createdAt,
              last_seen: entry.createdAt
            });
            
            storedCount++;
          } catch (error) {
            console.error(`Error storing entry ${entry.id}:`, error);
          }
        }
        console.log(`✅ Stored ${storedCount}/${allEntries.length} conversations to Supabase`);
      }
      
      return { added: allEntries.length, total: this.knownEntries.size };
    } catch (error) {
      console.error('❌ Error collecting data:', error);
      return { added: 0, total: this.knownEntries.size };
    } finally {
      this.isCollecting = false;
    }
  }

  private async fetchAllPosts(limit: number = 100): Promise<ForumPost[]> {
    try {
      const response = await axios.get(`${this.API_BASE}/forum/posts`, {
        params: { sort: 'new', limit }
      });
      return response.data.posts || [];
    } catch (error) {
      console.error('Error fetching posts:', error);
      return [];
    }
  }

  private async fetchPostComments(postId: number): Promise<ForumComment[]> {
    try {
      const response = await axios.get(`${this.API_BASE}/forum/posts/${postId}/comments`, {
        params: { sort: 'new', limit: 100 }
      });
      return response.data.comments || [];
    } catch (error) {
      return [];
    }
  }

  private convertPostToEntry(post: ForumPost): ConversationEntry {
    const historyEntry: ConversationHistoryEntry = {
      agentName: post.agentName,
      content: post.body,
      timestamp: post.createdAt,
      messageType: 'post'
    };
    
    this.conversationThreads.set(post.id, [historyEntry]);

    return {
      timestamp: new Date().toISOString(),
      type: 'post',
      id: post.id,
      agentId: post.agentId,
      agentName: post.agentName,
      agentClaim: post.agentClaim,
      content: post.body,
      title: post.title,
      tags: post.tags,
      upvotes: post.upvotes,
      downvotes: post.downvotes,
      score: post.score,
      isDeleted: post.isDeleted,
      createdAt: post.createdAt,
      editedAt: post.editedAt,
      conversationContext: {
        threadDepth: 1,
        conversationHistory: [historyEntry]
      },
      ...this.analyzeAgentBehavior(post.body, post.agentName, 'post', undefined, [historyEntry])
    };
  }

  private convertCommentToEntry(comment: ForumComment, post: ForumPost): ConversationEntry {
    const threadHistory = this.conversationThreads.get(post.id) || [];
    
    let responseTime: number | undefined;
    if (threadHistory.length > 0) {
      const lastMessage = threadHistory[threadHistory.length - 1];
      const lastTime = new Date(lastMessage.timestamp).getTime();
      const currentTime = new Date(comment.createdAt).getTime();
      responseTime = Math.round((currentTime - lastTime) / 1000);
    }

    const historyEntry: ConversationHistoryEntry = {
      agentName: comment.agentName,
      content: comment.body,
      timestamp: comment.createdAt,
      messageType: 'comment'
    };
    
    threadHistory.push(historyEntry);
    this.conversationThreads.set(post.id, threadHistory);

    return {
      timestamp: new Date().toISOString(),
      type: 'comment',
      id: comment.id,
      agentId: comment.agentId,
      agentName: comment.agentName,
      agentClaim: comment.agentClaim,
      content: comment.body,
      postId: comment.postId,
      upvotes: comment.upvotes,
      downvotes: comment.downvotes,
      score: comment.score,
      isDeleted: comment.isDeleted,
      createdAt: comment.createdAt,
      editedAt: comment.editedAt,
      conversationContext: {
        replyToAgent: post.agentName,
        threadDepth: threadHistory.length,
        responseTime,
        conversationHistory: threadHistory.slice(-5)
      },
      ...this.analyzeAgentBehavior(comment.body, comment.agentName, 'comment', post.agentName, threadHistory)
    };
  }

  private analyzeAgentBehavior(
    content: string, 
    agentName: string, 
    type: 'post' | 'comment',
    replyToAgent?: string,
    conversationHistory?: ConversationHistoryEntry[]
  ): { pureAgentScore: number; humanControlScore: number; analysisReason: string } {
    let pureAgentScore = 50;
    let humanControlScore = 50;
    const reasons: string[] = [];

    if (content.includes('##') || content.includes('**') || content.includes('```')) {
      pureAgentScore += 10;
      reasons.push('structured_formatting');
    }
    
    const technicalPatterns = [
      /\d+\+?\s*(lines of code|LOC)/i,
      /\d+\.\d+%/,
      /\d+ms|seconds|minutes/,
      /API|SDK|REST|JSON/i,
      /GitHub|repo|repository/i
    ];
    const technicalMatches = technicalPatterns.filter(pattern => pattern.test(content)).length;
    if (technicalMatches >= 2) {
      pureAgentScore += 15;
      reasons.push('technical_precision');
    }

    const casualPatterns = [
      /lol|haha|😂|🤣/i,
      /tbh|honestly|personally/i,
      /i think|i feel|in my opinion/i,
      /btw|by the way/i
    ];
    const casualMatches = casualPatterns.filter(pattern => pattern.test(content)).length;
    if (casualMatches >= 1) {
      humanControlScore += 15;
      reasons.push('casual_language');
    }

    pureAgentScore = Math.max(0, Math.min(100, pureAgentScore));
    humanControlScore = Math.max(0, Math.min(100, humanControlScore));
    
    const total = pureAgentScore + humanControlScore;
    if (total > 0) {
      pureAgentScore = Math.round((pureAgentScore / total) * 100);
      humanControlScore = 100 - pureAgentScore;
    }

    return {
      pureAgentScore,
      humanControlScore,
      analysisReason: reasons.join(', ') || 'neutral_baseline'
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getDatasetStats(): { totalEntries: number; posts: number; comments: number; agents: Set<string> } {
    if (!existsSync(this.DATASET_FILE)) {
      return { totalEntries: 0, posts: 0, comments: 0, agents: new Set() };
    }

    // Use knownEntries for quick stats instead of reading file
    let posts = 0;
    let comments = 0;
    
    this.knownEntries.forEach(key => {
      if (key.startsWith('post-')) posts++;
      if (key.startsWith('comment-')) comments++;
    });

    return { 
      totalEntries: this.knownEntries.size, 
      posts, 
      comments, 
      agents: new Set() // Would need to track separately for accuracy
    };
  }
}
