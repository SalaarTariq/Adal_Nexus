'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers';
import {
  getUserProfile,
  updateUserProfile,
  createUserProfile,
  type UserProfile,
  type Experience,
  type Achievement,
  type Project,
  type SocialLinks,
} from '@/lib/firestore';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Loader2, Briefcase, Award, BookOpen, Mail, Calendar, Link as LinkIcon, Github, Twitter, Linkedin, Globe } from 'lucide-react';
import Link from 'next/link';

export default function ProfilePage() {
  const params = useParams<{ uid: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [formState, setFormState] = useState({
    name: '',
    bio: '',
    specialisations: '',
    year: '',
    experience: [] as Experience[],
    achievements: [] as Achievement[],
    projects: [] as Project[],
    socialLinks: { linkedin: '', twitter: '', github: '', website: '' } as SocialLinks,
  });

  useEffect(() => {
    async function loadProfile() {
      if (!params.uid) return;
      try {
        setLoading(true);
        let data = await getUserProfile(params.uid);
        
        // If profile is missing but the user is viewing their own profile, try to auto-create it
        if (!data && user && user.uid === params.uid) {
          try {
            await createUserProfile(
              user.uid,
              user.email || '',
              user.displayName || user.email?.split('@')[0] || 'User',
              'student'
            );
            data = await getUserProfile(params.uid);
          } catch (createErr) {
            console.error('Failed to auto-create profile:', createErr);
          }
        }

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
          experience: data.experience || [],
          achievements: data.achievements || [],
          projects: data.projects || [],
          socialLinks: data.socialLinks || { linkedin: '', twitter: '', github: '', website: '' },
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error loading profile');
      } finally {
        setLoading(false);
      }
    }

    if (authLoading) return;
    loadProfile();
  }, [params.uid, user, authLoading]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setFormState((current) => ({ ...current, [name]: value }));
  };

  const handleAddExperience = () => {
    setFormState((current) => ({
      ...current,
      experience: [
        ...current.experience,
        {
          title: '',
          organization: '',
          startDate: '',
          endDate: '',
          description: '',
          current: false,
        },
      ],
    }));
  };

  const handleAddAchievement = () => {
    setFormState((current) => ({
      ...current,
      achievements: [
        ...current.achievements,
        {
          title: '',
          year: new Date().getFullYear().toString(),
          description: '',
        },
      ],
    }));
  };

  const handleExperienceChange =
    (index: number, field: keyof Experience) => (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
      setFormState((current) => {
        const newExperience = [...current.experience];
        newExperience[index] = {
          ...newExperience[index],
          [field]: e.target.value,
        };
        return { ...current, experience: newExperience };
      });
    };

  const handleAchievementChange = (index: number, field: keyof Achievement) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormState((current) => {
      const newAchievements = [...current.achievements];
      newAchievements[index] = {
        ...newAchievements[index],
        [field]: e.target.value,
      };
      return { ...current, achievements: newAchievements };
    });
  };

  const handleRemoveExperience = (index: number) => {
    setFormState((current) => ({
      ...current,
      experience: current.experience.filter((_, i) => i !== index),
    }));
  };

  const handleRemoveAchievement = (index: number) => {
    setFormState((current) => ({
      ...current,
      achievements: current.achievements.filter((_, i) => i !== index),
    }));
  };

  const handleAddProject = () => {
    setFormState((current) => ({
      ...current,
      projects: [
        ...current.projects,
        {
          title: '',
          role: '',
          description: '',
          link: '',
          year: new Date().getFullYear().toString(),
        },
      ],
    }));
  };

  const handleProjectChange = (index: number, field: keyof Project) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormState((current) => {
      const newProjects = [...current.projects];
      newProjects[index] = {
        ...newProjects[index],
        [field]: e.target.value,
      };
      return { ...current, projects: newProjects };
    });
  };

  const handleRemoveProject = (index: number) => {
    setFormState((current) => ({
      ...current,
      projects: current.projects.filter((_, i) => i !== index),
    }));
  };

  const handleSocialLinksChange = (field: keyof SocialLinks) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormState((current) => ({
      ...current,
      socialLinks: {
        ...current.socialLinks,
        [field]: e.target.value,
      },
    }));
  };

  const handleCancel = () => {
    // Reset form state back to saved profile data
    if (profile) {
      setFormState({
        name: profile.name || '',
        bio: profile.bio || '',
        specialisations: profile.specialisations?.join(', ') || '',
        year: profile.year ? String(profile.year) : '',
        experience: profile.experience || [],
        achievements: profile.achievements || [],
        projects: profile.projects || [],
        socialLinks: profile.socialLinks || { linkedin: '', twitter: '', github: '', website: '' },
      });
    }
    setIsEditing(false);
    setError('');
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || user.uid !== params.uid) return;

    try {
      setSaving(true);
      setError('');
      const updates: Partial<UserProfile> = {
        name: formState.name,
        bio: formState.bio,
        specialisations: formState.specialisations
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        year: formState.year ? Number(formState.year) : undefined,
        experience: formState.experience.filter((exp) => exp.title && exp.organization),
        achievements: formState.achievements.filter((ach) => ach.title),
        projects: formState.projects.filter((proj) => proj.title),
        socialLinks: formState.socialLinks,
      };

      const result = await updateUserProfile(params.uid, updates);
      if (!result.success) {
        setError(result.error || 'Failed to save profile');
        return;
      }
      setProfile((current) =>
        current
          ? {
              ...current,
              ...updates,
            }
          : current
      );
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
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
  const userTypeBadgeColor =
    profile.userType === 'student'
      ? 'bg-blue-100 text-blue-800'
      : profile.userType === 'lawyer'
        ? 'bg-purple-100 text-purple-800'
        : 'bg-amber-100 text-amber-800';

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="p-2 hover:bg-gray-100 rounded">
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Portfolio</h1>
          </div>
          {isOwnProfile && (
            <Button
              onClick={() => isEditing ? handleCancel() : setIsEditing(true)}
              variant={isEditing ? 'outline' : 'default'}
              className={isEditing ? 'text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700' : 'bg-indigo-600 hover:bg-indigo-700'}
            >
              {isEditing ? 'Cancel' : 'Edit'}
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
            {error}
          </div>
        )}
        {isEditing ? (
          <form onSubmit={handleSave} className="space-y-8">
            {/* Header Card - Edit Mode */}
            <Card className="p-8 bg-gradient-to-r from-indigo-50 to-blue-50 border-indigo-200">
              <div className="space-y-4">
                <input
                  name="name"
                  value={formState.name}
                  onChange={handleChange}
                  placeholder="Full Name"
                  className="text-3xl font-bold w-full rounded-lg border border-gray-300 px-4 py-2"
                />
                <div className="flex gap-4">
                  <span className={`px-4 py-2 rounded-full text-sm font-medium capitalize ${userTypeBadgeColor}`}>
                    {profile.userType}
                  </span>
                  {profile.userType === 'student' && (
                    <input
                      name="year"
                      type="number"
                      min="1"
                      max="5"
                      value={formState.year}
                      onChange={handleChange}
                      placeholder="Year"
                      className="rounded-lg border border-gray-300 px-4 py-2 w-24"
                    />
                  )}
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Mail className="h-4 w-4" />
                  <span>{profile.email}</span>
                </div>
                <textarea
                  name="bio"
                  value={formState.bio}
                  onChange={handleChange}
                  placeholder="Tell others about yourself..."
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-700"
                  rows={3}
                />
              </div>
            </Card>

            {/* Social Links - Edit Mode */}
            <Card className="p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <LinkIcon className="h-6 w-6 text-indigo-600" />
                Social Links
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Linkedin className="h-5 w-5 text-gray-400" />
                  <input
                    value={formState.socialLinks?.linkedin || ''}
                    onChange={handleSocialLinksChange('linkedin')}
                    placeholder="LinkedIn URL"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Twitter className="h-5 w-5 text-gray-400" />
                  <input
                    value={formState.socialLinks?.twitter || ''}
                    onChange={handleSocialLinksChange('twitter')}
                    placeholder="Twitter/X URL"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Github className="h-5 w-5 text-gray-400" />
                  <input
                    value={formState.socialLinks?.github || ''}
                    onChange={handleSocialLinksChange('github')}
                    placeholder="GitHub URL"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-gray-400" />
                  <input
                    value={formState.socialLinks?.website || ''}
                    onChange={handleSocialLinksChange('website')}
                    placeholder="Personal Website URL"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2"
                  />
                </div>
              </div>
            </Card>

            {/* Specialisations - Edit Mode */}
            <Card className="p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <BookOpen className="h-6 w-6 text-indigo-600" />
                Specialisations & Skills
              </h3>
              <input
                name="specialisations"
                value={formState.specialisations}
                onChange={handleChange}
                placeholder="E.g., Constitutional Law, Criminal Law, Corporate Law (comma-separated)"
                className="w-full rounded-lg border border-gray-300 px-4 py-2"
              />
            </Card>

            {/* Experience - Edit Mode */}
            <Card className="p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Briefcase className="h-6 w-6 text-indigo-600" />
                Experience
              </h3>
              <div className="space-y-6">
                {formState.experience.map((exp, index) => (
                  <div key={index} className="border-l-4 border-indigo-200 pl-6 pb-6">
                    <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
                      <input
                        value={exp.title}
                        onChange={handleExperienceChange(index, 'title')}
                        placeholder="Job Title / Position"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 font-semibold"
                      />
                      <input
                        value={exp.organization}
                        onChange={handleExperienceChange(index, 'organization')}
                        placeholder="Organization / Company"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          value={exp.startDate}
                          onChange={handleExperienceChange(index, 'startDate')}
                          placeholder="Start Date (e.g., Jan 2023)"
                          className="rounded-lg border border-gray-300 px-3 py-2"
                        />
                        <input
                          value={exp.endDate || ''}
                          onChange={handleExperienceChange(index, 'endDate')}
                          placeholder="End Date (e.g., Dec 2023)"
                          className="rounded-lg border border-gray-300 px-3 py-2"
                        />
                      </div>
                      <textarea
                        value={exp.description || ''}
                        onChange={handleExperienceChange(index, 'description')}
                        placeholder="Description of your role and achievements..."
                        className="w-full rounded-lg border border-gray-300 px-3 py-2"
                        rows={3}
                      />
                      <Button
                        type="button"
                        onClick={() => handleRemoveExperience(index)}
                        variant="outline"
                        className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                        size="sm"
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <Button type="button" onClick={handleAddExperience} size="sm" className="mt-4 bg-indigo-100 text-indigo-700 hover:bg-indigo-200">
                + Add Experience
              </Button>
            </Card>

            {/* Projects / Publications - Edit Mode */}
            <Card className="p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <BookOpen className="h-6 w-6 text-indigo-600" />
                Projects & Publications
              </h3>
              <div className="space-y-6">
                {formState.projects.map((project, index) => (
                  <div key={index} className="border-l-4 border-indigo-200 pl-6 pb-6">
                    <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
                      <input
                        value={project.title}
                        onChange={handleProjectChange(index, 'title')}
                        placeholder="Project/Publication Title"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 font-semibold"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          value={project.role || ''}
                          onChange={handleProjectChange(index, 'role')}
                          placeholder="Your Role / Authorship"
                          className="w-full rounded-lg border border-gray-300 px-3 py-2"
                        />
                        <input
                          value={project.year || ''}
                          onChange={handleProjectChange(index, 'year')}
                          placeholder="Year (e.g., 2024)"
                          className="w-full rounded-lg border border-gray-300 px-3 py-2"
                        />
                      </div>
                      <input
                        value={project.link || ''}
                        onChange={handleProjectChange(index, 'link')}
                        placeholder="Link (URL)"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2"
                      />
                      <textarea
                        value={project.description || ''}
                        onChange={handleProjectChange(index, 'description')}
                        placeholder="Description of the project or publication..."
                        className="w-full rounded-lg border border-gray-300 px-3 py-2"
                        rows={3}
                      />
                      <Button
                        type="button"
                        onClick={() => handleRemoveProject(index)}
                        variant="outline"
                        className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                        size="sm"
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <Button type="button" onClick={handleAddProject} size="sm" className="mt-4 bg-indigo-100 text-indigo-700 hover:bg-indigo-200">
                + Add Project/Publication
              </Button>
            </Card>

            {/* Achievements - Edit Mode */}
            <Card className="p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Award className="h-6 w-6 text-indigo-600" />
                Achievements & Certifications
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {formState.achievements.map((achievement, index) => (
                  <div key={index} className="bg-gradient-to-br from-yellow-50 to-orange-50 p-4 rounded-lg border border-yellow-200">
                    <div className="space-y-2">
                      <input
                        value={achievement.title}
                        onChange={handleAchievementChange(index, 'title')}
                        placeholder="Achievement Title"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 font-semibold text-sm"
                      />
                      <input
                        value={achievement.year}
                        onChange={handleAchievementChange(index, 'year')}
                        placeholder="Year"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                      <textarea
                        value={achievement.description || ''}
                        onChange={handleAchievementChange(index, 'description')}
                        placeholder="Description (optional)"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        rows={2}
                      />
                      <Button
                        type="button"
                        onClick={() => handleRemoveAchievement(index)}
                        variant="outline"
                        className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                        size="sm"
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <Button type="button" onClick={handleAddAchievement} size="sm" className="mt-4 bg-indigo-100 text-indigo-700 hover:bg-indigo-200">
                + Add Achievement
              </Button>
            </Card>

            {/* Save Buttons */}
            <div className="flex gap-4 sticky bottom-4">
              <Button type="submit" disabled={saving} className="flex-1 bg-indigo-600 hover:bg-indigo-700">
                {saving ? 'Saving...' : 'Save All Changes'}
              </Button>
              <Button
                type="button"
                onClick={handleCancel}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-8">
            {/* View Mode - Header Card */}
            <Card className="p-8 bg-gradient-to-r from-indigo-50 to-blue-50 border-indigo-200">
              <div className="space-y-3">
                <h2 className="text-4xl font-bold text-gray-900">{profile.name}</h2>
                <div className="flex gap-3 items-center flex-wrap">
                  <span className={`px-4 py-2 rounded-full text-sm font-medium capitalize ${userTypeBadgeColor}`}>
                    {profile.userType}
                  </span>
                  {profile.year && profile.userType === 'student' && (
                    <span className="px-4 py-2 rounded-full bg-gray-100 text-sm text-gray-700">
                      Year {profile.year}
                    </span>
                  )}
                </div>
                {isOwnProfile && profile.email && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Mail className="h-5 w-5" />
                    <span>{profile.email}</span>
                  </div>
                )}
                {profile.socialLinks && (
                  <div className="flex items-center gap-4 pt-2">
                    {profile.socialLinks.linkedin && (
                      <a href={profile.socialLinks.linkedin} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-indigo-600 transition">
                        <Linkedin className="h-5 w-5" />
                      </a>
                    )}
                    {profile.socialLinks.twitter && (
                      <a href={profile.socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-indigo-600 transition">
                        <Twitter className="h-5 w-5" />
                      </a>
                    )}
                    {profile.socialLinks.github && (
                      <a href={profile.socialLinks.github} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-indigo-600 transition">
                        <Github className="h-5 w-5" />
                      </a>
                    )}
                    {profile.socialLinks.website && (
                      <a href={profile.socialLinks.website} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-indigo-600 transition">
                        <Globe className="h-5 w-5" />
                      </a>
                    )}
                  </div>
                )}
                <p className="text-gray-700 text-lg leading-relaxed pt-2">{profile.bio || 'No bio added yet.'}</p>
              </div>
            </Card>

            {/* View Mode - Specialisations */}
            {profile.specialisations && profile.specialisations.length > 0 && (
              <Card className="p-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <BookOpen className="h-6 w-6 text-indigo-600" />
                  Specialisations & Skills
                </h3>
                <div className="flex flex-wrap gap-2">
                  {profile.specialisations.map((item) => (
                    <span key={item} className="rounded-full bg-indigo-100 px-4 py-2 text-sm text-indigo-700 font-medium">
                      {item}
                    </span>
                  ))}
                </div>
              </Card>
            )}

            {/* View Mode - Experience */}
            <Card className="p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Briefcase className="h-6 w-6 text-indigo-600" />
                Experience
              </h3>
              {profile.experience && profile.experience.length > 0 ? (
                <div className="space-y-6">
                  {profile.experience.map((exp, index) => (
                    <div key={index} className="border-l-4 border-indigo-200 pl-6 pb-6">
                      <h4 className="text-xl font-bold text-gray-900">{exp.title}</h4>
                      <p className="text-indigo-600 font-semibold">{exp.organization}</p>
                      <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                        <Calendar className="h-4 w-4" />
                        {exp.startDate} {exp.endDate ? `- ${exp.endDate}` : '- Present'}
                      </p>
                      {exp.description && <p className="text-gray-700 mt-2">{exp.description}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 italic">No experience added yet.</p>
              )}
            </Card>

            {/* View Mode - Projects / Publications */}
            <Card className="p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <BookOpen className="h-6 w-6 text-indigo-600" />
                Projects & Publications
              </h3>
              {profile.projects && profile.projects.length > 0 ? (
                <div className="space-y-6">
                  {profile.projects.map((project, index) => (
                    <div key={index} className="border-l-4 border-indigo-200 pl-6 pb-6">
                      <h4 className="text-xl font-bold text-gray-900">{project.title}</h4>
                      {project.role && <p className="text-indigo-600 font-semibold">{project.role}</p>}
                      <div className="flex items-center gap-4 mt-1">
                        {project.year && (
                          <p className="text-sm text-gray-500 flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {project.year}
                          </p>
                        )}
                        {project.link && (
                          <a href={project.link} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                            <LinkIcon className="h-4 w-4" />
                            View Link
                          </a>
                        )}
                      </div>
                      {project.description && <p className="text-gray-700 mt-2">{project.description}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 italic">No projects or publications added yet.</p>
              )}
            </Card>

            {/* View Mode - Achievements */}
            <Card className="p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Award className="h-6 w-6 text-indigo-600" />
                Achievements & Certifications
              </h3>
              {profile.achievements && profile.achievements.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {profile.achievements.map((achievement, index) => (
                    <div key={index} className="bg-gradient-to-br from-yellow-50 to-orange-50 p-4 rounded-lg border border-yellow-200">
                      <p className="font-bold text-gray-900">{achievement.title}</p>
                      <p className="text-sm text-gray-600">{achievement.year}</p>
                      {achievement.description && (
                        <p className="text-sm text-gray-700 mt-2">{achievement.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 italic">No achievements added yet.</p>
              )}
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
