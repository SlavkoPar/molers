# One image: Flask serves the API and the built React app.

# --- build the React app ---
FROM node:22-slim AS frontend
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# Vite bakes this public value into the bundle at build time (Render passes env vars as build args)
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
RUN npm run build

# --- run the Flask app ---
FROM python:3.13-slim
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app

COPY backend/requirements.txt backend/requirements.txt
RUN pip install -r backend/requirements.txt

COPY backend/ backend/
COPY --from=frontend /build/dist frontend/dist

# Render sets PORT. One worker: SQLite and the background transcription threads share its memory;
# the long timeout covers voice conversion plus the speech service.
CMD gunicorn --chdir backend app:app --bind 0.0.0.0:${PORT:-10000} --workers 1 --threads 4 --timeout 180
