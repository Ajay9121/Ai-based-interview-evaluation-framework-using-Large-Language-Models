import json
import logging
import random
import re
import time
from typing import List, Dict, Any

# ── Intro questions (picked randomly, never AI-generated) ─────────────────────
INTRO_QUESTIONS = [
    "Tell me about yourself.",
    "Can you introduce yourself?",
    "Walk me through your background.",
    "Give me a brief introduction about yourself.",
    "Could you please introduce yourself?",
    "Tell me something about yourself.",
    "How would you describe yourself?",
    "Can you give a short summary of your profile?",
    "Please give me a quick overview of your background.",
    "Tell me about your journey so far.",
    "Can you share a little about yourself?",
    "I'd like to know more about you. Please introduce yourself.",
    "Give me a quick introduction.",
    "Tell me about your academic and professional background.",
    "How would you present yourself to an interviewer?",
    "Can you start by introducing yourself?",
    "Tell me about your profile in brief.",
    "Give me a short pitch about yourself.",
    "Walk me through your resume.",
    "Can you summarize who you are and what you do?",
    "Tell me about your education and experience.",
    "Introduce yourself in a few sentences.",
    "What should I know about you?",
    "How do you usually introduce yourself in interviews?",
    "Tell me about your background and skills.",
]

from google import genai
from google.genai import types
from app.config import GEMINI_API_KEY, GEMINI_MODEL, GROQ_API_KEY

logger = logging.getLogger(__name__)

# Initialise Gemini client
_client = genai.Client(api_key=GEMINI_API_KEY)


def _parse_question_json(raw: str, skill: str, difficulty: str) -> Dict[str, Any]:
    """Strip markdown fences and parse JSON; raise on failure."""
    raw = re.sub(r'^```(?:json)?\n?', '', raw)
    raw = re.sub(r'\n?```$', '', raw)
    q = json.loads(raw.strip())
    q["skill"] = skill
    if "difficulty" not in q:
        q["difficulty"] = difficulty
    return q


def _generate_skill_question_groq(skill: str, tier: str, difficulty: str,
                                  style_rules: str, years: int) -> Dict[str, Any]:
    """Groq/Llama fallback for a single skill question."""
    from groq import Groq
    client = Groq(api_key=GROQ_API_KEY)
    prompt = f"""You are a technical interviewer. Generate exactly 1 interview question for the skill '{skill}'.
Candidate level: {tier} ({years} years experience).
{style_rules}
Return ONLY valid JSON, no markdown:
{{"difficulty": "{difficulty}", "question": "...", "ideal_answer": "..."}}"""
    completion = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": "You are a strict technical interviewer. Return only valid JSON."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.7,
        max_completion_tokens=300,
        stream=False
    )
    raw = completion.choices[0].message.content
    return _parse_question_json(raw, skill, difficulty)


def _generate_project_question_groq(skills_str: str, tier: str,
                                    years: int) -> Dict[str, Any]:
    """Groq/Llama fallback for the project question."""
    from groq import Groq
    client = Groq(api_key=GROQ_API_KEY)
    difficulty = "basic" if tier == "FRESHER" else "advanced"
    prompt = f"""You are a technical interviewer. Generate exactly 1 closing project question.
Candidate: {tier}, {years} years experience, skills: {skills_str}.
Ask about a real project they built using these skills.
Return ONLY valid JSON, no markdown:
{{"difficulty": "{difficulty}", "question": "...", "ideal_answer": "..."}}"""
    completion = Groq(api_key=GROQ_API_KEY).chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": "You are a technical interviewer. Return only valid JSON."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.7,
        max_completion_tokens=300,
        stream=False
    )
    raw = completion.choices[0].message.content
    q = _parse_question_json(raw, "Projects", difficulty)
    q["skill"] = "Projects"
    return q


def get_experience_tier(level: str, years: int) -> str:
    """
    Map resume level/years to FRESHER or EXPERIENCED.
    junior (0-1 yrs) → FRESHER
    mid / senior (2+ yrs) → EXPERIENCED
    """
    if level in ("junior",) or years < 2:
        return "FRESHER"
    return "EXPERIENCED"


