'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { likePost, getPostLikes, type Post } from '@/lib/firestore';
import { useAuth } from '@/app/providers';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Loader2, Heart } from 'lucide-react';
import Link from 'next/link';

export default function PostDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [likes, setLikes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState('');
  const [isLiked, setIsLiked] = useState(false);

  useEffect(() => {
    async function loadPost() {
      if (!params.id) return;
      try {
        setLoading(true);
        const postSnap = await getDoc(doc(db, 'posts', params.id));
        if (!postSnap.exists()) {
          setError('Post not found');
          return;
        }
        setPost({ postId: postSnap.id, ...postSnap.data() } as Post);
        setLikes(await getPostLikes(params.id));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error loading post');
      } finally {
        setLoading(false);
      }
    }

    loadPost();
  }, [params.id]);

  const handleLike = async () => {
    if (!user || !params.id || toggling) return;
    
    // Track the previous state for rollback in case of error
    const previousLikes = likes;
    const previousIsLiked = isLiked;
    
    try {
      setToggling(true);
      
      // Determine new state (toggle)
      const willBeLiked = !isLiked;
      
      // Optimistic update: immediately reflect the change
      setIsLiked(willBeLiked);
      setLikes((current) => (willBeLiked ? current + 1 : Math.max(0, current - 1)));
      
      const result = await likePost(params.id, user);
      
      if (!result.success) {
        // If API call failed, revert to previous state
        setLikes(previousLikes);
        setIsLiked(previousIsLiked);
        setError('Failed to update like');
      }
    } catch (error) {
      // On error, revert to previous state
      setLikes(previousLikes);
      setIsLiked(previousIsLiked);
      console.error('Error toggling like:', error);
      setError('Error updating like');
    } finally {
      setToggling(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error && !post) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="max-w-lg w-full p-6 text-center">
          <p className="text-red-600">{error}</p>
          <Button className="mt-4" onClick={() => router.push('/dashboard')}>
            Back to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  if (!post) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <Link href="/dashboard" className="p-2 hover:bg-gray-100 rounded">
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Post Details</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="p-8 space-y-6">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-indigo-600 mb-2">Post</p>
            <h2 className="text-3xl font-serif font-bold text-gray-900">{post.title}</h2>
            <p className="mt-2 text-sm text-gray-500">By {post.authorId}</p>
          </div>

          <div className="prose max-w-none text-gray-700 whitespace-pre-wrap">
            {post.content}
          </div>

          {post.tags?.length ? (
            <div className="flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-indigo-50 px-3 py-1 text-xs text-indigo-700">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <span className="text-sm text-gray-600">{likes} likes</span>
            <Button 
              onClick={handleLike} 
              disabled={!user || toggling} 
              className={`flex items-center gap-2 ${isLiked ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-gray-100 hover:bg-gray-200'}`}
            >
              <Heart className={`h-4 w-4 ${isLiked ? 'fill-white' : ''}`} />
              {toggling ? 'Updating...' : (isLiked ? 'Unlike' : 'Like')}
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );
}
