import assert from 'node:assert/strict';
import test from 'node:test';

import {
  VOICE_LANGUAGES,
  isNonLatin,
  languageOf,
  noVoiceMessage,
  pickVoice,
  recognitionErrorMessage,
  scriptOf,
  speechChunks,
  speechTextFor,
} from './voice-utils';

test('the three supported languages carry the tags the browser recognises and speaks', () => {
  assert.deepEqual(
    VOICE_LANGUAGES.map((language) => language.tag),
    ['en-IN', 'hi-IN', 'gu-IN']
  );
});

test('a language is found from a tag, a code or a name, and anything else is not a language', () => {
  assert.equal(languageOf('hi-IN')?.code, 'hi');
  assert.equal(languageOf('gu_IN')?.code, 'gu');
  assert.equal(languageOf('English')?.code, 'en');
  assert.equal(languageOf('fr-FR'), null);
  assert.equal(languageOf(''), null);
  assert.equal(languageOf(undefined), null);
});

test('the script of a sentence decides Hindi, Gujarati or English', () => {
  assert.equal(scriptOf('Show students with pending fees'), 'en');
  assert.equal(scriptOf('बकाया फीस वाले छात्र दिखाओ'), 'hi');
  assert.equal(scriptOf('બાકી ફી બતાવો'), 'gu');
  assert.equal(scriptOf('मुझे 5 students दिखाओ'), 'hi');
  assert.equal(isNonLatin('Open admissions'), false);
  assert.equal(isNonLatin('એડમિશન ખોલો'), true);
});

test('every recognition error says what to do, and a deliberate stop says nothing', () => {
  assert.equal(recognitionErrorMessage('aborted', 'Hindi'), null);

  const denied = recognitionErrorMessage('not-allowed', 'Hindi');
  assert.equal(denied?.kind, 'permission-denied');
  assert.match(denied?.message ?? '', /Allow microphone access/);
  assert.equal(recognitionErrorMessage('service-not-allowed', 'Hindi')?.kind, 'permission-denied');

  assert.equal(recognitionErrorMessage('audio-capture', 'Hindi')?.kind, 'no-microphone');
  assert.equal(recognitionErrorMessage('no-speech', 'Hindi')?.kind, 'no-speech');
  assert.equal(recognitionErrorMessage('network', 'Hindi')?.kind, 'network');

  const unsupported = recognitionErrorMessage('language-not-supported', 'Gujarati');
  assert.equal(unsupported?.kind, 'language-unsupported');
  assert.match(unsupported?.message ?? '', /Gujarati/);

  const other = recognitionErrorMessage('something-new', 'Hindi');
  assert.equal(other?.kind, 'unknown');
  assert.match(other?.message ?? '', /something-new/);
});

test('a voice is chosen by exact tag, then by language, and never from a different language', () => {
  const voices = [
    { lang: 'en-US', name: 'Microsoft David' },
    { lang: 'en-IN', name: 'Microsoft Ravi', localService: true },
    { lang: 'hi-IN', name: 'Microsoft Hemant', localService: true },
    { lang: 'hi-IN', name: 'Google हिन्दी' },
    { lang: 'gu_IN', name: 'Android Gujarati' },
  ];

  assert.equal(pickVoice(voices, 'en-IN')?.name, 'Microsoft Ravi');
  assert.equal(pickVoice(voices, 'hi-IN')?.name, 'Google हिन्दी', 'a natural online voice is preferred');
  assert.equal(pickVoice(voices, 'gu-IN')?.name, 'Android Gujarati', 'an underscore tag still matches');
  assert.equal(pickVoice(voices, 'en-GB')?.lang.startsWith('en'), true, 'same language, other region');
  assert.equal(pickVoice(voices.filter((voice) => !voice.lang.startsWith('gu')), 'gu-IN'), null);
  assert.equal(pickVoice([], 'hi-IN'), null);
});

test('the message for a missing voice names the language', () => {
  assert.match(noVoiceMessage('Gujarati'), /No Gujarati voice/);
});

test('the headline is what is read out, cleaned of markup', () => {
  assert.equal(
    speechTextFor('**10 students** owe the most, `largest` first.', 'ignored body'),
    '10 students owe the most, largest first.'
  );
  assert.equal(speechTextFor('', '- one\n- two'), 'one two');
  assert.equal(speechTextFor(undefined, undefined), '');
  assert.equal(speechTextFor('Done 🎉 [see](http://x)', ''), 'Done see');
});

test('a very long answer is cut at a sentence, not mid-word', () => {
  const sentence = 'This is a reasonably long sentence about pending fees. ';
  const spoken = speechTextFor(sentence.repeat(30), '');

  assert.ok(spoken.length <= 600);
  assert.ok(spoken.endsWith('.'));
});

test('speech is split into sentences short enough to speak whole', () => {
  const text = 'पहला वाक्य यहाँ है। दूसरा वाक्य यहाँ है। तीसरा वाक्य यहाँ है।';
  const chunks = speechChunks(text, 30);

  assert.ok(chunks.length >= 2);
  assert.ok(chunks.every((chunk) => chunk.length <= 40));
  assert.equal(chunks.join(' ').replace(/\s+/g, ' '), text.replace(/\s+/g, ' '));
  assert.deepEqual(speechChunks('Short.'), ['Short.']);

  const long = speechChunks('word '.repeat(100), 50);
  assert.ok(long.every((chunk) => chunk.length <= 50));
});
