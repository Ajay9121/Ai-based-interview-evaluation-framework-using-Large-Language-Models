package com.example.interview.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.*;


@Service
@RequiredArgsConstructor
@Slf4j
public class PythonAIClient {

    private final RestTemplate restTemplate;

    @Value("${app.python-ai.base-url}")
    private String pythonAiBaseUrl;

    @SuppressWarnings("unchecked")
    public Map<String, Object> parseResume(MultipartFile file) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);
            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("file", new ByteArrayResource(file.getBytes()) {
                @Override
                public String getFilename() {
                    return file.getOriginalFilename();
                }
            });
            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);
            ResponseEntity<Map> response = restTemplate.postForEntity(
                    pythonAiBaseUrl + "/parse_resume", requestEntity, Map.class);
            return response.getBody() != null ? response.getBody() : Map.of();
        } catch (IOException e) {
            log.error("Error sending resume to Python AI: {}", e.getMessage());
            return Map.of("skills", List.of("Java"), "experience_years", 0, "level", "junior");
        } catch (Exception e) {
            log.error("Python AI unavailable for resume parsing: {}", e.getMessage());
            return Map.of("skills", List.of("General Programming"), "experience_years", 0, "level", "junior");
        }
    }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> generateQuestions(List<String> skills, String level, int years) {
        try {
            Map<String, Object> request = new HashMap<>();
            request.put("skills", skills);
            request.put("level", level);
            request.put("experience_years", years);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(request, headers);

            ResponseEntity<List> response = restTemplate.postForEntity(
                    pythonAiBaseUrl + "/generate_questions", entity, List.class);
            return response.getBody() != null ? response.getBody() : fallbackQuestions(skills);
        } catch (Exception e) {
            log.error("Python AI unavailable for question generation: {}", e.getMessage());
            return fallbackQuestions(skills);
        }
    }

    public double evaluateSemantic(String candidateAnswer, String idealAnswer) {
        try {
            Map<String, String> request = Map.of(
                    "candidate_answer", candidateAnswer,
                    "ideal_answer", idealAnswer
            );
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, String>> entity = new HttpEntity<>(request, headers);

            ResponseEntity<Map> response = restTemplate.postForEntity(
                    pythonAiBaseUrl + "/evaluate_semantic", entity, Map.class);
            if (response.getBody() != null && response.getBody().containsKey("score")) {
                Object score = response.getBody().get("score");
                return score instanceof Number ? ((Number) score).doubleValue() : 0.0;
            }
        } catch (Exception e) {
            log.error("Python AI unavailable for semantic evaluation: {}", e.getMessage());
        }
        return 0.0;
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> generateFeedback(List<Map<String, Object>> qaData) {
        try {
            Map<String, Object> request = Map.of("qa_data", qaData);
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(request, headers);

            ResponseEntity<Map> response = restTemplate.postForEntity(
                    pythonAiBaseUrl + "/generate_feedback", entity, Map.class);
            return response.getBody() != null ? response.getBody() : defaultFeedback();
        } catch (Exception e) {
            log.error("Python AI unavailable for feedback generation: {}", e.getMessage());
            return defaultFeedback();
        }
    }

    public String transcribeAudio(MultipartFile audioFile) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);
            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("file", new ByteArrayResource(audioFile.getBytes()) {
                @Override
                public String getFilename() { return audioFile.getOriginalFilename(); }
            });
            HttpEntity<MultiValueMap<String, Object>> entity = new HttpEntity<>(body, headers);
            ResponseEntity<Map> response = restTemplate.postForEntity(
                    pythonAiBaseUrl + "/transcribe", entity, Map.class);
            if (response.getBody() != null) {
                return (String) response.getBody().getOrDefault("transcript", "");
            }
        } catch (Exception e) {
            log.error("Python AI unavailable for transcription: {}", e.getMessage());
        }
        return "";
    }

    private List<Map<String, Object>> fallbackQuestions(List<String> skills) {
        List<Map<String, Object>> questions = new ArrayList<>();
        Random rng = new Random();

        // ── 1. Intro question (random pick, mirrors Python generator) ──────────
        List<String> introOptions = List.of(
            "Tell me about yourself.",
            "Can you introduce yourself?",
            "Walk me through your background.",
            "Give me a brief introduction about yourself.",
            "Could you please introduce yourself?",
            "Tell me something about yourself.",
            "How would you describe yourself?",
            "Can you give a short summary of your profile?",
            "Please give me a quick overview of your background.",
            "Tell me about your journey so far."
        );
        questions.add(Map.of(
            "skill",       "Introduction",
            "difficulty",  "basic",
            "question",    introOptions.get(rng.nextInt(introOptions.size())),
            "ideal_answer","A concise self-introduction covering educational background, key skills, and career goals."
        ));

        // ── 2. Per-skill question pools ────────────────────────────────────────
        List<String[]> basicTemplates = new ArrayList<>(List.of(
            new String[]{"What is %s and why is it used?",
                         "A clear definition of %s, its purpose, and common real-world use cases."},
            new String[]{"Can you explain the core concepts of %s?",
                         "An explanation of the fundamental concepts and principles behind %s."},
            new String[]{"How does %s work at a high level?",
                         "A high-level description of how %s operates and its key components."},
            new String[]{"When would you choose %s over other alternatives?",
                         "Reasoning about the strengths of %s and scenarios where it is the best choice."},
            new String[]{"What are the main advantages of using %s?",
                         "A discussion of the primary benefits and strengths of %s."}
        ));
        List<String[]> intermediateTemplates = new ArrayList<>(List.of(
            new String[]{"Describe a problem you solved using %s.",
                         "A concrete example showing problem-solving skills with %s."},
            new String[]{"What are common pitfalls when working with %s?",
                         "An honest discussion of typical mistakes and how to avoid them in %s."},
            new String[]{"How do you debug or troubleshoot issues in %s?",
                         "Practical debugging strategies and tools used with %s."},
            new String[]{"How have you used %s in a real project?",
                         "A project walkthrough that demonstrates hands-on experience with %s."},
            new String[]{"What best practices do you follow when using %s?",
                         "A set of guidelines and conventions applied for clean, maintainable %s work."}
        ));

        Collections.shuffle(basicTemplates, rng);
        Collections.shuffle(intermediateTemplates, rng);

        List<String> selectedSkills = skills.isEmpty()
            ? List.of("General Programming") : skills.subList(0, Math.min(skills.size(), 4));

        for (int i = 0; i < selectedSkills.size(); i++) {
            String skill = selectedSkills.get(i).trim();
            // Alternate basic / intermediate to give variety
            String[] template = (i % 2 == 0)
                ? basicTemplates.get(i % basicTemplates.size())
                : intermediateTemplates.get(i % intermediateTemplates.size());
            String difficulty = (i % 2 == 0) ? "basic" : "intermediate";
            questions.add(Map.of(
                "skill",       skill,
                "difficulty",  difficulty,
                "question",    String.format(template[0], skill),
                "ideal_answer", String.format(template[1], skill)
            ));
        }

        // ── 3. Closing project question ────────────────────────────────────────
        String skillsList = String.join(", ", selectedSkills);
        questions.add(Map.of(
            "skill",       "Projects",
            "difficulty",  "basic",
            "question",    "Tell me about a project you built using " + skillsList + ". What was your role and what did you learn?",
            "ideal_answer","A description of the project goal, technologies used, the candidate's contribution, challenges faced, and key learnings."
        ));

        return questions;
    }

    private Map<String, Object> defaultFeedback() {
        return Map.of(
                "strengths", List.of("Demonstrated knowledge of the subject"),
                "areas_for_improvement", List.of("Could provide more detailed answers"),
                "final_score", 50.0,
                "recommendation", "On Hold"
        );
    }
}
