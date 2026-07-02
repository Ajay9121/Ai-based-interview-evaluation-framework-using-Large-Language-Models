<<<<<<< HEAD
# Automated Interview Evaluation Framework

This is an AI-powered technical interview evaluation framework featuring:
- A lifelike SVG 2D avatar that speaks directly to you using your browser's TTS.
- Real-time voice interaction using the Web Speech API (with an audio recording fallback).
- A Spring Boot (Java 17) backend orchestrator with JWT security and temporary SQLite file-based storage.
- A Python FastAPI AI microservice that leverages the Google Gemini API to parse resumes, generate customized interview questions based on skills, and evaluate responses with semantic similarity (Sentence-Transformers) and Gemini (RAG-grounded).
- A beautiful dark-themed React (TypeScript) frontend.

## Prerequisites
- Docker and Docker Compose
- Google Gemini API Key (Get one from [Google AI Studio](https://aistudio.google.com/))

## Quick Setup

1. **Configure Gemini API Key**
   Open the `docker-compose.yml` file and replace `${GEMINI_API_KEY:-your_gemini_key_here}` with your actual API key, OR export it in your shell:
   ```bash
   export GEMINI_API_KEY="AIzaSyYourRealKeyHere"
   ```

2. **Start the Application**
   From the project root, run:
   ```bash
   docker-compose up --build
   ```
   *Note: On the first run, the Python AI container will automatically download required ML models (`spaCy en_core_web_sm` and `Sentence-Transformer all-MiniLM-L6-v2`). This might take a couple of minutes.*

3. **Access the Application**
   - **Frontend:** http://localhost:3000
   - **Spring Boot API:** http://localhost:8080
   - **Python AI API:** http://localhost:8000

## How to Test

### 1. Default Admin Setup
During initialization, a robust Flyway migration automatically creates a default Admin user inside the SQLite database.
- **Admin Email:** `admin@interview.com`
- **Admin Password:** `admin123`

You can use this default account to access the Admin portal (`/admin`) to view interviews, review answers, see AI feedback, and override scores.

### 2. Candidate Flow (The Viva Presentation)
1. Navigate to http://localhost:3000
2. Click **"Sign Up"** and register a new candidate account.
3. Once logged in, upload a sample resume (PDF/DOCX) or proceed without one. 
4. The system will detect your level (e.g., JUNIOR/SENIOR) and skills (e.g., Python, React).
5. Click **"Start Interview"**.
6. The UI will load the Avatar. It will read the question aloud using TTS.
7. Wait for the Avatar to finish speaking, then click **"🎤 Start Recording"** and answer the question. The Web Speech API will transcribe your speech into text in real-time.
8. Click **"Submit Answer & Continue ➔"**.
9. Once all 3 questions are answered, the AI will evaluate your answers against the ideal answers, and provide a final recommendation (Hire / On Hold / Reject) along with Strengths and Areas for Improvement.

### 3. Database Location
The SQLite database is file-based and mounted automatically.
- It is located at `./data/interview.db` on your host machine.
- No separate PostgreSQL container is needed, ideal for quick testing and local demos.

## Architecture Highlights
- **Containers:** 3 distinct Docker containers mapped cleanly.
- **Python AI:** FastAPI application using `sentence-transformers` locally and `google-generativeai` securely for LLM reasoning.
- **Spring Boot 3.2.x:** Orchestrates tasks statefully via async threads (`@EnableAsync`), manages JWT filters, and handles REST templates for bridging logic to the AI endpoints.
- `React 18`: Modern functional components, pure CSS dynamic keyframe animations for the speaking avatar, and seamless API bridging with Axios.

## Directory Structure and Hierarchy

Below is a detailed breakdown of the application architecture and its internal filesystem hierarchy.

### Root Directory
- `docker-compose.yml`: The primary run orchestrator mapping all 3 containers, environment variables, and persistent volumes.
- `data/`: A persistent folder mapped to `/app/data` containing the SQLite database file (`interview.db`).
- `uploads/`: A persistent folder mapped to `/app/uploads` holding user submitted PDF and DOCX resumes.

### /frontend (React.js + TypeScript)
Hosts the aesthetic web application using React, React Router, and standard CSS.
- `src/components/`: Reusable UI modules, including the animated `Avatar.tsx`, `AudioRecorder.tsx`, and `Navbar.tsx`.
- `src/pages/`: Distinct page views (`Login.tsx`, `Dashboard.tsx`, `Interview.tsx`, `Admin.tsx`).
- `src/services/`: Contains `api.ts` representing Axios client wrappers mapped directly to backend endpoints.
- `src/types/`: Interfaces outlining the complex nested JSON schemas.
- `package.json`: Core React scripts and web dependencies setup.

### /spring-boot-backend (Java 17 + Spring Boot 3)
The core backend providing security, database tracking, user logic, and orchestrating downstream Python AI requests.
- `src/.../controller/`: REST routing layer endpoints (`AuthController.java`, `InterviewController.java`).
- `src/.../service/`: Heavy business workflows. Includes the REST Client (`PythonAIClient.java`) that proxies background NLP generation to Python asynchronously.
- `src/.../security/`: JWT Filters and token providers configured to secure endpoints robustly.
- `src/.../model/`: Strong-typed JPA Entities (`Candidate.java`, `Question.java`).
- `src/.../resources/db/migration/`: Flyway version-controlled SQL scripts (`V1`, `V2`, `V3`) for automated database bootstrapping.
- `pom.xml`: Maven dependencies, bringing in SQLite JDBC community dialects alongside Web and Security contexts.

### /python-ai-service (FastAPI + Python 3.10)
A designated, highly-scalable microservice built purely for Natural Language Processing, decoupled from Java's logic context.
- `app/api/`: FastAPI route handlers (e.g., `generate_questions`, `evaluate_answer`).
- `app/services/`: Core Intelligence
  - `resume_parser.py`: Uses NLP models (e.g. `spaCy`) to extract context and competencies from resumes.
  - `gemini_client.py`: Integrates `google-generativeai` to orchestrate targeted parameter driven generation.
  - `question_generator.py`: Tailors LLM prompt strategies based on skill metadata.
  - `feedback_generator.py`: Calculates mathematical semantic context scoring via `sentence-transformers` and aggregates qualitative Gemini feedback.
- `requirements.txt`: Lightweight isolated `pip` references required for local ML operations.
=======
# Ai-based-interview-evaluation-framework-using-Large-Language-Models
AI-powered interview evaluation framework using Large Language Models (LLMs) for automated technical interviews, candidate assessment, and personalized feedback.
>>>>>>> 1c8a3f941fd835773a49646d2584349aa332fc63
