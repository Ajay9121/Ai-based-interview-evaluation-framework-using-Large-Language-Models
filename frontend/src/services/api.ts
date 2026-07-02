import axios from 'axios';

const API_BASE    = process.env.REACT_APP_API_URL    || 'http://localhost:8081';
const PYTHON_BASE = process.env.REACT_APP_PYTHON_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 60000,
});

// Longer-timeout instance for the interview start call (AI question generation takes ~30-60s)
const apiSlow = axios.create({
  baseURL: API_BASE,
  timeout: 150000,  // 2.5 minutes
});

// Separate axios instance for the Python AI service (no auth needed)
const pythonApi = axios.create({
  baseURL: PYTHON_BASE,
  timeout: 30000,
});

// Attach JWT token to every Spring Boot request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Same interceptors for the slow instance (interview start)
apiSlow.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
apiSlow.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.clear();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Handle 401 and 403 globally (403 = expired/invalid JWT with no AuthenticationEntryPoint configured)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.clear();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authAPI = {
  login: (email: string, password: string) =>
    api.post('/api/auth/login', { email, password }),
  register: (name: string, email: string, password: string) =>
    api.post('/api/auth/register', { name, email, password }),
};

// ─── Resume ───────────────────────────────────────────────────────────────────
export const resumeAPI = {
  upload: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/api/resume/upload', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getProfile: () => api.get('/api/resume/profile'),
};

// ─── Interview ────────────────────────────────────────────────────────────────
export const interviewAPI = {
  // Uses apiSlow (150s timeout) because Python AI generates 15 questions which takes ~30-90s
  start: () => apiSlow.post('/api/interview/start'),
  next: (interviewId: number, lastQuestionId?: number) =>
    api.get(`/api/interview/next/${interviewId}`, {
      params: lastQuestionId ? { lastQuestionId } : {},
    }),
  submitAnswer: (interviewId: number, questionId: number, answerText: string, audioFile?: File) => {
    const fd = new FormData();
    fd.append('interviewId', String(interviewId));
    fd.append('questionId', String(questionId));
    fd.append('answerText', answerText);
    if (audioFile) fd.append('audioFile', audioFile);
    return api.post('/api/interview/answer', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  complete: (interviewId: number) =>
    api.post(`/api/interview/complete/${interviewId}`),
  progress: (interviewId: number) =>
    api.get(`/api/interview/progress/${interviewId}`),
  result: (interviewId: number) =>
    api.get(`/api/interview/result/${interviewId}`),
  history: () => api.get('/api/interview/history'),

  /** Evaluate a single answer via Python AI service (Gemini → Groq fallback) */
  evaluateAnswer: (question: string, candidateAnswer: string) =>
    pythonApi.post('/evaluate_answer', { question, candidate_answer: candidateAnswer }),

  /** Generate one follow-up question based on original question + candidate's answer + evaluation */
  generateFollowup: (question: string, candidateAnswer: string, evalResult?: object) =>
    pythonApi.post('/generate_followup', {
      question,
      candidate_answer: candidateAnswer,
      eval_result: evalResult ?? null,
    }),


};

// ─── Admin ────────────────────────────────────────────────────────────────────
export const adminAPI = {
  getCandidates: () => api.get('/api/admin/candidates'),
  getInterviews: () => api.get('/api/admin/interviews'),
  getResults:    () => api.get('/api/admin/results'),
  getInterviewDetail: (interviewId: number) =>
    api.get(`/api/admin/interview/${interviewId}/detail`),
  overrideResult: (interviewId: number, score: number, recommendation: string) =>
    api.put(`/api/admin/result/${interviewId}/override`, { score, recommendation }),
  triggerEvaluation: (interviewId: number) =>
    api.post(`/api/admin/interview/${interviewId}/evaluate`),
};

export default api;
