import asyncio
import json
import logging
from pathlib import Path
from typing import List, Dict

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
import ffmpeg

from ..core.config import settings
from ..core.database import get_database
from ..models.project import CaptionData, ProjectData
from ..services.translation_service import TranslationGenerator
from ..services.export_service import ExportService
from .websocket import manager as websocket_manager
from .config import SubtitleConfig

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
    db = await get_database()
    # Check if project exists
    project = await db.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    success = await db.delete_project(project_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete project")
    
    return {"message": "Project deleted successfully"}

@router.put("/{project_id}/status")
async def update_project_status(project_id: str, status: str, subtitle_count: int = None):
    """Update project status"""
    db = await get_database()
    # Check if project exists
    project = await db.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    success = await db.update_project_status(project_id, status, subtitle_count)
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
    file_path = project_dir / f"{project_id}_video{Path(file.filename).suffix}"
    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)
    
    # Get video duration using ffmpeg probe
    try:
        probe = ffmpeg.probe(str(file_path))
        duration = float(probe['format']['duration'])
        logger.info(f"Video duration extracted using ffmpeg: {duration} seconds")
    except ffmpeg.Error as e:
        error_message = e.stderr.decode() if e.stderr else str(e)
        logger.error(f"ffmpeg duration extraction failed: {error_message}")
        # Set default duration if extraction fails
        duration = 0
        logger.warning("Using default duration (0) due to extraction failure")
    except Exception as e:
        logger.error(f"Unexpected error during duration extraction: {e}")
        duration = 0

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

@router.post("/{project_id}/translate")
async def translate_project_subtitles(project_id: str):
    """Translate project subtitles to Arabic"""
    db = await get_database()
    # Check if project exists
    project = await db.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get current subtitles
    subtitles = db.get_project_subtitles(project_id)
    if not subtitles:
        raise HTTPException(status_code=404, detail="No subtitles found for this project")
    
    # Send immediate response and process translation in background
    asyncio.create_task(translate_project_background(project_id, subtitles))
    
    return {
        "message": "Translation started successfully",
        "subtitle_count": len(subtitles),
        "status": "processing"
    }

async def translate_project_background(project_id: str, subtitles):
    """Background task to translate project subtitles"""
    # Send status update that translation started
    try:
        await websocket_manager.send_to_project(project_id, {
            "project_id": project_id,
            "type": "status",
            "status": "translating",
            "message": "Translation in progress..."
        })
        
        # Translate subtitles
        translation_generator = TranslationGenerator()
        translated_subtitles = translation_generator.translate_transcription(subtitles)
        
        # Save to project directory
        project_dir = settings.get_project_dir(project_id)
        translation_generator._save_subtitles(project_dir, translated_subtitles)
        
        # Broadcast subtitle updates via WebSocket
        logger.info(f"Broadcasting subtitle updates for project {project_id} via WebSocket")
        websocket_message = {
            "project_id": project_id,
            "type": "subtitles",
            "data": [
                {
                    "id": f"{project_id}_subtitle_{idx}",  # Generate consistent IDs
                    "start_time": subtitle.start,
                    "end_time": subtitle.end,
                    "text": subtitle.text,
                    "confidence": subtitle.confidence,
                    "translation": subtitle.translation
                }
                for idx, subtitle in enumerate(translated_subtitles)
            ],
            "message": "Subtitles translated successfully"
        }
        logger.info(f"Sending WebSocket message with {len(translated_subtitles)} subtitles")
        await websocket_manager.send_to_project(project_id, websocket_message)
        
        # Send completion status
        await websocket_manager.send_to_project(project_id, {
            "project_id": project_id,
            "type": "completion",
            "status": "completed",
            "message": f"Translation completed successfully! {len(translated_subtitles)} subtitles translated."
        })
    except Exception as e:
        logger.error(f"Error during translation for project {project_id}: {e}")
        await websocket_manager.send_to_project(project_id, {
            "project_id": project_id,
            "type": "error",
            "message": f"Translation failed: {str(e)}"
        })

@router.post("/translate-text")
async def translate_text(text: str):
    """Translate a single text to Arabic"""
    if not text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    
    translation_generator = TranslationGenerator()
    translated_text = translation_generator.translate_caption(text)
    
    return {
        "original": text,
        "translated": translated_text
    }

@router.put("/{project_id}/subtitles/{subtitle_index}")
async def update_subtitle_text(project_id: str, subtitle_index: int, text: str, translation: str = None):
    """Update individual subtitle text and translation"""
    db = await get_database()
    # Check if project exists
    project = await db.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get current subtitles
    subtitles = db.get_project_subtitles(project_id)
    if not subtitles or subtitle_index >= len(subtitles):
        raise HTTPException(status_code=404, detail="Subtitle not found")
    
    # Update the subtitle
    subtitles[subtitle_index].text = text
    if translation is not None:
        subtitles[subtitle_index].translation = translation
    
    # Save back to file
    project_dir = settings.get_project_dir(project_id)
    subtitles_path = project_dir / "subtitles.json"
    
    # Convert to dict format for JSON serialization
    subtitles_dict = [subtitle.dict() for subtitle in subtitles]
    
    with open(subtitles_path, 'w', encoding='utf-8') as f:
        json.dump(subtitles_dict, f, indent=2, ensure_ascii=False)
    
    logger.info(f"Updated subtitle {subtitle_index} for project {project_id}")
    
    # Broadcast update via WebSocket
    websocket_message = {
        "project_id": project_id,
        "type": "subtitle_updated",
        "data": {
            "index": subtitle_index,
            "text": text,
            "translation": translation
        }
    }
    await websocket_manager.send_to_project(project_id, websocket_message)
    
    return {"message": "Subtitle updated successfully"}

