"""
answer_evaluator.py
-------------------
Per-question AI evaluation.
Primary  : Google Gemini
Fallback : Groq (llama-3.3-70b-versatile) — used when Gemini errors or hits quota.
"""

import json
import logging
import re
from typing import Dict, Any

from google import genai
from app.config import GEMINI_API_KEY, GEMINI_MODEL, GROQ_API_KEY

logger = logging.getLogger(__name__)

_client = genai.Client(api_key=GEMINI_API_KEY)

# ── Shared Prompt ─────────────────────────────────────────────────────────────

def _build_prompt(question: str, user_answer: str) -> str:
    return f"""You are a senior technical interviewer and expert evaluator conducting a professional interview panel assessment.

Your task is to rigorously evaluate the candidate's answer based ONLY on the given question.
Do NOT rely on any provided correct answer — derive expectations from your expert knowledge.

Question:
{question}

Candidate Answer:
{user_answer}

STEP 1 — Internally construct the ideal answer:
- What are the 3-5 key concepts a strong candidate must mention?
- What depth of explanation is expected at a professional level?

STEP 2 — Evaluate against these scoring criteria:
1. Accuracy (0-10): Is the concept technically correct? Penalize wrong facts heavily.
2. Completeness (0-10): Are all major points covered? Penalize omissions of key concepts.
3. Clarity (0-10): Is the explanation structured, clear, and easy to follow?

STEP 3 — Assign a Verdict based on final_score:
- 85-100 → "Excellent" (Ready for senior role)
- 65-84  → "Good" (Strong candidate)
- 40-64  → "Needs Improvement" (Average, requires coaching)
- 0-39   → "Poor" (Significant gaps in knowledge)

STEP 4 — Classify the next question type:
- "follow-up" if the answer is shallow/partial and same topic needs probing
- "clarification" if the answer contains errors that need correction
- "new" if the answer is strong and complete — ready for next topic

Scoring Rules:
- Be strict but fair — this is a panel interview
- Full marks (10/10) only for truly comprehensive, accurate, well-articulated answers
- Partial credit for partial understanding
- Be specific in feedback — mention exact missing concepts by name

Output Rules:
- Return ONLY valid JSON, no markdown, no extra text

Return format:
{{
  "accuracy": <number 0-10>,
  "completeness": <number 0-10>,
  "clarity": <number 0-10>,
  "final_score": <number 0-100, = round((accuracy + completeness + clarity) / 3 * 10)>,
  "verdict": "Excellent | Good | Needs Improvement | Poor",
  "feedback": "<2-3 sentence balanced overall evaluation of the candidate's response>",
  "strengths": "<Specific things the candidate did well — name exact concepts they got right>",
  "improvements": "<Exactly what is missing and how to improve — name missing concepts explicitly>",
  "key_concepts_missed": ["<concept1>", "<concept2>"],
  "ideal_answer_hint": "<One concise sentence summarizing what the ideal answer should have covered>",
  "question_type": "follow-up | clarification | new"
}}

Critical:
- final_score = round(((accuracy + completeness + clarity) / 3) * 10)  → scale is 0-100
- key_concepts_missed must be a JSON array (can be empty [] if answer is complete)
"""


# ── Clean raw AI text → JSON ──────────────────────────────────────────────────

def _parse_json(raw: str) -> Dict[str, Any]:
    raw = re.sub(r'^```(?:json)?\s*\n?', '', raw)
    raw = re.sub(r'\n?```\s*$', '', raw)
    raw = raw.strip()
    return json.loads(raw)


def _normalise(result: Dict[str, Any]) -> Dict[str, Any]:
    """Ensure all required fields exist and are properly typed."""
    for key in ("accuracy", "completeness", "clarity"):
        result.setdefault(key, 5)
        result[key] = max(0, min(10, int(result[key])))

    # Recalculate final_score to be on 0-100
    avg = (result["accuracy"] + result["completeness"] + result["clarity"]) / 3
    result["final_score"] = round(avg * 10)

    # Derive verdict from final_score if missing
    score = result["final_score"]
    if "verdict" not in result:
        if score >= 85:
            result["verdict"] = "Excellent"
        elif score >= 65:
            result["verdict"] = "Good"
        elif score >= 40:
            result["verdict"] = "Needs Improvement"
        else:
            result["verdict"] = "Poor"

    result.setdefault("feedback", "The candidate provided an answer.")
    result.setdefault("strengths", "Attempted to answer the question.")
    result.setdefault("improvements", "Provide a more detailed and accurate answer.")
    result.setdefault("key_concepts_missed", [])
    result.setdefault("ideal_answer_hint", "A comprehensive answer covering all core concepts is expected.")
    result.setdefault("question_type", "new")

    # Ensure key_concepts_missed is always a list
    if not isinstance(result["key_concepts_missed"], list):
        result["key_concepts_missed"] = []

    return result


