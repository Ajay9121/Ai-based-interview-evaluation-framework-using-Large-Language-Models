package com.example.interview.controller;

import com.example.interview.model.*;
import com.example.interview.service.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/interview")
@RequiredArgsConstructor
@Slf4j
public class InterviewController {

    private final InterviewService interviewService;
    private final CandidateService candidateService;
    private final EvaluationService evaluationService;
    private final PythonAIClient pythonAIClient;

    @PostMapping("/start")
    public ResponseEntity<?> startInterview(@AuthenticationPrincipal UserDetails userDetails) {
        try {
            Candidate candidate = candidateService.findByEmail(userDetails.getUsername())
                    .orElseThrow(() -> new RuntimeException("Candidate not found"));
            Interview interview = interviewService.startInterview(candidate.getId());

            // Get first question
            var firstQuestion = interviewService.getNextQuestion(interview.getId(), null);

            return ResponseEntity.ok(Map.of(
                    "interviewId", interview.getId(),
                    "status", interview.getStatus(),
                    "firstQuestion", firstQuestion != null ? firstQuestion : Map.of()
            ));
        } catch (Exception e) {
            log.error("Start interview error: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/next/{interviewId}")
    public ResponseEntity<?> getNextQuestion(
            @PathVariable Long interviewId,
            @RequestParam(required = false) Long lastQuestionId) {
        var question = interviewService.getNextQuestion(interviewId, lastQuestionId);
        if (question == null) {
            return ResponseEntity.ok(Map.of("done", true, "message", "No more questions"));
        }
        return ResponseEntity.ok(question);
    }

    @PostMapping("/answer")
    public ResponseEntity<?> submitAnswer(
            @RequestParam Long interviewId,
            @RequestParam Long questionId,
            @RequestParam(required = false) String answerText,
            @RequestParam(required = false) MultipartFile audioFile) {
        try {
            String finalAnswer = answerText;
            String audioPath = null;

            // Handle audio transcription if text not provided
            if ((finalAnswer == null || finalAnswer.isBlank()) && audioFile != null) {
                finalAnswer = pythonAIClient.transcribeAudio(audioFile);
            }

            // Save audio file if provided
            if (audioFile != null && !audioFile.isEmpty()) {
                audioPath = "uploads/audio_" + interviewId + "_" + questionId + ".webm";
            }

            Answer answer = interviewService.submitAnswer(interviewId, questionId, finalAnswer, audioPath);
            return ResponseEntity.ok(Map.of(
                    "answerId", answer.getId(),
                    "message", "Answer submitted successfully"
            ));
        } catch (Exception e) {
            log.error("Answer submission error: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/complete/{interviewId}")
    public ResponseEntity<?> completeInterview(@PathVariable Long interviewId) {
        Interview interview = interviewService.completeInterview(interviewId);
        evaluationService.evaluateInterview(interviewId); // async
        return ResponseEntity.ok(Map.of(
                "message", "Interview completed. Evaluation in progress.",
                "interviewId", interview.getId(),
                "status", interview.getStatus()
        ));
    }

    @GetMapping("/progress/{interviewId}")
    public ResponseEntity<?> getProgress(@PathVariable Long interviewId) {
        return ResponseEntity.ok(interviewService.getInterviewProgress(interviewId));
    }

    @GetMapping("/result/{interviewId}")
    public ResponseEntity<?> getResult(@PathVariable Long interviewId) {
        return evaluationService.getResult(interviewId)
                .map(result -> ResponseEntity.ok((Object) Map.of(
                        "interviewId", interviewId,
                        "finalScore", result.getFinalScore(),
                        "recommendation", result.getRecommendation() != null ? result.getRecommendation() : "",
                        "strengths", result.getStrengths() != null ? result.getStrengths() : "",
                        "areasForImprovement", result.getAreasForImprovement() != null ? result.getAreasForImprovement() : "",
                        "feedbackJson", result.getFeedbackJson() != null ? result.getFeedbackJson() : "{}"
                )))
                .orElse(ResponseEntity.ok(Map.of("message", "Evaluation in progress")));
    }

    @GetMapping("/history")
    public ResponseEntity<?> getInterviewHistory(@AuthenticationPrincipal UserDetails userDetails) {
        Candidate candidate = candidateService.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("Candidate not found"));
        List<Interview> interviews = interviewService.getCandidateInterviews(candidate.getId());
        return ResponseEntity.ok(interviews.stream().map(i -> Map.of(
                "id", i.getId(),
                "status", i.getStatus(),
                "createdAt", i.getCreatedAt().toString()
        )).toList());
    }
}
