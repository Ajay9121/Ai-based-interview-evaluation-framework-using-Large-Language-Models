/**
 * Avatar.tsx
 * AI interviewer avatar face with natural eye blinking.
 * - Blinks independently of speaking state (always active)
 * - Randomised interval: 2–5 s between blinks
 * - Blink duration: ~120 ms close, then reopen
 */

import React, { useEffect, useRef, useState } from 'react';

interface AvatarProps {
  isSpeaking: boolean;
  questionText?: string;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
}

const Avatar: React.FC<AvatarProps> = ({ isSpeaking }) => {
  const [mouthOpen, setMouthOpen]   = useState(false);
  const [isBlinking, setIsBlinking] = useState(false);

  const mouthIntervalRef  = useRef<ReturnType<typeof setInterval>  | null>(null);
  const blinkTimeoutRef   = useRef<ReturnType<typeof setTimeout>   | null>(null);

  // ── Mouth animation while speaking ──────────────────────────────────────────
  useEffect(() => {
    if (isSpeaking) {
      mouthIntervalRef.current = setInterval(() => {
        setMouthOpen(prev => !prev);
      }, 110);
    } else {
      if (mouthIntervalRef.current) clearInterval(mouthIntervalRef.current);
      setMouthOpen(false);
    }
    return () => {
      if (mouthIntervalRef.current) clearInterval(mouthIntervalRef.current);
    };
  }, [isSpeaking]);

  // ── Natural eye-blink loop (always running) ──────────────────────────────────
  useEffect(() => {
    const scheduleBlink = () => {
      // Randomise delay between 2 000 ms and 5 000 ms
      const delay = 2000 + Math.random() * 3000;

      blinkTimeoutRef.current = setTimeout(() => {
        // Close eyes
        setIsBlinking(true);

        // Reopen after 120 ms
        blinkTimeoutRef.current = setTimeout(() => {
          setIsBlinking(false);
          // Schedule the next blink
          scheduleBlink();
        }, 120);
      }, delay);
    };

    scheduleBlink();

    return () => {
      if (blinkTimeoutRef.current) clearTimeout(blinkTimeoutRef.current);
    };
  }, []); // runs once on mount

  // Eye ry: 1 = closed (blinking), 8 = open
  const eyeRy  = isBlinking ? 1 : 8;
  const mouthRy = isSpeaking ? (mouthOpen ? 10 : 3) : 3;

  return (
    <div className="avatar-card">
      <div className="avatar-svg-wrapper">
        <div className={`avatar-speaking-ring ${isSpeaking ? 'active' : ''}`} />

        <svg width="140" height="140" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Background circle */}
          <circle cx="100" cy="100" r="95" fill="#dbeafe" stroke="#93c5fd" strokeWidth="2" />

          {/* Face */}
          <circle cx="100" cy="95" r="62" fill="#1e40af" />

          {/* Eyes — ry shrinks to 1 on blink */}
          <ellipse cx="78"  cy="82" rx="9" ry={eyeRy} fill="white"
            style={{ transition: 'ry 60ms ease-in-out' }} />
          <ellipse cx="122" cy="82" rx="9" ry={eyeRy} fill="white"
            style={{ transition: 'ry 60ms ease-in-out' }} />

          {/* Pupils — hidden while blinking */}
          {!isBlinking && (
            <>
              <circle cx="81"  cy="84" r="4" fill="#1e3a8a" />
              <circle cx="125" cy="84" r="4" fill="#1e3a8a" />

              {/* Pupil shine */}
              <circle cx="83"  cy="82" r="1.5" fill="white" />
              <circle cx="127" cy="82" r="1.5" fill="white" />
            </>
          )}

          {/* Eyebrows */}
          <path d="M 67 69 Q 78 63 89 69"  stroke="white" strokeWidth="3" strokeLinecap="round" fill="none" />
          <path d="M 111 69 Q 122 63 133 69" stroke="white" strokeWidth="3" strokeLinecap="round" fill="none" />

          {/* Nose */}
          <ellipse cx="100" cy="102" rx="5" ry="4" fill="rgba(255,255,255,0.25)" />

          {/* Mouth */}
          <ellipse
            cx="100" cy="118" rx="16" ry={mouthRy}
            fill={isSpeaking ? '#1e3a8a' : 'rgba(255,255,255,0.2)'}
          />
          {!isSpeaking && (
            <path d="M 84 115 Q 100 126 116 115" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          )}

          {/* Ears */}
          <ellipse cx="38"  cy="95" rx="10" ry="15" fill="#1e40af" />
          <ellipse cx="162" cy="95" rx="10" ry="15" fill="#1e40af" />
        </svg>
      </div>

      <div className="avatar-status">
        <div className={`status-dot ${isSpeaking ? 'speaking' : ''}`} />
        <span style={{ fontSize: '0.85rem', color: '#374151' }}>
          {isSpeaking ? 'Speaking…' : 'Ready'}
        </span>
      </div>

      {isSpeaking && (
        <p style={{ fontSize: '0.78rem', color: '#6b7280', textAlign: 'center', maxWidth: 180 }}>
          🔊 Listen carefully
        </p>
      )}
    </div>
  );
};

export default Avatar;