def generate_question_for_skill(skill: str, level: str, years: int) -> Dict[str, Any]:
    """
    Generate exactly 1 interview question for a skill.
    Flow: Gemini (2 attempts) → Groq/Llama → static fallback
    """
    tier = get_experience_tier(level, years)
    variation = random.randint(1000, 9999)   # ensures varied output each session

    if tier == "FRESHER":
        difficulty = "basic"
        style_rules = (
            f"- Ask about the BASIC CONCEPT or DEFINITION of {skill}\n"
            f"- Use simple, beginner-friendly language\n"
            f"- Scenarios must be straightforward, NOT production or architecture-level\n"
            f"- Do NOT ask about performance, scalability, trade-offs, or system design\n"
            f"- Example style: 'What is X?', 'How does X work?', 'When would you use X?'"
        )
    else:
        difficulty = "intermediate"
        style_rules = (
            f"- Ask about a REAL-WORLD usage, design decision, or optimisation involving {skill}\n"
            f"- The question should reflect {years} years of hands-on experience\n"
            f"- Cover trade-offs, implementation challenges, or architectural thinking\n"
            f"- Do NOT ask trivial definitions — assume they know the basics\n"
            f"- Example style: 'How would you design X?', 'What trade-offs did you face with X?', 'How did you optimise X in production?'"
        )

    prompt = f"""You are a technical interviewer conducting a job interview. [session:{variation}]
Candidate profile: {years} years of experience, classified as {tier}.
Skill to ask about: '{skill}'

RULES:
{style_rules}
- Question must be STRICTLY about '{skill}' only
- Generate a UNIQUE question different from common ones
- Keep the question concise and interview-relevant (1-2 sentences max)
- The ideal answer must be appropriately detailed for a {tier}

Output ONLY a valid JSON object, no markdown, no code blocks, no extra text:
{{"difficulty": "{difficulty}", "question": "...", "ideal_answer": "..."}}"""

    # ── 1. Try Gemini (2 attempts) ─────────────────────────────────────────────
    for attempt in range(2):
        try:
            response = _client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
            )
            raw = response.text.strip()
            q = _parse_question_json(raw, skill, difficulty)
            logger.info(f"[Gemini/{tier}] Question for '{skill}': {q['question'][:60]}...")
            return q

        except json.JSONDecodeError as e:
            logger.error(f"Gemini JSON parse error for '{skill}': {e}")
            break   # don't retry JSON errors — go to Groq

        except Exception as e:
            err_str = str(e)
            if "Quota" in err_str or "quota" in err_str or "429" in err_str:
                logger.warning(f"Gemini quota/rate-limit for '{skill}' — switching to Groq immediately")
                break   # don't retry — go straight to Groq
            logger.warning(f"Gemini failed for '{skill}': {e} — trying Groq")
            break

    # ── 2. Groq/Llama fallback ────────────────────────────────────────────────
    try:
        q = _generate_skill_question_groq(skill, tier, difficulty, style_rules, years)
        logger.info(f"[Groq/{tier}] Question for '{skill}': {q['question'][:60]}...")
        return q
    except Exception as e:
        logger.error(f"Groq also failed for '{skill}': {e} — using static fallback")

    # ── 3. Static fallback ─────────────────────────────────────────────────
    return fallback_question(skill, tier)


def generate_project_question(skills: List[str], level: str, years: int) -> Dict[str, Any]:
    """
    Generate 1 closing project-experience question.
    Flow: Gemini → Groq/Llama → static fallback
    """
    tier = get_experience_tier(level, years)
    skills_str = ", ".join(skills[:4]) if skills else "programming"
    variation = random.randint(1000, 9999)

    if tier == "FRESHER":
        prompt = f"""You are a technical interviewer closing a freshers interview. [session:{variation}]
The candidate knows: {skills_str}.

Generate exactly 1 UNIQUE question asking about a college/personal project they built.
Focus on: what they built, what they learned, and which skills they used.
Keep it simple and encouraging for a fresher.

Output ONLY valid JSON object, no markdown:
{{"difficulty": "basic", "question": "...", "ideal_answer": "..."}}"""
    else:
        prompt = f"""You are a technical interviewer closing an experienced-candidate interview. [session:{variation}]
The candidate has {years} years of experience with: {skills_str}.

Generate exactly 1 UNIQUE question about their most impactful real project:
- What they built, their technical role, key decisions, and the outcome.

Output ONLY valid JSON object, no markdown:
{{"difficulty": "advanced", "question": "...", "ideal_answer": "..."}}"""

    # ── 1. Gemini ─────────────────────────────────────────────────────
    try:
        response = _client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
        )
        raw = response.text.strip()
        q = _parse_question_json(raw, "Projects",
                                  "basic" if tier == "FRESHER" else "advanced")
        q["skill"] = "Projects"
        logger.info(f"[Gemini] Project question: {q['question'][:60]}...")
        return q
    except Exception as e:
        logger.warning(f"Gemini project question failed: {e} — trying Groq")

    # ── 2. Groq/Llama fallback ───────────────────────────────────────────
    try:
        q = _generate_project_question_groq(skills_str, tier, years)
        logger.info(f"[Groq] Project question: {q['question'][:60]}...")
        return q
    except Exception as e:
        logger.error(f"Groq project question also failed: {e} — using static fallback")

    return fallback_project_question(skills_str, tier)


