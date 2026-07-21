import os
from dotenv import load_dotenv

load_dotenv()

# ── Database ──
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "imt_poc")
DB_USER = os.getenv("DB_USER", "imt")
DB_PASSWORD = os.getenv("DB_PASSWORD", "imt_poc_2024")

DATABASE_URL = (
    f"postgresql+psycopg://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
)

# ── LLM Mode ──
# "offline" = random projection + template (zero external deps)
# "openai"  = OpenAI API (api.openai.com)
# "custom"  = custom OpenAI-compatible endpoint (Azure, local LLM, proxy)
LLM_MODE = os.getenv("LLM_MODE", "offline")

# Chat / completion
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1")
LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o")

# Embedding
LLM_EMBEDDING_MODEL = os.getenv("LLM_EMBEDDING_MODEL", "text-embedding-3-small")
LLM_EMBEDDING_DIM = int(os.getenv("LLM_EMBEDDING_DIM", "1536"))

# Local embedding (offline mode)
LOCAL_EMBEDDING_MODEL = os.getenv("LOCAL_EMBEDDING_MODEL", "all-MiniLM-L6-v2")

# ── Effective embedding dimension ──
EMBEDDING_DIM = LLM_EMBEDDING_DIM if LLM_MODE != "offline" else 384

# ── Retrieval hyperparameters ──
VECTOR_TOPK = 50
FTS_TOPK = 50
STRUCT_TOPK = 30
RRF_K = 60
MERGE_TOPK = 30
RERANK_TOPK = 10
FINAL_TOPK = 5
