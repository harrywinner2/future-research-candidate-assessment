# ---------- Stage 1: build the React frontend ----------
FROM node:20-slim AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
# Production build: VITE_API_BASE is empty so the SPA talks to the same origin
# (FastAPI serves both the app and the API in the final image).
RUN npm run build

# ---------- Stage 2: Python API that also serves the built SPA ----------
FROM python:3.11-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
COPY app ./app
COPY exercises.json ./exercises.json
COPY scripts ./scripts
RUN pip install --upgrade pip && pip install -e .

# Drop the built SPA where app.main._mount_frontend looks for it.
COPY --from=web /web/dist ./app/static

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=5 \
    CMD curl -fsS http://localhost:${PORT:-8000}/health || exit 1

# Railway (and most PaaS) inject $PORT; default to 8000 locally.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
