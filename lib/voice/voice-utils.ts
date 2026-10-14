/**
 * What the chatbot's voice features decide, apart from the browser.
 *
 * The microphone and the speaker belong to the browser (the Web Speech API), but the
 * decisions around them do not: which language tag a language means, what an error code should
 * say to a person, which installed voice to read an answer with, and what text of an answer is
 * worth reading out loud. They live here as plain functions so they can be tested without a
 * browser, and so the hook that drives the microphone stays small.
 */

export type VoiceLanguageCode = 'en' | 'hi' | 'gu';

export interface VoiceLanguage {
  code: VoiceLanguageCode;
  /** The name shown in the language picker. */
  label: string;
  /** The BCP-47 tag the browser's recogniser and voices are chosen by. */
  tag: string;
}

export const VOICE_LANGUAGES: readonly VoiceLanguage[] = [
  { code: 'en', label: 'English', tag: 'en-IN' },
  { code: 'hi', label: 'Hindi', tag: 'hi-IN' },
  { code: 'gu', label: 'Gujarati', tag: 'gu-IN' },
];

/** The language a tag ("hi-IN", "hi", "Hindi") means, or null if it is not one of the three. */
export function languageOf(value: string | null | undefined): VoiceLanguage | null {
  const wanted = (value ?? '').trim().toLowerCase().replace('_', '-');

  if (!wanted) return null;

  return (
    VOICE_LANGUAGES.find(
      (language) =>
        wanted === language.code ||
        wanted.startsWith(`${language.code}-`) ||
        wanted === language.label.toLowerCase()
    ) ?? null
  );
}

/** The language of the characters in a sentence, as the server reads it. */
export function scriptOf(text: string): VoiceLanguageCode {
  const gujarati = (text.match(/[઀-૿]/g) ?? []).length;
  const devanagari = (text.match(/[ऀ-ॿ]/g) ?? []).length;

  if (gujarati > 0 && gujarati >= devanagari) return 'gu';

  return devanagari > 0 ? 'hi' : 'en';
}

/** Whether a sentence needs translating before the page can recognise a navigation request in it. */
export function isNonLatin(text: string): boolean {
  return scriptOf(text) !== 'en';
}

/* -------------------------------------------------------------------------- */
/* Errors                                                                      */
/* -------------------------------------------------------------------------- */

export type VoiceErrorKind =
  | 'unsupported'
  | 'insecure'
  | 'permission-denied'
  | 'no-microphone'
  | 'no-speech'
  | 'network'
  | 'language-unsupported'
  | 'busy'
  | 'unknown';

/** What a person should be told for a speech-recognition error code. */
export function recognitionErrorMessage(code: string, languageLabel: string): { kind: VoiceErrorKind; message: string } | null {
  switch (code) {
    // The person (or us) stopped it; not a failure.
    case 'aborted':
      return null;
    case 'not-allowed':
    case 'service-not-allowed':
      return {
        kind: 'permission-denied',
        message:
          'The microphone is blocked. Allow microphone access for this site (the lock icon next to the address), then press Voice again.',
      };
    case 'audio-capture':
      return {
        kind: 'no-microphone',
        message: 'No microphone was found. Connect one, check it is not in use by another app, and try again.',
      };
    case 'no-speech':
      return {
        kind: 'no-speech',
        message: 'I did not hear anything. Press Voice, wait a moment, then speak clearly.',
      };
    case 'network':
      return {
        kind: 'network',
        message:
          'Speech recognition needs an internet connection and could not reach the speech service. Check your connection and try again, or type your question.',
      };
    case 'language-not-supported':
      return {
        kind: 'language-unsupported',
        message: `This browser cannot recognise ${languageLabel}. Try Chrome or Edge, pick another language, or type your question.`,
      };
    default:
      return {
        kind: 'unknown',
        message: `Voice recognition stopped (${code || 'unknown reason'}). Please try again, or type your question.`,
      };
  }
}

export const UNSUPPORTED_RECOGNITION_MESSAGE =
  'Voice input is not supported in this browser. Use Chrome or Edge, or type your question.';

export const INSECURE_CONTEXT_MESSAGE =
  'Voice input only works on a secure (HTTPS) page. Open this site over HTTPS, or type your question.';

export const UNSUPPORTED_SYNTHESIS_MESSAGE =
  'Reading answers aloud is not supported in this browser. The answer is still on screen.';

export function noVoiceMessage(languageLabel: string): string {
  return `No ${languageLabel} voice is installed on this device, so this answer cannot be read aloud. Install a ${languageLabel} voice in your system speech settings, or read it on screen.`;
}

/* -------------------------------------------------------------------------- */
/* Choosing a voice                                                            */
/* -------------------------------------------------------------------------- */

export interface VoiceLike {
  lang: string;
  name: string;
  localService?: boolean;
  default?: boolean;
}

function normalise(tag: string): string {
  return tag.trim().toLowerCase().replace('_', '-');
}

/**
 * The installed voice that reads a language, or null if there is none.
 *
 * An exact match on the tag wins ("hi-IN"), then any voice for the same base language. There is
 * deliberately no fallback to a different language: an English voice reading Hindi text is
 * unintelligible, and silence with a message is more useful than noise.
 */
export function pickVoice<T extends VoiceLike>(voices: readonly T[], tag: string): T | null {
  const wanted = normalise(tag);
  const base = wanted.split('-')[0];

  const exact = voices.filter((voice) => normalise(voice.lang) === wanted);
  const sameLanguage = voices.filter((voice) => normalise(voice.lang).split('-')[0] === base);
  const pool = exact.length > 0 ? exact : sameLanguage;

  if (pool.length === 0) return null;

  // Prefer a natural-sounding online voice, then the platform's own, then whatever came first.
  return (
    pool.find((voice) => /google|natural|online/i.test(voice.name)) ??
    pool.find((voice) => voice.localService) ??
    pool[0]
  );
}

/* -------------------------------------------------------------------------- */
/* What to read out                                                            */
/* -------------------------------------------------------------------------- */

const MAX_SPOKEN_CHARS = 600;

/**
 * The part of an answer worth reading aloud.
 *
 * The answer's own sentence — its headline — is the answer; the cards beneath it are tables a
 * person reads, not hears. Without a headline, the start of the plain text stands in.
 */
export function speechTextFor(headline: string | undefined, content: string | undefined): string {
  const source = (headline ?? '').trim() || (content ?? '').trim();

  const cleaned = source
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[`*_#>~|]/g, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length <= MAX_SPOKEN_CHARS) return cleaned;

  const cut = cleaned.slice(0, MAX_SPOKEN_CHARS);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('। '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));

  return (end > 120 ? cut.slice(0, end + 1) : cut).trim();
}

/**
 * Sentences short enough for the browser to speak without stopping partway.
 *
 * Some engines silently cut an utterance after about fifteen seconds; speaking sentence by
 * sentence avoids that and lets the Mute button take effect between them.
 */
export function speechChunks(text: string, maxLength = 200): string[] {
  const sentences = text.match(/[^.!?।]+[.!?।]*\s*/g) ?? [text];
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    if ((current + sentence).length > maxLength && current) {
      chunks.push(current.trim());
      current = '';
    }

    if (sentence.length > maxLength) {
      const words = sentence.split(/\s+/);
      let piece = '';

      for (const word of words) {
        if ((piece + ' ' + word).length > maxLength && piece) {
          chunks.push(piece.trim());
          piece = '';
        }

        piece += (piece ? ' ' : '') + word;
      }

      current += piece;
    } else {
      current += sentence;
    }
  }

  if (current.trim()) chunks.push(current.trim());

  return chunks.filter(Boolean);
}
