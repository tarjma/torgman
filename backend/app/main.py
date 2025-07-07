from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
import logging

from .core.config import settings
from .core.database import get_database
from .services import YouTubeAudioProcessor, SubtitleGenerator
from .api import projects_router, youtube_router, websocket_router
from .api.websocket import manager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title=settings.app_name, version=settings.app_version)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=settings.cors_credentials,
    allow_methods=settings.cors_methods,
    allow_headers=settings.cors_headers,
)

# Static files (for serving the frontend)
if settings.static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(settings.static_dir)), name="static")

# Include API routers
app.include_router(projects_router, prefix=settings.api_prefix)
app.include_router(youtube_router, prefix=settings.api_prefix)
app.include_router(websocket_router)

# Initialize services
youtube_processor = YouTubeAudioProcessor()
subtitle_generator = SubtitleGenerator()

@app.on_event("startup")
async def startup_event():
    """Initialize database"""
    await get_database()  # Initialize database
    logger.info("Application started successfully")

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "torgman-backend"}

async def process_youtube_video_task(url: str, project_id: str, language: str = "ar", resolution: str = "720p"):
    """Background task to process YouTube video"""
    try:
        # Send initial status
        await manager.send_to_project(project_id, {
            "project_id": project_id,
            "type": "status",
            "status": "downloading_audio",
            "progress": 10,
            "message": f"Extracting audio from YouTube video in {resolution}..."
        })
        
        # Step 1: Extract audio
        audio_path = youtube_processor.extract_audio(url, project_id, resolution)
        
        await manager.send_to_project(project_id, {
            "project_id": project_id,
            "type": "status",
            "status": "generating_subtitles",
            "progress": 60,
            "message": "Generating subtitles with speech recognition..."
        })
        
        # Step 2: Generate subtitles (includes segmentation and transcription)
        subtitles = subtitle_generator.generate_transcription(audio_path)
        
        await manager.send_to_project(project_id, {
            "project_id": project_id,
            "type": "status",
            "status": "completed",
            "progress": 100,
            "message": "Processing completed successfully!"
        })
        
        # Send final subtitles
        await manager.send_to_project(project_id, {
            "project_id": project_id,
            "type": "subtitles",
            "data": subtitles
        })
        
        # Save subtitles to database
        db = await get_database()
        await db.save_subtitles(project_id, subtitles)
        
        # Clean up temporary audio file
        if os.path.exists(audio_path):
            os.remove(audio_path)
            
    except Exception as e:
        logger.error(f"Error processing video {project_id}: {str(e)}")
        await manager.send_to_project(project_id, {
            "project_id": project_id,
            "type": "error",
            "message": f"Processing failed: {str(e)}"
        })

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)