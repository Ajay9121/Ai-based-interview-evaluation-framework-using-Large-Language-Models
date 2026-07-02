/**
 * CandidateDashboard.tsx
 * ─────────────────────
 * Reads interview history from localStorage (saved by Interview.tsx after each session).
 * Shows: stats, Key Improvements from the last interview, and a recent sessions list.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../types';

interface LocalInterview {
  id: number;
  date: string;
  finalScore: number;
  recommendation: string;
  improvements: string[];
  strengths: string[];
  suggestions: string[];
}

const recommendationColor = (rec?: string) => {
  if (rec === 'Hire')    return { bg: '#dcfce7', color: '#16a34a' };
  if (rec === 'On Hold') return { bg: '#fef9c3', color: '#b45309' };
  if (rec === 'Reject')  return { bg: '#fee2e2', color: '#dc2626' };
  return                        { bg: '#f3f4f6', color: '#6b7280' };
};

const scoreColor = (score: number) => {
  if (score >= 70) return '#16a34a';
  if (score >= 40) return '#b45309';
  return '#dc2626';
};

const readHistory = (): LocalInterview[] => {
  try {
    return JSON.parse(localStorage.getItem('interview_history') ?? '[]');
  } catch {
    return [];
  }
};

const CandidateDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser]       = useState<User | null>(null);
  const [history, setHistory] = useState<LocalInterview[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { navigate('/login'); return; }
    setUser(JSON.parse(stored));
    setHistory(readHistory());
  }, [navigate]);

  const refresh = () => setHistory(readHistory());

  // ── Derived stats ────────────────────────────────────────────────────────
  const scored     = history.filter(h => h.finalScore > 0);
  const avgScore   = scored.length ? Math.round(scored.reduce((s, h) => s + h.finalScore, 0) / scored.length) : null;
  const bestScore  = scored.length ? Math.max(...scored.map(h => h.finalScore))                               : null;
  const lastDate   = history.length
    ? (() => { try { return new Date(history[0].date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return '—'; } })()
    : null;

  const stats = [
    { icon: '🎤', label: 'Total Interviews', value: history.length      },
    { icon: '📊', label: 'Avg Score',        value: avgScore  !== null ? `${avgScore}/100`  : '—' },
    { icon: '🏆', label: 'Best Score',       value: bestScore !== null ? `${bestScore}/100` : '—' },
    { icon: '📅', label: 'Last Interview',   value: lastDate ?? '—' },
  ];

  const last = history[0] ?? null;            // most recent interview
  const recStyle = recommendationColor(last?.recommendation);

  const logout = () => { localStorage.clear(); navigate('/login'); };

  return (
    <div className="candidate-dash-page">

      {/* Navbar */}
      <header className="navbar">
        <div className="navbar-brand">🎤 Interview<span>AI</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '0.9rem', color: 'white', opacity: 0.85 }}>{user?.name}</span>
          <button className="btn btn-secondary btn-sm" onClick={logout}>Logout</button>
        </div>
      </header>

      <div className="candidate-dash-body">

        {/* Welcome Banner */}
        <div className="dash-welcome-banner fade-in">
          <div className="dash-welcome-left">
            <div className="dash-avatar-circle">{user?.name?.charAt(0).toUpperCase() ?? '?'}</div>
            <div>
              <h1 className="dash-welcome-title">Welcome back, {user?.name?.split(' ')[0]} 👋</h1>
              <p className="dash-welcome-sub">{user?.email}</p>
            </div>
          </div>
          <button className="btn btn-primary btn-lg" id="start-interview-btn" onClick={() => navigate('/')}>
            🚀 Start New Interview
          </button>
        </div>

        {/* Stats Row */}
        <div className="dash-stats-row fade-in">
          {stats.map(s => (
            <div key={s.label} className="dash-stat-card">
              <div className="dash-stat-icon">{s.icon}</div>
              <div className="dash-stat-value">{s.value}</div>
              <div className="dash-stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── Key Improvements from Last Interview ───────────────────────── */}
        <div className="card fade-in" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="dash-table-header">
            <h2 className="dash-table-title">🎯 Key Improvements from Last Interview</h2>
            <button className="btn btn-secondary btn-sm" onClick={refresh} title="Refresh">
              🔃 Refresh
            </button>
          </div>

          {!last ? (
            <div className="dash-empty">
              <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>🎙️</div>
              <p style={{ fontWeight: 600, color: '#374151', marginBottom: 4 }}>No interviews yet</p>
              <p style={{ color: '#9ca3af', fontSize: '0.88rem' }}>Complete your first interview to see your improvement areas</p>
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/')}>
                🚀 Start Interview
              </button>
            </div>
          ) : (
            <div style={{ padding: '20px 24px' }}>

              {/* Last interview score header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20,
                            background: '#f8fafc', borderRadius: 10, padding: '14px 18px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: scoreColor(last.finalScore) }}>
                    {last.finalScore}<span style={{ fontSize: '1rem', color: '#9ca3af' }}>/100</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 2 }}>Score</div>
                </div>
                <div style={{ width: 1, height: 48, background: '#e5e7eb' }} />
                <div>
                  <span className="badge" style={{ background: recStyle.bg, color: recStyle.color, fontSize: '0.85rem' }}>
                    {last.recommendation}
                  </span>
                  <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: 4 }}>
                    {(() => { try { return new Date(last.date).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return last.date; } })()}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                {/* Areas to Improve */}
                <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '16px' }}>
                  <div style={{ fontWeight: 700, color: '#c2410c', marginBottom: 10, fontSize: '0.9rem' }}>
                    ⚠️ Areas to Improve
                  </div>
                  {last.improvements.length > 0 ? (
                    <ul style={{ margin: 0, padding: '0 0 0 16px', listStyle: 'disc' }}>
                      {last.improvements.map((item, i) => (
                        <li key={i} style={{ color: '#78350f', fontSize: '0.85rem', marginBottom: 6, lineHeight: 1.5 }}>
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ color: '#9ca3af', fontSize: '0.84rem' }}>No specific areas recorded.</p>
                  )}
                </div>

                {/* Strengths */}
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '16px' }}>
                  <div style={{ fontWeight: 700, color: '#15803d', marginBottom: 10, fontSize: '0.9rem' }}>
                    ✅ Strengths
                  </div>
                  {last.strengths.length > 0 ? (
                    <ul style={{ margin: 0, padding: '0 0 0 16px', listStyle: 'disc' }}>
                      {last.strengths.map((item, i) => (
                        <li key={i} style={{ color: '#14532d', fontSize: '0.85rem', marginBottom: 6, lineHeight: 1.5 }}>
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ color: '#9ca3af', fontSize: '0.84rem' }}>Keep practicing to build strengths!</p>
                  )}
                </div>

                {/* Suggestions — full width if present */}
                {last.suggestions.length > 0 && (
                  <div style={{ gridColumn: '1 / -1', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '16px' }}>
                    <div style={{ fontWeight: 700, color: '#1d4ed8', marginBottom: 10, fontSize: '0.9rem' }}>
                      💡 Suggestions for Next Interview
                    </div>
                    <ul style={{ margin: 0, padding: '0 0 0 16px', listStyle: 'disc' }}>
                      {last.suggestions.map((item, i) => (
                        <li key={i} style={{ color: '#1e3a8a', fontSize: '0.85rem', marginBottom: 6, lineHeight: 1.5 }}>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Recent Sessions (compact) ──────────────────────────────────── */}
        {history.length > 1 && (
          <div className="card fade-in" style={{ padding: '16px 24px' }}>
            <h3 style={{ fontSize: '0.95rem', color: '#374151', marginBottom: 14, fontWeight: 700 }}>
              📋 Recent Sessions
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {history.slice(0, 5).map((item, idx) => {
                const rs = recommendationColor(item.recommendation);
                return (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                              background: idx === 0 ? '#f0f9ff' : '#f9fafb',
                                              borderRadius: 8, padding: '10px 14px', border: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {idx === 0 && <span style={{ fontSize: '0.7rem', background: '#dbeafe', color: '#1d4ed8', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>Latest</span>}
                      <span style={{ fontSize: '0.82rem', color: '#6b7280' }}>
                        {(() => { try { return new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return '—'; } })()}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontWeight: 700, color: scoreColor(item.finalScore), fontSize: '0.9rem' }}>
                        {item.finalScore}/100
                      </span>
                      <span className="badge" style={{ background: rs.bg, color: rs.color, fontSize: '0.75rem' }}>
                        {item.recommendation}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* How it works — first time hint */}
        {history.length === 0 && (
          <div className="card dash-howto fade-in">
            <h3 style={{ marginBottom: 16, fontSize: '1rem', color: '#374151' }}>How the Interview Works</h3>
            <div className="dash-howto-grid">
              {[
                { icon: '📁', title: 'Upload Resume', desc: 'Tailor questions to your profile (optional)' },
                { icon: '🔊', title: 'AI Speaks',     desc: 'Listen carefully to each question' },
                { icon: '🎤', title: 'You Answer',    desc: 'Mic opens automatically — fully hands-free' },
                { icon: '📊', title: 'Get Report',    desc: 'Detailed feedback & score at the end' },
              ].map(s => (
                <div key={s.title} className="dash-howto-step">
                  <div className="dash-howto-icon">{s.icon}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 2 }}>{s.title}</div>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default CandidateDashboard;
