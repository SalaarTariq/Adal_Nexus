'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Link from 'next/link';

export default function SignupPage() {
  const router = useRouter();
  const { signup, loading, error } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    userType: 'student' as 'student' | 'lawyer' | 'judge',
  });
  const [localError, setLocalError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');

    if (!formData.email || !formData.password || !formData.name) {
      setLocalError('Please fill in all fields');
      return;
    }

    try {
      await signup(formData.email, formData.password, formData.name, formData.userType);
      router.push('/dashboard');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Signup failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 px-4">
      <Card className="w-full max-w-md p-8 shadow-lg">
        <h1 className="text-3xl font-bold text-center text-gray-900 mb-2 font-serif">Adal Nexus</h1>
        <p className="text-center text-gray-600 mb-8">Join Pakistan&apos;s Legal Community</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Full Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="John Doe"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={loading}
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="you@example.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={loading}
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={loading}
            />
          </div>

          {/* User Type */}
          <div>
            <label htmlFor="userType" className="block text-sm font-medium text-gray-700 mb-1">
              I am a...
            </label>
            <select
              id="userType"
              name="userType"
              value={formData.userType}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={loading}
            >
              <option value="student">Law Student</option>
              <option value="lawyer">Advocate / Lawyer</option>
              <option value="judge">Judge / Judicial Officer</option>
            </select>
          </div>

          {/* Error Messages */}
          {(error || localError) && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error || localError}</div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 rounded-lg transition"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </Button>
        </form>

        {/* Login Link */}
        <p className="text-center text-gray-600 mt-6">
          Already have an account?{' '}
          <Link href="/auth/signin" className="text-indigo-600 hover:text-indigo-700 font-semibold">
            Sign in
          </Link>
        </p>
      </Card>
    </div>
  );
}
