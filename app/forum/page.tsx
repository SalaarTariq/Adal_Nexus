'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers';
import { getForumThreads, getForumReplies, ForumThread, ForumReply } from '@/lib/firestore';
import { fetchUserNames } from '@/lib/users';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, MessageCircle, Plus, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const CATEGORIES = [
  'Constitutional',
  'Criminal',
  'Corporate',
  'Family',
  'Cyber',
  'Tax',
  'Career Advice',
  'Legal Awareness',
];

export default function ForumPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<ForumThread | null>(null);
  const [replies, setReplies] = useState<ForumReply[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [authorNames, setAuthorNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    async function loadThreads() {
      try {
        setLoading(true);
        const data = await getForumThreads(selectedCategory || undefined, 0, 50);
        setThreads(data);
        const names = await fetchUserNames(data.map((t) => t.authorId));
        setAuthorNames(names);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error loading threads');
      } finally {
        setLoading(false);
      }
    }

    if (user && !authLoading) {
      loadThreads();
    }
  }, [user, authLoading, selectedCategory]);

  const handleSelectThread = async (thread: ForumThread) => {
    setSelectedThread(thread);
    try {
      const threadReplies = await getForumReplies(thread.threadId);
      setReplies(threadReplies);
    } catch (err) {
      console.error('Error loading replies:', err);
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
      <header className="border-b border-gray-200 bg-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="p-2 hover:bg-gray-100 rounded">
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </Link>
            <h1 className="text-2xl font-bold font-serif text-gray-900">Community Forum</h1>
          </div>
          <Button
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700"
            onClick={() => router.push('/forum/create')}
          >
            <Plus className="h-4 w-4" />
            New Discussion
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Category Filter */}
        <div className="mb-6">
          <p className="text-sm font-medium text-gray-700 mb-3">Filter by Category</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedCategory === '' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory('')}
            >
              All
            </Button>
            {CATEGORIES.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </Button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg">{error}</div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Threads List */}
          <div className="lg:col-span-2">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {selectedCategory ? `${selectedCategory} Discussions` : 'All Discussions'}
            </h2>

            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin h-6 w-6 text-indigo-600" />
              </div>
            ) : threads.length > 0 ? (
              <div className="space-y-3">
                {threads.map((thread) => (
                  <Card
                    key={thread.threadId}
                    className="p-5 hover:shadow-lg transition cursor-pointer"
                    onClick={() => handleSelectThread(thread)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-1">{thread.title}</h3>
                        <p className="text-sm text-gray-600 mb-2 line-clamp-1">
                          {thread.description}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded">
                            {thread.category}
                          </span>
                          {thread.tags?.map((tag) => (
                            <span key={tag} className="bg-gray-100 px-2 py-1 rounded">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-gray-500 ml-4">
                        <MessageCircle className="h-4 w-4" />
                        <span className="font-semibold">{thread.replyCount}</span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-8 text-center">
                <p className="text-gray-500">No threads in this category yet.</p>
              </Card>
            )}
          </div>

          {/* Thread Detail / Stats Sidebar */}
          <div className="lg:col-span-1">
            {selectedThread ? (
              <Card className="p-6 sticky top-24">
                <h3 className="font-semibold text-gray-900 mb-3">{selectedThread.title}</h3>
                <div className="space-y-3 text-sm text-gray-600 mb-4">
                  <p>
                    <span className="font-medium text-gray-900">Category:</span> {selectedThread.category}
                  </p>
                  <p>
                    <span className="font-medium text-gray-900">Replies:</span> {selectedThread.replyCount}
                  </p>
                  <p>
                    <span className="font-medium text-gray-900">Started by:</span>{' '}
                    {authorNames[selectedThread.authorId] || 'Adal Nexus member'}
                  </p>
                </div>

                {/* Replies Section */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h4 className="font-semibold text-gray-900 mb-3">Recent Replies</h4>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {replies.length > 0 ? (
                      replies.slice(-3).map((reply) => (
                        <div key={reply.replyId} className="p-3 bg-gray-50 rounded text-xs">
                          <p className="font-medium text-gray-900">
                            {authorNames[reply.authorId] || 'Adal Nexus member'}
                          </p>
                          <p className="text-gray-600 mt-1 line-clamp-2">{reply.content}</p>
                          <div className="flex justify-between items-center mt-2 text-gray-500">
                            <span>👍 {reply.upvoteCount}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500">No replies yet.</p>
                    )}
                  </div>
                </div>

                <Button
                  className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700"
                  onClick={() => router.push(`/forum/thread/${selectedThread.threadId}`)}
                >
                  View Full Discussion
                </Button>
              </Card>
            ) : (
              <Card className="p-6">
                <p className="text-gray-500 text-center">Select a thread to view details</p>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
