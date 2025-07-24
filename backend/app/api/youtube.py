from fastapi import APIRouter, HTTPException
import logging
import asyncio

from ..models.project import YouTubeProcessRequest
from ..services.youtube_service import YouTubeVideoProcessor
from ..core.database import get_database
from ..utils.youtube_utils import extract_youtube_id, validate_youtube_url

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/youtube", tags=["youtube"])

# Initialize YouTube processor
youtube_processor = YouTubeVideoProcessor()

@router.get("/info")
async def get_youtube_info(url: str):
    """Extract YouTube video information"""
    if not validate_youtube_url(url):
        raise HTTPException(status_code=400, detail="Invalid YouTube URL")
    
    logger.info(f"Fetching YouTube video info for URL: {url}")
    video_info = youtube_processor.get_video_info(url)
    # 1. Filter for video formats that have resolution data
    video_formats = [
        f for f in video_info.get('formats', []) 
        if f.get('vcodec') != 'none' and f.get('height') is not None
    ]
    
    # 2. Extract the height and create a user-friendly string (e.g., "1080p")
    #    Use a set to automatically handle duplicates.
    resolutions = set(f'{f["height"]}p' for f in video_formats)
    
    # 3. Sort the resolutions numerically from highest to lowest
    #    A simple string sort would fail (e.g., '720p' > '1080p')
    sorted_resolutions = sorted(
        list(resolutions),
        key=lambda r: int(r.replace('p', '')), 
        reverse=True
    )
    
    # 4. Determine a recommended resolution (usually the best available)
    recommended_resolution = sorted_resolutions[0] if sorted_resolutions else "N/A"
    
    return {
        "video_id": extract_youtube_id(url),
        "title": video_info.get("title"),
        "duration": video_info.get("duration"),
        "thumbnail": video_info.get("thumbnail"),
        "uploader": video_info.get("uploader"),
        "description": video_info.get("description"),
        "available_resolutions": sorted_resolutions,
        "recommended_resolution": recommended_resolution
    }

@router.post("/process")
async def process_youtube_video(request: YouTubeProcessRequest):
    """Create a new project and start processing YouTube video"""
    if not validate_youtube_url(request.url):
        raise HTTPException(status_code=400, detail="Invalid YouTube URL")
    
    # Get video info
    video_info = request.video_info or youtube_processor.get_video_info(request.url)
    
    # Create project in database
    db = await get_database()
    project_data = {
        "id": request.project_id,
        "title": video_info.get("title", "YouTube Video"),
        "youtube_url": request.url,
        "duration": video_info.get("duration", 0),
        "status": "processing",
    }
    
    # Save to database
    success = await db.create_project(project_data)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to create project in database")
    
    # Start background processing (import here to avoid circular imports)
    from ..main import process_youtube_video_task
    asyncio.create_task(process_youtube_video_task(
        request.url, 
        request.project_id, 
        request.resolution
    ))
    
    return {
        "project_id": request.project_id,
        "status": "processing",
        "message": "Project created, processing started"
    }
    
