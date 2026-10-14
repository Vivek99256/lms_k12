'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

import {
  INSECURE_CONTEXT_MESSAGE,
  UNSUPPORTED_RECOGNITION_MESSAGE,
  UNSUPPORTED_SYNTHESIS_MESSAGE,
  VOICE_LANGUAGES,
  languageOf,
  noVoiceMessage,
  pickVoice,
  recognitionErrorMessage,
  speechChunks,
} from '@/lib/voice/voice-utils'

declare global {
  interface Window {
    webkitSpeechRecognition?: SpeechRecognitionConstructor
    SpeechRecognition?: SpeechRecognitionConstructor
  }

  interface SpeechRecognitionConstructor {
    new (): SpeechRecognition
  }

  interface SpeechRecognition extends EventTarget {
    continuous: boolean
    interimResults: boolean
    lang: string
    maxAlternatives?: number
    start(): void
    stop(): void
    abort(): void
    onstart: (() => void) | null
    onresult: ((event: SpeechRecognitionEvent) => void) | null
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
    onend: (() => void) | null
  }

  interface SpeechRecognitionResult {
    readonly isFinal: boolean
    0: {
      transcript: string
    }
  }

  interface SpeechRecognitionEvent {
    resultIndex: number
    results: ArrayLike<SpeechRecognitionResult>
  }

  interface SpeechRecognitionErrorEvent {
    error: string
  }
}

const SPEAK_REPLIES_KEY = 'chatbot-speak-replies'

// Whether this browser can listen and speak is a fact about the browser, read without effects:
// the server render has no `window`, so it answers false there and the real answer after hydration.
const noSubscription = () => () => {}
const canRecognise = () => Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
const canSpeak = () => Boolean(window.speechSynthesis && typeof SpeechSynthesisUtterance !== 'undefined')
const no = () => false

function readSpeakReplies(): boolean {
  if (typeof window === 'undefined') return false

  try {
    return window.localStorage.getItem(SPEAK_REPLIES_KEY) === '1'
  } catch {
    // Storage can be blocked; the preference then lasts for the visit only.
    return false
  }
}
const VOICES_WAIT_MS = 1500

/** The labels the picker shows, with the tag the browser is given. */
const SUPPORTED_LANGUAGES = VOICE_LANGUAGES.map((language) => ({ label: language.label, value: language.tag }))

interface UseVoiceInteractionOptions {
  /**
   * Called once with what was said when the person stops speaking — the signal to ask the
   * question. `language` is the tag the recogniser was listening for.
   */
  onFinalTranscript?: (text: string, language: string) => void
}

/** Wait for the browser to list its voices; some load them a moment after the page. */
function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis
  const now = synth.getVoices()

  if (now.length > 0) return Promise.resolve(now)

  return new Promise((resolve) => {
    const done = () => {
      synth.removeEventListener('voiceschanged', done)
      window.clearTimeout(timer)
      resolve(synth.getVoices())
    }
    const timer = window.setTimeout(done, VOICES_WAIT_MS)

    synth.addEventListener('voiceschanged', done)
  })
}

