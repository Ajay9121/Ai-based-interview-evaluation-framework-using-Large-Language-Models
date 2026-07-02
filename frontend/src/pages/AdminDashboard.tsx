import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAPI } from '../services/api';
import { AdminCandidate, AdminInterview, AdminResult, InterviewDetail } from '../types';

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'candidates' | 'interviews' | 'results'>('interviews');

  const [candidates, setCandidates] = useState<AdminCandidate[]>([]);
  const [interviews, setInterviews] = useState<AdminInterview[]>([]);
  const [results, setResults] = useState<AdminResult[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedInterview, setSelectedInterview] = useState<InterviewDetail | null>(null);
  const [overrideScore, setOverrideScore] = useState<number>(0);
  const [overrideRec, setOverrideRec] = useState<string>('On Hold');

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'candidates') {
        const res = await adminAPI.getCandidates();
        setCandidates(res.data);
      } else if (activeTab === 'interviews') {
        const res = await adminAPI.getInterviews();
        setInterviews(res.data);
      } else if (activeTab === 'results') {
        const res = await adminAPI.getResults();
        setResults(res.data);
      }
    } catch (err) {
      console.error(err);
      if (err instanceof Error && err.message.includes('401')) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const viewDetail = async (id: number) => {
    try {
      const res = await adminAPI.getInterviewDetail(id);
      setSelectedInterview(res.data);
      if (res.data.result) {
        setOverrideScore(res.data.result.finalScore);
        setOverrideRec(res.data.result.recommendation);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to load details');
    }
  };

  const overrideResult = async () => {
    if (!selectedInterview) return;
    try {
      await adminAPI.overrideResult(selectedInterview.interviewId, overrideScore, overrideRec);
      alert('Score updated successfully');
      viewDetail(selectedInterview.interviewId);
      if (activeTab === 'results') fetchData();
    } catch (err) {
      console.error(err);
      alert('Failed to override result');
    }
  };

  const triggerEval = async (id: number) => {
    try {
      await adminAPI.triggerEvaluation(id);
      alert('Evaluation triggered');
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Failed to trigger evaluation');
    }
  };

  const logout = () => {
    localStorage.clear();
    navigate('/login');
  };

  return (
    <div className="admin-page">

      {/* Header */}
      <header className="admin-header">
        <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
          🎤 InterviewAI &nbsp;
          <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>Admin Panel</span>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={logout}>Logout</button>
      </header>

      <div className="admin-layout">

        {/* Sidebar */}
        <aside className="admin-sidebar">
          <div
            className={`sidebar-item ${activeTab === 'interviews' ? 'active' : ''}`}
            onClick={() => setActiveTab('interviews')}
          >
            📹 Interviews
          </div>
          <div
            className={`sidebar-item ${activeTab === 'results' ? 'active' : ''}`}
            onClick={() => setActiveTab('results')}
          >
            📊 Results
          </div>
          <div
            className={`sidebar-item ${activeTab === 'candidates' ? 'active' : ''}`}
            onClick={() => setActiveTab('candidates')}
          >
            👥 Candidates
          </div>
        </aside>

        {/* Main Content */}
        <main className="admin-content">

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#6b7280' }}>
              <span className="spinner" /> Loading...
            </div>
          )}

          {/* Interviews Tab */}
          {!loading && activeTab === 'interviews' && (
            <div className="card fade-in">
              <h2 style={{ marginBottom: 20, fontSize: '1.2rem' }}>Interview Sessions</h2>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Candidate</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {interviews.map(i => (
                    <tr key={i.id}>
                      <td>#{i.id}</td>
                      <td style={{ fontWeight: 600 }}>{i.candidateName}</td>
                      <td>
                        <span className={`badge ${i.status === 'COMPLETED' ? 'badge-primary' : i.status === 'EVALUATED' ? 'badge-success' : 'badge-warning'}`}>
                          {i.status}
                        </span>
                      </td>
                      <td style={{ color: '#6b7280' }}>{new Date(i.createdAt).toLocaleString()}</td>
                      <td style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => viewDetail(i.id)}>View</button>
                        {i.status === 'COMPLETED' && (
                          <button className="btn btn-primary btn-sm" onClick={() => triggerEval(i.id)}>Evaluate</button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {interviews.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: '#9ca3af' }}>No interviews found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Results Tab */}
          {!loading && activeTab === 'results' && (
            <div className="card fade-in">
              <h2 style={{ marginBottom: 20, fontSize: '1.2rem' }}>Evaluation Results</h2>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Int. ID</th>
                    <th>Candidate</th>
                    <th>Score</th>
                    <th>Recommendation</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map(r => (
                    <tr key={r.interviewId}>
                      <td>#{r.interviewId}</td>
                      <td style={{ fontWeight: 600 }}>{r.candidateName}</td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{r.finalScore}/100</span>
                      </td>
                      <td>
                        <span className={`score-chip ${r.recommendation === 'Hire' ? 'badge-success' : r.recommendation === 'Reject' ? 'badge-danger' : 'badge-warning'}`}>
                          {r.recommendation}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-secondary btn-sm" onClick={() => viewDetail(r.interviewId)}>Review Q&A</button>
                      </td>
                    </tr>
                  ))}
                  {results.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: '#9ca3af' }}>No results found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Candidates Tab */}
          {!loading && activeTab === 'candidates' && (
            <div className="card fade-in">
              <h2 style={{ marginBottom: 20, fontSize: '1.2rem' }}>Candidate Directory</h2>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Level</th>
                    <th>Skills</th>
                    <th>Experience</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600 }}>{c.name}</td>
                      <td style={{ color: '#6b7280' }}>{c.email}</td>
                      <td><span className="badge badge-info">{c.level.toUpperCase()}</span></td>
                      <td style={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.skills ? c.skills.split(',').join(', ') : 'Not set'}
                      </td>
                      <td>{c.experienceYears} yr</td>
                    </tr>
                  ))}
                  {candidates.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: '#9ca3af' }}>No candidates found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

        </main>
      </div>

      {/* Detail Modal */}
      {selectedInterview && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          padding: '24px',
          zIndex: 1000,
          overflowY: 'auto'
        }}>
          <div className="card fade-in" style={{ width: '100%', maxWidth: 860, alignSelf: 'flex-start', position: 'relative' }}>

            <button
              className="btn btn-secondary btn-sm"
              style={{ position: 'absolute', top: 16, right: 16 }}
              onClick={() => setSelectedInterview(null)}
            >
              ✕ Close
            </button>

            <h2 style={{ marginBottom: 6, fontSize: '1.2rem' }}>
              Interview #{selectedInterview.interviewId} — {selectedInterview.candidateName}
            </h2>
            <div style={{ marginBottom: 20 }}>
              <span className={`badge ${selectedInterview.status === 'EVALUATED' ? 'badge-success' : 'badge-warning'}`}>
                {selectedInterview.status}
              </span>
            </div>

            {selectedInterview.result?.finalScore !== undefined ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28, background: '#f9fafb', padding: 20, borderRadius: 6, border: '1px solid #e5e7eb' }}>
                <div>
                  <h4 style={{ marginBottom: 12, color: '#6b7280', textTransform: 'uppercase', fontSize: '0.78rem', letterSpacing: '1px' }}>AI Evaluation</h4>
                  <p style={{ marginBottom: 6 }}><strong>Score:</strong> {selectedInterview.result.finalScore}/100</p>
                  <p style={{ marginBottom: 16 }}><strong>Recommendation:</strong> {selectedInterview.result.recommendation}</p>

                  <div className="form-group" style={{ marginBottom: 12 }}>
                    <label className="form-label">Override Score (0–100)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={overrideScore}
                      onChange={e => setOverrideScore(Number(e.target.value))}
                      min={0} max={100}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 12 }}>
                    <label className="form-label">Override Recommendation</label>
                    <select className="form-input" value={overrideRec} onChange={e => setOverrideRec(e.target.value)}>
                      <option>Hire</option>
                      <option>On Hold</option>
                      <option>Reject</option>
                    </select>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={overrideResult}>Save Override</button>
                </div>

                <div>
                  <h4 style={{ marginBottom: 8, color: '#6b7280', textTransform: 'uppercase', fontSize: '0.78rem', letterSpacing: '1px' }}>Strengths</h4>
                  <p style={{ fontSize: '0.9rem', marginBottom: 16, color: '#374151' }}>{selectedInterview.result.strengths}</p>
                  <h4 style={{ marginBottom: 8, color: '#6b7280', textTransform: 'uppercase', fontSize: '0.78rem', letterSpacing: '1px' }}>Areas to Improve</h4>
                  <p style={{ fontSize: '0.9rem', color: '#374151' }}>{selectedInterview.result.areasForImprovement}</p>
                </div>
              </div>
            ) : (
              <div className="alert alert-info" style={{ marginBottom: 20 }}>
                This interview has not been evaluated yet.
              </div>
            )}

            <h3 style={{ marginBottom: 14, fontSize: '1.1rem' }}>Q&A Transcript</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {selectedInterview.qaList.map((qa, idx) => (
                <div key={qa.questionId} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <h4 style={{ fontSize: '0.95rem', color: '#1e40af', flex: 1, paddingRight: 12 }}>
                      Q{idx + 1}: {qa.questionText}
                    </h4>
                    <span className="badge badge-primary">
                      {qa.similarityScore > 0 ? `${qa.similarityScore.toFixed(0)}/100` : 'Not Scored'}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: '0.9rem' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>Candidate's Answer</div>
                      <p style={{ background: '#fff', padding: '10px', borderRadius: 5, border: '1px solid #e5e7eb' }}>
                        {qa.candidateAnswer || <span style={{ color: '#dc2626' }}>No answer provided</span>}
                      </p>
                      {qa.audioPath && (
                        <div style={{ marginTop: 6 }}>
                          <span className="badge badge-warning">🎵 Audio Recorded</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>Ideal Answer (AI)</div>
                      <p style={{ background: '#fff', padding: '10px', borderRadius: 5, border: '1px solid #e5e7eb', color: '#4b5563' }}>
                        {qa.idealAnswer}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {selectedInterview.qaList.length === 0 && (
                <p style={{ color: '#9ca3af' }}>No questions were answered.</p>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
