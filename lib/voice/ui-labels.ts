/**
 * The fixed wording of the chat panel's own interface, in each supported language.
 *
 * An answer's text arrives already in the person's language (the backend translates it). These
 * are the words the PAGE adds around an answer — "Sources", "Show details", the badge over each
 * card — which the backend never sees. They are interface labels, not conversation content: a
 * short, closed list that does not depend on any school's data.
 */

export type UiLanguage = 'en' | 'hi' | 'gu';

export type UiLabelKey =
  | 'fromRecords'
  | 'aiAnalysis'
  | 'needsDecision'
  | 'view'
  | 'sources'
  | 'noDataReturned'
  | 'notRecorded'
  | 'showDetails'
  | 'hideDetails'
  | 'working'
  | 'agentActivity'
  | 'verified';

export const UI_LABELS: Record<UiLanguage, Record<UiLabelKey, string>> = {
  en: {
    fromRecords: 'From your records',
    aiAnalysis: 'AI analysis',
    needsDecision: 'Needs a decision',
    view: 'View',
    sources: 'Sources',
    noDataReturned: 'no data returned',
    notRecorded: 'not recorded',
    showDetails: 'Show details',
    hideDetails: 'Hide details',
    working: 'Working…',
    agentActivity: 'Agent activity',
    verified: 'Verified',
  },
  hi: {
    fromRecords: 'आपके रिकॉर्ड से',
    aiAnalysis: 'AI विश्लेषण',
    needsDecision: 'निर्णय आवश्यक',
    view: 'देखें',
    sources: 'स्रोत',
    noDataReturned: 'कोई डेटा नहीं मिला',
    notRecorded: 'दर्ज नहीं',
    showDetails: 'विवरण दिखाएँ',
    hideDetails: 'विवरण छिपाएँ',
    working: 'काम चल रहा है…',
    agentActivity: 'एजेंट गतिविधि',
    verified: 'सत्यापित',
  },
  gu: {
    fromRecords: 'તમારા રેકોર્ડમાંથી',
    aiAnalysis: 'AI વિશ્લેષણ',
    needsDecision: 'નિર્ણય જરૂરી',
    view: 'જુઓ',
    sources: 'સ્રોત',
    noDataReturned: 'કોઈ ડેટા મળ્યો નથી',
    notRecorded: 'નોંધાયેલ નથી',
    showDetails: 'વિગતો બતાવો',
    hideDetails: 'વિગતો છુપાવો',
    working: 'કામ ચાલુ છે…',
    agentActivity: 'એજન્ટ પ્રવૃત્તિ',
    verified: 'ચકાસાયેલ',
  },
};

export function uiLabel(language: UiLanguage | undefined, key: UiLabelKey): string {
  return UI_LABELS[language ?? 'en']?.[key] ?? UI_LABELS.en[key];
}

/** "3 of 12 steps completed", in a language. The numbers are as given. */
export function stepsCompleted(language: UiLanguage | undefined, reached: number, total: number): string {
  switch (language) {
    case 'hi':
      return `${total} में से ${reached} चरण पूरे`;
    case 'gu':
      return `${total} માંથી ${reached} પગલાં પૂર્ણ`;
    default:
      return `${reached} of ${total} steps completed`;
  }
}
