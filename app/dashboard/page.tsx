'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers';
import { getPosts, getForumThreads, deletePost, Post, ForumThread } from '@/lib/firestore';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, LogOut, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const router = useRouter();
  const { user, profile, logout, loading: authLoading } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && !authLoading) {
      // Load posts first (more important for initial view)
      loadPosts();
      // Load threads separately (can load in background)
      loadThreads();
    }
  }, [user, authLoading]);

  async function loadPosts() {
    try {
      setPostsLoading(true);
      const postsData = await getPosts(10, 0);
      setPosts(postsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading posts');
    } finally {
      setPostsLoading(false);
    }
  }

  async function loadThreads() {
    try {
      setThreadsLoading(true);
      const threadsData = await getForumThreads(undefined, 0, 5);
      setThreads(threadsData);
    } catch (err) {
      console.error('Error loading threads:', err);
    } finally {
      setThreadsLoading(false);
    }
  }

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const handleDeletePost = async (e: React.MouseEvent, postId: string) => {
    e.stopPropagation(); // Prevent card click
    if (!user) return;
    
    if (confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
      try {
        const result = await deletePost(postId, user);
        if (result.success) {
          // Remove from local state
          setPosts(current => current.filter(p => p.postId !== postId));
        } else {
          setError(result.error || 'Failed to delete post');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error deleting post');
      }
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8 text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <h1 className="text-2xl font-bold font-serif text-gray-900">Adal Nexus</h1>
            <nav className="hidden md:flex gap-6 text-sm">
              <Link href="/dashboard" className="text-gray-700 hover:text-indigo-600 font-medium">
                Dashboard
              </Link>
              <Link href="/forum" className="text-gray-600 hover:text-indigo-600">
                Forum
              </Link>
              <Link href="/roadmap" className="text-gray-600 hover:text-indigo-600">
                Roadmap
              </Link>
              <Link href="/chat" className="text-gray-600 hover:text-indigo-600">
                Lex (AI)
              </Link>
              {user && (
                <Link href={`/profile/${user.uid}`} className="text-gray-600 hover:text-indigo-600">
                  My Portfolio
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <Link href={user ? `/profile/${user.uid}` : '#'} className="hover:opacity-80 transition">
                <p className="text-sm font-medium text-gray-900">{profile?.name}</p>
                <p className="text-xs text-gray-500 capitalize">{profile?.userType}</p>
              </Link>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back, {profile?.name?.split(' ')[0]}!
          </h2>
          <p className="text-gray-600">
            Stay updated with the latest posts and discussions from the Pakistani legal community.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg">{error}</div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content - Posts */}
          <div className="lg:col-span-2">
            {/* Create Post Button */}
            <div className="mb-6">
              <Button
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700"
                onClick={() => router.push('/create-post')}
              >
                <Plus className="h-4 w-4" />
                Create Post
              </Button>
            </div>

            {/* Posts Section */}
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Recent Posts</h3>
              {postsLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Card key={i} className="p-5 animate-pulse">
                      <div className="h-5 bg-gray-200 rounded w-3/4 mb-3"></div>
                      <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                      <div className="h-4 bg-gray-200 rounded w-5/6 mb-3"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </Card>
                  ))}
                </div>
              ) : posts.length > 0 ? (
                posts.map((post) => (
                  <Card key={post.postId} className="p-5 hover:shadow-lg transition cursor-pointer relative group">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold text-gray-900 pr-8">{post.title}</h4>
                      {user && user.uid === post.authorId && (
                        <button
                          onClick={(e) => handleDeletePost(e, post.postId)}
                          className="text-gray-400 hover:text-red-600 transition p-1 rounded hover:bg-red-50 absolute top-4 right-4 opacity-0 group-hover:opacity-100 focus:opacity-100"
                          title="Delete Post"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <p className="text-gray-600 text-sm line-clamp-2 mb-3">{post.content}</p>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{post.authorId}</span>
                      <span>{post.tags?.join(', ')}</span>
                    </div>
                  </Card>
                ))
              ) : (
                <Card className="p-8 text-center">
                  <p className="text-gray-500">No posts yet. Be the first to create one!</p>
                </Card>
              )}
            </div>
          </div>

          {/* Sidebar - Forum Threads */}
          <div>
            <div className="bg-white rounded-lg border border-gray-200 p-6 sticky top-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Forum Discussions</h3>
              <div className="space-y-3 mb-4">
                {threadsLoading ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="p-3 bg-gray-50 rounded animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    ))}
                  </div>
                ) : threads.length > 0 ? (
                  threads.map((thread) => (
                    <div
                      key={thread.threadId}
                      className="p-3 bg-gray-50 rounded hover:bg-gray-100 cursor-pointer transition"
                    >
                      <p className="font-medium text-sm text-gray-900 line-clamp-2">
                        {thread.title}
                      </p>
                      <div className="flex items-center justify-between mt-2 text-xs text-gray-600">
                        <span>{thread.category}</span>
                        <span>{thread.replyCount} replies</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-sm">No threads yet.</p>
                )}
              </div>
              <Button
                variant="outline"
                className="w-full text-sm"
                onClick={() => router.push('/forum')}
              >
                View All Threads
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
