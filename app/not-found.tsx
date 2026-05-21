import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="max-w-md w-full p-8 text-center space-y-4">
        <p className="text-xs uppercase tracking-[0.2em] text-indigo-600">404</p>
        <h1 className="text-2xl font-serif font-bold text-gray-900">Page not found</h1>
        <p className="text-sm text-gray-600">
          The page you&apos;re looking for has moved or doesn&apos;t exist.
        </p>
        <div className="flex gap-3 justify-center pt-2">
          <Link href="/">
            <Button>Go home</Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline">Dashboard</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
