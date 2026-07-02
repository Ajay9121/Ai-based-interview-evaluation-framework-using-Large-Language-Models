package com.example.interview.service;

import com.example.interview.dto.RegisterRequest;
import com.example.interview.model.Candidate;
import com.example.interview.repository.CandidateRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class CandidateService {

    private final CandidateRepository candidateRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public Candidate registerCandidate(RegisterRequest request) {
        if (candidateRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Email already registered: " + request.getEmail());
        }
        Candidate candidate = Candidate.builder()
                .name(request.getName())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .role("CANDIDATE")
                .build();
        return candidateRepository.save(candidate);
    }

    public Optional<Candidate> findByEmail(String email) {
        return candidateRepository.findByEmail(email);
    }

    public Optional<Candidate> findById(Long id) {
        return candidateRepository.findById(id);
    }

    public List<Candidate> findAllCandidates() {
        return candidateRepository.findAll();
    }

    @Transactional
    public Candidate updateCandidateSkills(Long candidateId, List<String> skills,
                                           Integer experienceYears, String level) {
        Candidate candidate = candidateRepository.findById(candidateId)
                .orElseThrow(() -> new RuntimeException("Candidate not found: " + candidateId));
        candidate.setSkills(String.join(",", skills));
        candidate.setExperienceYears(experienceYears);
        candidate.setLevel(level);
        return candidateRepository.save(candidate);
    }

    @Transactional
    public Candidate updateResumePath(Long candidateId, String resumePath) {
        Candidate candidate = candidateRepository.findById(candidateId)
                .orElseThrow(() -> new RuntimeException("Candidate not found: " + candidateId));
        candidate.setResumePath(resumePath);
        return candidateRepository.save(candidate);
    }

    public List<String> getCandidateSkills(Long candidateId) {
        Candidate candidate = candidateRepository.findById(candidateId)
                .orElseThrow(() -> new RuntimeException("Candidate not found: " + candidateId));
        if (candidate.getSkills() == null || candidate.getSkills().isEmpty()) {
            return List.of();
        }
        return Arrays.asList(candidate.getSkills().split(","));
    }
}
