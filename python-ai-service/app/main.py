import logging
from contextlib import asynccontextmanager
from typing import List

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.services import resume_parser, question_generator, semantic_similarity, feedback_generator, speech_to_text, answer_evaluator, followup_generator

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Pre-load the Sentence-Transformer model at startup
    logger.info("Pre-loading Sentence-Transformer model...")
    try:
        semantic_similarity.get_model()
    except Exception as e:
        logger.warning(f"Could not pre-load model: {e}")
    yield
    logger.info("Shutting down Python AI service.")


app = FastAPI(
    title="Interview AI Service",
    description="AI-powered resume parsing, question generation, and evaluation API",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Request / Response Models ────────────────────────────────────────────────

class QuestionRequest(BaseModel):
    skills: List[str]
    level: str = "junior"
    experience_years: int = 0

class EvaluationRequest(BaseModel):
    candidate_answer: str
    ideal_answer: str

class QAItem(BaseModel):
    question: str
    ideal_answer: str
    candidate_answer: str
    score: float = 0.0
    difficulty: str = ""
    skill: str = ""

class FeedbackRequest(BaseModel):
    qa_data: List[QAItem]

class AnswerEvalRequest(BaseModel):
    question: str
    candidate_answer: str

class FollowUpRequest(BaseModel):
    question: str
    candidate_answer: str
    eval_result: dict | None = None   # accuracy, completeness, clarity, feedback, etc.



# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "python-ai"}


@app.post("/parse_resume")
async def parse_resume_endpoint(file: UploadFile = File(...)):
    """Parse a resume PDF/DOCX and extract skills and experience."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    allowed_types = [".pdf", ".docx", ".txt"]
    ext = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in allowed_types:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")

    contents = await file.read()
    result = resume_parser.parse_resume(contents, file.filename)
    logger.info(f"Parsed resume: {result}")
    return result


@app.post("/generate_questions")
async def generate_questions_endpoint(request: QuestionRequest):
    """Generate interview questions using Gemini API."""
    questions = question_generator.generate_questions_batch(
        skills=request.skills,
        level=request.level,
        years=request.experience_years
    )
    logger.info(f"Generated {len(questions)} questions for skills: {request.skills}")
    return questions


@app.post("/evaluate_semantic")
async def evaluate_semantic_endpoint(request: EvaluationRequest):
    """Compute semantic similarity between candidate and ideal answer."""
    score = semantic_similarity.compute_similarity(
        candidate_answer=request.candidate_answer,
        ideal_answer=request.ideal_answer
    )
    return {"score": score}


@app.post("/generate_feedback")
async def generate_feedback_endpoint(request: FeedbackRequest):
    """Generate structured feedback using Gemini API."""
    qa_data = [item.dict() for item in request.qa_data]
    feedback = feedback_generator.generate_feedback(qa_data)
    logger.info(f"Feedback generated: score={feedback.get('final_score')}, rec={feedback.get('recommendation')}")
    return feedback


@app.post("/evaluate_answer")
async def evaluate_answer_endpoint(request: AnswerEvalRequest):
    """Evaluate a single candidate answer using AI (Gemini → Groq fallback)."""
    result = answer_evaluator.evaluate_answer(
        question=request.question,
        user_answer=request.candidate_answer
    )
    logger.info(
        f"Answer evaluated: score={result.get('final_score')}, "
        f"by={result.get('_evaluated_by', 'unknown')}"
    )
    return result


@app.post("/transcribe")
async def transcribe_audio_endpoint(file: UploadFile = File(...)):
    """Transcribe audio file using Whisper (fallback endpoint)."""
    contents = await file.read()
    transcript = speech_to_text.transcribe_audio(contents, file.filename or "audio.webm")
    return {"transcript": transcript}


@app.post("/generate_followup")
async def generate_followup_endpoint(request: FollowUpRequest):
    """Generate one context-aware follow-up question based on original Q+A and evaluation."""
    followup = followup_generator.generate_followup(
        question=request.question,
        candidate_answer=request.candidate_answer,
        eval_result=request.eval_result,
    )
    logger.info(f"Follow-up generated: {followup[:80]}…")
    return {"followup_question": followup}

