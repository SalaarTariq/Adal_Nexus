'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers';
import { getRoadmapProgress, updateMilestone } from '@/lib/firestore';
import { Card } from '@/components/ui/card';
import { Loader2, Check, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface RoadmapData {
  [key: string]: {
    [key: string]: boolean;
  };
}

const ROADMAP_MILESTONES: RoadmapData = {
  year1: {
    'Constitution Basics': false,
    'Legal English': false,
    'Communication Skills': false,
    'Study Groups': false,
    'Mock Trials': false,
  },
  year2: {
    'Moot Court': false,
    'PPC/CrPC Study': false,
    'Court Visits': false,
    'Legal Research': false,
    'Bar Notes': false,
  },
  year3: {
    'Internship at Chambers': false,
    'Specialization Selection': false,
    'Mentorship Matching': false,
    'Portfolio Building': false,
    'Publications': false,
  },
  year4: {
    'Bar Exam Prep': false,
    'Final Portfolio': false,
    'Professional Network': false,
    'Job Applications': false,
    'Graduation': false,
  },
};

export default function RoadmapPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [progress, setProgress] = useState<RoadmapData>(ROADMAP_MILESTONES);
  const [loading, setLoading] = useState(true);
  const [updatingMilestone, setUpdatingMilestone] = useState<string>('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    async function loadProgress() {
      if (!user) return;
      try {
        setLoading(true);
        const roadmapData = await getRoadmapProgress(user.uid);
        if (roadmapData) {
          setProgress((prev) => ({
            ...prev,
            year1: { ...prev.year1, ...roadmapData.year1 },
            year2: { ...prev.year2, ...roadmapData.year2 },
            year3: { ...prev.year3, ...roadmapData.year3 },
            year4: { ...prev.year4, ...roadmapData.year4 },
          }));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error loading roadmap progress');
      } finally {
        setLoading(false);
      }
    }

    if (user && !authLoading) {
      loadProgress();
    }
  }, [user, authLoading]);

  const handleToggleMilestone = async (year: number, milestone: string) => {
    if (!user) return;

    const key = `year${year}`;
    const currentStatus = progress[key]?.[milestone] ?? false;
    const newStatus = !currentStatus;

    setUpdatingMilestone(`${key}-${milestone}`);
    try {
      await updateMilestone(user.uid, year, milestone, newStatus);
      setProgress((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          [milestone]: newStatus,
        },
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error updating milestone');
    } finally {
      setUpdatingMilestone('');
    }
  };

  const calculateProgress = (year: string) => {
    const milestones = progress[year] || {};
    const completed = Object.values(milestones).filter(Boolean).length;
    const total = Object.keys(milestones).length;
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  };

  const totalCompleted = Object.values(progress)
    .flatMap((year) => Object.values(year))
    .filter(Boolean).length;
  const totalMilestones = Object.values(progress).flatMap((year) => Object.values(year)).length;
  const overallProgress = totalMilestones > 0 ? Math.round((totalCompleted / totalMilestones) * 100) : 0;

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
            <h1 className="text-2xl font-bold font-serif text-gray-900">Your Legal Journey</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overall Progress */}
        <Card className="p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Overall Progress</h2>
            <span className="text-3xl font-bold text-indigo-600">{overallProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-indigo-600 to-indigo-500 h-3 rounded-full transition-all"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-gray-600">
            {totalCompleted} of {totalMilestones} milestones completed
          </p>
        </Card>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg">{error}</div>
        )}

        {/* Roadmap Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {(['year1', 'year2', 'year3', 'year4'] as const).map((yearKey) => {
            const year = parseInt(yearKey.replace('year', ''));
            const yearData = ROADMAP_MILESTONES[yearKey];
            const yearProgress = calculateProgress(yearKey);
            const themes = ['Foundation', 'Practical', 'Specialisation', 'Portfolio'];

            return (
              <Card key={yearKey} className="p-6 bg-white hover:shadow-lg transition">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-serif text-lg font-semibold text-gray-900">Year {year}</h3>
                  <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                    {yearProgress}%
                  </span>
                </div>

                <p className="text-xs text-gray-600 font-medium mb-4">{themes[year - 1]}</p>

                <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                  <div
                    className="bg-indigo-600 h-2 rounded-full transition-all"
                    style={{ width: `${yearProgress}%` }}
                  />
                </div>

                <div className="space-y-2">
                  {Object.entries(yearData).map(([milestone]) => {
                    const isCompleted = progress[yearKey]?.[milestone] ?? false;
                    const isUpdating =
                      updatingMilestone === `${yearKey}-${milestone}`;

                    return (
                      <button
                        key={milestone}
                        onClick={() => handleToggleMilestone(year, milestone)}
                        disabled={isUpdating || loading}
                        className={`w-full flex items-center gap-2 p-2 rounded text-sm transition ${
                          isCompleted
                            ? 'bg-indigo-50 text-indigo-700'
                            : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <div
                          className={`flex-shrink-0 h-5 w-5 rounded border-2 flex items-center justify-center transition ${
                            isCompleted
                              ? 'border-indigo-600 bg-indigo-600'
                              : 'border-gray-300'
                          }`}
                        >
                          {isCompleted && (
                            <Check className="h-3 w-3 text-white" />
                          )}
                        </div>
                        <span className="text-left line-clamp-1">{milestone}</span>
                        {isUpdating && (
                          <Loader2 className="h-3 w-3 animate-spin ml-auto" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>

        {/* Legend */}
        <Card className="mt-8 p-6 bg-blue-50">
          <h3 className="font-semibold text-gray-900 mb-3">How to Use This Roadmap</h3>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>✅ Check off milestones as you complete them</li>
            <li>📊 Your progress is saved automatically</li>
            <li>🎯 The roadmap is adaptable to 3-year or 5-year programmes</li>
            <li>💡 Use this to track your legal education journey</li>
          </ul>
        </Card>
      </main>
    </div>
  );
}
