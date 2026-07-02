-- V3: Create results table
CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    interview_id INTEGER NOT NULL UNIQUE,
    candidate_id INTEGER NOT NULL,
    final_score REAL DEFAULT 0.0,
    strengths TEXT,
    areas_for_improvement TEXT,
    recommendation VARCHAR(50),
    feedback_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (interview_id) REFERENCES interviews(id),
    FOREIGN KEY (candidate_id) REFERENCES candidates(id)
);
