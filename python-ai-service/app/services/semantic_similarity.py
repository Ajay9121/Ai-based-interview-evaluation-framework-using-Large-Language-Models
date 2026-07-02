import logging
from typing import Optional

try:
    import numpy as np
except ImportError:
    np = None

try:
    from sentence_transformers import SentenceTransformer
except ImportError:
    SentenceTransformer = None

try:
    from sklearn.metrics.pairwise import cosine_similarity as _sklearn_cosine
    def cosine_similarity(a, b):
        return _sklearn_cosine(a, b)
except ImportError:
    def cosine_similarity(a, b):
        # Pure-numpy cosine similarity fallback
        import numpy as _np
        a_vec = _np.array(a[0])
        b_vec = _np.array(b[0])
        dot = _np.dot(a_vec, b_vec)
        norm = _np.linalg.norm(a_vec) * _np.linalg.norm(b_vec)
        return [[float(dot / norm) if norm > 0 else 0.0]]

logger = logging.getLogger(__name__)

# Load model once at startup (downloads automatically on first run)
_model: Optional[SentenceTransformer] = None

def get_model():
    global _model
    if SentenceTransformer is None:
        raise ImportError("sentence-transformers is not installed")
    if _model is None:
        logger.info("Loading Sentence-Transformer model (all-MiniLM-L6-v2)...")
        _model = SentenceTransformer("all-MiniLM-L6-v2")
        logger.info("Sentence-Transformer model loaded.")
    return _model


def compute_similarity(candidate_answer: str, ideal_answer: str) -> float:
    """Compute cosine similarity between candidate answer and ideal answer.
    Returns a score between 0 and 100.
    """
    if not candidate_answer or not candidate_answer.strip():
        return 0.0
    if not ideal_answer or not ideal_answer.strip():
        return 50.0  # No ideal to compare against

    try:
        model = get_model()
        embeddings = model.encode([candidate_answer.strip(), ideal_answer.strip()])
        similarity = cosine_similarity([embeddings[0]], [embeddings[1]])[0][0]
        # Convert from [-1, 1] range to [0, 100]
        score = float(max(0.0, min(1.0, similarity))) * 100
        return round(score, 2)
    except Exception as e:
        logger.error(f"Similarity computation error: {e}")
        return 0.0
