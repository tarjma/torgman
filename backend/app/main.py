import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .api import projects_router, websocket_router, youtube_router
from .api.websocket import manager
from .core.config import settings
from .core.database import get_database
from .services import SubtitleGenerator, VideoFileProcessor, YouTubeVideoProcessor

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

# Initialize services
youtube_processor = YouTubeVideoProcessor()
subtitle_generator = SubtitleGenerator()
file_processor = VideoFileProcessor()

# Include API routers AFTER service initialization
app.include_router(projects_router, prefix=settings.api_prefix)
app.include_router(youtube_router, prefix=settings.api_prefix)
app.include_router(websocket_router)

# Add explicit routes for trailing slash issues
@app.get("/api/projects")
async def list_projects_no_slash(limit: int = 50, offset: int = 0):
    """List all projects - handle no trailing slash"""
    # Import here to avoid circular imports
    from .api.projects import list_projects
    return await list_projects(limit=limit, offset=offset)

@app.on_event("startup")
async def startup_event():
    """Initialize database and debug routes"""
    await get_database()  # Initialize database
    
    # Debug: Print registered routes
    logger.info("=== Registered Routes ===")
    for route in app.routes:
        if hasattr(route, 'path') and hasattr(route, 'methods'):
            logger.info(f"Route: {route.path} - Methods: {route.methods}")
        elif hasattr(route, 'path'):
            logger.info(f"Route: {route.path}")
    logger.info("=========================")
    
    logger.info("Application started successfully")

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}

@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    """Serve favicon with proper content type"""
    favicon_path = settings.static_dir / "favicon.ico"
    if favicon_path.exists():
        response = FileResponse(str(favicon_path), media_type="image/x-icon")
        # Add cache headers to ensure the favicon is properly cached
        response.headers["Cache-Control"] = "public, max-age=86400"  # Cache for 1 day
        return response
    else:
        # Fallback to a default response
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Favicon not found")

# Add additional favicon route without .ico extension for browsers that request it
@app.get("/favicon", include_in_schema=False)
async def favicon_no_ext():
    """Serve favicon without extension"""
    favicon_path = settings.static_dir / "favicon.ico"
    if favicon_path.exists():
        response = FileResponse(str(favicon_path), media_type="image/x-icon")
        response.headers["Cache-Control"] = "public, max-age=86400"
        return response
    else:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Favicon not found")

# Static files (for serving the frontend) - Mount after specific routes
if settings.static_dir.exists():
    # Mount assets directory for CSS, JS, etc.
    assets_dir = settings.static_dir / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")
    
    # Mount static files for favicon, manifest, etc. - Make sure this comes after specific routes
    app.mount("/static", StaticFiles(directory=str(settings.static_dir)), name="static")
    
    # Also try mounting a favicon-specific static handler
    favicon_dir = settings.static_dir  # This includes favicon.ico
    if (favicon_dir / "favicon.ico").exists():
        # This will allow /favicon.ico to be served from the static directory as well
        # The specific route above will take precedence, but this provides a fallback
        logger.info(f"Favicon found at: {favicon_dir / 'favicon.ico'}")

# Serve React frontend
@app.get("/{path:path}")
async def serve_frontend(path: str = ""):
    """Serve React frontend for all non-API routes"""
    # Check if it's an API route - these should be handled by the routers
    # Note: API routes have /api prefix, so check for api/ at start of path
    if path.startswith("api/") or path == "api":
        # This should not happen if routers are working correctly
        logger.warning(f"API path /{path} reached catch-all route - this indicates a routing issue")
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="API endpoint not found")
    
    # Check if it's a WebSocket route
    if path.startswith("ws") or path == "ws":
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="WebSocket endpoint not found")
    
    # For assets, let the static files handler manage them
    if path.startswith("assets/"):
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Asset not found")
    
    # Handle specific static files (though these should be handled by specific routes above)
    if path in ["favicon.ico", "manifest.json", "robots.txt"]:
        static_file = settings.static_dir / path
        if static_file.exists():
            # Set proper media type for favicon
            if path == "favicon.ico":
                return FileResponse(str(static_file), media_type="image/x-icon")
            elif path == "manifest.json":
                return FileResponse(str(static_file), media_type="application/json")
            else:
                return FileResponse(str(static_file))
        else:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail=f"{path} not found")
    
    # Serve index.html for all other routes (React Router will handle routing)
    index_file = settings.static_dir / "index.html"
    if index_file.exists():
        return FileResponse(str(index_file))
    else:
        return {"error": "Frontend not found", "message": "Static files not available"}

