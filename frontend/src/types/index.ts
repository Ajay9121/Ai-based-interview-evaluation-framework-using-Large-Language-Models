// TypeScript type definitions for the entire application

export interface User {
  id: number;
  email: string;
  name: string;
  role: 'ADMIN' | 'CANDIDATE';
  token: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}

export interface QuestionDTO {
  id: number;
  skill: string;
  difficulty: 'basic' | 'intermediate' | 'advanced';
  questionText: string;
  orderIndex: number;
  interviewId: number;
  done?: boolean;
}

export interface StartInterviewResponse {
  interviewId: number;
  status: string;
  firstQuestion: QuestionDTO;
}

export interface AnswerSubmitResponse {
  answerId: number;
  message: string;
}

export interface InterviewProgress {
  totalQuestions: number;
  answeredQuestions: number;
  isComplete: boolean;
}

export interface InterviewResult {
  interviewId: number;
  finalScore: number;
  recommendation: 'Hire' | 'On Hold' | 'Reject';
  strengths: string;
  areasForImprovement: string;
  feedbackJson: string;
}

/** Extended result with the detailed automated-interview fields */
export interface DetailedInterviewResult extends InterviewResult {
  communicationScore?: number;
  technicalScore?: number;
  confidenceScore?: number;
  feedbackSummary?: string;
  suggestions?: string[];
}

export interface ParsedFeedback {
  strengths: string[];
  areas_for_improvement: string[];
  suggestions?: string[];
  final_score: number;
  recommendation: string;
  communication_score?: number;
  technical_score?: number;
  confidence_score?: number;
  feedback_summary?: string;
}

export interface CandidateProfile {
  id: number;
  name: string;
  email: string;
  skills: string;
  experienceYears: number;
  level: string;
  resumePath: string;
}

export interface AdminCandidate {
  id: number;
  name: string;
  email: string;
  skills: string;
  level: string;
  experienceYears: number;
}

export interface AdminInterview {
  id: number;
  candidateId: number;
  candidateName: string;
  status: string;
  createdAt: string;
}

export interface QAItem {
  questionId: number;
  questionText: string;
  idealAnswer: string;
  candidateAnswer: string;
  difficulty: string;
  skill: string;
  similarityScore: number;
  audioPath: string;
}

export interface InterviewDetail {
  interviewId: number;
  candidateName: string;
  status: string;
  qaList: QAItem[];
  result: {
    finalScore: number;
    recommendation: string;
    strengths: string;
    areasForImprovement: string;
  };
}

export interface AdminResult {
  interviewId: number;
  candidateName: string;
  finalScore: number;
  recommendation: string;
  createdAt: string;
}
