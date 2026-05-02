'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers';
import { getPosts, getForumThreads, Post, ForumThread } from '@/lib/firestore';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, LogOut, Plus } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const router = useRouter();
  const { user, profile, logout, loading: authLoading } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [postsData, threadsData] = await Promise.all([
          getPosts(10, 0),
          getForumThreads(undefined, undefined, 5),
        ]);
        setPosts(postsData);
        setThreads(threadsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error loading data');
      } finally {
        setLoading(false);
      }
    }

    if (user && !authLoading) {
      loadData();
    }
  }, [user, authLoading]);

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/');
    } catch (err) {
      console.error('Logout failed:', err);
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
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-900">{profile?.name}</p>
              <p className="text-xs text-gray-500 capitalize">{profile?.userType}</p>
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
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="animate-spin h-6 w-6 text-indigo-600" />
                </div>
              ) : posts.length > 0 ? (
                posts.map((post) => (
                  <Card key={post.postId} className="p-5 hover:shadow-lg transition cursor-pointer">
                    <h4 className="font-semibold text-gray-900 mb-2">{post.title}</h4>
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
                {threads.length > 0 ? (
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
