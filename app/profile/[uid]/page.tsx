'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers';
import {
  getUserProfile,
  updateUserProfile,
  type UserProfile,
} from '@/lib/firestore';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function ProfilePage() {
  const params = useParams<{ uid: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formState, setFormState] = useState({
    name: '',
    bio: '',
    specialisations: '',
    year: '',
  });

  useEffect(() => {
    async function loadProfile() {
      if (!params.uid) return;
      try {
        setLoading(true);
        const data = await getUserProfile(params.uid);
        if (!data) {
          setError('Profile not found');
          return;
        }
        setProfile(data);
        setFormState({
          name: data.name || '',
          bio: data.bio || '',
          specialisations: data.specialisations?.join(', ') || '',
          year: data.year ? String(data.year) : '',
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error loading profile');
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [params.uid]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setFormState((current) => ({ ...current, [name]: value }));
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || user.uid !== params.uid) return;

    try {
      setSaving(true);
      await updateUserProfile(params.uid, {
        name: formState.name,
        bio: formState.bio,
        specialisations: formState.specialisations
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        year: formState.year ? Number(formState.year) : undefined,
      });
      setProfile((current) =>
        current
          ? {
              ...current,
              name: formState.name,
              bio: formState.bio,
              specialisations: formState.specialisations
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean),
              year: formState.year ? Number(formState.year) : undefined,
            }
          : current
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error && !profile) {
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

  if (!profile) return null;

  const isOwnProfile = user?.uid === params.uid;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <Link href="/dashboard" className="p-2 hover:bg-gray-100 rounded">
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Profile</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Card className="p-8 space-y-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-indigo-600 mb-2">User Profile</p>
            <h2 className="text-3xl font-serif font-bold text-gray-900">{profile.name}</h2>
            <p className="mt-2 text-sm text-gray-500">{profile.email}</p>
            <p className="mt-1 text-sm text-gray-500 capitalize">{profile.userType}</p>
          </div>
          <p className="text-gray-700 whitespace-pre-wrap">{profile.bio || 'No bio yet.'}</p>
          {profile.specialisations?.length ? (
            <div className="flex flex-wrap gap-2">
              {profile.specialisations.map((item) => (
                <span key={item} className="rounded-full bg-indigo-50 px-3 py-1 text-xs text-indigo-700">
                  {item}
                </span>
              ))}
            </div>
          ) : null}
        </Card>

        {isOwnProfile ? (
          <Card className="p-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Edit Profile</h3>
            <form onSubmit={handleSave} className="space-y-4">
              <input
                name="name"
                value={formState.name}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-4 py-2"
                placeholder="Name"
              />
              <textarea
                name="bio"
                value={formState.bio}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-4 py-2"
                rows={4}
                placeholder="Bio"
              />
              <input
                name="specialisations"
                value={formState.specialisations}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-4 py-2"
                placeholder="Specialisations, comma-separated"
              />
              <input
                name="year"
                value={formState.year}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-4 py-2"
                placeholder="Year"
              />
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </form>
          </Card>
        ) : null}
      </main>
    </div>
  );
}
