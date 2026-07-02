package com.example.interview.dto;

import lombok.Data;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class EvaluationRequest {
    private String candidateAnswer;
    private String idealAnswer;
}
