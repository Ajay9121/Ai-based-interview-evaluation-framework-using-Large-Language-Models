import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "your_gemini_api_key_here")
GEMINI_MODEL   = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
GROQ_API_KEY   = os.getenv("GROQ_API_KEY", "REMOVED_API_KEY")
UPLOAD_DIR     = os.getenv("UPLOAD_DIR", "/tmp/uploads")
WHISPER_MODEL  = os.getenv("WHISPER_MODEL", "base")
