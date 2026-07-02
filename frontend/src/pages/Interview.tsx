/**
 * Interview.tsx — Automated AI Interview Page
 * Flow: Setup → Start → Speak → Listen → Submit → Result
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Avatar from '../components/Avatar';
import ListeningIndicator from '../components/ListeningIndicator';
import SpeakingWave from '../components/SpeakingWave';
import { useInterviewAutomation } from '../hooks/useInterviewAutomation';
import { interviewAPI, resumeAPI } from '../services/api';
import {
  StartInterviewResponse,
  QuestionDTO,
  InterviewProgress,
  User,
  DetailedInterviewResult,
} from '../types';

interface AIEval {
  accuracy: number;
  completeness: number;
  clarity: number;
  final_score: number;
  verdict?: string;
  feedback: string;
  strengths: string;
  improvements: string;
  key_concepts_missed?: string[];
  ideal_answer_hint?: string;
  question_type?: string;
  _evaluated_by?: string;
}

interface AnsweredQuestion {
  question: QuestionDTO;
  answer: string;
  answeredBy: 'voice' | 'no_answer';
  score?: number;
  aiEval?: AIEval;
  isFollowUp?: boolean;        // true = this entry is a follow-up question
  followUpQuestionText?: string; // the actual follow-up question text
}

const Interview: React.FC = () => {
  const navigate = useNavigate();

  const [user, setUser] = useState<User | null>(null);

  // Setup phase
  const [setupMode, setSetupMode] = useState(true);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [skills, setSkills] = useState<string[]>([]);
  const [level, setLevel] = useState('');
  const [isStarting, setIsStarting] = useState(false);

  // Interview session
  const [interviewId, setInterviewId] = useState<number | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionDTO | null>(null);
  const [progress, setProgress] = useState<InterviewProgress | null>(null);
  const [answeredQuestions, setAnsweredQuestions] = useState<AnsweredQuestion[]>([]);
  const [isBetweenQuestions, setIsBetweenQuestions] = useState(false);
  const [transitionMsg, setTransitionMsg] = useState('');

  // Result
  const [result, setResult] = useState<DetailedInterviewResult | null>(null);
  const [evaluating, setEvaluating] = useState(false);

  // Follow-up
  const [followUpText, setFollowUpText] = useState<string | null>(null); // displayed in question card

  // Refs
  const interviewIdRef = useRef<number | null>(null);
  const currentQuestionRef = useRef<QuestionDTO | null>(null);
  const answeredRef = useRef<AnsweredQuestion[]>([]);
  const isProcessingRef = useRef(false);
  const isFollowUpRef = useRef(false);          // true while collecting follow-up answer
  const mainAnswerRef = useRef('');             // stores main answer text during follow-up phase
  const noAnswerCountRef = useRef(0);           // counts total skipped / no-answer questions
  const followUpTextRef = useRef<string | null>(null); // mirrors followUpText state (avoids stale closure)

  useEffect(() => { interviewIdRef.current = interviewId; }, [interviewId]);
  useEffect(() => { currentQuestionRef.current = currentQuestion; }, [currentQuestion]);
  useEffect(() => { answeredRef.current = answeredQuestions; }, [answeredQuestions]);
  useEffect(() => { followUpTextRef.current = followUpText; }, [followUpText]);

  // ── Save result to localStorage when interview finishes ───────────────────
  useEffect(() => {
    if (!result) return;
    try {
      let parsedFeedback: any = {};
      try { parsedFeedback = result.feedbackJson ? JSON.parse(result.feedbackJson) : {}; } catch {}

      const improvements: string[] =
        parsedFeedback.areas_for_improvement?.length
          ? parsedFeedback.areas_for_improvement
          : result.areasForImprovement
          ? [result.areasForImprovement]
          : ['No specific improvements recorded.'];

      const strengths: string[] =
        parsedFeedback.strengths?.length
          ? parsedFeedback.strengths
          : result.strengths
          ? [result.strengths]
          : [];

      const suggestions: string[] = parsedFeedback.suggestions ?? [];

      const summary = {
        id:             result.interviewId ?? Date.now(),
        date:           new Date().toISOString(),
        finalScore:     result.finalScore ?? 0,
        recommendation: result.recommendation ?? 'On Hold',
        improvements,
        strengths,
        suggestions,
      };

      const existing: any[] = (() => {
        try { return JSON.parse(localStorage.getItem('interview_history') ?? '[]'); } catch { return []; }
      })();

      // Deduplicate by id and keep last 20 entries
      const updated = [summary, ...existing.filter((e: any) => e.id !== summary.id)].slice(0, 20);
      localStorage.setItem('interview_history', JSON.stringify(updated));
    } catch { /* localStorage write failure — ignore */ }
  }, [result]);

  const handleAnswerReady = useCallback(async (
    transcript: string,
    answerPhase: 'answered' | 'no_answer'
  ) => {
    if (isProcessingRef.current) return;

    const iId = interviewIdRef.current;
    const q = currentQuestionRef.current;
    if (!iId || !q) return;

    // ── Follow-up answer collected → record as separate entry + advance ────
    if (isFollowUpRef.current) {
      const capturedFollowUpText = followUpTextRef.current; // ✅ read from ref (never stale)
      isFollowUpRef.current = false;
      isProcessingRef.current = true;
      setFollowUpText(null);
      followUpTextRef.current = null;

      // ✅ Push follow-up as its OWN entry in answeredQuestions (so it appears in breakdown)
      const followUpEntry: AnsweredQuestion = {
        question: q,                          // same main question object (for skill/difficulty badges)
        followUpQuestionText: capturedFollowUpText ?? 'Follow-up question', // actual follow-up text
        answer: transcript.trim() ? transcript.trim() : '(No answer provided)',
        answeredBy: transcript.trim().length > 0 ? 'voice' : 'no_answer',
        isFollowUp: true,
      };
      setAnsweredQuestions(prev => [...prev, followUpEntry]);

      setIsBetweenQuestions(true);
      setTransitionMsg('✅ Answer recorded! Loading next question…');

      try {
        const progRes = await interviewAPI.progress(iId);
        setProgress(progRes.data);
        await new Promise(r => setTimeout(r, 1000));

        if (progRes.data.isComplete) {
          await finishInterview(iId);
        } else {
          const nextRes = await interviewAPI.next(iId, q.id);
          if (nextRes.data.done) {
            await finishInterview(iId);
          } else {
            setCurrentQuestion(nextRes.data);
            setIsBetweenQuestions(false);
            voiceApi.speakQuestion(nextRes.data.questionText);
          }
        }
      } catch (err) {
        console.error('Advance error after follow-up:', err);
      } finally {
        isProcessingRef.current = false;
      }
      return;
    }

    // ── Main answer collected → strict sequential flow ────────────────────────
    isProcessingRef.current = true;
    mainAnswerRef.current = transcript || '';

    // ✅ Source of truth: check transcript text — any text = answered, blank = skip
    const actuallyAnswered = transcript.trim().length > 0;

    const answeredEntry: AnsweredQuestion = {
      question: q,
      answer: actuallyAnswered ? mainAnswerRef.current : '(No answer provided)',
      answeredBy: actuallyAnswered ? 'voice' : 'no_answer',
    };
    setAnsweredQuestions(prev => [...prev, answeredEntry]);
    setIsBetweenQuestions(true);

    // ── No answer → check early-stop threshold, then advance ────────────────
    if (!actuallyAnswered) {
      noAnswerCountRef.current += 1;

      // ── Early termination: 3 unanswered questions ─────────────────────────
      if (noAnswerCountRef.current >= 3) {
        setTransitionMsg(
          '⛔ 3 questions skipped — ending interview early and computing your report…'
        );
        try {
          await interviewAPI.submitAnswer(iId, q.id, 'No answer provided');
        } catch { /* best-effort */ }
        await new Promise(r => setTimeout(r, 2000));
        isProcessingRef.current = false;
        await finishInterview(iId);
        return;
      }

      // ── Fewer than 3 skips — move to next question normally ───────────────
      setTransitionMsg(
        `⏭ No answer — moving on… (${noAnswerCountRef.current}/3 skips used)`
      );
      try {
        await interviewAPI.submitAnswer(iId, q.id, 'No answer provided');
        const progRes = await interviewAPI.progress(iId);
        setProgress(progRes.data);
        await new Promise(r => setTimeout(r, 900));
        if (progRes.data.isComplete) {
          await finishInterview(iId);
        } else {
          const nextRes = await interviewAPI.next(iId, q.id);
          if (nextRes.data.done) await finishInterview(iId);
          else {
            setCurrentQuestion(nextRes.data);
            setIsBetweenQuestions(false);
            voiceApi.speakQuestion(nextRes.data.questionText);
          }
        }
      } catch (err) {
        console.error('Skip error:', err);
      } finally {
        isProcessingRef.current = false;
      }
      return;
    }

    try {
      // ── STEP 1: Submit answer + evaluate in parallel (evaluation FIRST) ───
      setTransitionMsg('🧠 Evaluating your answer…');
      const [, evalRes] = await Promise.allSettled([
        interviewAPI.submitAnswer(iId, q.id, mainAnswerRef.current),
        interviewAPI.evaluateAnswer(q.questionText, mainAnswerRef.current),
      ]);

      // Extract evaluation data
      const aiEval: AIEval | undefined =
        evalRes.status === 'fulfilled' ? evalRes.value.data : undefined;

      // Store AI eval in state
      if (aiEval) {
        setAnsweredQuestions(prev =>
          prev.map((aq, idx) =>
            idx === prev.length - 1 ? { ...aq, aiEval } : aq
          )
        );
      }

      // ── STEP 2: Generate follow-up USING the evaluation result ────────────
      setTransitionMsg('💬 Generating follow-up question…');
      let generatedFollowUp = 'Can you elaborate on that with a specific example?';
      try {
        const followUpRes = await interviewAPI.generateFollowup(
          q.questionText,
          mainAnswerRef.current,
          aiEval
        );
        generatedFollowUp = followUpRes.data.followup_question || generatedFollowUp;
      } catch (fErr) {
        console.warn('Follow-up generation failed, using fallback:', fErr);
      }

      // ── STEP 3: Display + Speak follow-up ─────────────────────────────────
      isFollowUpRef.current = true;
      setFollowUpText(generatedFollowUp);   // ← renders in question card
      followUpTextRef.current = generatedFollowUp; // keep ref in sync for callback
      setIsBetweenQuestions(false);
      setTransitionMsg('');
      isProcessingRef.current = false;
      voiceApi.speakQuestion(generatedFollowUp);

    } catch (err) {
      console.error('Answer processing error:', err);
      // Graceful degradation — skip follow-up and advance
      isFollowUpRef.current = false;
      isProcessingRef.current = false;
      setTransitionMsg('⚠️ Moving to next question…');
      try {
        const progRes = await interviewAPI.progress(iId);
        setProgress(progRes.data);
        await new Promise(r => setTimeout(r, 800));
        if (progRes.data.isComplete) {
          await finishInterview(iId);
        } else {
          const nextRes = await interviewAPI.next(iId, q.id);
          if (nextRes.data.done) await finishInterview(iId);
          else {
            setCurrentQuestion(nextRes.data);
            setIsBetweenQuestions(false);
            voiceApi.speakQuestion(nextRes.data.questionText);
          }
        }
      } catch { }
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const voiceApi = useInterviewAutomation({
    onAnswerReady: handleAnswerReady,
    silenceTimeoutSec: 9,
  });

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (!userStr) { navigate('/login'); return; }
    setUser(JSON.parse(userStr));

    resumeAPI.getProfile()
      .then(res => {
        if (res.data?.skills) {
          setSkills(res.data.skills.split(',').filter(Boolean));
          setLevel(res.data.level || '');
        }
      })
      .catch(() => { });
  }, [navigate]);

  const handleResumeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setResumeFile(e.target.files[0]);
  };

  const uploadAndParseResume = async () => {
    if (!resumeFile) return;
    setUploading(true);
    try {
      const res = await resumeAPI.upload(resumeFile);
      setSkills(res.data.skills || []);
      setLevel(res.data.level || 'junior');
    } catch {
      alert('Resume parsing failed. Proceeding with general interview.');
    } finally {
      setUploading(false);
    }
  };

  const startInterview = async () => {
    setIsStarting(true);
    try {
      const res = await interviewAPI.start();
      const data = res.data as StartInterviewResponse;
      setInterviewId(data.interviewId);
      setCurrentQuestion(data.firstQuestion);
      setSetupMode(false);

      interviewAPI.progress(data.interviewId).then(p => setProgress(p.data)).catch(() => { });

      const firstQ = data.firstQuestion;
      setTimeout(() => {
        voiceApi.speakQuestion(firstQ.questionText);
      }, 800);
    } catch {
      alert('Failed to start interview. Please try again.');
    } finally {
      setIsStarting(false);
    }
  };

  const finishInterview = async (iId: number) => {
    setEvaluating(true);
    setCurrentQuestion(null);
    setIsBetweenQuestions(false);
    voiceApi.reset();

    try {
      await interviewAPI.complete(iId);
    } catch { /* ignore */ }

    pollResult(iId);
  };

  const pollResult = (id: number) => {
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      try {
        const res = await interviewAPI.result(id);
        const d = res.data;

        // Backend returns {message: '...'} with no finalScore when not ready yet
        if (d?.message && d.finalScore === undefined) return;

        // Accept result when recommendation is present (score=0 is valid for skipped interviews)
        const hasRec =
          d?.recommendation &&
          d.recommendation.trim() !== '' &&
          d.recommendation !== 'null' &&
          d.recommendation !== 'undefined';

        if (d?.finalScore !== undefined && d.finalScore !== null && hasRec) {
          setResult(d as DetailedInterviewResult);
          setEvaluating(false);
          clearInterval(interval);
          return;
        }

        // After 15 attempts (~45s): fill defaults for any missing fields and show result
        if (attempts >= 15 && d?.finalScore !== undefined && d.finalScore !== null) {
          setResult({
            ...d,
            recommendation:      d.recommendation      || 'On Hold',
            strengths:           d.strengths           || 'Interview session completed.',
            areasForImprovement: d.areasForImprovement || 'Practice answering questions more thoroughly.',
            feedbackJson:        d.feedbackJson        || '{}',
          } as DetailedInterviewResult);
          setEvaluating(false);
          clearInterval(interval);
          return;
        }

      } catch { /* network blip — keep polling */ }

      // Hard timeout after 30 attempts (~90s): always show result, never leave blank screen
      if (attempts >= 30) {
        clearInterval(interval);
        setResult({
          interviewId: id,
          finalScore: 0,
          recommendation: 'On Hold',
          strengths: 'Your interview session was recorded.',
          areasForImprovement: 'Evaluation is still processing. Check your dashboard in a few minutes for full results.',
          feedbackJson: '{}',
        } as DetailedInterviewResult);
        setEvaluating(false);
      }
    }, 3000);
  };

  // ─── Setup Screen ─────────────────────────────────────────────────────────

  if (setupMode) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f4f6f8' }}>
        <header className="navbar">
          <div className="navbar-brand">🎤 Interview<span>AI</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '0.9rem', color: 'white' }}>{user?.name}</span>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/login')}>Logout</button>
          </div>
        </header>

        <div className="setup-hero">
          <div className="setup-card card fade-in">
            <div className="setup-header">
              <div className="setup-icon">🤖</div>
              <h1>AI Interview System</h1>
              <p>
                The AI will speak each question aloud. Answer naturally — the system listens and moves on automatically.
                <strong> No buttons needed.</strong>
              </p>
            </div>

            {/* How it works */}
            <div className="how-it-works">
              {[
                { icon: '', title: 'Upload Resume', desc: 'We tailor questions to your profile (optional)' },
                { title: 'AI Speaks', desc: 'Listen carefully to each question' },
                { icon: '', title: 'You Answer', desc: 'Mic opens automatically after each question' },
                { icon: '', title: 'Get Report', desc: 'Detailed feedback and result at the end' },
              ].map(item => (
                <div key={item.title} className="how-step">
                  <div className="how-step-icon">{item.icon}</div>
                  <div>
                    <div className="how-step-title">{item.title}</div>
                    <div className="how-step-desc">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Resume upload */}
            <div
              className="upload-area"
              style={{ marginBottom: 20 }}
              onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
              onDragLeave={e => e.currentTarget.classList.remove('drag-over')}
              onDrop={e => {
                e.preventDefault();
                e.currentTarget.classList.remove('drag-over');
                const files = e.dataTransfer.files;
                if (files[0]) setResumeFile(files[0]);
              }}
            >
              <input type="file" id="resume-upload" accept=".pdf,.docx" style={{ display: 'none' }} onChange={handleResumeUpload} />
              <label htmlFor="resume-upload" style={{ cursor: 'pointer', display: 'block' }}>
                <div style={{ fontSize: '1.8rem', marginBottom: 6 }}>📁</div>
                <div style={{ fontWeight: 600, marginBottom: 4, color: '#374151' }}>
                  {resumeFile ? resumeFile.name : 'Click to upload resume (PDF or DOCX)'}
                </div>
                <div style={{ fontSize: '0.82rem', color: '#9ca3af' }}>Optional — skip to start a general interview</div>
              </label>

              {resumeFile && (
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ marginTop: 12 }}
                  onClick={e => { e.preventDefault(); uploadAndParseResume(); }}
                  disabled={uploading}
                >
                  {uploading ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Parsing…</> : '⚙ Process Resume'}
                </button>
              )}
            </div>

            {/* Detected skills */}
            {skills.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>Detected Profile</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {level && <span className="badge badge-primary">{level.toUpperCase()}</span>}
                  {skills.map(s => <span key={s} className="badge badge-info">{s}</span>)}
                </div>
              </div>
            )}

            <button
              className="btn btn-primary btn-lg"
              style={{ width: '100%' }}
              onClick={startInterview}
              disabled={isStarting}
            >
              {isStarting
                ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Generating interview…</>
                : '🚀 Start Interview'}
            </button>

            <p style={{ textAlign: 'center', marginTop: 12, fontSize: '0.8rem', color: '#9ca3af' }}>
              🎙 Please allow microphone access when prompted
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Evaluating Screen ────────────────────────────────────────────────────

  if (evaluating) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f6f8' }}>
        <div className="eval-screen fade-in">
          <div className="eval-spinner">
            {[0, 1, 2].map(i => (
              <div key={i} className="eval-dot" style={{ animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
          <h2 style={{ fontSize: '1.4rem', marginBottom: 10, color: '#111827' }}>Evaluating Your Interview</h2>
          <p style={{ color: '#6b7280', maxWidth: 380, textAlign: 'center' }}>
            Our AI is analysing your answers and generating your performance report…
          </p>
          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 6, width: '100%', maxWidth: 300 }}>
            {['Analysing answers', 'Computing scores', 'Generating feedback', 'Creating final report'].map((s, i) => (
              <div key={s} className="eval-step" style={{ animationDelay: `${i * 0.5}s` }}>
                <span className="eval-step-dot" /> {s}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Result Screen ────────────────────────────────────────────────────────

  if (result) {
    const isShortlisted = result.recommendation === 'Hire';
    const isOnHold = result.recommendation === 'On Hold';

    let parsedFeedback: any = {};
    try { parsedFeedback = result.feedbackJson ? JSON.parse(result.feedbackJson) : {}; } catch { }

    const communicationScore = parsedFeedback.communication_score ?? Math.round(result.finalScore * 0.9);
    const technicalScore = parsedFeedback.technical_score ?? result.finalScore;
    const confidenceScore = parsedFeedback.confidence_score ?? Math.round(result.finalScore * 0.85);
    const strengths: string[] = parsedFeedback.strengths ?? (result.strengths ? [result.strengths] : []);
    const improvements: string[] = parsedFeedback.areas_for_improvement ?? (result.areasForImprovement ? [result.areasForImprovement] : []);
    const suggestions: string[] = parsedFeedback.suggestions ?? [];

    const decisionColor = isShortlisted ? '#16a34a' : isOnHold ? '#b45309' : '#dc2626';
    const decisionLabel = isShortlisted ? '🎉 Shortlisted' : isOnHold ? '⏳ On Hold' : '❌ Not Shortlisted';
    const decisionBg = isShortlisted ? '#dcfce7' : isOnHold ? '#fef9c3' : '#fee2e2';

    return (
      <div style={{ minHeight: '100vh', background: '#f4f6f8' }}>
        <header className="navbar">
          <div className="navbar-brand">🎤 Interview<span>AI</span></div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/login')}>Logout</button>
        </header>

        <div className="result-page">

          {/* Hero banner */}
          <div className="result-hero-banner fade-in" style={{ borderColor: decisionColor }}>
            <div className="result-decision-badge" style={{ background: decisionBg, color: decisionColor, border: `1px solid ${decisionColor}` }}>
              {decisionLabel}
            </div>
            <h1 className="result-title">Interview Complete!</h1>
            <p className="result-subtitle">Here is your performance report</p>

            {/* Score circle */}
            <div className="result-score-wrap">
              <svg width="140" height="140" viewBox="0 0 140 140">
                <circle cx="70" cy="70" r="60" fill="none" stroke="#e5e7eb" strokeWidth="10" />
                <circle
                  cx="70" cy="70" r="60"
                  fill="none"
                  stroke={decisionColor}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 60}`}
                  strokeDashoffset={`${2 * Math.PI * 60 * (1 - result.finalScore / 100)}`}
                  style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dashoffset 1.5s ease' }}
                />
                <text x="70" y="63" textAnchor="middle" fill="#111827" fontSize="30" fontWeight="700">{result.finalScore}</text>
                <text x="70" y="80" textAnchor="middle" fill="#6b7280" fontSize="12">out of 100</text>
              </svg>
            </div>
          </div>

          {/* Sub-scores */}
          <div className="result-subscores fade-in">
            {[
              { label: 'Communication', score: communicationScore, icon: '💬' },
              { label: 'Technical', score: technicalScore, icon: '🧠' },
              { label: 'Confidence', score: confidenceScore, icon: '💪' },
            ].map(({ label, score, icon }) => (
              <div key={label} className="subscore-card">
                <div className="subscore-icon">{icon}</div>
                <div className="subscore-label">{label}</div>
                <div className="subscore-bar-wrap">
                  <div className="subscore-bar-fill" style={{ width: `${score}%`, background: decisionColor }} />
                </div>
                <div className="subscore-value">{score}<span>/100</span></div>
              </div>
            ))}
          </div>

          {/* Strengths & Improvements */}
          <div className="result-grid fade-in">
            <div className="card result-feedback-card">
              <h3 style={{ color: '#16a34a', marginBottom: 12, fontSize: '1rem' }}>✅ Key Strengths</h3>
              {strengths.length > 0 ? (
                <ul className="feedback-list">
                  {(Array.isArray(strengths) ? strengths : [strengths]).map((s, i) => (
                    <li key={i} className="feedback-item">
                      <span className="feedback-icon">→</span>{String(s).replace(/["[\]]/g, '')}
                    </li>
                  ))}
                </ul>
              ) : <p style={{ color: '#9ca3af' }}>No data</p>}
            </div>

            <div className="card result-feedback-card">
              <h3 style={{ color: '#b45309', marginBottom: 12, fontSize: '1rem' }}>📈 Areas to Improve</h3>
              {improvements.length > 0 ? (
                <ul className="feedback-list">
                  {(Array.isArray(improvements) ? improvements : [improvements]).map((s, i) => (
                    <li key={i} className="feedback-item">
                      <span className="feedback-icon">→</span>{String(s).replace(/["[\]]/g, '')}
                    </li>
                  ))}
                </ul>
              ) : <p style={{ color: '#9ca3af' }}>No data</p>}
            </div>
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="card fade-in">
              <h3 style={{ marginBottom: 12, fontSize: '1rem', color: '#0369a1' }}>💡 Suggestions</h3>
              <ul className="feedback-list">
                {suggestions.map((s: string, i: number) => (
                  <li key={i} className="feedback-item"><span className="feedback-icon">💡</span>{String(s)}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Q&A Breakdown */}
          <div className="card fade-in">
            <h3 style={{ marginBottom: 16, fontSize: '1rem' }}>📋 Question-by-Question Breakdown</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(() => {
                // Build display list: number only main questions; follow-ups show inline
                let mainIdx = 0;
                return answeredQuestions.map((aq, idx) => {
                  const isFollowUp = aq.isFollowUp === true;
                  if (!isFollowUp) mainIdx++;
                  const displayNum = mainIdx;

                  return (
                    <div
                      key={idx}
                      className="qa-item"
                      style={isFollowUp ? { marginLeft: 20, borderLeft: '3px solid #7c3aed', paddingLeft: 12 } : {}}
                    >
                      <div className="qa-header">
                        {isFollowUp ? (
                          <span className="badge" style={{ background: '#ede9fe', color: '#7c3aed' }}>🔍 Follow-up</span>
                        ) : (
                          <span className="qa-number">Q{displayNum}</span>
                        )}
                        <span className="badge badge-info">{aq.question.skill}</span>
                        <span className={`badge ${aq.question.difficulty === 'advanced' ? 'badge-danger' : aq.question.difficulty === 'intermediate' ? 'badge-warning' : 'badge-success'}`}>
                          {aq.question.difficulty}
                        </span>
                        {aq.answeredBy === 'no_answer' && <span className="badge badge-warning">No Answer</span>}
                      </div>

                      {/* Show follow-up question text or main question text */}
                      <div className="qa-question">
                        {isFollowUp ? (aq.followUpQuestionText ?? aq.question.questionText) : aq.question.questionText}
                      </div>

                      <div className="qa-answer">
                        <span style={{ color: '#6b7280', fontSize: '0.78rem', fontWeight: 600 }}>YOUR ANSWER: </span>
                        {aq.answer}
                      </div>

                      {/* Per-question AI evaluation scores (main questions only) */}
                      {aq.aiEval && (() => {
                        const e = aq.aiEval!;
                        const verdict = e.verdict ?? (e.final_score >= 85 ? 'Excellent' : e.final_score >= 65 ? 'Good' : e.final_score >= 40 ? 'Needs Improvement' : 'Poor');
                        const verdictMeta: Record<string, { color: string; bg: string; border: string; icon: string }> = {
                          'Excellent':          { color: '#065f46', bg: '#d1fae5', border: '#6ee7b7', icon: '🏆' },
                          'Good':               { color: '#1e40af', bg: '#dbeafe', border: '#93c5fd', icon: '✅' },
                          'Needs Improvement':  { color: '#92400e', bg: '#fef3c7', border: '#fcd34d', icon: '⚠️' },
                          'Poor':               { color: '#991b1b', bg: '#fee2e2', border: '#fca5a5', icon: '❌' },
                        };
                        const vm = verdictMeta[verdict] ?? verdictMeta['Needs Improvement'];
                        const qTypeMeta: Record<string, { label: string; color: string; bg: string }> = {
                          'follow-up':    { label: '🔍 Follow-up Next', color: '#4338ca', bg: '#ede9fe' },
                          'clarification':{ label: '🔎 Clarification Needed', color: '#b45309', bg: '#fef3c7' },
                          'new':          { label: '➡️ Move to Next Topic', color: '#065f46', bg: '#d1fae5' },
                        };
                        const qt = qTypeMeta[e.question_type ?? 'new'] ?? qTypeMeta['new'];

                        return (
                          <div className="ai-eval-panel">
                            {/* Header row: Verdict + Score + Question Type */}
                            <div className="ai-eval-header">
                              <div className="ai-eval-verdict" style={{ background: vm.bg, border: `1px solid ${vm.border}`, color: vm.color }}>
                                {vm.icon} {verdict}
                              </div>
                              <div className="ai-eval-score-badge" style={{ color: e.final_score >= 70 ? '#065f46' : e.final_score >= 40 ? '#92400e' : '#991b1b' }}>
                                <span className="ai-eval-score-num">{e.final_score}</span>
                                <span className="ai-eval-score-den">/100</span>
                              </div>
                              <div className="ai-eval-qtype" style={{ background: qt.bg, color: qt.color }}>
                                {qt.label}
                              </div>
                            </div>

                            {/* Score meters */}
                            <div className="ai-eval-meters">
                              {([
                                { label: 'Accuracy',     value: e.accuracy,     icon: '🎯', color: '#1e40af' },
                                { label: 'Completeness', value: e.completeness, icon: '📋', color: '#7c3aed' },
                                { label: 'Clarity',      value: e.clarity,      icon: '💡', color: '#0369a1' },
                              ] as { label: string; value: number; icon: string; color: string }[]).map(({ label, value, icon, color }) => (
                                <div key={label} className="ai-eval-meter">
                                  <div className="ai-eval-meter-label">{icon} {label}</div>
                                  <div className="ai-eval-meter-track">
                                    <div className="ai-eval-meter-fill" style={{ width: `${value * 10}%`, background: color }} />
                                  </div>
                                  <div className="ai-eval-meter-value" style={{ color }}>{value}<span>/10</span></div>
                                </div>
                              ))}
                            </div>

                            {/* Feedback */}
                            <div className="ai-eval-feedback">
                              <div className="ai-eval-feedback-label">📝 Panel Feedback</div>
                              <p className="ai-eval-feedback-text">{e.feedback}</p>
                            </div>

                            {/* Strengths + Improvements */}
                            <div className="ai-eval-si-grid">
                              <div className="ai-eval-strengths">
                                <div className="ai-eval-si-label" style={{ color: '#065f46' }}>✅ Strengths</div>
                                <p className="ai-eval-si-text">{e.strengths}</p>
                              </div>
                              <div className="ai-eval-improvements">
                                <div className="ai-eval-si-label" style={{ color: '#92400e' }}>📈 Improvements</div>
                                <p className="ai-eval-si-text">{e.improvements}</p>
                              </div>
                            </div>

                            {/* Key concepts missed */}
                            {e.key_concepts_missed && e.key_concepts_missed.length > 0 && (
                              <div className="ai-eval-concepts">
                                <div className="ai-eval-concepts-label">⚠️ Key Concepts Missed</div>
                                <div className="ai-eval-concepts-pills">
                                  {e.key_concepts_missed.map((c, ci) => (
                                    <span key={ci} className="ai-eval-concept-pill">{c}</span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Ideal answer hint */}
                            {e.ideal_answer_hint && (
                              <div className="ai-eval-hint">
                                <span className="ai-eval-hint-icon">💎</span>
                                <span className="ai-eval-hint-text">{e.ideal_answer_hint}</span>
                              </div>
                            )}

                            {/* Evaluated by */}
                            {e._evaluated_by && (
                              <div className="ai-eval-by">Evaluated by: {e._evaluated_by === 'gemini' ? '✨ Google Gemini' : e._evaluated_by === 'groq' ? '⚡ Groq / LLaMA-70B' : '🔧 Fallback'}</div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          <div style={{ textAlign: 'center', paddingBottom: 32, display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
              📊 Back to Dashboard
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/')}>
              🔄 New Interview
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Active Interview Screen ──────────────────────────────────────────────

  return (
    <div className="interview-page">
      <header className="navbar">
        <div className="navbar-brand">🎤 Interview<span>AI</span></div>
        {progress && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 200 }}>
            <span style={{ fontSize: '0.82rem', color: 'white', whiteSpace: 'nowrap' }}>
              {progress.answeredQuestions} / {progress.totalQuestions}
            </span>
            <div className="progress-bar-wrap" style={{ flex: 1 }}>
              <div className="progress-bar-fill" style={{ width: `${(progress.answeredQuestions / progress.totalQuestions) * 100}%` }} />
            </div>
          </div>
        )}
      </header>

      <div className="interview-layout">

        {/* Left — Avatar */}
        <div className="avatar-panel fade-in">
          <Avatar
            isSpeaking={voiceApi.phase === 'speaking'}
            questionText={currentQuestion?.questionText}
            onSpeechStart={() => { }}
            onSpeechEnd={() => { }}
          />

          <SpeakingWave isSpeaking={voiceApi.phase === 'speaking'} />

          <div className="hands-free-notice">
            <span>🤲</span>
            <span>Fully hands-free — no buttons needed</span>
          </div>
        </div>

        {/* Right — Question + Listening */}
        <div className="question-panel">

          {/* Transition message */}
          {isBetweenQuestions && (
            <div className="card fade-in" style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="spinner" style={{ width: 18, height: 18 }} />
                <span style={{ color: '#374151' }}>{transitionMsg}</span>
              </div>
            </div>
          )}

          {/* Question card */}
          {currentQuestion && !isBetweenQuestions && (
            <div className="card question-card fade-in" key={currentQuestion.id}>
              <div className="question-number-row">
                <div className="question-number">
                  {isFollowUpRef.current
                    ? <><span style={{ color: '#7c3aed' }}>🔍 Follow-up</span><span className="question-total"> — Q{currentQuestion.orderIndex + 1}</span></>
                    : <>Question {currentQuestion.orderIndex + 1}{progress && <span className="question-total"> of {progress.totalQuestions}</span>}</>
                  }
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <span className="badge badge-info">{currentQuestion.skill}</span>
                  <span className={`badge ${currentQuestion.difficulty === 'advanced' ? 'badge-danger' : currentQuestion.difficulty === 'intermediate' ? 'badge-warning' : 'badge-success'}`}>
                    {currentQuestion.difficulty}
                  </span>
                </div>
              </div>
              <h2 className="question-text">
                {followUpText ?? currentQuestion.questionText}
              </h2>

              <div className="question-phase-hint">
                {voiceApi.phase === 'speaking' && (
                  <span style={{ color: '#1e40af' }}>🔊 Listen to the interviewer…</span>
                )}
                {voiceApi.phase === 'listening' && (
                  <span style={{ color: '#dc2626' }}>🎤 Speak your answer now</span>
                )}
              </div>
            </div>
          )}

          {/* Listening indicator */}
          {currentQuestion && !isBetweenQuestions && (
            <div className="fade-in" style={{ animationDelay: '0.1s' }}>
              <ListeningIndicator
                phase={voiceApi.phase}
                transcript={voiceApi.transcript}
                silenceCountdown={voiceApi.silenceCountdown}
                isMicActive={voiceApi.isMicActive}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Interview;
