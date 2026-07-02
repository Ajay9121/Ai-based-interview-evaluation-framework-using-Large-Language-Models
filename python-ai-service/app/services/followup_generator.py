"""
followup_generator.py
---------------------
Generates ONE context-aware follow-up question per answer.
Uses evaluation result (from LLaMA/Gemini) to intelligently probe weak areas.
Primary: Gemini | Fallback: Groq/Llama
"""

import logging
import re
from typing import Dict, Optional

from google import genai
from app.config import GEMINI_API_KEY, GEMINI_MODEL, GROQ_API_KEY

logger = logging.getLogger(__name__)

_client = genai.Client(api_key=GEMINI_API_KEY)


def _build_prompt(question: str, candidate_answer: str,
                  eval_result: Optional[Dict] = None) -> str:
    """
    Build the follow-up generation prompt.
    When eval_result is provided, the model uses the scores/feedback
    to precisely target the weakest dimension.
    """

    # ── Evaluation context block ──────────────────────────────────────────────
    eval_block = ""
    if eval_result:
        accuracy    = eval_result.get("accuracy",    "N/A")
        completeness= eval_result.get("completeness","N/A")
        clarity     = eval_result.get("clarity",     "N/A")
        score       = eval_result.get("final_score", "N/A")
        feedback    = eval_result.get("feedback",    "")
        strengths   = eval_result.get("strengths",   "")
        improvements= eval_result.get("improvements","")

        eval_block = f"""
AI Evaluation of the candidate's answer (use this to target the follow-up):
- Overall Score   : {score}/100
- Accuracy        : {accuracy}/10   (Is the concept technically correct?)
- Completeness    : {completeness}/10 (Are all key points covered?)
- Clarity         : {clarity}/10   (Is the explanation clear?)
- AI Feedback     : {feedback}
- What was good   : {strengths}
- What is missing : {improvements}

Focus the follow-up on the LOWEST scoring dimension and the identified gaps.
"""

    return f"""You are an experienced technical interviewer conducting a live interview.

The candidate was asked:
"{question}"

The candidate answered:
"{candidate_answer}"
{eval_block}
Instructions:
- Analyze the candidate's answer carefully
- Identify:
  1. Missing concepts flagged by the evaluation
  2. Weak explanations (low clarity/accuracy scores)
  3. Areas that can be explored deeper

Now generate ONE follow-up question that:
- Directly targets the weakest area identified above
- Probes deeper into the same topic
- Tests the candidate's understanding of the specific gap
- Is natural and conversational (like a real interviewer would ask)

Rules:
- Do NOT repeat the same question
- Do NOT ask generic questions
- Keep it directly relevant to the candidate's specific answer and its gaps
- Keep it short and clear (1-2 sentences max)

Return ONLY the follow-up question as plain text. No JSON, no labels, no extra text."""


def _clean(text: str) -> str:
    text = text.strip()
    text = re.sub(r'^["\']|["\']$', '', text).strip()
    text = re.sub(r'^(Follow-up question:|Follow-up:|Question:)\s*',
                  '', text, flags=re.IGNORECASE).strip()
    return text


def generate_followup(question: str, candidate_answer: str,
                      eval_result: Optional[Dict] = None) -> str:
    """
    Generate a single follow-up question.
    eval_result: the dict returned by answer_evaluator (accuracy, completeness,
                 clarity, final_score, feedback, strengths, improvements).
    Returns a plain-text string (the question itself).
    """
    # If no answer was provided, return a gentle prompt
    if not candidate_answer or candidate_answer.strip().lower() in (
        "no answer provided", "", "no answer"
    ):
        return ("Could you take a moment to share any thoughts you have on "
                "this topic, even if you're not fully sure?")

    prompt = _build_prompt(question, candidate_answer, eval_result)

    # ── 1. Try Gemini ─────────────────────────────────────────────────────────
    try:
        response = _client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
        )
        followup = _clean(response.text)
        logger.info(f"[Gemini] Follow-up: {followup[:80]}…")
        return followup
    except Exception as e:
        logger.warning(f"[Gemini] Follow-up failed ({e}) — trying Groq")

    # ── 2. Fallback: Groq/Llama ───────────────────────────────────────────────
    try:
        from groq import Groq
        client = Groq(api_key=GROQ_API_KEY)
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a technical interviewer. "
                        "Generate exactly ONE short follow-up question that probes "
                        "the weakest part of the candidate's answer. "
                        "Return only the question text, nothing else."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.4,
            max_completion_tokens=120,
            stream=False,
        )
        followup = _clean(completion.choices[0].message.content)
        logger.info(f"[Groq] Follow-up: {followup[:80]}…")
        return followup
    except Exception as e:
        logger.error(f"[Groq] Follow-up also failed: {e}")

    # ── 3. Static fallback ────────────────────────────────────────────────────
    return "Can you elaborate on that a bit more and give a specific example?"
