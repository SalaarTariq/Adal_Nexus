/**
 * Firestore helper functions for Adal Nexus.
 * 
 * These functions provide a convenient interface for reading/writing to Firestore collections:
 * - users, posts, post_likes, forumThreads, forumReplies, forum_reply_upvotes, roadmapProgress
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db, auth } from './firebase';

/**
 * Helper to get current user's Firebase ID token.
 */
export async function getAuthToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken();
  } catch (error) {
    console.error('Error getting ID token:', error);
    return null;
  }
}

// ===== CHAT MEMORY =====

export interface ChatMemoryMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Timestamp;
}

export async function getChatMemory(userId: string, messageLimit = 20) {
  try {
    const memoryRef = collection(db, 'users', userId, 'chatMessages');
    const docs = await getDocs(query(memoryRef, orderBy('createdAt', 'asc')));

    return docs.docs
      .slice(-messageLimit)
      .map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as ChatMemoryMessage[];
  } catch (error) {
    console.error('Error fetching chat memory:', error);
    return [];
  }
}

export async function saveChatMemoryMessage(
  userId: string,
  role: 'user' | 'assistant',
  content: string
) {
  try {
    const memoryRef = collection(db, 'users', userId, 'chatMessages');
    const docRef = await addDoc(memoryRef, {
      role,
      content,
      createdAt: Timestamp.now(),
    });

    return { id: docRef.id, success: true };
  } catch (error) {
    console.error('Error saving chat memory:', error);
    return { id: '', success: false, error };
  }
}

export async function clearChatMemory(userId: string) {
  try {
    const memoryRef = collection(db, 'users', userId, 'chatMessages');
    const docs = await getDocs(query(memoryRef, orderBy('createdAt', 'asc')));

    await Promise.all(docs.docs.map((docSnap) => deleteDoc(docSnap.ref)));
    return { success: true };
  } catch (error) {
    console.error('Error clearing chat memory:', error);
    return { success: false, error };
  }
}

// ===== CHAT SESSIONS =====

export interface ChatSessionMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Timestamp;
}

