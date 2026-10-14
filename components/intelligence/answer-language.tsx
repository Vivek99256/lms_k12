'use client';

import { createContext, useContext } from 'react';

import type { UiLanguage } from '@/lib/voice/ui-labels';

/**
 * The language the answer being drawn is written in.
 *
 * Every answer card is drawn by components that add a few words of their own around the text
 * (a badge over a card, a "View" button). They read the language from here, so the whole answer
 * — the backend's text and the page's own wording — is in one language. English when nothing
 * provides one, which is how every screen outside the chat panel behaves.
 */
const AnswerLanguageContext = createContext<UiLanguage>('en');

export const AnswerLanguageProvider = AnswerLanguageContext.Provider;

export function useAnswerLanguage(): UiLanguage {
  return useContext(AnswerLanguageContext);
}
