package com.example.interview.service;

import com.example.interview.model.*;
import com.example.interview.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class EvaluationService {

    private final InterviewRepository interviewRepository;
    private final QuestionRepository questionRepository;
    private final AnswerRepository answerRepository;
    private final ResultRepository resultRepository;
    private final PythonAIClient pythonAIClient;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Async("taskExecutor")
    @Transactional
    public void evaluateInterview(Long interviewId) {
        log.info("Starting evaluation for interview {}", interviewId);
        try {
            Interview interview = interviewRepository.findById(interviewId)
                    .orElseThrow(() -> new RuntimeException("Interview not found"));
            List<Question> questions = questionRepository.findByInterviewIdOrderByOrderIndexAsc(interviewId);
            List<Answer> answers = answerRepository.findByInterviewId(interviewId);

            Map<Long, Answer> answerMap = new HashMap<>();
            for (Answer a : answers) {
                answerMap.put(a.getQuestion().getId(), a);
            }

            // Score each answer
            List<Map<String, Object>> qaData = new ArrayList<>();
            double totalScore = 0.0;
            int scoredCount = 0;

            for (Question q : questions) {
                Answer answer = answerMap.get(q.getId());
                String candidateAnswer = (answer != null && answer.getCandidateAnswer() != null)
                        ? answer.getCandidateAnswer() : "";
                String idealAnswer = q.getIdealAnswer() != null ? q.getIdealAnswer() : "";

                double score = pythonAIClient.evaluateSemantic(candidateAnswer, idealAnswer);

                if (answer != null) {
                    answer.setSimilarityScore(score);
                    answerRepository.save(answer);
                }

                totalScore += score;
                scoredCount++;

                Map<String, Object> qaEntry = new HashMap<>();
                qaEntry.put("question", q.getQuestionText());
                qaEntry.put("ideal_answer", idealAnswer);
                qaEntry.put("candidate_answer", candidateAnswer);
                qaEntry.put("score", score);
                qaEntry.put("difficulty", q.getDifficulty());
                qaEntry.put("skill", q.getSkill());
                qaData.add(qaEntry);
            }

            double averageScore = scoredCount > 0 ? totalScore / scoredCount : 0.0;

            // Generate Gemini feedback
            Map<String, Object> feedback = pythonAIClient.generateFeedback(qaData);
            double finalScore = feedback.containsKey("final_score")
                    ? ((Number) feedback.get("final_score")).doubleValue()
                    : averageScore;

            // Save result
            Result result = resultRepository.findByInterviewId(interviewId)
                    .orElse(Result.builder()
                            .interview(interview)
                            .candidate(interview.getCandidate())
                            .build());

            result.setFinalScore(finalScore);
            result.setRecommendation((String) feedback.getOrDefault("recommendation", "On Hold"));

            Object strengths = feedback.get("strengths");
            Object improvements = feedback.get("areas_for_improvement");
            result.setStrengths(strengths != null ? strengths.toString() : "");
            result.setAreasForImprovement(improvements != null ? improvements.toString() : "");
            result.setFeedbackJson(objectMapper.writeValueAsString(feedback));

            resultRepository.save(result);

            // Update interview status
            interview.setStatus("EVALUATED");
            interviewRepository.save(interview);

            log.info("Evaluation complete for interview {}. Score: {}", interviewId, finalScore);
        } catch (Exception e) {
            log.error("Evaluation failed for interview {}: {}", interviewId, e.getMessage(), e);
        }
    }

    @Transactional
    public Result updateResultOverride(Long interviewId, Double score, String recommendation) {
        Result result = resultRepository.findByInterviewId(interviewId)
                .orElseThrow(() -> new RuntimeException("Result not found for interview " + interviewId));
        if (score != null) result.setFinalScore(score);
        if (recommendation != null) result.setRecommendation(recommendation);
        return resultRepository.save(result);
    }

    public Optional<Result> getResult(Long interviewId) {
        return resultRepository.findByInterviewId(interviewId);
    }

    public List<Result> getAllResults() {
        return resultRepository.findAll();
    }
}