# ── General tech topics used to pad when resume has too few skills ────────────
_GENERAL_TOPICS = [
    "Data Structures", "Algorithms", "Object-Oriented Programming",
    "Database Design", "REST APIs", "Version Control", "Software Testing",
    "System Design", "Design Patterns", "Problem Solving",
    "Computer Networks", "Operating Systems", "Cloud Computing",
    "Agile Methodology", "Code Review", "Debugging",
]


def generate_questions_batch(skills: List[str], level: str, years: int,
                              max_skills: int = 11) -> List[Dict[str, Any]]:
    """
    Build the full 15-question technical interview set.

    Structure (always exactly 15):
      1. Intro question          (1)  — random, never AI-generated
      2. Definition questions   (11)  — concept/theory, one per skill
      3. Scenario questions      (2)  — situation/application, first 2 skills only
      4. Project question        (1)  — real project/experience

    Total = 1 + 11 + 2 + 1 = 15
    """
    tier = get_experience_tier(level, years)
    logger.info(
        f"Generating 4-question set for {tier} | "
        f"level={level} | years={years} | skills={skills}"
    )

    # ── Pad skills to always reach max_skills (11) ────────────────────────────
    padded_skills = [s.strip() for s in skills if s.strip()]
    if not padded_skills:
        padded_skills = ["General Programming"]

    general_pool = [t for t in _GENERAL_TOPICS if t not in padded_skills]
    random.shuffle(general_pool)
    while len(padded_skills) < max_skills and general_pool:
        padded_skills.append(general_pool.pop(0))

    selected_skills = padded_skills[:max_skills]   # 11 skills for definitions
    scenario_skills = selected_skills[:2]          # only first 2 get scenario questions

    logger.info(f"Skills (padded to {len(selected_skills)}): {selected_skills}")

    # ── 1. Intro question (random, no AI) ─────────────────────────────────────
    intro_text = random.choice(INTRO_QUESTIONS)
    intro_q = {
        "skill": "Introduction",
        "difficulty": "basic",
        "question_type": "intro",
        "question": intro_text,
        "ideal_answer": (
            "A concise, confident self-introduction covering the candidate's "
            "educational background, key skills, relevant experience, and "
            "what they are looking for in their next opportunity."
        ),
    }
    all_questions = [intro_q]
    logger.info(f"[Intro] {intro_text}")

    # ── 2. Definition questions — 11 questions (one per skill) ────────────────
    for skill in selected_skills:
        q = generate_question_for_skill(skill, level, years)
        q["question_type"] = "definition"
        all_questions.append(q)
        logger.info(f"[Definition] {skill}")

    # ── 3. Scenario questions — 2 questions (first 2 skills only) ─────────────
    for skill in scenario_skills:
        q = generate_scenario_question_for_skill(skill, level, years)
        all_questions.append(q)
        logger.info(f"[Scenario] {skill}")

    # ── 4. Project question ───────────────────────────────────────────────────
    project_q = generate_project_question(selected_skills, level, years)
    project_q["question_type"] = "project"
    all_questions.append(project_q)

    logger.info(
        f"Question set complete → Total: {len(all_questions)} "
        f"(1 intro + {len(selected_skills)} definition + "
        f"{len(scenario_skills)} scenario + 1 project)"
    )
    return all_questions


# ── Randomised Static Fallbacks ──────────────────────────────────────────────
# Used only when BOTH Gemini AND Groq fail.

