package com.example.interview.service;

import com.example.interview.dto.QuestionDTO;
import com.example.interview.model.*;
import com.example.interview.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class InterviewService {

    private final InterviewRepository interviewRepository;
    private final QuestionRepository questionRepository;
    private final AnswerRepository answerRepository;
    private final CandidateRepository candidateRepository;
    private final PythonAIClient pythonAIClient;

    @Transactional
    public Interview startInterview(Long candidateId) {
        Candidate candidate = candidateRepository.findById(candidateId)
                .orElseThrow(() -> new RuntimeException("Candidate not found"));

        Interview interview = Interview.builder()
                .candidate(candidate)
                .status("IN_PROGRESS")
                .startedAt(LocalDateTime.now())
                .build();
        interview = interviewRepository.save(interview);

        // Generate questions via Python AI
        List<String> skills = candidate.getSkills() != null
                ? Arrays.asList(candidate.getSkills().split(","))
                : List.of("General Programming");
        String level = candidate.getLevel() != null ? candidate.getLevel() : "junior";
        int years = candidate.getExperienceYears() != null ? candidate.getExperienceYears() : 0;

        List<Map<String, Object>> generatedQuestions =
                pythonAIClient.generateQuestions(skills, level, years);

        int idx = 0;
        for (Map<String, Object> q : generatedQuestions) {
            Question question = Question.builder()
                    .interview(interview)
                    .skill((String) q.getOrDefault("skill", "General"))
                    .difficulty((String) q.getOrDefault("difficulty", "basic"))
                    .questionText((String) q.get("question"))
                    .idealAnswer((String) q.get("ideal_answer"))
                    .orderIndex(idx++)
                    .build();
            questionRepository.save(question);
        }
        log.info("Interview {} started with {} questions", interview.getId(), idx);
        return interview;
    }

    public QuestionDTO getNextQuestion(Long interviewId, Long lastQuestionId) {
        List<Question> questions = questionRepository.findByInterviewIdOrderByOrderIndexAsc(interviewId);
        if (questions.isEmpty()) return null;

        if (lastQuestionId == null || lastQuestionId == 0) {
            return toDTO(questions.get(0));
        }

        boolean found = false;
        for (Question q : questions) {
            if (found) return toDTO(q);
            if (q.getId().equals(lastQuestionId)) found = true;
        }
        return null; // no more questions
    }

    @Transactional
    public Answer submitAnswer(Long interviewId, Long questionId,
                               String answerText, String audioPath) {
        Interview interview = interviewRepository.findById(interviewId)
                .orElseThrow(() -> new RuntimeException("Interview not found"));
        Question question = questionRepository.findById(questionId)
                .orElseThrow(() -> new RuntimeException("Question not found"));

        Answer answer = Answer.builder()
                .interview(interview)
                .question(question)
                .candidateAnswer(answerText)
                .audioPath(audioPath)
                .build();
        return answerRepository.save(answer);
    }

    @Transactional
    public Interview completeInterview(Long interviewId) {
        Interview interview = interviewRepository.findById(interviewId)
                .orElseThrow(() -> new RuntimeException("Interview not found"));
        interview.setStatus("COMPLETED");
        interview.setCompletedAt(LocalDateTime.now());
        return interviewRepository.save(interview);
    }

    public Map<String, Object> getInterviewProgress(Long interviewId) {
        long totalQuestions = questionRepository.countByInterviewId(interviewId);
        long answeredQuestions = answerRepository.countByInterviewId(interviewId);
        Map<String, Object> progress = new HashMap<>();
        progress.put("totalQuestions", totalQuestions);
        progress.put("answeredQuestions", answeredQuestions);
        progress.put("isComplete", answeredQuestions >= totalQuestions);
        return progress;
    }

    public List<Interview> getCandidateInterviews(Long candidateId) {
        return interviewRepository.findByCandidateId(candidateId);
    }

    public List<Interview> getAllInterviews() {
        return interviewRepository.findAll();
    }

    public Optional<Interview> getInterview(Long id) {
        return interviewRepository.findById(id);
    }

    public List<Question> getInterviewQuestions(Long interviewId) {
        return questionRepository.findByInterviewIdOrderByOrderIndexAsc(interviewId);
    }

    public List<Answer> getInterviewAnswers(Long interviewId) {
        return answerRepository.findByInterviewId(interviewId);
    }

    private QuestionDTO toDTO(Question q) {
        return QuestionDTO.builder()
                .id(q.getId())
                .skill(q.getSkill())
                .difficulty(q.getDifficulty())
                .questionText(q.getQuestionText())
                .orderIndex(q.getOrderIndex())
                .interviewId(q.getInterview().getId())
                .build();
    }
}
