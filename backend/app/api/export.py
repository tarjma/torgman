import asyncio
import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from ..core.config import settings
from ..services.project_manager import get_project_manager
from .config import SubtitleConfig
from .websocket import manager as websocket_manager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/projects", tags=["export"])

@router.post("/{project_id}/export")
async def export_project_video(project_id: str, config: SubtitleConfig):
    """Export video with burned-in subtitles"""
    project_manager = get_project_manager()
    
    # Check if project exists
    project = project_manager.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if project has subtitles
    project_dir = settings.get_project_dir(project_id)
    subtitles_path = project_dir / "subtitles.json"
    if not subtitles_path.exists():
        raise HTTPException(status_code=404, detail="No subtitles found for this project")
    
    # Check if original video exists
    video_path = None
    for ext in ['.mp4', '.webm', '.avi', '.mov', '.mkv']:
        potential_path = project_dir / f"{project_id}_video{ext}"
        if potential_path.exists():
            video_path = str(potential_path)
            break
    
    if not video_path:
        raise HTTPException(status_code=404, detail="Original video file not found")
    
    logger.info(f"Starting video export for project {project_id}")
    
    # Send initial status via WebSocket
    await websocket_manager.send_to_project(project_id, {
        "project_id": project_id,
        "type": "export_status",
        "status": "starting",
        "message": "بدء عملية تصدير الفيديو...",
        "progress": 0
    })
    
    # Start export task in background
    from ..tasks.video_processing import export_video_task
    asyncio.create_task(export_video_task(project_id, video_path, config))
    
    return {
        "message": "Video export started successfully",
        "project_id": project_id
    }

@router.get("/{project_id}/download-export/{filename}")
async def download_exported_video(project_id: str, filename: str):
    """Download an exported video file"""
    project_manager = get_project_manager()
    
    # Check if project exists
    project = project_manager.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Construct file path
    project_dir = settings.get_project_dir(project_id)
    file_path = project_dir / filename
    
    # Security check: ensure the file is within the project directory
    if not str(file_path.resolve()).startswith(str(project_dir.resolve())):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Check if file exists
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Export file not found")
    
    # Verify it's an export file (should contain "export" in the name)
    if "export" not in filename.lower():
        raise HTTPException(status_code=403, detail="Invalid export file")
    
    logger.info(f"Serving exported video: {file_path}")
    
    return FileResponse(
        path=str(file_path),
        filename=filename,
        media_type="video/mp4"
    )
