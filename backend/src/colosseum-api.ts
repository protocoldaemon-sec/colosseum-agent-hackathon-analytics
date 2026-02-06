import axios from 'axios';

const API_BASE = 'https://agents.colosseum.com/api';

export interface ColosseumPost {
  id: number;
  hackathonId: number;
  agentId: number;
  agentName: string;
  agentClaim: {
    xUsername?: string;
    xProfileImageUrl?: string;
  } | null;
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

export interface ColosseumComment {
  id: number;
  postId: number;
  agentId: number;
  agentName: string;
  agentClaim: {
    xUsername?: string;
    xProfileImageUrl?: string;
  } | null;
  body: string;
  upvotes: number;
  downvotes: number;
  score: number;
  isDeleted: boolean;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
}

export interface ColosseumProject {
  id: number;
  hackathonId: number;
  name: string;
  slug: string;
  description: string;
  repoLink: string;
  solanaIntegration: string;
  technicalDemoLink?: string;
  presentationLink?: string;
  tags: string[];
  status: 'draft' | 'submitted';
  humanUpvotes: number;
  agentUpvotes: number;
  teamId: number;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
}

export class ColosseumAPI {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 30000; // 30 seconds

  private async fetchWithCache<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const cached = this.cache.get(key);
    const now = Date.now();

    if (cached && now - cached.timestamp < this.CACHE_TTL) {
      return cached.data as T;
    }

    try {
      const data = await fetcher();
      this.cache.set(key, { data, timestamp: now });
      return data;
    } catch (error) {
      // If fetch fails but we have stale cache, return it
      if (cached) {
        console.warn(`API fetch failed for ${key}, using stale cache`);
        return cached.data as T;
      }
      throw error;
    }
  }

  async getPosts(params: {
    sort?: 'hot' | 'new' | 'top';
    limit?: number;
    offset?: number;
    tags?: string[];
  } = {}): Promise<{ posts: ColosseumPost[]; total: number }> {
    const { sort = 'new', limit = 100, offset = 0, tags = [] } = params;
    const cacheKey = `posts_${sort}_${limit}_${offset}_${tags.join(',')}`;

    return this.fetchWithCache(cacheKey, async () => {
      const queryParams = new URLSearchParams({
        sort,
        limit: limit.toString(),
        offset: offset.toString()
      });

      tags.forEach(tag => queryParams.append('tags', tag));

      const response = await axios.get(`${API_BASE}/forum/posts?${queryParams}`);
      return response.data;
    });
  }

  async getPost(postId: number): Promise<ColosseumPost> {
    const cacheKey = `post_${postId}`;

    return this.fetchWithCache(cacheKey, async () => {
      const response = await axios.get(`${API_BASE}/forum/posts/${postId}`);
      return response.data.post;
    });
  }

  async getComments(postId: number, params: {
    sort?: 'hot' | 'new' | 'top';
    limit?: number;
    offset?: number;
  } = {}): Promise<{ comments: ColosseumComment[]; total: number }> {
    const { sort = 'new', limit = 100, offset = 0 } = params;
    const cacheKey = `comments_${postId}_${sort}_${limit}_${offset}`;

    return this.fetchWithCache(cacheKey, async () => {
      const queryParams = new URLSearchParams({
        sort,
        limit: limit.toString(),
        offset: offset.toString()
      });

      const response = await axios.get(`${API_BASE}/forum/posts/${postId}/comments?${queryParams}`);
      return response.data;
    });
  }

  async getProjects(params: {
    includeDrafts?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ projects: ColosseumProject[]; total: number }> {
    const { includeDrafts = false, limit = 100, offset = 0 } = params;
    const cacheKey = `projects_${includeDrafts}_${limit}_${offset}`;

    return this.fetchWithCache(cacheKey, async () => {
      const queryParams = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString()
      });

      if (includeDrafts) {
        queryParams.append('includeDrafts', 'true');
      }

      const response = await axios.get(`${API_BASE}/projects?${queryParams}`);
      return response.data;
    });
  }

  async getLeaderboard(params: {
    limit?: number;
    offset?: number;
  } = {}): Promise<{ projects: ColosseumProject[]; total: number }> {
    const { limit = 50, offset = 0 } = params;
    const cacheKey = `leaderboard_${limit}_${offset}`;

    return this.fetchWithCache(cacheKey, async () => {
      const queryParams = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString()
      });

      const response = await axios.get(`${API_BASE}/leaderboard?${queryParams}`);
      return response.data;
    });
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}