_FRESHER_SKILL_Q = [
    ("What is {s} and why is it important in software development?",
     "A clear definition of {s}, its purpose, and why developers use it."),
    ("Can you explain how {s} works with a simple example?",
     "A high-level explanation of {s} with a beginner-friendly example."),
    ("When would you choose to use {s} in a project?",
     "Reasoning about the appropriate use cases and advantages of {s}."),
    ("What are the core concepts behind {s}?",
     "An explanation of the fundamental concepts and principles of {s}."),
    ("Can you describe a situation where {s} would be useful?",
     "A scenario where {s} solves a real problem, explained simply."),
    ("What is the main purpose of {s} and how does it help developers?",
     "An explanation of the problem {s} solves and how it helps in development."),
    ("How does {s} differ from similar technologies you know?",
     "A comparison highlighting {s}'s unique features vs alternatives."),
    ("What would happen if you didn't use {s} in a project that needs it?",
     "An explanation of the problems that arise without {s} and why it matters."),
]

_EXPERIENCED_SKILL_Q = [
    ("Describe a real situation where you used {s} to solve a production problem.",
     "A structured example with problem context, {s} application, trade-offs, and outcome."),
    ("What trade-offs have you encountered when using {s} in large-scale systems?",
     "A discussion of real trade-offs like performance vs cost, complexity vs maintainability."),
    ("How have you optimised {s} usage in a performance-critical scenario?",
     "Specific optimisations made with measurable impact on performance."),
    ("How would you design a system that relies heavily on {s}?",
     "An architectural overview covering scalability, reliability, and {s} integration."),
    ("What best practices do you follow when working with {s} in production?",
     "A set of battle-tested practices and conventions for production-grade {s} use."),
    ("What challenges have you faced with {s} and how did you overcome them?",
     "Specific challenges with concrete solutions demonstrating depth of {s} experience."),
    ("How do you debug or troubleshoot issues related to {s} in production?",
     "A step-by-step debugging approach with specific tools and strategies for {s}."),
    ("How does {s} fit into your overall system architecture decisions?",
     "A discussion of how {s} integrates with other components and influences architecture."),
]

_FRESHER_PROJECT_Q = [
    ("Tell me about a project you built — college, personal, or otherwise. "
     "What did you build, what skills did you use, and what did you learn?",
     "Project goal, technologies used, the candidate's role, challenges, and key learnings."),
    ("Can you walk me through a project you're proud of? What problem did it solve?",
     "Project purpose, implementation details, skills applied, and personal growth."),
    ("Describe a project where you applied your technical skills. What was the outcome?",
     "Technical approach, skills used, challenges overcome, and final result."),
    ("What is the most interesting project you have worked on and why?",
     "Project motivation, technical details, what made it interesting, and learnings."),
    ("Tell me about a project where you faced a technical challenge. How did you solve it?",
     "The challenge, thought process, the solution applied, and what was learned."),
    ("If you had to show me one project that represents your skills best, which would it be?",
     "Clear description of the project, technical decisions made, and outcome achieved."),
    ("Describe something you built from scratch. What was your development process?",
     "Planning, implementation steps, tools used, and the final delivered result."),
    ("What project taught you the most during your studies or personal time?",
     "The project, specific learnings, challenges encountered, and how they were handled."),
]

_EXPERIENCED_PROJECT_Q = [
    ("Walk me through the most impactful project you've worked on. "
     "What was your role and the outcome?",
     "Project scope, personal contributions, key decisions, and measurable impact."),
    ("Tell me about a technically challenging project you delivered. "
     "What made it hard and how did you succeed?",
     "Technical complexity, approach taken, trade-offs made, and successful delivery."),
    ("Describe a project where you had to make difficult architectural decisions. "
     "What did you choose and why?",
     "Architectural options, decision criteria, chosen approach, and results."),
    ("What is the largest-scale system you have worked on? "
     "How did you handle its complexity?",
     "Scale metrics, complexity challenges, solutions applied, and lessons learned."),
    ("Tell me about a project where something went wrong. How did you handle it?",
     "What went wrong, how it was identified, the fix implemented, and preventive measures."),
    ("Describe a project where you significantly improved performance or reliability.",
     "Baseline, problem identified, optimisation applied, and measurable improvement."),
    ("What is the project you are most proud of in your career? "
     "What was your specific contribution?",
     "Project overview, personal impact, technical decisions, and why it stands out."),
    ("Tell me about a project where you had to learn something entirely new to deliver it.",
     "What was learned, how quickly it was picked up, and how it was applied."),
]


