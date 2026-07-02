package com.example.interview.repository;

import com.example.interview.model.Question;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface QuestionRepository extends JpaRepository<Question, Long> {
    List<Question> findByInterviewIdOrderByOrderIndexAsc(Long interviewId);
    Optional<Question> findFirstByInterviewIdAndIdGreaterThanOrderByOrderIndexAsc(Long interviewId, Long lastId);
    long countByInterviewId(Long interviewId);
}
