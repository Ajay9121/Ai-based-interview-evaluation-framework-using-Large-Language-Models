package com.example.interview.repository;

import com.example.interview.model.Answer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AnswerRepository extends JpaRepository<Answer, Long> {
    List<Answer> findByInterviewId(Long interviewId);
    Optional<Answer> findByQuestionId(Long questionId);
    long countByInterviewId(Long interviewId);
}