def fallback_question(skill: str, tier: str) -> Dict[str, Any]:
    """Randomly pick a varied fallback question — never the same twice in a row."""
    pool = _FRESHER_SKILL_Q if tier == "FRESHER" else _EXPERIENCED_SKILL_Q
    q_tmpl, a_tmpl = random.choice(pool)
    difficulty = "basic" if tier == "FRESHER" else "intermediate"
    return {
        "skill": skill,
        "difficulty": difficulty,
        "question": q_tmpl.format(s=skill),
        "ideal_answer": a_tmpl.format(s=skill),
    }


def fallback_project_question(skills_str: str, tier: str) -> Dict[str, Any]:
    """Randomly pick a varied fallback project question."""
    pool = _FRESHER_PROJECT_Q if tier == "FRESHER" else _EXPERIENCED_PROJECT_Q
    q_tmpl, a_tmpl = random.choice(pool)
    difficulty = "basic" if tier == "FRESHER" else "advanced"
    return {
        "skill": "Projects",
        "difficulty": difficulty,
        "question_type": "project",
        "question": q_tmpl,
        "ideal_answer": a_tmpl,
    }


# ── Scenario Question Fallback Pools ─────────────────────────────────────────

_FRESHER_SCENARIO_Q = [
    ("You are building a student web app and need to add {s} functionality. "
     "How would you approach implementing it step by step?",
     "Break the task down: understand requirements, set up {s}, write core logic, test edge cases."),
    ("Imagine you are working on a team project and a bug appears related to {s}. "
     "How would you debug it?",
     "Reproduce the bug, isolate the cause, use logging/debugging tools for {s}, apply and verify the fix."),
    ("Your college project uses {s} but it is running slowly. "
     "What steps would you take to investigate and improve performance?",
     "Profile to find the bottleneck, check common {s} performance issues, apply fixes, measure improvement."),
    ("You need to explain how {s} works to a non-technical team member. "
     "How would you describe it and give a simple real-world analogy?",
     "Use a clear analogy, explain the core concept of {s} in simple terms, give an everyday example."),
    ("During a code review, your senior asks why you chose {s} over other options. "
     "How would you justify your decision?",
     "Compare {s} to alternatives, explain advantages for the use case, discuss trade-offs considered."),
    ("You are asked to add error handling for a {s}-related operation in your project. "
     "What approach would you take?",
     "Identify failure points, add try/catch or equivalent, log errors meaningfully, provide fallback behavior."),
    ("Your application using {s} works locally but fails after deployment. "
     "How would you troubleshoot this environment-specific issue?",
     "Compare local vs production environments, check configs, dependencies, logs, and {s} version differences."),
    ("You need to write unit tests for a module that uses {s}. "
     "How would you approach testing it effectively?",
     "Identify testable units, mock {s} dependencies, write tests covering happy path and edge cases."),
]

_EXPERIENCED_SCENARIO_Q = [
    ("Your production service's {s} component is experiencing sudden latency spikes. "
     "Walk me through your diagnosis and resolution process.",
     "Check monitoring/APM, identify bottleneck in {s}, apply targeted fix (e.g. caching, query tuning), validate."),
    ("Your team wants to migrate a legacy system to use {s}. "
     "How would you plan and execute this migration with minimal downtime?",
     "Assess scope, create migration plan, run parallel systems, incremental cutover, rollback strategy."),
    ("A critical security vulnerability is found in your {s} implementation. "
     "How do you respond and remediate it in a live production environment?",
     "Assess severity, apply hotfix or patch, communicate to stakeholders, post-mortem, add safeguards."),
    ("You are designing a new microservice that heavily relies on {s}. "
     "What architectural decisions would you make and why?",
     "Service boundaries, {s} integration patterns, resilience (retries, circuit breaker), monitoring strategy."),
    ("Your team is hitting the scalability limits of your current {s} setup. "
     "What strategies would you explore to scale it horizontally or vertically?",
     "Profiling to confirm bottleneck, horizontal vs vertical trade-offs, sharding/partitioning, load testing."),
    ("A junior developer on your team is misusing {s} in a way that causes subtle bugs. "
     "How would you identify this and coach them effectively?",
     "Code review process, explain correct {s} usage with examples, add linting or tests to prevent recurrence."),
    ("During peak traffic your {s}-based caching layer starts evicting too aggressively. "
     "How do you tune it and prevent data storms?",
     "Analyse eviction policy, tune TTL and max memory, add pre-warming, implement request coalescing."),
    ("You are asked to improve observability of your {s} component in production. "
     "What metrics, logs, and alerts would you instrument?",
     "Key metrics (latency, error rate, throughput), structured logging, distributed tracing, alert thresholds."),
]


