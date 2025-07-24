import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .api import projects_router, websocket_router, youtube_router, config_router
from .api.fonts import router as fonts_router
from .core.config import settings
from .core.database import get_database
from .services import UnifiedVideoProcessor

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title=settings.app_name)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=settings.cors_credentials,
    allow_methods=settings.cors_methods,
    allow_headers=settings.cors_headers,
)

# Initialize unified video processor
video_processor = UnifiedVideoProcessor()

# Include API routers AFTER service initialization
app.include_router(projects_router, prefix=settings.api_prefix)
app.include_router(youtube_router, prefix=settings.api_prefix)
app.include_router(config_router, prefix=settings.api_prefix)
app.include_router(fonts_router, prefix=settings.api_prefix)
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
    await video_processor.process_youtube_video(url, project_id, resolution)

async def process_video_file_task(file_path: str, project_id: str):
    """Background task to process uploaded video file"""
    await video_processor.process_video_file(file_path, project_id)

async def export_video_task(project_id: str, video_path: str, config):
    """Background task to burn subtitles into video."""
    from .services.export_service import ExportService
    export_service = ExportService()
    # Convert the config to SubtitleConfig if it's a dict
    if isinstance(config, dict):
        from ..api.config import SubtitleConfig
        config = SubtitleConfig(**config)
    await export_service.burn_subtitles(project_id, export_format="hard", config=config)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)