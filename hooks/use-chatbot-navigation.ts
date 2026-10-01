'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  fetchModuleCategoryRegistry,
  fetchModuleMenuCategories,
  type ModuleCategory,
  type ModuleRegistryEntry,
} from '@/app/_lib/module-categories-api';
import { getFeesSession, type FeesSession } from '@/app/fees/_lib/fees-api';
import {
  detectNavigationIntent,
  evaluateChatbotIntent,
  type ChatbotIntentEvaluation,
  type NavigationMatch,
} from '@/lib/intelligence/chatbot-navigation';

/**
 * Provides the chatbot with the ability to detect navigation intents.
 *
 * Fetches the same module category registry and per-module categories that
 * the tab bar uses, caches them, and exposes a `tryNavigate` function that
 * the chatbot calls before sending a message to the backend.
 *
 * The categories are loaded lazily on first use and cached for the session,
 * so repeated chatbot opens do not re-fetch.
 */

type CategoriesCache = Map<string, ModuleCategory[]>;

// Session-level cache shared across hook instances.
let cachedRegistry: ModuleRegistryEntry[] | null = null;
let cachedCategories: CategoriesCache | null = null;
let cacheSessionKey = '';

export function useChatbotNavigation() {
  const [registry, setRegistry] = useState<ModuleRegistryEntry[]>(cachedRegistry ?? []);
  const [categoriesMap, setCategoriesMap] = useState<CategoriesCache>(cachedCategories ?? new Map());
  const [loaded, setLoaded] = useState(cachedRegistry !== null);
  const loadingRef = useRef(false);

  // Load registry and all module categories on first mount
  useEffect(() => {
    const session = getFeesSession();
    if (!session?.subInstituteId || !session.userId) return;

    const sessionKey = `${session.subInstituteId}:${session.userId}`;

    // Already cached for this session
    if (cacheSessionKey === sessionKey && cachedRegistry && cachedCategories) {
      setRegistry(cachedRegistry);
      setCategoriesMap(cachedCategories);
      setLoaded(true);
      return;
    }

    if (loadingRef.current) return;
    loadingRef.current = true;

    let cancelled = false;

    void (async () => {
      try {
        const reg = await fetchModuleCategoryRegistry(session);
        if (cancelled) return;

        // Fetch categories for each module in parallel
        const entries = await Promise.all(
          reg.map(async (entry) => {
            try {
              const cats = await fetchModuleMenuCategories(session, {
                moduleName: entry.moduleName,
                level2MenuId: entry.level2MenuId,
              });
              return [entry.moduleName, cats] as const;
            } catch {
              return [entry.moduleName, []] as const;
            }
          })
        );

        if (cancelled) return;

        const catMap = new Map<string, ModuleCategory[]>(entries);

        // Cache
        cachedRegistry = reg;
        cachedCategories = catMap;
        cacheSessionKey = sessionKey;

        setRegistry(reg);
        setCategoriesMap(catMap);
        setLoaded(true);
      } catch {
        // Non-fatal: navigation detection is a convenience, not a requirement.
        // The chatbot works fine without it.
        setLoaded(true);
      } finally {
        loadingRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Try to match a user message to a navigation intent.
   *
   * Returns the match if one was found, or null if the message is not a
   * navigation request. The caller is responsible for actually navigating.
   */
  const tryMatch = useCallback(
    (userMessage: string): NavigationMatch | null => {
      return detectNavigationIntent(userMessage, registry, categoriesMap);
    },
    [registry, categoriesMap]
  );

  const evaluateIntent = useCallback(
    (userMessage: string, currentModulePathOrName?: string | null): ChatbotIntentEvaluation => {
      return evaluateChatbotIntent(userMessage, currentModulePathOrName, registry, categoriesMap);
    },
    [registry, categoriesMap]
  );

  return useMemo(() => ({ tryMatch, evaluateIntent, registry, categoriesMap, loaded }), [tryMatch, evaluateIntent, registry, categoriesMap, loaded]);
}

