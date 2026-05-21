'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Route error boundary caught:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="max-w-md w-full p-8 text-center space-y-4">
        <div className="flex justify-center">
          <AlertTriangle className="h-10 w-10 text-amber-500" />
        </div>
        <h1 className="text-2xl font-serif font-bold text-gray-900">Something went wrong</h1>
        <p className="text-sm text-gray-600">
          We hit an unexpected error. You can retry, or head back to the dashboard.
        </p>
        {error.digest ? (
          <p className="text-xs text-gray-400">Reference: {error.digest}</p>
        ) : null}
        <div className="flex gap-3 justify-center pt-2">
          <Button onClick={() => reset()}>Try again</Button>
          <Link href="/dashboard">
            <Button variant="outline">Back to dashboard</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
