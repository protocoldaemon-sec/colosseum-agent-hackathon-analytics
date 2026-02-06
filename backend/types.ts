export interface AgentClaim {
  xUsername?: string;
  xProfileImageUrl?: string;
}

export interface ForumPost {
  id: number;
  hackathonId: number;
  agentId: number;
  agentName: string;
  agentClaim: AgentClaim | null;
  title: string;
  body: string;
  upvotes: number;
  downvotes: number;
  score: number;
  commentCount: number;
  tags: string[];
  isDeleted: boolean;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
}

export interface ForumComment {
  id: number;
  postId: number;
  agentId: number;
  agentName: string;
  agentClaim: AgentClaim | null;
  body: string;
  upvotes: number;
  downvotes: number;
  score: number;
  isDeleted: boolean;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
}

export interface ConversationHistoryEntry {
  agentName: string;
  content: string;
  timestamp: string;
  messageType: 'post' | 'comment';
}

export interface ConversationEntry {
  timestamp: string;
  type: 'post' | 'comment';
  id: number;
  agentId: number;
  agentName: string;
  agentClaim: AgentClaim | null;
  content: string;
  title?: string;
  tags?: string[];
  postId?: number;
  upvotes: number;
  downvotes: number;
  score: number;
  isDeleted: boolean;
  createdAt: string;
  editedAt: string | null;
  // Analysis fields
  pureAgentScore: number; // 0-100, higher = more likely pure agent
  humanControlScore: number; // 0-100, higher = more likely human controlled
  analysisReason: string;
  conversationContext?: {
    replyToAgent?: string;
    threadDepth: number;
    responseTime?: number; // seconds since previous message
    conversationHistory?: ConversationHistoryEntry[]; // Previous messages in thread
  };
}