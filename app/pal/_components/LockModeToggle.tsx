'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { Lock, LockOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Lock / Unlock mode for the sequential PAL screens.
 *
 * "Lock" is the existing behaviour (steps / concepts open one after another).
 * "Unlock" opens everything for direct access, in any order. The mode is only a
 * view over the same completion data: it never writes progress, completion or
 * diagnostic results, so switching back to Lock restores the sequential state
 * exactly as it was.
 *
 * Each scope is stored on its own so unlocking the Learning Journey does not
 * unlock the Concept Diagnostic. Every component reading a scope re-renders
 * together, in this tab (listeners) and in others (storage event).
 */
export type LockScope = 'journey' | 'concept';

const storageKey = (scope: LockScope) => `pal_unlock_all_${scope}`;
const listeners = new Set<() => void>();

function readUnlocked(scope: LockScope): boolean {
  try {
    return window.localStorage.getItem(storageKey(scope)) === '1';
  } catch {
    return false;
  }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

export function useUnlockAll(scope: LockScope): [boolean, (unlocked: boolean) => void] {
  const unlocked = useSyncExternalStore(
    subscribe,
    () => readUnlocked(scope),
    () => false
  );

  const setUnlocked = useCallback(
    (next: boolean) => {
      try {
        window.localStorage.setItem(storageKey(scope), next ? '1' : '0');
      } catch {
        // Storage unavailable: nothing persists, so fall through to the notify.
      }
      listeners.forEach((listener) => listener());
    },
    [scope]
  );

  return [unlocked, setUnlocked];
}

export function LockModeToggle({
  scope,
  className,
}: {
  scope: LockScope;
  className?: string;
}) {
  const [unlocked, setUnlocked] = useUnlockAll(scope);

  const options = [
    { value: false, label: 'Lock', Icon: Lock },
    { value: true, label: 'Unlock', Icon: LockOpen },
  ] as const;

  return (
    <div
      role="group"
      aria-label="Lock mode"
      className={cn(
        'inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs',
        className
      )}
    >
      {options.map(({ value, label, Icon }) => {
        const active = unlocked === value;
        return (
          <button
            key={label}
            type="button"
            aria-pressed={active}
            onClick={() => setUnlocked(value)}
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-semibold transition-colors',
              active
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-white hover:text-slate-900'
            )}
          >
            <Icon aria-hidden className="h-3.5 w-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