export function useVoiceInteraction(options: UseVoiceInteractionOptions = {}) {
  const [language, setLanguage] = useState('en-IN')
  const [transcript, setTranscript] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isSupported = useSyncExternalStore(noSubscription, canRecognise, no)
  const isSpeechSupported = useSyncExternalStore(noSubscription, canSpeak, no)
  const [speakReplies, setSpeakRepliesState] = useState(readSpeakReplies)

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const finalRef = useRef('')
  const interimRef = useRef('')
  const deliveredRef = useRef(false)
  const failedRef = useRef(false)
  const speakingRunRef = useRef(0)
  const onFinalRef = useRef(options.onFinalTranscript)

  useEffect(() => {
    onFinalRef.current = options.onFinalTranscript
  }, [options.onFinalTranscript])

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort()
      window.speechSynthesis?.cancel()
    }
  }, [])

  const setSpeakReplies = useCallback((value: boolean) => {
    setSpeakRepliesState(value)

    try {
      window.localStorage.setItem(SPEAK_REPLIES_KEY, value ? '1' : '0')
    } catch {
      // Not persisted; still applies now.
    }

    if (!value) {
      speakingRunRef.current += 1
      window.speechSynthesis?.cancel()
      setIsSpeaking(false)
    }
  }, [])

  const startRecording = useCallback(async () => {
    if (typeof window === 'undefined') return

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition

    if (!Recognition) {
      setError(UNSUPPORTED_RECOGNITION_MESSAGE)
      return
    }

    // Microphones are only offered to secure pages (localhost counts).
    if (!window.isSecureContext) {
      setError(INSECURE_CONTEXT_MESSAGE)
      return
    }

    // Ask the browser what it already knows, so a blocked microphone is explained
    // before the person speaks into nothing.
    try {
      const status = await navigator.permissions?.query({ name: 'microphone' as PermissionName })

      if (status?.state === 'denied') {
        setError(recognitionErrorMessage('not-allowed', '')?.message ?? null)
        return
      }
    } catch {
      // Not every browser can answer; recognition reports a refusal itself.
    }

    // Talking over the answer being read would be recognised as a question.
    speakingRunRef.current += 1
    window.speechSynthesis?.cancel()
    setIsSpeaking(false)
    recognitionRef.current?.abort()

    setError(null)
    setTranscript('')
    finalRef.current = ''
    interimRef.current = ''
    deliveredRef.current = false
    failedRef.current = false

    const tag = language
    const label = languageOf(tag)?.label ?? tag
    const recognition = new Recognition()

    recognition.lang = tag
    recognition.continuous = false
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    // A session that was replaced (or aborted) can still fire its last events; only the current one counts.
    const current = () => recognitionRef.current === recognition

    recognition.onresult = (event) => {
      if (!current()) return

      let finalText = ''
      let interimText = ''

      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index]
        const text = result[0]?.transcript ?? ''

        if (result.isFinal) finalText += text
        else interimText += text
      }

      finalRef.current = finalText.trim()
      interimRef.current = interimText.trim()
      setTranscript((finalText + interimText).trim())
    }

    recognition.onerror = (event) => {
      if (!current()) return

      const problem = recognitionErrorMessage(event.error, label)

      if (problem) {
        failedRef.current = true
        setError(problem.message)
      }

      setIsRecording(false)
    }

    recognition.onend = () => {
      if (!current()) return

      setIsRecording(false)
      recognitionRef.current = null

      // What was heard when the engine stopped: the settled text, or — if the person pressed
      // Stop before it settled — the best guess so far.
      const heard = (finalRef.current || interimRef.current).trim()

      if (deliveredRef.current || failedRef.current) return

      if (heard) {
        deliveredRef.current = true
        onFinalRef.current?.(heard, tag)
      } else {
        // Ended with nothing: say so rather than appearing to ignore the person.
        setError(recognitionErrorMessage('no-speech', label)?.message ?? null)
      }
    }

    recognitionRef.current = recognition

    try {
      recognition.start()
      setIsRecording(true)
    } catch {
      // `start()` throws if a session is already open.
      setIsRecording(false)
      setError('The microphone is busy. Wait a moment and press Voice again.')
    }
  }, [language])

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  /**
   * Read text aloud in a language.
   *
   * The voice is chosen by the language of the TEXT, not the language picked for the
   * microphone: an answer written in Hindi is read by a Hindi voice even when the person
   * went on to ask the next question in English. If the device has no voice for that language
   * nothing is spoken and the person is told why — an English voice reading Hindi is noise.
   */
  const speakText = useCallback(
    async (text: string, tag?: string) => {
      if (typeof window === 'undefined' || !window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') {
        setError(UNSUPPORTED_SYNTHESIS_MESSAGE)
        return
      }

      const spoken = text.trim()

      if (!spoken) return

      const wanted = tag ?? language
      const label = languageOf(wanted)?.label ?? wanted
      const run = ++speakingRunRef.current

      window.speechSynthesis.cancel()
      setError(null)

      const voices = await loadVoices()

      // Superseded while the voices were loading: a newer request, or Mute.
      if (run !== speakingRunRef.current) return

      const voice = pickVoice(voices, wanted)

      // English can fall back to the browser default; Hindi and Gujarati cannot.
      if (!voice && !wanted.toLowerCase().startsWith('en')) {
        setError(noVoiceMessage(label))
        return
      }

      const chunks = speechChunks(spoken)

      setIsSpeaking(true)

      chunks.forEach((chunk, index) => {
        const utterance = new SpeechSynthesisUtterance(chunk)

        utterance.lang = voice?.lang ?? wanted
        if (voice) utterance.voice = voice

        const last = index === chunks.length - 1

        utterance.onend = () => {
          if (last && run === speakingRunRef.current) setIsSpeaking(false)
        }
        utterance.onerror = (event) => {
          // Cancelling to start something else is not a failure.
          const reason = (event as SpeechSynthesisErrorEvent).error

          if (reason === 'canceled' || reason === 'interrupted') return

          if (run === speakingRunRef.current) {
            setError('Reading the answer aloud failed. The answer is still on screen.')
            setIsSpeaking(false)
          }
        }

        window.speechSynthesis.speak(utterance)
      })
    },
    [language]
  )

  const stopSpeaking = useCallback(() => {
    speakingRunRef.current += 1

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }

    setIsSpeaking(false)
  }, [])

  return {
    supportedLanguages: SUPPORTED_LANGUAGES,
    isSupported,
    isSpeechSupported,
    language,
    setLanguage,
    transcript,
    setTranscript,
    isRecording,
    startRecording,
    stopRecording,
    isSpeaking,
    speakText,
    stopSpeaking,
    speakReplies,
    setSpeakReplies,
    error,
    clearError: () => setError(null),
  }
}
