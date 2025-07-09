from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from typing import List
import logging
from pathlib import Path

from ..core.database import get_database
from ..models.project import ProjectData, CaptionData
from ..core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/projects", tags=["projects"])

@router.get("/", response_model=List[ProjectData])
@router.get("", response_model=List[ProjectData])  # Handle both with and without trailing slash
async def list_projects(limit: int = 50, offset: int = 0):
    """List all projects with pagination"""
    try:
        db = await get_database()
        projects = await db.list_projects(limit=limit, offset=offset)
        # Ensure we always return a list
        if projects is None:
            return []
        return projects
    except Exception as e:
        logger.error(f"Error listing projects: {e}")
        # Return empty list instead of raising exception to prevent frontend errors
        return []

@router.get("/{project_id}", response_model=ProjectData)
async def get_project(project_id: str):
    """Get a project by ID"""
    try:
        db = await get_database()
        project = await db.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        return project
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting project {project_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get project: {str(e)}")

@router.get("/{project_id}/subtitles", response_model=List[CaptionData])
async def get_project_subtitles(project_id: str):
    """Get subtitles for a project"""
    db = await get_database()
    # Check if project exists
    project = await db.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    subtitles = db.get_project_subtitles(project_id)
    return subtitles

@router.delete("/{project_id}")
async def delete_project(project_id: str):
    """Delete a project and its subtitles"""
    try:
        db = await get_database()
        # Check if project exists
        project = await db.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        success = await db.delete_project(project_id)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to delete project")
        
        return {"message": "Project deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting project {project_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete project: {str(e)}")

@router.put("/{project_id}/status")
async def update_project_status(project_id: str, status: str, subtitle_count: int = None):
    """Update project status"""
    try:
        db = await get_database()
        # Check if project exists
        project = await db.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        success = await db.update_project_status(project_id, status, subtitle_count)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to update project status")
        
        return {"message": "Project status updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating project status {project_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update project status: {str(e)}")

@router.post("/upload")
async def upload_project_file(
    file: UploadFile = File(...),
    project_id: str = Form(...),
    title: str = Form(...),
    description: str = Form(None),
):
    """Create a new project and upload video file"""
    # Validate file type
    if not file.content_type or not file.content_type.startswith('video/'):
        raise HTTPException(status_code=400, detail="File must be a video")
    
    # Create project directory
    project_dir = settings.get_project_dir(project_id)
    project_dir.mkdir(parents=True, exist_ok=True)
    
    # Save uploaded file
    file_path = project_dir / f"{project_id}_video{Path(file.filename).suffix}"
    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)
    
    # Get video duration (basic approach)
    # TODO: Implement proper video duration extraction
    duration = 0.0
    
    # Create project in database
    db = await get_database()
    project_data = {
        "id": project_id,
        "title": title,
        "description": description,
        "duration": duration,
        "status": "processing",  # Set to processing since we'll start processing
    }
    
    success = await db.create_project(project_data)
    if not success:
        # Clean up file if database creation fails
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(status_code=500, detail="Failed to create project in database")
    
    # Start background file processing (import here to avoid circular imports)
    import asyncio
    from ..main import process_video_file_task
    asyncio.create_task(process_video_file_task(
        str(file_path), 
        project_id, 
    ))
    
    return {
        "project_id": project_id,
        "status": "processing",
        "message": "Project created successfully, processing started"
    }
        
@router.get("/{project_id}/thumbnail")
async def get_project_thumbnail(project_id: str):
    """Get project thumbnail image"""
    project_dir = settings.get_project_dir(project_id)
    
    # Look for thumbnail files with different extensions
    thumbnail_extensions = ['jpg', 'jpeg', 'png', 'webp']
    thumbnail_file = None
    
    for ext in thumbnail_extensions:
        potential_file = project_dir / f"{project_id}_thumbnail.{ext}"
        if potential_file.exists():
            thumbnail_file = potential_file
            break
    
    if not thumbnail_file:
        raise HTTPException(status_code=404, detail="Thumbnail not found")
    
    # Determine media type based on file extension
    ext = thumbnail_file.suffix.lower()
    if ext in ['.jpg', '.jpeg']:
        media_type = 'image/jpeg'
    elif ext == '.png':
        media_type = 'image/png'
    elif ext == '.webp':
        media_type = 'image/webp'
    else:
        media_type = 'image/jpeg'  # Default fallback
    
    return FileResponse(
        str(thumbnail_file),
        media_type=media_type,
        headers={
            "Cache-Control": "public, max-age=3600",  # Cache for 1 hour
            "Access-Control-Allow-Origin": "*"
        }
    )
    
@router.get("/{project_id}/video")
async def get_project_video(project_id: str):
    """Get project video file"""
    project_dir = settings.get_project_dir(project_id)
    
    # Look for video files with different extensions
    video_extensions = ['mp4', 'webm', 'mkv', 'avi', 'mov']
    video_file = None
    
    for ext in video_extensions:
        potential_file = project_dir / f"{project_id}_video.{ext}"
        if potential_file.exists():
            video_file = potential_file
            break
    
    if not video_file:
        raise HTTPException(status_code=404, detail="Video file not found")
    
    # Determine media type based on file extension
    ext = video_file.suffix.lower()
    if ext == '.mp4':
        media_type = 'video/mp4'
    elif ext == '.webm':
        media_type = 'video/webm'
    elif ext == '.mkv':
        media_type = 'video/x-matroska'
    elif ext == '.avi':
        media_type = 'video/x-msvideo'
    elif ext == '.mov':
        media_type = 'video/quicktime'
    else:
        media_type = 'video/mp4'  # Default fallback
    
    return FileResponse(
        str(video_file),
        media_type=media_type,
        headers={
            "Cache-Control": "public, max-age=3600",  # Cache for 1 hour
            "Access-Control-Allow-Origin": "*"
        }
    )
