package com.example.interview.controller;

import com.example.interview.model.*;
import com.example.interview.repository.ResultRepository;
import com.example.interview.service.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
@Slf4j
public class AdminController {

    private final CandidateService candidateService;
    private final InterviewService interviewService;
    private final EvaluationService evaluationService;
    private final ResultRepository resultRepository;

    @GetMapping("/candidates")
    public ResponseEntity<?> getAllCandidates() {
        List<Candidate> candidates = candidateService.findAllCandidates();
        return ResponseEntity.ok(candidates.stream()
                .filter(c -> !"ADMIN".equals(c.getRole()))
                .map(c -> Map.of(
                        "id", c.getId(),
                        "name", c.getName(),
                        "email", c.getEmail(),
                        "skills", c.getSkills() != null ? c.getSkills() : "",
                        "level", c.getLevel() != null ? c.getLevel() : "N/A",
                        "experienceYears", c.getExperienceYears() != null ? c.getExperienceYears() : 0
                )).toList());
    }

    @GetMapping("/interviews")
    public ResponseEntity<?> getAllInterviews() {
        List<Interview> interviews = interviewService.getAllInterviews();
        return ResponseEntity.ok(interviews.stream().map(i -> Map.of(
                "id", i.getId(),
                "candidateId", i.getCandidate().getId(),
                "candidateName", i.getCandidate().getName(),
                "status", i.getStatus(),
                "createdAt", i.getCreatedAt().toString()
        )).toList());
    }

    @GetMapping("/interview/{interviewId}/detail")
    public ResponseEntity<?> getInterviewDetail(@PathVariable Long interviewId) {
        var interview = interviewService.getInterview(interviewId)
                .orElseThrow(() -> new RuntimeException("Interview not found"));
        List<Question> questions = interviewService.getInterviewQuestions(interviewId);
        List<Answer> answers = interviewService.getInterviewAnswers(interviewId);

        Map<Long, Answer> answerMap = new java.util.HashMap<>();
        answers.forEach(a -> answerMap.put(a.getQuestion().getId(), a));

        List<Map<String, Object>> qaList = questions.stream().map(q -> {
            Answer ans = answerMap.get(q.getId());
            Map<String, Object> qaMap = new java.util.HashMap<>();
            qaMap.put("questionId", q.getId());
            qaMap.put("questionText", q.getQuestionText());
            qaMap.put("idealAnswer", q.getIdealAnswer() != null ? q.getIdealAnswer() : "");
            qaMap.put("difficulty", q.getDifficulty() != null ? q.getDifficulty() : "");
            qaMap.put("skill", q.getSkill() != null ? q.getSkill() : "");
            qaMap.put("candidateAnswer", ans != null && ans.getCandidateAnswer() != null ? ans.getCandidateAnswer() : "");
            qaMap.put("similarityScore", ans != null ? ans.getSimilarityScore() : 0.0);
            qaMap.put("audioPath", ans != null && ans.getAudioPath() != null ? ans.getAudioPath() : "");
            return qaMap;
        }).toList();

        var result = evaluationService.getResult(interviewId);

        return ResponseEntity.ok(Map.of(
                "interviewId", interviewId,
                "candidateName", interview.getCandidate().getName(),
                "status", interview.getStatus(),
                "qaList", qaList,
                "result", result.map(r -> Map.of(
                        "finalScore", r.getFinalScore(),
                        "recommendation", r.getRecommendation() != null ? r.getRecommendation() : "",
                        "strengths", r.getStrengths() != null ? r.getStrengths() : "",
                        "areasForImprovement", r.getAreasForImprovement() != null ? r.getAreasForImprovement() : ""
                )).orElse(Map.of())
        ));
    }

    @PutMapping("/result/{interviewId}/override")
    public ResponseEntity<?> overrideResult(
            @PathVariable Long interviewId,
            @RequestBody Map<String, Object> body) {
        Double score = body.containsKey("score")
                ? ((Number) body.get("score")).doubleValue() : null;
        String recommendation = (String) body.get("recommendation");
        Result result = evaluationService.updateResultOverride(interviewId, score, recommendation);
        return ResponseEntity.ok(Map.of(
                "message", "Result updated",
                "finalScore", result.getFinalScore(),
                "recommendation", result.getRecommendation()
        ));
    }

    @PostMapping("/interview/{interviewId}/evaluate")
    public ResponseEntity<?> triggerEvaluation(@PathVariable Long interviewId) {
        evaluationService.evaluateInterview(interviewId);
        return ResponseEntity.ok(Map.of("message", "Evaluation triggered for interview " + interviewId));
    }

    @GetMapping("/results")
    public ResponseEntity<?> getAllResults() {
        List<Result> results = evaluationService.getAllResults();
        return ResponseEntity.ok(results.stream().map(r -> Map.of(
                "interviewId", r.getInterview().getId(),
                "candidateName", r.getCandidate().getName(),
                "finalScore", r.getFinalScore(),
                "recommendation", r.getRecommendation() != null ? r.getRecommendation() : "",
                "createdAt", r.getCreatedAt().toString()
        )).toList());
    }
}
