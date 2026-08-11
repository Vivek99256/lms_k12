'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';

type AgentNavigationAction = {
  route: string;
  query?: Record<string, string | number>;
  label?: string;
};

export function useAgentActionHandler() {
  const router = useRouter();

  const executeNavigation = useCallback(
    (action?: AgentNavigationAction | null) => {
      if (!action?.route) {
        return;
      }

      const params = new URLSearchParams();
      Object.entries(action.query ?? {}).forEach(([key, value]) => {
        params.set(key, String(value));
      });

      router.push(
        params.toString() ? `${action.route}?${params.toString()}` : action.route
      );
    },
    [router]
  );

  return {
    executeNavigation,
  };
}
