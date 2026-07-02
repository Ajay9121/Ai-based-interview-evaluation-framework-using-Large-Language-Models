package com.example.interview.repository;

import com.example.interview.model.Interview;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface InterviewRepository extends JpaRepository<Interview, Long> {
    List<Interview> findByCandidateId(Long candidateId);
    Optional<Interview> findTopByCandidateIdOrderByCreatedAtDesc(Long candidateId);
    List<Interview> findByStatus(String status);
}
