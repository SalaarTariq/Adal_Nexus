'use client';

import { useEffect } from 'react';

export default function GlobalErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global error boundary caught:', error);
  }, [error]);

  return (
    <html>
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            background: '#F5F6F8',
          }}
        >
          <div
            style={{
              maxWidth: 480,
              width: '100%',
              padding: '2rem',
              borderRadius: '0.75rem',
              background: '#FFFFFF',
              border: '1px solid #E5E7EB',
              textAlign: 'center',
            }}
          >
            <h1 style={{ fontSize: '1.5rem', margin: '0 0 0.5rem', color: '#0A1929' }}>
              Adal Nexus had a problem
            </h1>
            <p style={{ color: '#4A5568', marginBottom: '1.5rem' }}>
              The app crashed unexpectedly. Refresh the page to continue.
            </p>
            <button
              onClick={() => reset()}
              style={{
                background: '#0A1929',
                color: '#FFFFFF',
                border: 'none',
                padding: '0.6rem 1.2rem',
                borderRadius: '0.5rem',
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
