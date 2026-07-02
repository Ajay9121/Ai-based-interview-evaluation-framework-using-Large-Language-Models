import logging
import os
import tempfile
from typing import Optional

logger = logging.getLogger(__name__)

# Whisper is optional - only load if available
_whisper_model = None

def _get_whisper():
    global _whisper_model
    if _whisper_model is None:
        try:
            import whisper
            model_name = os.getenv("WHISPER_MODEL", "base")
            logger.info(f"Loading Whisper model: {model_name}")
            _whisper_model = whisper.load_model(model_name)
            logger.info("Whisper model loaded successfully.")
        except ImportError:
            logger.warning("Whisper not installed. Audio transcription disabled.")
            return None
        except Exception as e:
            logger.error(f"Whisper load error: {e}")
            return None
    return _whisper_model


def transcribe_audio(audio_bytes: bytes, filename: str = "audio.webm") -> str:
    """Transcribe audio bytes using Whisper model."""
    whisper_model = _get_whisper()
    if whisper_model is None:
        logger.warning("Whisper unavailable. Returning empty transcript.")
        return ""

    try:
        # Write bytes to temp file
        suffix = os.path.splitext(filename)[1] or ".webm"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        result = whisper_model.transcribe(tmp_path)
        transcript = result.get("text", "").strip()
        logger.info(f"Transcribed {len(transcript)} characters from audio.")
        return transcript
    except Exception as e:
        logger.error(f"Transcription error: {e}")
        return ""
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass
