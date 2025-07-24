# Multi-stage build for single container deployment
# Stage 1: Build React frontend
FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# Stage 2: Python backend with embedded frontend
FROM ghcr.io/astral-sh/uv:0.7.8-python3.11-bookworm-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    fontconfig \ 
    && rm -rf /var/lib/apt/lists/*

# The source path `./fonts/` is relative to your Docker build context root.
COPY ./backend/app/assets/fonts/ /usr/share/fonts/truetype/custom/

# Rebuild the font cache to make the new fonts discoverable by name
RUN fc-cache -f -v

# Set working directory
WORKDIR /app

# Copy backend requirements and install Python dependencies
COPY backend/requirements.txt ./
RUN --mount=type=cache,target=/root/.cache/pip uv pip install --system --no-cache-dir -r requirements.txt
RUN python -c "import whisper; whisper.load_model('turbo')"
RUN python -m spacy download en_core_web_sm

# Copy backend code
COPY backend/app ./app

# Copy built frontend from stage 1
COPY --from=frontend-build /app/frontend/dist ./static

# Expose port
EXPOSE 8000

# Start the application using the start script
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]