# ── Gemini Evaluator ──────────────────────────────────────────────────────────

def _evaluate_with_gemini(question: str, user_answer: str) -> Dict[str, Any]:
    prompt = _build_prompt(question, user_answer)
    response = _client.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
    )
    result = _parse_json(response.text.strip())
    return _normalise(result)


# ── Groq / Llama Fallback ─────────────────────────────────────────────────────

def _evaluate_with_groq(question: str, user_answer: str) -> Dict[str, Any]:
    from groq import Groq

    prompt = f"""You are a senior technical interviewer conducting a panel interview evaluation.

Evaluate the candidate's answer based ONLY on the question provided.
Do NOT assume any given correct answer — derive expectations from your expert knowledge.

Question:
{question}

Candidate Answer:
{user_answer}

Evaluation Criteria (score each 0-10):
1. Accuracy: Is the concept technically correct? Penalize wrong facts.
2. Completeness: Are all major points covered? Penalize missing key concepts.
3. Clarity: Is the explanation structured and easy to follow?

Verdict Assignment:
- 85-100 → "Excellent"
- 65-84 → "Good"
- 40-64 → "Needs Improvement"
- 0-39 → "Poor"

Question Type:
- "follow-up" if answer is shallow/partial
- "clarification" if answer has errors
- "new" if answer is strong and complete

Return ONLY valid JSON — no extra text, no markdown:
{{
  "accuracy": <0-10>,
  "completeness": <0-10>,
  "clarity": <0-10>,
  "final_score": <0-100, round((accuracy+completeness+clarity)/3*10)>,
  "verdict": "Excellent | Good | Needs Improvement | Poor",
  "feedback": "<2-3 sentence evaluation>",
  "strengths": "<specific strengths with concept names>",
  "improvements": "<specific improvements with missing concept names>",
  "key_concepts_missed": ["concept1", "concept2"],
  "ideal_answer_hint": "<one sentence on what ideal answer covers>",
  "question_type": "follow-up | clarification | new"
}}"""

    client = Groq(api_key=GROQ_API_KEY)
    completion = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": "You are a strict but fair technical interviewer. Return only valid JSON."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.2,
        max_completion_tokens=500,
        stream=False
    )
    raw = completion.choices[0].message.content
    result = _parse_json(raw)
    return _normalise(result)


# ── Public API ────────────────────────────────────────────────────────────────

def evaluate_answer(question: str, user_answer: str) -> Dict[str, Any]:
    """
    Evaluate a single Q&A pair.
    Tries Gemini first — on any error falls back to Groq/Llama.
    Returns a dict with: accuracy, completeness, clarity, final_score,
                         feedback, strengths, improvements.
    """
    if not user_answer or user_answer.strip().lower() in ("no answer provided", ""):
        logger.info("No answer provided — returning zero scores")
        return {
            "accuracy": 0,
            "completeness": 0,
            "clarity": 0,
            "final_score": 0,
            "verdict": "Poor",
            "feedback": "The candidate did not provide an answer to this question.",
            "strengths": "N/A",
            "improvements": "An answer must be provided to receive a score.",
            "key_concepts_missed": [],
            "ideal_answer_hint": "Please attempt to answer the question to receive evaluation.",
            "question_type": "clarification",
        }

    # 1. Try Gemini
    try:
        logger.info(f"[Gemini] Evaluating answer for question: {question[:60]}…")
        result = _evaluate_with_gemini(question, user_answer)
        logger.info(f"[Gemini] Score: {result['final_score']}/100")
        result["_evaluated_by"] = "gemini"
        return result
    except Exception as e:
        logger.warning(f"[Gemini] Failed ({e}) — switching to Groq/Llama fallback")

    # 2. Fallback: Groq / Llama
    try:
        logger.info(f"[Groq] Evaluating answer for question: {question[:60]}…")
        result = _evaluate_with_groq(question, user_answer)
        logger.info(f"[Groq] Score: {result['final_score']}/100")
        result["_evaluated_by"] = "groq"
        return result
    except Exception as e:
        logger.error(f"[Groq] Also failed: {e} — returning fallback scores")
        return _fallback_eval(user_answer)


def _fallback_eval(user_answer: str) -> Dict[str, Any]:
    """Last-resort fallback when both AI providers fail."""
    has_answer = bool(user_answer and len(user_answer.strip()) > 10)
    score = 5 if has_answer else 0
    return {
        "accuracy": score,
        "completeness": score,
        "clarity": score,
        "final_score": score * 10,
        "verdict": "Needs Improvement" if has_answer else "Poor",
        "feedback": "AI evaluation was temporarily unavailable. Score estimated from answer length.",
        "strengths": "Provided an answer." if has_answer else "N/A",
        "improvements": "Could not evaluate automatically. Please review manually.",
        "key_concepts_missed": [],
        "ideal_answer_hint": "Manual review recommended.",
        "question_type": "new",
        "_evaluated_by": "fallback",
    }