async def process_youtube_video_task(url: str, project_id: str, resolution: str = "720p"):
    """Background task to process YouTube video with enhanced features"""
    # Send initial status
    await manager.send_to_project(project_id, {
        "project_id": project_id,
        "type": "status",
        "status": "downloading_video",
        "progress": 5,
        "message": f"Downloading YouTube video in {resolution}..."
    })
    
    # Step 1: Download full video
    video_path = youtube_processor.download_video(url, project_id, resolution)
    
    await manager.send_to_project(project_id, {
        "project_id": project_id,
        "type": "status",
        "status": "downloading_thumbnail",
        "progress": 20,
        "message": "Downloading video thumbnail..."
    })
    
    # Step 2: Download thumbnail
    thumbnail_path = youtube_processor.download_thumbnail(url, project_id)
    
    await manager.send_to_project(project_id, {
        "project_id": project_id,
        "type": "status",
        "status": "extracting_audio",
        "progress": 35,
        "message": "Extracting audio from video..."
    })
    
    # Step 3: Extract audio
    audio_path = youtube_processor.extract_audio(video_path, project_id)
    
    await manager.send_to_project(project_id, {
        "project_id": project_id,
        "type": "status",
        "status": "generating_subtitles",
        "progress": 60,
        "message": "Generating subtitles with speech recognition..."
    })
    
    # Step 4: Generate subtitles (includes segmentation and transcription)
    subtitles = subtitle_generator.generate_transcription(audio_path)
    
    await manager.send_to_project(project_id, {
        "project_id": project_id,
        "type": "status",
        "status": "saving_data",
        "progress": 90,
        "message": "Saving project data..."
    })
    
    # Step 5: Save project metadata and subtitles
    project_dir = settings.get_project_dir(project_id)
    youtube_processor._save_project_metadata(
        project_dir, 
        project_id, 
        url, 
        resolution, 
        Path(video_path).name if video_path else "",
        Path(thumbnail_path).name if thumbnail_path else ""
    )
    youtube_processor._save_subtitles(project_dir, subtitles)
    
    # Step 6: Save subtitles to database
    db = await get_database()
    await db.save_subtitles(project_id, subtitles)
    
    # Update project status to completed
    await db.update_project_status(project_id, "completed", len(subtitles))
    
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
    
    # Send completion notification with file paths
    await manager.send_to_project(project_id, {
        "project_id": project_id,
        "type": "completion",
        "data": {
            "video_file": Path(video_path).name if video_path else "",
            "audio_file": f"{project_id}_audio.wav",
            "thumbnail_file": Path(thumbnail_path).name if thumbnail_path else "",
            "subtitle_count": len(subtitles)
        }
    })
    
    logger.info(f"YouTube video processing completed for project {project_id}")
    logger.info(f"Video file: {video_path}")
    logger.info(f"Audio file: {audio_path}")
    logger.info(f"Thumbnail file: {thumbnail_path}")

async def process_video_file_task(file_path: str, project_id: str):
    """Background task to process uploaded video file"""
    try:
        # Send initial status
        await manager.send_to_project(project_id, {
            "project_id": project_id,
            "type": "status",
            "status": "processing",
            "progress": 10,
            "message": "Processing uploaded video file..."
        })
        
        # Step 1: Extract video information and duration
        await manager.send_to_project(project_id, {
            "project_id": project_id,
            "type": "status",
            "status": "extracting_info",
            "progress": 20,
            "message": "Extracting video information..."
        })
        
        # Get video info (for future use, could be used to update duration)
        # video_info = file_processor.get_video_info(file_path)
        
        # Update project status to processing
        db = await get_database()
        await db.update_project_status(project_id, "processing", None)
        
        # Step 2: Extract audio
        await manager.send_to_project(project_id, {
            "project_id": project_id,
            "type": "status",
            "status": "extracting_audio",
            "progress": 40,
            "message": "Extracting audio from video file..."
        })
        
        audio_path = file_processor.extract_audio(file_path, project_id)
        
        await manager.send_to_project(project_id, {
            "project_id": project_id,
            "type": "status",
            "status": "generating_subtitles",
            "progress": 70,
            "message": "Generating subtitles with speech recognition..."
        })
        
        # Step 3: Generate subtitles (includes segmentation and transcription)
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
        await db.save_subtitles(project_id, subtitles)
        
        # Update project status to completed
        await db.update_project_status(project_id, "completed", len(subtitles))
        
        logger.info(f"File processing completed for project {project_id}")
        logger.info(f"Audio file preserved at: {audio_path}")
            
    except Exception as e:
        logger.error(f"Error processing file {project_id}: {str(e)}")
        await manager.send_to_project(project_id, {
            "project_id": project_id,
            "type": "error",
            "message": f"Processing failed: {str(e)}"
        })
        
        # Update project status to failed
        try:
            db = await get_database()
            await db.update_project_status(project_id, "failed", None)
        except Exception as db_error:
            logger.error(f"Failed to update project status: {db_error}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)