import asyncio
import logging
from pathlib import Path
from typing import List

import ffmpeg
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from ..core.config import settings
from ..core.database import get_database
from ..models.project import ProjectData

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/projects", tags=["projects"])

@router.get("/", response_model=List[ProjectData])
@router.get("", response_model=List[ProjectData])  # Handle both with and without trailing slash
async def list_projects(limit: int = 50, offset: int = 0):
    """List all projects with pagination"""
    db = await get_database()
    projects = await db.list_projects(limit=limit, offset=offset)
    # Ensure we always return a list
    if projects is None:
        return []
    return projects

@router.get("/{project_id}", response_model=ProjectData)
async def get_project(project_id: str):
    """Get a project by ID"""
    db = await get_database()
    project = await db.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.delete("/{project_id}")
async def delete_project(project_id: str):
    """Delete a project and its associated files"""
    db = await get_database()
    # Check if project exists
    project = await db.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Delete from database
    success = await db.delete_project(project_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete project from database")
    
    return {"message": "Project deleted successfully"}

@router.put("/{project_id}/status")
async def update_project_status(project_id: str, status_data: dict):
    """Update project status"""
    db = await get_database()
    # Check if project exists
    project = await db.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    new_status = status_data.get("status")
    subtitle_count = status_data.get("subtitle_count")
    
    success = await db.update_project_status(project_id, new_status, subtitle_count)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update project status")
    
    return {"message": "Project status updated successfully"}

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
    file_extension = Path(file.filename).suffix if file.filename else '.mp4'
    file_path = project_dir / f"{project_id}_video{file_extension}"
    
    # Save file to disk
    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)
    
    # Get video duration using ffmpeg
    try:
        probe = ffmpeg.probe(str(file_path))
        duration = float(probe['streams'][0]['duration'])
    except Exception as e:
        logger.warning(f"Could not get video duration: {e}")
        duration = 0.0
    
    # Save to database
    db = await get_database()
    project_data = {
        "id": project_id,
        "title": title,
        "description": description,
        "duration": duration,
        "status": "processing"
    }
    
    success = await db.create_project(project_data)
    if not success:
        # Clean up file if database creation fails
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(status_code=500, detail="Failed to create project in database")

    # Start background processing
    from ..tasks.video_processing import process_video_file_task
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
    """Get project thumbnail"""
    db = await get_database()
    project = await db.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Look for thumbnail file
    project_dir = settings.get_project_dir(project_id)
    
    # Try different thumbnail extensions
    for ext in ['.webp', '.jpg', '.jpeg', '.png']:
        thumbnail_path = project_dir / f"{project_id}_thumbnail{ext}"
        if thumbnail_path.exists():
            return FileResponse(
                path=str(thumbnail_path),
                media_type=f"image/{ext[1:]}" if ext != '.jpg' else "image/jpeg"
            )
    
    # If no specific thumbnail found, try to find any thumbnail file
    thumbnail_files = list(project_dir.glob("*thumbnail*"))
    if thumbnail_files:
        thumbnail_path = thumbnail_files[0]
        # Determine media type based on extension
        ext = thumbnail_path.suffix.lower()
        media_type = {
            '.webp': 'image/webp',
            '.jpg': 'image/jpeg', 
            '.jpeg': 'image/jpeg',
            '.png': 'image/png'
        }.get(ext, 'image/jpeg')
        
        return FileResponse(
            path=str(thumbnail_path),
            media_type=media_type
        )
    
    raise HTTPException(status_code=404, detail="Thumbnail not found")

@router.get("/{project_id}/video")
async def get_project_video(project_id: str):
    """Get project video file"""
    db = await get_database()
    project = await db.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Look for video file
    project_dir = settings.get_project_dir(project_id)
    
    # Try different video extensions
    for ext in ['.mp4', '.webm', '.avi', '.mov', '.mkv']:
        video_path = project_dir / f"{project_id}_video{ext}"
        if video_path.exists():
            return FileResponse(
                path=str(video_path),
                media_type="video/mp4"
            )
    
    # If no specific video found, try to find any video file
    video_files = []
    for pattern in ["*video*", "*.mp4", "*.webm", "*.avi", "*.mov", "*.mkv"]:
        video_files.extend(project_dir.glob(pattern))
    
    if video_files:
        # Sort by modification time, get the most recent
        video_path = max(video_files, key=lambda p: p.stat().st_mtime)
        return FileResponse(
            path=str(video_path),
            media_type="video/mp4"
        )
    
    raise HTTPException(status_code=404, detail="Video file not found")
