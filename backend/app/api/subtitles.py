import asyncio
import json
import logging
from typing import List, Dict

from fastapi import APIRouter, HTTPException

from ..core.config import settings
from ..core.database import get_database
from ..models.project import CaptionData
from ..services.translation_service import TranslationGenerator
from .websocket import manager as websocket_manager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/projects", tags=["subtitles"])

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

@router.put("/{project_id}/subtitles/{subtitle_index}")
async def update_subtitle(project_id: str, subtitle_index: int, subtitle_data: Dict):
    """Update a specific subtitle by index"""
    db = await get_database()
    # Check if project exists
    project = await db.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Load subtitles from file
    project_dir = settings.get_project_dir(project_id)
    subtitles_path = project_dir / "subtitles.json"
    
    if not subtitles_path.exists():
        raise HTTPException(status_code=404, detail="Subtitles file not found")
    
    with open(subtitles_path, 'r', encoding='utf-8') as f:
        subtitles_data = json.load(f)
    
    if subtitle_index < 0 or subtitle_index >= len(subtitles_data):
        raise HTTPException(status_code=404, detail="Subtitle index out of range")
    
    # Update the subtitle
    subtitles_data[subtitle_index].update(subtitle_data)
    
    # Save back to file
    with open(subtitles_path, 'w', encoding='utf-8') as f:
        json.dump(subtitles_data, f, ensure_ascii=False, indent=2)
    
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
            start_time=sub_data.get("start_time", 0),
            end_time=sub_data.get("end_time", 0),
            text=sub_data.get("text", ""),
            confidence=sub_data.get("confidence", 1.0),
            translation=sub_data.get("translation", sub_data.get("translatedText"))
        )
        subtitles_list.append(caption.dict())
    
    # Ensure directory exists
    project_dir.mkdir(parents=True, exist_ok=True)
    
    # Write to file
    with open(subtitles_path, 'w', encoding='utf-8') as f:
        json.dump(subtitles_list, f, ensure_ascii=False, indent=2)
    
    # Update subtitle count in database
    await db.update_project_status(project_id, "completed", len(subtitles_list))
    
    return {
        "message": "Subtitles updated successfully", 
        "count": len(subtitles_list)
    }

@router.post("/{project_id}/translate")
async def translate_project_subtitles(project_id: str, request_data: Dict):
    """Translate all subtitles in a project using AI"""
    db = await get_database()
    
    # Check if project exists
    project = await db.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get current subtitles
    subtitles = db.get_project_subtitles(project_id)
    if not subtitles:
        raise HTTPException(status_code=404, detail="No subtitles found for this project")
    
    # Extract source and target languages from request
    source_language = request_data.get("source_language", "en")
    target_language = request_data.get("target_language", "ar")
    
    logger.info(f"Starting AI translation for project {project_id}: {source_language} -> {target_language}")
    
    # Send initial status
    await websocket_manager.send_to_project(project_id, {
        "project_id": project_id,
        "type": "status",
        "status": "translating",
        "message": f"بدء ترجمة {len(subtitles)} جملة..."
    })
    
    # Start translation task in background
    from ..tasks.video_processing import translate_project_task
    asyncio.create_task(translate_project_task(
        project_id, 
        subtitles, 
        source_language, 
        target_language
    ))
    
    return {
        "message": "Translation started successfully",
        "project_id": project_id,
        "subtitle_count": len(subtitles),
        "source_language": source_language,
        "target_language": target_language
    }

@router.post("/translate-text")
async def translate_text_endpoint(request_data: Dict):
    """Translate a single piece of text"""
    text = request_data.get("text", "")
    source_language = request_data.get("source_language", "en")
    target_language = request_data.get("target_language", "ar")
    
    if not text.strip():
        raise HTTPException(status_code=400, detail="Text is required")
    
    translation_generator = TranslationGenerator()
    result = await translation_generator.translate_text(text, source_language, target_language)
    
    return result
