'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';

/**
 * The landing page a mobile-app WebView opens for any menu row whose page
 * lives here rather than on the Laravel ERP.
 *
 * The ERP cannot log this origin in the way it logs in its own Blade pages
 * (a session cookie set on the ERP's host means nothing here): instead it
 * hands the WebView a one-time ticket, and this page trades that ticket for
 * the same session shape a normal email/password login produces -- see
 * AuthContext.loginFromHandoffTicket and, on the ERP side,
 * MobileWebHandoffApiController@claims.
 *
 * The ticket lives in this URL for exactly one request. Once
 * loginFromHandoffTicket() has run, router.replace() below removes it from
 * history and from anything that reads the address bar afterwards.
 */
function MobileBridge() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loginFromHandoffTicket } = useAuth();
  const ticket = searchParams.get('ticket');

  // A missing ticket is known synchronously from the URL, so it is derived
  // once as the initial state rather than set from inside the effect below
  // -- an effect body is for reacting to the async exchange's result, not
  // for a check that render already had the answer to.
  const [error, setError] = useState<string | null>(
    ticket ? null : 'This link is missing its access ticket. Please open it again from the app.'
  );

  // StrictMode/effect re-runs must not spend the same ticket twice -- it is
  // single-use, so a second exchange would just fail and show an error for
  // no reason.
  const attempted = useRef(false);

  useEffect(() => {
    if (!ticket || attempted.current) return;
    attempted.current = true;

    void loginFromHandoffTicket(ticket).then((result) => {
      if (result.success) {
        router.replace(result.redirectPath || '/');
        return;
      }
      setError(result.error || 'This link has expired. Please open it again from the app.');
    });
  }, [ticket, loginFromHandoffTicket, router]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-sm">
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-label="Signing in" />
    </div>
  );
}

export default function MobileBridgePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <MobileBridge />
    </Suspense>
  );
}
