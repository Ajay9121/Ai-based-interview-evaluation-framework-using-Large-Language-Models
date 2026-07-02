/**
 * SpeakingWave.tsx
 * Red audio-bar wave animation — visible only while AI is speaking.
 */

import React from 'react';
import './SpeakingWave.css';

interface SpeakingWaveProps {
  isSpeaking: boolean;
}

const SpeakingWave: React.FC<SpeakingWaveProps> = ({ isSpeaking }) => {
  if (!isSpeaking) return null;

  return (
    <div className="speaking-wave" aria-label="AI is speaking">
      {[1, 2, 3, 4, 5, 6, 7].map(i => (
        <span key={i} className={`speaking-wave__bar bar-${i}`} />
      ))}
    </div>
  );
};

export default SpeakingWave;
