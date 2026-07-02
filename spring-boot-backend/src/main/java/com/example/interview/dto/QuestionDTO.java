package com.example.interview.dto;

import lombok.Data;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;
import lombok.Builder;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class QuestionDTO {
    private Long id;
    private String skill;
    private String difficulty;
    private String questionText;
    private Integer orderIndex;
    private Long interviewId;
}
