# Multi-stage build for single container deployment
# Stage 1: Build React frontend
FROM node:18-alpine AS frontend-build

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# Stage 2: Python backend with embedded frontend
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# # Install Ollama
# RUN curl -fsSL https://ollama.ai/install.sh | sh
# RUN ollama serve & \
#     sleep 10 && \
#     ollama pull alibayram/smollm3:latest

# Cache Models
RUN pip install openai-whisper
RUN python -c "import whisper; whisper.load_model('turbo')"

# Set working directory
WORKDIR /app

# Copy backend requirements and install Python dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install google-genai spacy
RUN python -m spacy download en_core_web_sm

# Copy backend code
COPY backend/app ./app

# Copy built frontend from stage 1
COPY --from=frontend-build /app/frontend/dist ./static

# Expose port
EXPOSE 8000

# Start the application using the start script
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]