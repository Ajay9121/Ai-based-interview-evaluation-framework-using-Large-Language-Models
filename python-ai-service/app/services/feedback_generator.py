import json
import logging
import re
from typing import List, Dict, Any

from google import genai
from app.config import GEMINI_API_KEY, GEMINI_MODEL, GROQ_API_KEY

logger = logging.getLogger(__name__)

_client = genai.Client(api_key=GEMINI_API_KEY)


def generate_feedback(qa_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Generate a detailed, structured performance report using Gemini API."""

    qa_text = ""
    for i, item in enumerate(qa_data, 1):
        qa_text += f"""
Question {i} ({item.get('difficulty', 'N/A')} – {item.get('skill', 'N/A')}):
  Q: {item.get('question', '')}
  Ideal Answer: {item.get('ideal_answer', '')}
  Candidate Answer: {item.get('candidate_answer', '')}
  Similarity Score: {item.get('score', 0):.1f}/100
"""

    prompt = f"""You are a senior technical interviewer conducting an AI-driven automated voice interview.
Evaluate the following Q&A session and produce a detailed JSON performance report.

{qa_text}

OUTPUT ONLY valid JSON. No markdown, no code blocks, no extra text:
{{
  "final_score": <integer 0-100>,
  "communication_score": <integer 0-100, assess clarity and fluency of spoken answers>,
  "technical_score": <integer 0-100, assess technical accuracy and depth>,
  "confidence_score": <integer 0-100, infer confidence from answer completeness>,
  "recommendation": "<exactly one of: Hire, On Hold, Reject>",
  "feedback_summary": "<2-3 sentence overall summary of performance>",
  "strengths": ["<strength1>", "<strength2>", "<strength3>"],
  "areas_for_improvement": ["<area1>", "<area2>"],
  "suggestions": ["<actionable suggestion1>", "<actionable suggestion2>", "<actionable suggestion3>"]
}}

Scoring rules:
- final_score >= 70 → recommendation: "Hire"
- final_score 40-69 → recommendation: "On Hold"
- final_score < 40  → recommendation: "Reject"

If candidate answered "No answer provided" for a question, penalise that question's contribution heavily.
Be honest, professional, and constructive.
"""

    try:
        response = _client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
        )
        raw = response.text.strip()

        # Strip markdown code fences if the model sneaks them in
        raw = re.sub(r'^```(?:json)?\s*\n?', '', raw)
        raw = re.sub(r'\n?```\s*$', '', raw)
        raw = raw.strip()

        feedback = json.loads(raw)

        # ── Ensure all required fields exist ──────────────────────────────────
        feedback.setdefault("strengths", ["Participated in the interview process"])
        feedback.setdefault("areas_for_improvement", ["Provide more detailed answers"])
        feedback.setdefault("suggestions", ["Practice explaining concepts out loud", "Review core topics"])
        feedback.setdefault("feedback_summary", "The candidate participated in the automated interview.")
        feedback.setdefault("recommendation", "On Hold")

        # Validate numeric fields
        for key in ("final_score", "communication_score", "technical_score", "confidence_score"):
            if key not in feedback or not isinstance(feedback[key], (int, float)):
                if key == "final_score":
                    scores = [item.get("score", 0) for item in qa_data]
                    feedback[key] = round(sum(scores) / len(scores), 1) if scores else 0
                else:
                    feedback[key] = feedback.get("final_score", 0)

        # Ensure recommendation matches score
        score = feedback["final_score"]
        if score >= 70:
            feedback["recommendation"] = "Hire"
        elif score >= 40:
            feedback["recommendation"] = "On Hold"
        else:
            feedback["recommendation"] = "Reject"

        logger.info(
            f"Feedback generated: score={feedback['final_score']}, "
            f"comm={feedback['communication_score']}, tech={feedback['technical_score']}, "
            f"conf={feedback['confidence_score']}, rec={feedback['recommendation']}"
        )
        return feedback

    except json.JSONDecodeError as e:
        logger.error(f"Feedback JSON parse error: {e}\nRaw: {raw[:500]}")
        return _fallback_feedback(qa_data)
    except Exception as e:
        logger.warning(f"Gemini API error for feedback: {e} — trying Groq fallback")
        return _generate_with_groq(qa_text, qa_data)


def _generate_with_groq(qa_text: str, qa_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Fallback: use Groq/Llama to generate overall feedback."""
    try:
        from groq import Groq
        client = Groq(api_key=GROQ_API_KEY)

        prompt = f"""You are a senior technical interviewer.
Evaluate the following Q&A session and produce a JSON performance report.

{qa_text}

Return ONLY valid JSON, no markdown, no extra text:
{{
  "final_score": <integer 0-100>,
  "communication_score": <integer 0-100>,
  "technical_score": <integer 0-100>,
  "confidence_score": <integer 0-100>,
  "recommendation": "<Hire | On Hold | Reject>",
  "feedback_summary": "<2-3 sentence summary>",
  "strengths": ["<strength1>", "<strength2>"],
  "areas_for_improvement": ["<area1>", "<area2>"],
  "suggestions": ["<suggestion1>", "<suggestion2>"]
}}
Rules: final_score>=70 → Hire, 40-69 → On Hold, <40 → Reject"""

        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are a strict but fair technical interviewer. Return only valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2,
            max_completion_tokens=800,
            stream=False
        )
        raw = completion.choices[0].message.content.strip()
        raw = re.sub(r'^```(?:json)?\s*\n?', '', raw)
        raw = re.sub(r'\n?```\s*$', '', raw)
        feedback = json.loads(raw.strip())

        # normalise
        feedback.setdefault("strengths", ["Participated in the interview"])
        feedback.setdefault("areas_for_improvement", ["Provide more detailed answers"])
        feedback.setdefault("suggestions", ["Practice speaking answers aloud"])
        feedback.setdefault("feedback_summary", "Interview evaluated by Groq/Llama AI.")
        feedback.setdefault("recommendation", "On Hold")
        score = feedback.get("final_score", 0)
        if score >= 70:
            feedback["recommendation"] = "Hire"
        elif score >= 40:
            feedback["recommendation"] = "On Hold"
        else:
            feedback["recommendation"] = "Reject"

        logger.info(f"[Groq] Feedback: score={feedback['final_score']}, rec={feedback['recommendation']}")
        return feedback
    except Exception as e:
        logger.error(f"Groq fallback also failed: {e}")
        return _fallback_feedback(qa_data)


def _fallback_feedback(qa_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    scores = [item.get("score", 0) for item in qa_data]
    avg_score = round(sum(scores) / len(scores), 1) if scores else 0

    if avg_score >= 70:
        recommendation = "Hire"
    elif avg_score >= 40:
        recommendation = "On Hold"
    else:
        recommendation = "Reject"

    return {
        "final_score": avg_score,
        "communication_score": round(avg_score * 0.9),
        "technical_score": avg_score,
        "confidence_score": round(avg_score * 0.85),
        "recommendation": recommendation,
        "feedback_summary": (
            "The candidate completed the automated interview. "
            "Detailed AI analysis was unavailable; scores are based on semantic similarity."
        ),
        "strengths": [
            "Participated in the full interview",
            "Demonstrated willingness to answer questions",
        ],
        "areas_for_improvement": [
            "Provide more detailed technical explanations",
            "Use concrete real-world examples in answers",
        ],
        "suggestions": [
            "Practice speaking answers aloud for technical topics",
            "Review fundamental concepts in your skill areas",
            "Use the STAR method (Situation, Task, Action, Result) for answer structure",
        ],
    }
