/**
 * useInterviewAutomation
 * ---------------------
 * Central state machine for the fully automated interview flow.
 *
 * Flow per question:
 *   idle → speaking (TTS reads question) → listening (STT captures answer)
 *   → silence_timeout (if silence >8s) | submitting → caller handles next
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type InterviewPhase =
  | 'idle'
  | 'speaking'
  | 'listening'
  | 'silence_timeout'
  | 'submitting'
  | 'done';

export interface UseInterviewAutomationOptions {
  onAnswerReady: (transcript: string, phase: 'answered' | 'no_answer') => void;
  silenceTimeoutSec?: number;
}

export interface UseInterviewAutomationReturn {
  phase: InterviewPhase;
  transcript: string;
  silenceCountdown: number;
  isMicActive: boolean;
  speakQuestion: (text: string) => void;
  stopListening: () => void;
  reset: () => void;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const DEFAULT_SILENCE_SEC = 9;

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useInterviewAutomation({
  onAnswerReady,
  silenceTimeoutSec = DEFAULT_SILENCE_SEC,
}: UseInterviewAutomationOptions): UseInterviewAutomationReturn {
  const [phase, setPhase] = useState<InterviewPhase>('idle');
  const [transcript, setTranscript] = useState('');
  const [silenceCountdown, setSilenceCountdown] = useState(silenceTimeoutSec);
  const [isMicActive, setIsMicActive] = useState(false);

  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptRef = useRef('');
  const phaseRef = useRef<InterviewPhase>('idle');
  const onAnswerReadyRef = useRef(onAnswerReady);
  const submittedRef = useRef(false);

  useEffect(() => { onAnswerReadyRef.current = onAnswerReady; }, [onAnswerReady]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const clearTimers = useCallback(() => {
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
  }, []);

  const stopRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (_) {}
      recognitionRef.current = null;
    }
    setIsMicActive(false);
  }, []);

  // ─── Submit (exactly once per question) ───────────────────────────────────

  const submitAnswer = useCallback((reason: 'answered' | 'no_answer') => {
    if (submittedRef.current) return;
    submittedRef.current = true;

    clearTimers();
    stopRecognition();
    setPhase('submitting');

    onAnswerReadyRef.current(transcriptRef.current.trim(), reason);
  }, [clearTimers, stopRecognition]);

  // ─── Silence countdown ────────────────────────────────────────────────────

  const startSilenceTimer = useCallback(() => {
    clearTimers();
    setSilenceCountdown(silenceTimeoutSec);

    countdownRef.current = setInterval(() => {
      setSilenceCountdown(prev => Math.max(0, prev - 1));
    }, 1000);

    silenceTimerRef.current = setTimeout(() => {
      if (phaseRef.current !== 'listening') return;
      setPhase('silence_timeout');
      // ✅ Source of truth: transcript text field — any text = answered, empty = skip
      const hasSpoken = transcriptRef.current.trim().length > 0;
      submitAnswer(hasSpoken ? 'answered' : 'no_answer');
    }, silenceTimeoutSec * 1000);
  }, [silenceTimeoutSec, clearTimers, submitAnswer]);

  const resetSilenceTimer = useCallback(() => {
    clearTimers();
    startSilenceTimer();
  }, [clearTimers, startSilenceTimer]);

  // ─── Speech Recognition ───────────────────────────────────────────────────

  const startListening = useCallback(() => {
    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;

    submittedRef.current = false;
    transcriptRef.current = '';
    setTranscript('');
    setPhase('listening');

    if (!SpeechRecognitionClass) {
      setIsMicActive(false);
      startSilenceTimer();
      return;
    }

    setIsMicActive(true);

    const recognition = new SpeechRecognitionClass();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    let finalText = '';

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) { finalText += r[0].transcript + ' '; }
        else { interim += r[0].transcript; }
      }
      const combined = (finalText + interim).trim();
      transcriptRef.current = combined;
      setTranscript(combined);
      resetSilenceTimer();
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      console.error('Recognition error:', event.error);
    };

    recognition.onend = () => {
      setIsMicActive(false);
      // Restart if still in listening phase (Chrome timeout)
      if (phaseRef.current === 'listening' && !submittedRef.current) {
        try {
          const r2 = new SpeechRecognitionClass();
          recognitionRef.current = r2;
          r2.continuous = true;
          r2.interimResults = true;
          r2.lang = 'en-US';
          r2.onresult = recognition.onresult;
          r2.onerror = recognition.onerror;
          r2.onend = recognition.onend;
          r2.start();
          setIsMicActive(true);
        } catch (_) {}
      }
    };

    recognition.start();
    startSilenceTimer();
  }, [startSilenceTimer, resetSilenceTimer]);

  // ─── TTS ──────────────────────────────────────────────────────────────────

  const speakQuestion = useCallback((text: string) => {
    if (!text) return;

    stopRecognition();
    clearTimers();
    setTranscript('');
    transcriptRef.current = '';
    submittedRef.current = false;

    // ✅ Keep idle — do NOT set 'speaking' here (avatar would animate before sound)
    setPhase('idle');

    if (!('speechSynthesis' in window)) {
      startListening();
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate  = 0.92;
    utterance.pitch = 1.05;
    utterance.volume = 1;

    const applyVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      const preferred =
        voices.find(v => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha'))) ||
        voices.find(v => v.lang.startsWith('en')) || null;
      if (preferred) utterance.voice = preferred;
    };

    applyVoice();

    // ✅ Start avatar animation ONLY when TTS audio actually begins
    utterance.onstart = () => {
      setTimeout(() => {
        setPhase('speaking'); // synced with real audio start (80ms buffer for browser delay)
      }, 80);
    };

    utterance.onend   = () => setTimeout(() => startListening(), 650);
    utterance.onerror = () => setTimeout(() => startListening(), 650);

    setTimeout(() => { applyVoice(); window.speechSynthesis.speak(utterance); }, 220);
  }, [stopRecognition, clearTimers, startListening]);

  // ─── External stop ────────────────────────────────────────────────────────

  const stopListening = useCallback(() => {
    if (phaseRef.current !== 'listening') return;
    submitAnswer('answered');
  }, [submitAnswer]);

  // ─── Reset ────────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    stopRecognition();
    clearTimers();
    window.speechSynthesis?.cancel();
    setPhase('idle');
    setTranscript('');
    setSilenceCountdown(silenceTimeoutSec);
    transcriptRef.current = '';
    submittedRef.current = false;
  }, [stopRecognition, clearTimers, silenceTimeoutSec]);

  // ─── Cleanup ──────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      clearTimers();
      stopRecognition();
      window.speechSynthesis?.cancel();
    };
  }, [clearTimers, stopRecognition]);

  return { phase, transcript, silenceCountdown, isMicActive, speakQuestion, stopListening, reset };
}
