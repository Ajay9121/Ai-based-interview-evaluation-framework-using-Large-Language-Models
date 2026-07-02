"""
Quick smoke test: simulate what happens when an interview starts.
Runs generate_questions_batch with sample skills and prints all questions.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.chdir(os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from app.services.question_generator import generate_questions_batch

print("=" * 60)
print("GENERATING QUESTIONS (run 1)")
print("=" * 60)
questions = generate_questions_batch(
    skills=["Python", "SQL"],
    level="junior",
    years=0,
    max_skills=4
)
for i, q in enumerate(questions):
    print(f"\nQ{i+1} [{q['skill']} / {q['difficulty']}]")
    print(f"  {q['question']}")

print("\n" + "=" * 60)
print("GENERATING QUESTIONS (run 2 — should be DIFFERENT)")
print("=" * 60)
questions2 = generate_questions_batch(
    skills=["Python", "SQL"],
    level="junior",
    years=0,
    max_skills=4
)
for i, q in enumerate(questions2):
    print(f"\nQ{i+1} [{q['skill']} / {q['difficulty']}]")
    print(f"  {q['question']}")
