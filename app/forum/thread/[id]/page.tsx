'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  addForumReply,
  getForumReplies,
  getMyReplyUpvotes,
  upvoteReply,
  type ForumReply,
  type ForumThread,
} from '@/lib/firestore';
import { fetchUserNames } from '@/lib/users';
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
  const [upvotingIds, setUpvotingIds] = useState<Set<string>>(new Set());
  const [userUpvotes, setUserUpvotes] = useState<Set<string>>(new Set());
  const [authorNames, setAuthorNames] = useState<Record<string, string>>({});

  const loadThread = useCallback(async () => {
    if (!params.id) return;
    try {
      setLoading(true);
      const threadSnap = await getDoc(doc(db, 'forumThreads', params.id));
      if (!threadSnap.exists()) {
        setError('Thread not found');
        return;
      }
      const threadData = { threadId: threadSnap.id, ...threadSnap.data() } as ForumThread;
      setThread(threadData);
      const replyList = await getForumReplies(params.id);
      setReplies(replyList);

      const uids = [threadData.authorId, ...replyList.map((r) => r.authorId)];
      const names = await fetchUserNames(uids);
      setAuthorNames(names);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading thread');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    loadThread();
  }, [loadThread]);

  useEffect(() => {
    if (!user || !params.id) return;
    let cancelled = false;
    getMyReplyUpvotes(params.id, user).then((ids) => {
      if (!cancelled) setUserUpvotes(new Set(ids));
    });
    return () => {
      cancelled = true;
    };
  }, [user, params.id]);

  const handleReply = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !params.id || !replyText.trim()) return;

    try {
      setSending(true);
      setError('');
      const result = await addForumReply(params.id, user, replyText.trim());
      if (result.success) {
        setReplyText('');
        if (result.reply) {
          // Optimistic update: add reply to state immediately without page reload
          setReplies((prev) => [...prev, result.reply as ForumReply]);
          setThread((prev) =>
            prev ? { ...prev, replyCount: (prev.replyCount ?? 0) + 1 } : prev
          );
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to post reply');
    } finally {
      setSending(false);
    }
  };

  const handleUpvote = async (replyId: string) => {
    if (!user || upvotingIds.has(replyId)) return;

    setUpvotingIds((prev) => {
      const next = new Set(prev);
      next.add(replyId);
      return next;
    });

    const wasUpvoted = userUpvotes.has(replyId);
    const delta = wasUpvoted ? -1 : 1;

    // Optimistic update
    setReplies((prev) =>
      prev.map((reply) =>
        reply.replyId === replyId
          ? { ...reply, upvoteCount: Math.max(0, reply.upvoteCount + delta) }
          : reply
      )
    );
    setUserUpvotes((prev) => {
      const next = new Set(prev);
      if (wasUpvoted) next.delete(replyId);
      else next.add(replyId);
      return next;
    });

    try {
      const result = await upvoteReply(replyId, user);
      if (!result.success) throw new Error(result.error || 'Upvote failed');
    } catch (err) {
      console.error('Failed to upvote reply:', err);
      // Revert
      setReplies((prev) =>
        prev.map((reply) =>
          reply.replyId === replyId
            ? { ...reply, upvoteCount: Math.max(0, reply.upvoteCount - delta) }
            : reply
        )
      );
      setUserUpvotes((prev) => {
        const next = new Set(prev);
        if (wasUpvoted) next.add(replyId);
        else next.delete(replyId);
        return next;
      });
      setError('Failed to upvote reply');
    } finally {
      setUpvotingIds((prev) => {
        const next = new Set(prev);
        next.delete(replyId);
        return next;
      });
    }
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
              <p className="mt-2 text-sm text-gray-500">
                Started by{' '}
                <Link
                  href={`/profile/${thread.authorId}`}
                  className="text-indigo-600 hover:underline"
                >
                  {authorNames[thread.authorId] || 'Adal Nexus member'}
                </Link>
              </p>
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
                      <Link
                        href={`/profile/${reply.authorId}`}
                        className="font-medium text-gray-900 hover:text-indigo-600 hover:underline"
                      >
                        {authorNames[reply.authorId] || 'Adal Nexus member'}
                      </Link>
                      <p className="text-xs text-gray-500">Reply</p>
                    </div>
                    <Button 
                      type="button" 
                      size="sm" 
                      onClick={() => handleUpvote(reply.replyId)}
                      disabled={upvotingIds.has(reply.replyId)}
                      className={userUpvotes.has(reply.replyId) ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-gray-100 hover:bg-gray-200'}
                    >
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
