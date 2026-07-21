FROM python:3.12-slim

WORKDIR /app

# Install SQLite (already in slim) and system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY backend/requirements.txt /app/backend/requirements.txt
COPY poc/requirements.txt /app/poc/requirements.txt

RUN pip install --no-cache-dir \
    -r /app/poc/requirements.txt \
    -r /app/backend/requirements.txt

# Copy all application code
COPY poc/ /app/poc/
COPY backend/ /app/backend/

# API server imports from poc/ directory
ENV PYTHONPATH=/app/poc

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

CMD ["python", "/app/backend/api_server.py"]
