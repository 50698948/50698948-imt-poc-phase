import os
from dotenv import load_dotenv

load_dotenv()

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "imt_poc")
DB_USER = os.getenv("DB_USER", "imt")
DB_PASSWORD = os.getenv("DB_PASSWORD", "imt_poc_2024")

LOCAL_EMBEDDING_MODEL = os.getenv("LOCAL_EMBEDDING_MODEL", "all-MiniLM-L6-v2")
EMBEDDING_DIM = 384

VECTOR_TOPK = 50
FTS_TOPK = 50
STRUCT_TOPK = 30
RRF_K = 60
MERGE_TOPK = 30
RERANK_TOPK = 10
FINAL_TOPK = 5

DATABASE_URL = (
    f"postgresql+psycopg://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
)