export interface ChatSession {
  sessionId: string;
  userId: string;
  title: string;
  messages: ChatSessionMessage[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export async function getChatSessions(userId: string) {
  try {
    const sessionsRef = collection(db, 'chat_sessions');
    const q = query(sessionsRef, where('userId', '==', userId));
    const docs = await getDocs(q);

    const sessions = docs.docs.map((docSnap) => ({
      sessionId: docSnap.id,
      ...docSnap.data(),
    })) as ChatSession[];

    return sessions.sort((a, b) => {
      const aTs = a.updatedAt?.toMillis?.() ?? 0;
      const bTs = b.updatedAt?.toMillis?.() ?? 0;
      return bTs - aTs;
    });
  } catch (error) {
    console.error('Error fetching chat sessions:', error);
    return [];
  }
}

export async function createChatSession(userId: string, title = 'New Chat') {
  try {
    const sessionsRef = collection(db, 'chat_sessions');
    const now = Timestamp.now();
    const docRef = await addDoc(sessionsRef, {
      userId,
      title,
      messages: [],
      createdAt: now,
      updatedAt: now,
    });

    return { sessionId: docRef.id, success: true };
  } catch (error) {
    console.error('Error creating chat session:', error);
    return { sessionId: '', success: false, error };
  }
}

export async function updateChatSession(
  sessionId: string,
  updates: Partial<Pick<ChatSession, 'title' | 'messages'>>
) {
  try {
    const sessionRef = doc(db, 'chat_sessions', sessionId);
    await updateDoc(sessionRef, {
      ...updates,
      updatedAt: Timestamp.now(),
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating chat session:', error);
    return { success: false, error };
  }
}

export async function deleteChatSession(sessionId: string) {
  try {
    await deleteDoc(doc(db, 'chat_sessions', sessionId));
    return { success: true };
  } catch (error) {
    console.error('Error deleting chat session:', error);
    return { success: false, error };
  }
}

// ===== POSTS =====

export interface Post {
  postId: string;
  title: string;
  content: string;
  tags: string[];
  authorId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export async function getPosts(pageSize = 20, pageOffset = 0) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(`/api/posts?skip=${pageOffset}&limit=${pageSize}`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const posts = await response.json();
    return posts as Post[];
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('Posts request timed out');
      return [];
    }
    console.error('Error fetching posts via API:', error);
    return [];
  }
}

export async function createPost(
  user: User,
  title: string,
  content: string,
  tags: string[] = []
) {
  try {
    const token = await user.getIdToken();
    const response = await fetch('/api/posts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ title, content, tags }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API error (${response.status}):`, errorText);
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return { postId: data.postId, success: true };
  } catch (error) {
    console.error('Error creating post via API:', error);
    return { postId: '', success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function deletePost(postId: string, user: User) {
  try {
    const token = await user.getIdToken();
    const response = await fetch(`/api/posts/${postId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API error (${response.status}):`, errorText);
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting post via API:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function likePost(postId: string, user: User) {
  try {
    const token = await user.getIdToken();
    const response = await fetch(`/api/posts/${postId}/like`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API error (${response.status}):`, errorText);
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return { liked: data.liked, success: true };
  } catch (error) {
    console.error('Error toggling like via API:', error);
    return { liked: false, success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function getPostLikes(postId: string) {
  try {
    const likesRef = collection(db, 'post_likes');
    const q = query(likesRef, where('postId', '==', postId));
    const docs = await getDocs(q);
    return docs.size;
  } catch (error) {
    console.error('Error fetching post likes:', error);
    return 0;
  }
}

// ===== FORUM THREADS =====

export interface ForumThread {
  threadId: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  authorId: string;
  replyCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export async function getForumThreads(
  category?: string,
  pageOffset = 0,
  pageSize = 20
) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const url = new URL('/api/forum/threads', window.location.origin);
    if (category) url.searchParams.append('category', category);
    url.searchParams.append('skip', pageOffset.toString());
    url.searchParams.append('limit', pageSize.toString());

    const response = await fetch(url.toString(), {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const threads = await response.json();
    return threads as ForumThread[];
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('Forum threads request timed out');
      return [];
    }
    console.error('Error fetching forum threads via API:', error);
    return [];
  }
}

export async function createForumThread(
  user: User | string | null,
  title: string,
  description: string,
  category: string,
  tags: string[] = []
) {
  try {
    // Handle case where user might actually be the current user from auth
    let currentUser: User | null = typeof user === 'string' ? null : user;
    if (!currentUser) {
      // If user is a string (uid) or null, get current user
      currentUser = auth.currentUser;
    }

    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    const token = await currentUser.getIdToken();
    const response = await fetch('/api/forum/threads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ title, description, category, tags }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API error (${response.status}):`, errorText);
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return { threadId: data.threadId, success: true };
  } catch (error) {
    console.error('Error creating forum thread via API:', error);
    return { threadId: '', success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// ===== FORUM REPLIES =====

export interface ForumReply {
  replyId: string;
  threadId: string;
  content: string;
  authorId: string;
  upvoteCount: number;
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}

export async function getForumReplies(threadId: string) {
  try {
    const response = await fetch(`/api/forum/threads/${threadId}/replies`);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const replies = await response.json();
    return replies as ForumReply[];
  } catch (error) {
    console.error('Error fetching forum replies via API:', error);
    try {
      const repliesRef = collection(db, 'forumReplies');
      const q = query(repliesRef, where('threadId', '==', threadId));
      const docs = await getDocs(q);
      const replies = docs.docs.map((docSnap) => ({
        replyId: docSnap.id,
        ...(docSnap.data() as Omit<ForumReply, 'replyId'>),
      }));
      return replies.sort((a, b) => {
        const aValue = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : Date.parse(String(a.createdAt));
        const bValue = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : Date.parse(String(b.createdAt));
        return aValue - bValue;
      });
    } catch (fallbackError) {
      console.error('Error fetching forum replies via Firestore:', fallbackError);
      return [];
    }
  }
}

export async function addForumReply(
  threadId: string,
  user: User | string | null,
  content: string
) {
  try {
    let currentUser: User | null = typeof user === 'string' ? null : user;
    if (!currentUser) {
      currentUser = auth.currentUser;
    }

    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    const token = await currentUser.getIdToken();
    const response = await fetch(`/api/forum/threads/${threadId}/replies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API error (${response.status}):`, errorText);
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as ForumReply;
    return { replyId: data.replyId, reply: data, success: true };
  } catch (error) {
    console.error('Error adding forum reply via API:', error);
    return {
      replyId: '',
      reply: null,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function upvoteReply(replyId: string, user: User | string | null) {
  try {
    let currentUser: User | null = typeof user === 'string' ? null : user;
    if (!currentUser) {
      currentUser = auth.currentUser;
    }

    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    const token = await currentUser.getIdToken();
    const response = await fetch(`/api/forum/replies/${replyId}/upvote`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API error (${response.status}):`, errorText);
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return { upvoted: data.upvoted, success: true };
  } catch (error) {
    console.error('Error upvoting reply via API:', error);
    return { upvoted: false, success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// ===== ROADMAP PROGRESS =====

export interface RoadmapProgress {
  year1: { [key: string]: boolean };
  year2: { [key: string]: boolean };
  year3: { [key: string]: boolean };
  year4: { [key: string]: boolean };
  updatedAt: Timestamp;
}

export async function getRoadmapProgress(userId: string) {
  try {
    const progressRef = doc(db, 'roadmapProgress', userId);
    const docSnap = await getDoc(progressRef);

    if (docSnap.exists()) {
      return docSnap.data() as RoadmapProgress;
    }
    // Return empty structure if doesn't exist
    return {
      year1: {},
      year2: {},
      year3: {},
      year4: {},
      updatedAt: Timestamp.now(),
    };
  } catch (error) {
    console.error('Error fetching roadmap progress:', error);
    return {
      year1: {},
      year2: {},
      year3: {},
      year4: {},
      updatedAt: Timestamp.now(),
    };
  }
}

export async function updateMilestone(
  userId: string,
  year: number,
  milestone: string,
  completed: boolean
) {
  try {
    const progressRef = doc(db, 'roadmapProgress', userId);
    const yearKey = `year${year}`;

    const existingDoc = await getDoc(progressRef);

    if (!existingDoc.exists()) {
      await setDoc(progressRef, {
        [yearKey]: {
          [milestone]: completed,
        },
        updatedAt: Timestamp.now(),
      });
    } else {
      await updateDoc(progressRef, {
        [`${yearKey}.${milestone}`]: completed,
        updatedAt: Timestamp.now(),
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating milestone:', error);
    return { success: false, error };
  }
}

// ===== USERS (PROFILE) =====

export interface Achievement {
  title: string;
  year: string;
  description?: string;
}

export interface Experience {
  title: string;
  organization: string;
  startDate: string;
  endDate?: string;
  description?: string;
  current?: boolean;
}

export interface Project {
  title: string;
  role?: string;
  description: string;
  link?: string;
  year?: string;
}

export interface SocialLinks {
  linkedin?: string;
  twitter?: string;
  github?: string;
  website?: string;
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  profilePhotoURL: string;
  userType: 'student' | 'lawyer' | 'judge';
  year?: number;
  specialisations: string[];
  bio: string;
  experience?: Experience[];
  achievements?: Achievement[];
  projects?: Project[];
  socialLinks?: SocialLinks;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export async function getUserProfile(userId: string) {
  try {
    const userRef = doc(db, 'users', userId);
    const docSnap = await getDoc(userRef);

    if (docSnap.exists()) {
      return { uid: userId, ...docSnap.data() } as UserProfile;
    }
    return null;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
}

export async function createUserProfile(
  userId: string,
  email: string,
  name: string,
  userType: 'student' | 'lawyer' | 'judge' = 'student'
) {
  try {
    // Get Firebase token from the current user (who was just created)
    const user = auth.currentUser;
    if (!user) {
      return { success: false, error: 'No authenticated user found' };
    }
    
    const token = await user.getIdToken();
    
    // Call backend endpoint to create profile (uses admin privileges)
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name,
        email,
        userType,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Profile creation API error (${response.status}):`, errorText);
      throw new Error(`Failed to create profile: ${response.status}`);
    }

    return { success: true };
  } catch (error) {
    console.error('Error creating user profile:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function updateUserProfile(userOrUid: User | string, updates: Partial<UserProfile>) {
  try {
    // Handle both User object and uid string
    let token: string;
    
    if (typeof userOrUid === 'string') {
      // If uid string is passed, get token from current auth user
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('No authenticated user found');
      }
      token = await currentUser.getIdToken();
    } else {
      // If User object is passed
      token = await userOrUid.getIdToken();
    }
    
    const response = await fetch('/api/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API error (${response.status}):`, errorText);
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating user profile via API:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
