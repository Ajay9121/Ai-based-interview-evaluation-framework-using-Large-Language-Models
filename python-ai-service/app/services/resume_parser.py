import re
import io
import logging
from typing import List, Dict, Any

try:
    import spacy
    try:
        nlp = spacy.load("en_core_web_sm")
    except OSError:
        logging.getLogger(__name__).warning("spaCy model 'en_core_web_sm' not found.")
        nlp = None
except ImportError:
    spacy = None
    nlp = None

from PyPDF2 import PdfReader
import docx

logger = logging.getLogger(__name__)

KNOWN_SKILLS = [
    "Python", "Java", "JavaScript", "TypeScript", "C++", "C#", "Go", "Rust", "Ruby", "PHP",
    "Spring Boot", "Spring", "Django", "Flask", "FastAPI", "Node.js", "React", "Angular",
    "Vue.js", "Next.js", "Express", "Hibernate", "JPA", "REST", "GraphQL", "gRPC",
    "MySQL", "PostgreSQL", "SQLite", "MongoDB", "Redis", "Elasticsearch", "DynamoDB",
    "Docker", "Kubernetes", "AWS", "Azure", "GCP", "Terraform", "Ansible",
    "Git", "CI/CD", "Jenkins", "GitHub Actions", "Linux", "Kafka", "RabbitMQ",
    "Machine Learning", "Deep Learning", "TensorFlow", "PyTorch", "NLP", "OpenCV",
    "HTML", "CSS", "Tailwind", "Bootstrap", "SASS", "SQL", "NoSQL", "Microservices",
    "DevOps", "Agile", "Scrum", "TDD", "System Design", "Data Structures", "Algorithms"
]

KNOWN_SKILLS_LOWER = {s.lower(): s for s in KNOWN_SKILLS}

JOB_TITLE_PATTERNS = [
    r"software engineer", r"software developer", r"backend developer", r"frontend developer",
    r"full.?stack developer", r"data scientist", r"ml engineer", r"devops engineer",
    r"cloud engineer", r"architect", r"tech lead", r"senior developer", r"junior developer"
]

def extract_text_from_pdf(file_bytes: bytes) -> str:
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
        text = ""
        for page in reader.pages:
            text += page.extract_text() or ""
        return text
    except Exception as e:
        logger.error(f"PDF extraction error: {e}")
        return ""

def extract_text_from_docx(file_bytes: bytes) -> str:
    try:
        doc = docx.Document(io.BytesIO(file_bytes))
        return "\n".join([para.text for para in doc.paragraphs])
    except Exception as e:
        logger.error(f"DOCX extraction error: {e}")
        return ""

def extract_skills(text: str) -> List[str]:
    found_skills = set()
    text_lower = text.lower()

    # Match against known skills list
    for skill_lower, skill_name in KNOWN_SKILLS_LOWER.items():
        if re.search(r'\b' + re.escape(skill_lower) + r'\b', text_lower):
            found_skills.add(skill_name)

    # NLP-based extraction
    if nlp:
        doc = nlp(text[:5000])  # limit for performance
        for ent in doc.ents:
            if ent.label_ in ("ORG", "PRODUCT", "WORK_OF_ART"):
                candidate = ent.text.strip()
                if candidate.lower() in KNOWN_SKILLS_LOWER:
                    found_skills.add(KNOWN_SKILLS_LOWER[candidate.lower()])

    return sorted(list(found_skills))

def extract_experience_years(text: str) -> int:
    patterns = [
        r'(\d+)\+?\s*years?\s+(?:of\s+)?(?:professional\s+)?experience',
        r'(\d+)\+?\s*years?\s+(?:in|of)\s+\w+',
        r'experience\s+of\s+(\d+)\+?\s*years?',
    ]
    years_found = []
    for pattern in patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        years_found.extend([int(m) for m in matches])

    return max(years_found) if years_found else 0

def determine_level(years: int) -> str:
    if years < 2:
        return "junior"
    elif years < 5:
        return "mid"
    else:
        return "senior"

def parse_resume(file_bytes: bytes, filename: str) -> Dict[str, Any]:
    # Extract text
    if filename.lower().endswith(".pdf"):
        text = extract_text_from_pdf(file_bytes)
    elif filename.lower().endswith(".docx"):
        text = extract_text_from_docx(file_bytes)
    else:
        text = file_bytes.decode("utf-8", errors="ignore")

    if not text:
        return {"skills": [], "experience_years": 0, "level": "junior"}

    skills = extract_skills(text)
    years = extract_experience_years(text)
    level = determine_level(years)

    return {
        "skills": skills if skills else ["General Programming"],
        "experience_years": years,
        "level": level
    }
