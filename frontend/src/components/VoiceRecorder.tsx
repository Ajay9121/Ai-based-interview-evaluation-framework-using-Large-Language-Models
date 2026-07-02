import React, { useState, useRef, useEffect, useCallback } from 'react';

interface VoiceRecorderProps {
  onTranscriptChange: (text: string) => void;
  onAudioFile?: (file: File) => void;
  disabled?: boolean;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onTranscriptChange, onAudioFile, disabled }) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [usingSpeechAPI, setUsingSpeechAPI] = useState(true);
  const [audioSeconds, setAudioSeconds] = useState(0);

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;

  const handleTranscriptChange = useCallback((text: string) => {
    setTranscript(text);
    onTranscriptChange(text);
  }, [onTranscriptChange]);

  const startSpeechRecognition = () => {
    if (!SpeechRecognitionClass) {
      setUsingSpeechAPI(false);
      startAudioRecording();
      return;
    }

    setError(null);
    const recognition = new SpeechRecognitionClass();
    recognitionRef.current = recognition;

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    let finalTranscript = '';
    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript + ' ';
        } else {
          interim += result[0].transcript;
        }
      }
      handleTranscriptChange((finalTranscript + interim).trim());
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech') {
        setError('No speech detected. Try again.');
      } else if (event.error === 'not-allowed') {
        setError('Microphone access denied. Please allow microphone access.');
      } else {
        setError(`Error: ${event.error}`);
      }
      setIsListening(false);
    };

    recognition.onend = () => { setIsListening(false); };
    recognition.start();
    setIsListening(true);
  };

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  const startAudioRecording = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `recording_${Date.now()}.webm`, { type: 'audio/webm' });
        onAudioFile?.(file);
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start(250);
      setIsRecordingAudio(true);
      setAudioSeconds(0);
      timerRef.current = setInterval(() => setAudioSeconds(s => s + 1), 1000);
    } catch {
      setError('Microphone access denied. Please allow microphone access and try again.');
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecordingAudio(false);
  };

  const handleStart = () => {
    if (usingSpeechAPI && SpeechRecognitionClass) {
      startSpeechRecognition();
    } else {
      startAudioRecording();
    }
  };

  const handleStop = () => {
    if (isListening) stopSpeechRecognition();
    if (isRecordingAudio) stopAudioRecording();
  };

  const handleClear = () => {
    handleTranscriptChange('');
    setError(null);
  };

  const isActive = isListening || isRecordingAudio;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return (
    <div className="recorder-card">

      <div className="recorder-header">
        🎙️ Your Answer
        {!SpeechRecognitionClass && (
          <span className="badge badge-warning" style={{ marginLeft: 8 }}>Audio Fallback</span>
        )}
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 12 }}>
          ⚠️ {error}
        </div>
      )}

      <textarea
        id="transcript-box"
        className="transcript-box"
        value={transcript}
        onChange={(e) => handleTranscriptChange(e.target.value)}
        placeholder={
          isActive
            ? '🎤 Listening… speak your answer…'
            : 'Your answer will appear here. You can also type directly.'
        }
        disabled={isActive}
        rows={5}
      />

      {isRecordingAudio && (
        <div style={{ fontSize: '0.82rem', color: '#dc2626', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#dc2626' }} />
          Recording — {audioSeconds}s (audio will be sent for transcription)
        </div>
      )}

      <div className="recorder-controls">
        {!isActive ? (
          <button
            id="start-recording-btn"
            className="btn btn-danger"
            onClick={handleStart}
            disabled={disabled}
          >
            🎤 Start Recording
          </button>
        ) : (
          <button
            id="stop-recording-btn"
            className="btn btn-secondary"
            onClick={handleStop}
          >
            ⏹ Stop
          </button>
        )}

        <button
          id="clear-answer-btn"
          className="btn btn-secondary btn-sm"
          onClick={handleClear}
          disabled={isActive || disabled}
        >
          ✕ Clear
        </button>
      </div>

      <div style={{ marginTop: 8, fontSize: '0.8rem', color: '#9ca3af' }}>
        {SpeechRecognitionClass
          ? '✓ Real-time speech recognition active'
          : '⚠ Real-time recognition unavailable — audio will be processed'}
      </div>
    </div>
  );
};

export default VoiceRecorder;