@router.put("/{project_id}/subtitles")
async def update_project_subtitles(project_id: str, subtitles_data: List[Dict]):
    """Update all project subtitles"""
    db = await get_database()
    # Check if project exists
    project = await db.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Save subtitles to file
    project_dir = settings.get_project_dir(project_id)
    subtitles_path = project_dir / "subtitles.json"
    
    # Convert input data to CaptionData format and save
    subtitles_list = []
    for sub_data in subtitles_data:
        caption = CaptionData(
            start=sub_data.get("start", sub_data.get("start_time", 0)),
            end=sub_data.get("end", sub_data.get("end_time", 0)),
            text=sub_data.get("text", ""),
            confidence=sub_data.get("confidence", 1.0),
            translation=sub_data.get("translation", sub_data.get("translatedText"))
        )
        subtitles_list.append(caption)
    
    # Save to JSON file
    subtitles_dict = [subtitle.dict() for subtitle in subtitles_list]
    with open(subtitles_path, 'w', encoding='utf-8') as f:
        json.dump(subtitles_dict, f, indent=2, ensure_ascii=False)
    
    logger.info(f"Updated all subtitles for project {project_id} - {len(subtitles_list)} subtitles")
    
    # Update project status
    await db.update_project_status(project_id, "completed", len(subtitles_list))
    
    return {"message": "All subtitles updated successfully", "count": len(subtitles_list)}

@router.post("/{project_id}/export")
async def export_project_video(project_id: str, request: dict):
    """
    Export video with subtitles.
    
    Request body should include:
    - export_format: "hard" (burned-in subtitles) or "soft" (separate track)
    - subtitle_config: (optional) Subtitle styling configuration
    """
    db = await get_database()
    project = await db.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Get export format (default to hard)
    export_format = request.get("export_format", "hard")
    if export_format not in ["hard", "soft"]:
        raise HTTPException(status_code=400, detail="Export format must be 'hard' or 'soft'")

    # Parse subtitle configuration
    subtitle_config = None
    if "subtitle_config" in request:
        try:
            config_data = request["subtitle_config"]
            subtitle_config = SubtitleConfig(**config_data)
        except Exception as e:
            logger.error(f"Invalid subtitle config provided: {e}")
            raise HTTPException(status_code=400, detail=f"Invalid subtitle configuration: {str(e)}")

    # Run export as background task
    exporter = ExportService()
    asyncio.create_task(run_export_task(project_id, exporter, export_format, subtitle_config))
    
    return {"message": "Video export started. You will be notified when it's complete."}

async def run_export_task(project_id: str, exporter: ExportService, export_format: str, config: SubtitleConfig = None):
    """Background task for video export."""
    try:
        # Notify frontend that export has started
        await websocket_manager.send_to_project(project_id, {
            "project_id": project_id,
            "type": "export_status",
            "status": "export_started",
            "message": "Starting video export..."
        })
        
        # Run the export
        filename = await exporter.burn_subtitles(project_id, export_format, config)
        logger.info(f"Export completed for project {project_id}: {filename}")
        
        # Get project directory to verify the file exists
        project_dir = settings.get_project_dir(project_id)
        file_path = project_dir / filename
        file_size = file_path.stat().st_size if file_path.exists() else 0
        
        # Create the completion message
        completion_message = {
            "project_id": project_id,
            "type": "export_status",
            "status": "export_completed",
            "message": "Video export completed successfully",
            "progress": 100,
            "data": {
                "filename": filename,
                "file_size": file_size,
                "download_url": f"/api/projects/{project_id}/download-export/{filename}"
            }
        }
        
        logger.info(f"Sending export completion message: {completion_message}")
        
        # Notify frontend that export is complete
        await websocket_manager.send_to_project(project_id, completion_message)
    except Exception as e:
        logger.error(f"Export task failed for project {project_id}: {e}")
        await websocket_manager.send_to_project(project_id, {
            "project_id": project_id,
            "type": "export_status",
            "status": "export_failed",
            "message": f"Export failed: {str(e)}"
        })

@router.get("/{project_id}/download-export/{filename}")
async def download_exported_video(project_id: str, filename: str):
    """
    Download the exported video file.
    
    The filename should be in the format: {project_id}_export.{mp4|mkv}
    """
    # Validate filename to prevent directory traversal
    if not filename.startswith(project_id):
        raise HTTPException(status_code=400, detail="Invalid filename")
    
    project_dir = settings.get_project_dir(project_id)
    file_path = project_dir / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Exported file not found. Please check if the export has completed.")
    
    # Get project to use its title for the download filename
    db = await get_database()
    project = await db.get_project(project_id)
    
    # Determine media type based on file extension
    ext = file_path.suffix.lower()
    if ext == '.mp4':
        media_type = 'video/mp4'
        download_ext = 'mp4'
    elif ext == '.mkv':
        media_type = 'video/x-matroska'
        download_ext = 'mkv'
    else:
        media_type = 'video/mp4'
        download_ext = 'mp4'
    
    # Create a nice download filename
    project_title = project.title if project and project.title else project_id
    download_filename = f"{project_title}_with_subtitles.{download_ext}"
    
    return FileResponse(
        str(file_path),
        media_type=media_type,
        filename=download_filename,
        headers={
            "Content-Disposition": f"attachment; filename=\"{download_filename}\""
        }
    )
