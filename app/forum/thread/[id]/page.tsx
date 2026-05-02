'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  addForumReply,
  getForumReplies,
  upvoteReply,
  type ForumReply,
  type ForumThread,
} from '@/lib/firestore';
import { useAuth } from '@/app/providers';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Loader2, MessageSquare, ThumbsUp } from 'lucide-react';
import Link from 'next/link';

export default function ForumThreadPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [thread, setThread] = useState<ForumThread | null>(null);
  const [replies, setReplies] = useState<ForumReply[]>([]);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const loadThread = async () => {
    if (!params.id) return;
    try {
      setLoading(true);
      const threadSnap = await getDoc(doc(db, 'forumThreads', params.id));
      if (!threadSnap.exists()) {
        setError('Thread not found');
        return;
      }
      setThread({ threadId: threadSnap.id, ...threadSnap.data() } as ForumThread);
      setReplies(await getForumReplies(params.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading thread');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadThread();
  }, [params.id]);

  const handleReply = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !params.id || !replyText.trim()) return;

    try {
      setSending(true);
      const result = await addForumReply(params.id, user.uid, replyText.trim());
      if (result.success) {
        setReplyText('');
        await loadThread();
      }
    } finally {
      setSending(false);
    }
  };

  const handleUpvote = async (replyId: string) => {
    if (!user) return;
    await upvoteReply(replyId, user.uid);
    await loadThread();
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error && !thread) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="max-w-lg w-full p-6 text-center">
          <p className="text-red-600">{error}</p>
          <Button className="mt-4" onClick={() => router.push('/forum')}>
            Back to Forum
          </Button>
        </Card>
      </div>
    );
  }

  if (!thread) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <Link href="/forum" className="p-2 hover:bg-gray-100 rounded">
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Forum Thread</h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Card className="p-8 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-indigo-600 mb-2">
                {thread.category}
              </p>
              <h2 className="text-3xl font-serif font-bold text-gray-900">{thread.title}</h2>
              <p className="mt-2 text-sm text-gray-500">Started by {thread.authorId}</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MessageSquare className="h-4 w-4" />
              {thread.replyCount} replies
            </div>
          </div>

          <div className="text-gray-700 whitespace-pre-wrap">{thread.description}</div>

          {thread.tags?.length ? (
            <div className="flex flex-wrap gap-2">
              {thread.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-indigo-50 px-3 py-1 text-xs text-indigo-700">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </Card>

        <Card className="p-8 space-y-4">
          <h3 className="text-xl font-semibold text-gray-900">Replies</h3>
          <form onSubmit={handleReply} className="space-y-3">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              rows={4}
              placeholder="Write a reply..."
            />
            <Button type="submit" disabled={!user || sending}>
              {sending ? 'Posting...' : 'Post Reply'}
            </Button>
          </form>

          <div className="space-y-4 pt-4">
            {replies.length ? (
              replies.map((reply) => (
                <div key={reply.replyId} className="rounded-lg border border-gray-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-gray-900">{reply.authorId}</p>
                      <p className="text-xs text-gray-500">Reply</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => handleUpvote(reply.replyId)}>
                      <ThumbsUp className="mr-2 h-4 w-4" />
                      {reply.upvoteCount}
                    </Button>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-gray-700">{reply.content}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">No replies yet.</p>
            )}
          </div>
        </Card>
      </main>
    </div>
  );
}
