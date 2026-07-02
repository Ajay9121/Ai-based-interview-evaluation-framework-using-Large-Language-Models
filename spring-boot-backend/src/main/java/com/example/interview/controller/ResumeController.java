package com.example.interview.controller;

import com.example.interview.model.Candidate;
import com.example.interview.repository.CandidateRepository;
import com.example.interview.service.CandidateService;
import com.example.interview.service.PythonAIClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/resume")
@RequiredArgsConstructor
@Slf4j
public class ResumeController {

    private final CandidateService candidateService;
    private final CandidateRepository candidateRepository;
    private final PythonAIClient pythonAIClient;

    @Value("${app.upload.dir:/app/uploads}")
    private String uploadDir;

    @PostMapping("/upload")
    public ResponseEntity<?> uploadResume(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam("file") MultipartFile file) {
        try {
            Candidate candidate = candidateService.findByEmail(userDetails.getUsername())
                    .orElseThrow(() -> new RuntimeException("Candidate not found"));

            // Save file
            Path uploadPath = Paths.get(uploadDir);
            Files.createDirectories(uploadPath);
            String fileName = candidate.getId() + "_" + file.getOriginalFilename();
            Path filePath = uploadPath.resolve(fileName);
            file.transferTo(filePath.toFile());

            candidateService.updateResumePath(candidate.getId(), filePath.toString());

            // Parse resume via Python AI
            Map<String, Object> parsed = pythonAIClient.parseResume(file);
            List<String> skills = (List<String>) parsed.getOrDefault("skills", List.of());
            int years = ((Number) parsed.getOrDefault("experience_years", 0)).intValue();
            String level = (String) parsed.getOrDefault("level", "junior");

            candidateService.updateCandidateSkills(candidate.getId(), skills, years, level);

            return ResponseEntity.ok(Map.of(
                    "message", "Resume uploaded and parsed successfully",
                    "skills", skills,
                    "experienceYears", years,
                    "level", level
            ));
        } catch (Exception e) {
            log.error("Resume upload error: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/profile")
    public ResponseEntity<?> getProfile(@AuthenticationPrincipal UserDetails userDetails) {
        Candidate candidate = candidateService.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("Candidate not found"));
        return ResponseEntity.ok(Map.of(
                "id", candidate.getId(),
                "name", candidate.getName(),
                "email", candidate.getEmail(),
                "skills", candidate.getSkills() != null ? candidate.getSkills() : "",
                "experienceYears", candidate.getExperienceYears() != null ? candidate.getExperienceYears() : 0,
                "level", candidate.getLevel() != null ? candidate.getLevel() : "junior",
                "resumePath", candidate.getResumePath() != null ? candidate.getResumePath() : ""
        ));
    }
}
