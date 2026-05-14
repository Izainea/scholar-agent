###########################################################
# Scholar Agent backend — FastAPI + uvicorn
#
# Build context: scholar_agent_app/  (the root of this folder).
# That lets us COPY both `backend/` and the optional `scienti_sample/`.
###########################################################

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install runtime deps in their own layer (rarely invalidated).
RUN pip install --no-cache-dir \
        "fastapi>=0.115" \
        "uvicorn[standard]>=0.32" \
        "anthropic>=0.86" \
        "pyalex>=0.21" \
        "python-dotenv>=1.0" \
        "httpx>=0.27" \
        "pydantic>=2.9" \
        "aiq-quivers>=1.2.0"

# Copy the application + the bundled Scienti sample (~9MB, 100 CvLAC + 50 GrupLAC).
COPY backend/app /app/app
COPY scienti_sample /app/scienti_sample

# Copy the preprocessed author datasets that ship with the repo
# (Ringel, Schroll, Green, ... — see backend/data/*.json). `_raw.json`
# (OpenAlex cache) and `registry.json` (per-instance state) are kept
# out of git on purpose, so only the slim preprocessed files are bundled.
COPY backend/data /app/data

# Persistent locations.
ENV SCHOLAR_DATA_DIR=/app/data \
    SCIENTI_DATA_DIR=/app/scienti_sample \
    PYTHONPATH=/app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -fsS http://localhost:8000/health || exit 1

# Railway provides PORT; default to 8000 locally.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
