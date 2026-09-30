'use client';

import { useEffect } from 'react';

/**
 * Last-resort boundary for an error in the root layout itself (where app/error.tsx
 * cannot help). It replaces the whole document, so it carries its own html/body
 * and plain inline styles — nothing from the app shell is guaranteed to load.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[global error]', error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f8fafc', color: '#0f172a' }}>
        <main style={{ maxWidth: 440, margin: '15vh auto', padding: '0 16px', textAlign: 'center' }}>
          <h1 style={{ fontSize: 20, marginBottom: 12 }}>The application could not load</h1>
          <p style={{ color: '#475569', lineHeight: 1.6 }}>
            Something went wrong on our side. Please try again. If this keeps happening, contact your school
            administrator{error.digest ? ` and quote reference ${error.digest}` : ''}.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{ marginTop: 16, padding: '10px 20px', borderRadius: 12, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