def fallback_scenario_question(skill: str, tier: str) -> Dict[str, Any]:
    """Randomly pick a varied fallback scenario question."""
    pool = _FRESHER_SCENARIO_Q if tier == "FRESHER" else _EXPERIENCED_SCENARIO_Q
    q_tmpl, a_tmpl = random.choice(pool)
    difficulty = "basic" if tier == "FRESHER" else "intermediate"
    return {
        "skill": skill,
        "difficulty": difficulty,
        "question_type": "scenario",
        "question": q_tmpl.format(s=skill),
        "ideal_answer": a_tmpl.format(s=skill),
    }


# ── Scenario Question Generator ───────────────────────────────────────────────

def generate_scenario_question_for_skill(skill: str, level: str, years: int) -> Dict[str, Any]:
    """
    Generate exactly 1 scenario/situation-based technical question for a skill.
    Flow: Gemini (2 attempts) → Groq/Llama → static fallback
    """
    tier = get_experience_tier(level, years)
    variation = random.randint(1000, 9999)

    if tier == "FRESHER":
        difficulty = "basic"
        scenario_rules = (
            f"- Create a SIMPLE, RELATABLE scenario for a student or fresher involving {skill}\n"
            f"- Scenario context: college project, first job, small team assignment\n"
            f"- Ask what the candidate WOULD DO in that specific situation using {skill}\n"
            f"- Do NOT ask about production systems, architecture, or advanced optimisation\n"
            f"- Example style: 'You are building a student app and need to... How would you use {skill}?'"
        )
    else:
        difficulty = "intermediate"
        scenario_rules = (
            f"- Create a REALISTIC PRODUCTION scenario involving {skill}\n"
            f"- Include real-world constraints: performance, deadlines, team dynamics\n"
            f"- Ask how the candidate would diagnose, design, or resolve the situation\n"
            f"- Expect answers covering approach, trade-offs, and decision rationale\n"
            f"- Example style: 'Your {skill} service is causing X in production. How do you handle it?'"
        )

    prompt = f"""You are a technical interviewer. [session:{variation}]
Generate exactly 1 SCENARIO-BASED technical interview question for the skill '{skill}'.
Candidate: {tier}, {years} years experience.

Scenario Rules:
{scenario_rules}

IMPORTANT:
- The question MUST start with a situational opener: "You are...", "Imagine...", "Your team...", "During a..."
- The question must specifically require knowledge of '{skill}' to answer well
- Keep question to 2-3 sentences maximum
- The ideal answer should describe a step-by-step technical approach
- This is strictly a TECHNICAL scenario — no soft-skills or HR-style questions

Output ONLY valid JSON, no markdown:
{{"difficulty": "{difficulty}", "question": "...", "ideal_answer": "..."}}"""

    # ── 1. Gemini (2 attempts) ─────────────────────────────────────────────────
    for attempt in range(2):
        try:
            response = _client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
            )
            raw = response.text.strip()
            q = _parse_question_json(raw, skill, difficulty)
            q["question_type"] = "scenario"
            logger.info(f"[Gemini/{tier}] Scenario for '{skill}': {q['question'][:60]}...")
            return q

        except json.JSONDecodeError:
            break
        except Exception as e:
            err_str = str(e)
            if "Quota" in err_str or "quota" in err_str or "429" in err_str:
                logger.warning(f"Gemini quota/rate-limit for scenario '{skill}' — switching to Groq immediately")
                break   # don't retry — go straight to Groq
            logger.warning(f"Gemini scenario failed for '{skill}': {e} — trying Groq")
            break

    # ── 2. Groq/Llama fallback ────────────────────────────────────────────────
    try:
        from groq import Groq
        client = Groq(api_key=GROQ_API_KEY)
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are a strict technical interviewer. Return only valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_completion_tokens=300,
            stream=False
        )
        raw = completion.choices[0].message.content
        q = _parse_question_json(raw, skill, difficulty)
        q["question_type"] = "scenario"
        logger.info(f"[Groq/{tier}] Scenario for '{skill}': {q['question'][:60]}...")
        return q
    except Exception as e:
        logger.error(f"Groq scenario also failed for '{skill}': {e} — using static fallback")

    # ── 3. Static fallback ────────────────────────────────────────────────────
    return fallback_scenario_question(skill, tier)

