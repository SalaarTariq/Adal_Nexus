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
  limit,
  Query,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';

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
    const postsRef = collection(db, 'posts');
    const q = query(postsRef, orderBy('createdAt', 'desc'), limit(pageSize));
    const docs = await getDocs(q);
    return docs.docs.map((doc) => ({
      postId: doc.id,
      ...doc.data(),
    })) as Post[];
  } catch (error) {
    console.error('Error fetching posts:', error);
    return [];
  }
}

export async function createPost(
  authorId: string,
  title: string,
  content: string,
  tags: string[] = []
) {
  try {
    const postsRef = collection(db, 'posts');
    const docRef = await addDoc(postsRef, {
      title,
      content,
      tags,
      authorId,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return { postId: docRef.id, success: true };
  } catch (error) {
    console.error('Error creating post:', error);
    return { postId: '', success: false, error };
  }
}

export async function likePost(postId: string, userId: string) {
  try {
    const likesRef = collection(db, 'post_likes');
    // Check if already liked
    const q = query(likesRef, where('postId', '==', postId), where('userId', '==', userId));
    const existing = await getDocs(q);

    if (existing.size > 0) {
      // Unlike: delete the document
      await deleteDoc(existing.docs[0].ref);
      return { liked: false, success: true };
    } else {
      // Like: add new document
      await addDoc(likesRef, {
        postId,
        userId,
        createdAt: Timestamp.now(),
      });
      return { liked: true, success: true };
    }
  } catch (error) {
    console.error('Error liking post:', error);
    return { liked: false, success: false, error };
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
  tags?: string[],
  pageSize = 20,
  pageOffset = 0
) {
  try {
    const threadsRef = collection(db, 'forumThreads');
    let q: Query;

    if (category) {
      q = query(threadsRef, where('category', '==', category), orderBy('createdAt', 'desc'), limit(pageSize));
    } else {
      q = query(threadsRef, orderBy('createdAt', 'desc'), limit(pageSize));
    }

    const docs = await getDocs(q);
    let threads = docs.docs.map((doc) => ({
      threadId: doc.id,
      ...doc.data(),
    })) as ForumThread[];

    // Client-side filter by tags if provided
    if (tags && tags.length > 0) {
      threads = threads.filter((t) =>
        tags.some((tag) => t.tags.includes(tag))
      );
    }

    return threads;
  } catch (error) {
    console.error('Error fetching forum threads:', error);
    return [];
  }
}

export async function createForumThread(
  authorId: string,
  title: string,
  description: string,
  category: string,
  tags: string[] = []
) {
  try {
    const threadsRef = collection(db, 'forumThreads');
    const docRef = await addDoc(threadsRef, {
      title,
      description,
      category,
      tags,
      authorId,
      replyCount: 0,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return { threadId: docRef.id, success: true };
  } catch (error) {
    console.error('Error creating forum thread:', error);
    return { threadId: '', success: false, error };
  }
}

// ===== FORUM REPLIES =====

export interface ForumReply {
  replyId: string;
  threadId: string;
  content: string;
  authorId: string;
  upvoteCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export async function getForumReplies(threadId: string) {
  try {
    const repliesRef = collection(db, 'forumReplies');
    const q = query(repliesRef, where('threadId', '==', threadId), orderBy('createdAt', 'asc'));
    const docs = await getDocs(q);
    return docs.docs.map((doc) => ({
      replyId: doc.id,
      ...doc.data(),
    })) as ForumReply[];
  } catch (error) {
    console.error('Error fetching forum replies:', error);
    return [];
  }
}

export async function addForumReply(
  threadId: string,
  authorId: string,
  content: string
) {
  try {
    const repliesRef = collection(db, 'forumReplies');
    const docRef = await addDoc(repliesRef, {
      threadId,
      content,
      authorId,
      upvoteCount: 0,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    // Increment thread's replyCount
    const threadRef = doc(db, 'forumThreads', threadId);
    const threadSnap = await getDoc(threadRef);
    await updateDoc(threadRef, {
      replyCount: (threadSnap.data()?.replyCount || 0) + 1,
    });

    return { replyId: docRef.id, success: true };
  } catch (error) {
    console.error('Error adding forum reply:', error);
    return { replyId: '', success: false, error };
  }
}

export async function upvoteReply(replyId: string, userId: string) {
  try {
    const upvotesRef = collection(db, 'forum_reply_upvotes');
    // Check if already upvoted
    const q = query(upvotesRef, where('replyId', '==', replyId), where('userId', '==', userId));
    const existing = await getDocs(q);

    if (existing.size > 0) {
      // Remove upvote
      await deleteDoc(existing.docs[0].ref);
      const replyRef = doc(db, 'forumReplies', replyId);
      await updateDoc(replyRef, {
        upvoteCount: Math.max(0, ((await getDoc(replyRef)).data()?.upvoteCount || 0) - 1),
      });
      return { upvoted: false, success: true };
    } else {
      // Add upvote
      await addDoc(upvotesRef, {
        replyId,
        userId,
        createdAt: Timestamp.now(),
      });
      const replyRef = doc(db, 'forumReplies', replyId);
      await updateDoc(replyRef, {
        upvoteCount: ((await getDoc(replyRef)).data()?.upvoteCount || 0) + 1,
      });
      return { upvoted: true, success: true };
    }
  } catch (error) {
    console.error('Error upvoting reply:', error);
    return { upvoted: false, success: false, error };
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

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  profilePhotoURL: string;
  userType: 'student' | 'lawyer' | 'judge';
  year?: number;
  specialisations: string[];
  bio: string;
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
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, {
      name,
      email,
      userType,
      profilePhotoURL: '',
      year: userType === 'student' ? 1 : undefined,
      specialisations: [],
      bio: '',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return { success: true };
  } catch (error) {
    console.error('Error creating user profile:', error);
    return { success: false, error };
  }
}

export async function updateUserProfile(userId: string, updates: Partial<UserProfile>) {
  try {
    const userRef = doc(db, 'users', userId);
    const safeUpdates: Record<string, any> = {
      ...updates,
      updatedAt: Timestamp.now(),
      uid: undefined, // Remove uid from updates
    };
    // Remove undefined fields
    Object.keys(safeUpdates).forEach((key) => {
      if (safeUpdates[key] === undefined) {
        delete safeUpdates[key];
      }
    });

    await updateDoc(userRef, safeUpdates);
    return { success: true };
  } catch (error) {
    console.error('Error updating user profile:', error);
    return { success: false, error };
  }
}
