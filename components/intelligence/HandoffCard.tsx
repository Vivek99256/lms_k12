'use client';

import { useEffect, useMemo, useState } from 'react';

import type { ModuleHandoff } from '@/lib/intelligence/module-handoff';
import type { UiLanguage } from '@/lib/voice/ui-labels';

/**
 * The "open this in its module" card under an answer.
 *
 * Its words are built on this page from the records the turn touched, so the backend never saw
 * them. In Hindi or Gujarati they are translated through the same service that translated the
 * answer; until that returns — or if it cannot — the card shows its own English, which is always
 * correct and always works.
 */

/** Translations already fetched, so the same card is never translated twice. */
const cache = new Map<string, string>();

type Auth = { token?: string | null; subInstituteId?: string | number | null };

export function HandoffCard({
  handoff,
  language,
  module,
  auth,
  onOpen,
}: {
  handoff: ModuleHandoff;
  language: UiLanguage;
  module?: string;
  auth: Auth;
  onOpen: () => void;
}) {
  const wanted = useMemo(
    () => [handoff.title, handoff.description, handoff.label],
    [handoff.title, handoff.description, handoff.label]
  );
  const [, bump] = useState(0);

  useEffect(() => {
    if (language === 'en') return;

    const missing = wanted.filter((text) => text && !cache.has(`${language}|${text}`));

    if (missing.length === 0) return;

    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch('/api/ai/ask/localize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(auth.token ? { Authorization: `Bearer ${auth.token}` } : {}),
            ...(auth.subInstituteId ? { 'X-MCP-Institute-Id': String(auth.subInstituteId) } : {}),
          },
          body: JSON.stringify({ strings: missing, to: language, module }),
        });

        if (!response.ok) return;

        const translations =
          ((await response.json()) as { data?: { translations?: Record<string, string> } })?.data?.translations ?? {};

        for (const [source, translated] of Object.entries(translations)) {
          if (typeof translated === 'string' && translated.trim()) cache.set(`${language}|${source}`, translated);
        }

        if (!cancelled) bump((n) => n + 1);
      } catch {
        // The card keeps its English; nothing here is worth interrupting the chat for.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [language, wanted, module, auth.token, auth.subInstituteId]);

  const say = (text: string) => (language === 'en' ? text : cache.get(`${language}|${text}`) ?? text);

  return (
    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
      <h4 className="text-sm font-semibold text-emerald-900">{say(handoff.title)}</h4>
      <p className="mt-0.5 text-xs leading-5 text-emerald-800/80">{say(handoff.description)}</p>
      <button
        type="button"
        onClick={onOpen}
        className="mt-2.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
      >
        {say(handoff.label)}
      </button>
    </div>
  );
}
