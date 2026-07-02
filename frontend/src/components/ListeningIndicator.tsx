/**
 * ListeningIndicator
 * Shows current interview phase with simple visuals.
 */

import React from 'react';
import { InterviewPhase } from '../hooks/useInterviewAutomation';

interface ListeningIndicatorProps {
  phase: InterviewPhase;
  transcript: string;
  silenceCountdown: number;
  isMicActive: boolean;
}

const PHASE_CONFIG: Record<
  InterviewPhase,
  { label: string; icon: string; color: string }
> = {
  idle:            { label: 'Preparing...', icon: '⏳', color: '#9ca3af' },
  speaking:        { label: 'Interviewer is speaking…', icon: '🗣️', color: '#1e40af' },
  listening:       { label: 'Listening… speak your answer', icon: '🎤', color: '#dc2626' },
  silence_timeout: { label: 'Moving to next question…', icon: '⏭️', color: '#b45309' },
  submitting:      { label: 'Saving answer…', icon: '💾', color: '#0369a1' },
  done:            { label: 'Interview complete!', icon: '✅', color: '#16a34a' },
};

const ListeningIndicator: React.FC<ListeningIndicatorProps> = ({
  phase,
  transcript,
  silenceCountdown,
  isMicActive,
}) => {
  const config = PHASE_CONFIG[phase] ?? PHASE_CONFIG.idle;

  return (
    <div className="listening-card">

      {/* Phase indicator */}
      <div className="phase-row">
        <span
          className={`phase-dot ${config.color === '#dc2626' || config.color === '#1e40af' ? 'pulse' : ''}`}
          style={{ background: config.color }}
        />
        <span className="phase-label" style={{ color: config.color }}>
          {config.icon}&nbsp;{config.label}
        </span>
      </div>

      {/* Mic visualizer bars */}
      {phase === 'listening' && (
        <div className="mic-visualizer" aria-label="Microphone active">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className={`mic-bar ${isMicActive ? 'active' : ''}`}
              style={{ animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>
      )}

      {/* Silence countdown — simple text + small circle */}
      {phase === 'listening' && (
        <div className="silence-countdown">
          <svg width="44" height="44" viewBox="0 0 44 44">
            <circle cx="22" cy="22" r="18" fill="none" stroke="#e5e7eb" strokeWidth="4" />
            <circle
              cx="22" cy="22" r="18"
              fill="none"
              stroke={silenceCountdown <= 3 ? '#dc2626' : '#1e40af'}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 18}`}
              strokeDashoffset={`${2 * Math.PI * 18 * (1 - silenceCountdown / 9)}`}
              style={{ transition: 'stroke-dashoffset 1s linear', transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
            />
            <text
              x="22" y="26"
              textAnchor="middle"
              fill={silenceCountdown <= 3 ? '#dc2626' : '#374151'}
              fontSize="12"
              fontWeight="700"
            >
              {silenceCountdown}
            </text>
          </svg>
          <span className="countdown-label">sec left</span>
        </div>
      )}

      {/* Live transcript box */}
      <div className="transcript-live">
        {transcript ? (
          <p className="transcript-text">
            <span className="transcript-quote">"</span>
            {transcript}
            <span className="transcript-quote">"</span>
          </p>
        ) : phase === 'listening' ? (
          <p className="transcript-placeholder">
            <span className="blink-cursor" /> Waiting for your voice…
          </p>
        ) : null}
      </div>
    </div>
  );
};

export default ListeningIndicator;
