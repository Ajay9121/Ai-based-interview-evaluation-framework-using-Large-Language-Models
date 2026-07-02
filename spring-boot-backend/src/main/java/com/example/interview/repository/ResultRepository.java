package com.example.interview.repository;

import com.example.interview.model.Result;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ResultRepository extends JpaRepository<Result, Long> {
    Optional<Result> findByInterviewId(Long interviewId);
    Optional<Result> findByCandidateIdAndInterviewId(Long candidateId, Long interviewId);
}
