-- V1: Create candidate/user tables
CREATE TABLE IF NOT EXISTS candidates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'CANDIDATE',
    resume_path VARCHAR(500),
    skills TEXT,
    experience_years INTEGER DEFAULT 0,
    level VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default admin user (password: admin123 BCrypt encoded)
INSERT OR IGNORE INTO candidates (name, email, password, role)
VALUES ('Admin User', 'admin@interview.com', '$2a$10$v7nEMDMgVm9/02L2SGPYdeh9yXEkX1uUZQqZ8L5./nLt1M.zxDa3i', 'ADMIN');
