from fastapi import APIRouter, HTTPException
import logging
import asyncio

from ..models.project import YouTubeProcessRequest
from ..services.youtube_service import YouTubeAudioProcessor
from ..core.database import get_database
from ..utils.youtube_utils import extract_youtube_id, validate_youtube_url

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/youtube", tags=["youtube"])

# Initialize YouTube processor
youtube_processor = YouTubeAudioProcessor()

@router.get("/info")
async def get_youtube_info(url: str):
    """Extract YouTube video information"""
    try:
        if not validate_youtube_url(url):
            raise HTTPException(status_code=400, detail="Invalid YouTube URL")
        
        video_info = youtube_processor.get_video_info(url)
        format_info = youtube_processor.get_available_formats(url)
        
        return {
            "title": video_info.get("title", "Unknown Title"),
            "duration": video_info.get("duration", 0),
            "thumbnail": video_info.get("thumbnail"),
            "video_id": extract_youtube_id(url),
            "uploader": video_info.get("uploader"),
            "description": video_info.get("description", ""),
            "available_resolutions": format_info.get("available_resolutions", ["720p"]),
            "recommended_resolution": format_info.get("recommended", "720p")
        }
    except Exception as e:
        logger.error(f"Error getting YouTube info: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get video info: {str(e)}")

@router.post("/process")
async def process_youtube_video(request: YouTubeProcessRequest):
    """Create a new project and start processing YouTube video"""
    try:
        if not validate_youtube_url(request.url):
            raise HTTPException(status_code=400, detail="Invalid YouTube URL")
        
        # Get video info
        video_info = youtube_processor.get_video_info(request.url)
        
        # Create project in database
        db = await get_database()
        project_data = {
            "id": request.project_id,
            "title": video_info.get("title", "YouTube Video"),
            "youtube_url": request.url,
            "duration": video_info.get("duration", 0),
            "status": "processing",
            "language": request.language
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
            request.language,
            request.resolution
        ))
        
        return {
            "project_id": request.project_id,
            "status": "processing",
            "message": "Project created, processing started"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating project: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create project: {str(e)}")
