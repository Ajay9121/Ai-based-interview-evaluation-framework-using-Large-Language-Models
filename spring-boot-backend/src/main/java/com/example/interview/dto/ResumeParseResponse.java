package com.example.interview.dto;

import lombok.Data;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;
import lombok.Builder;

import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class ResumeParseResponse {
    private List<String> skills;
    private Integer experienceYears;
    private String level;
}
