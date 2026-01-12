import asyncio
import json
import logging
from typing import Dict, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..core.config import settings
from ..models.project import CaptionData
from ..services.project_manager import get_project_manager
from ..services.llm_caption_service import get_llm_caption_service
from .websocket import manager as websocket_manager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/projects", tags=["subtitles"])

class TranslationRequest(BaseModel):
    text: str
    source_language: str = "en"
    target_language: str = "ar"


@router.get("/{project_id}/subtitles", response_model=List[CaptionData])
async def get_project_subtitles(project_id: str):
    """Get source language subtitles for a project"""
    project_manager = get_project_manager()
    # Check if project exists
    project = project_manager.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    subtitles = project_manager.get_project_subtitles(project_id)
    return subtitles


@router.get("/{project_id}/arabic-subtitles", response_model=List[CaptionData])
async def get_arabic_subtitles(project_id: str):
    """Get Arabic language subtitles for a project (independent track from source)"""
    project_manager = get_project_manager()
    # Check if project exists
    project = project_manager.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project_dir = settings.get_project_dir(project_id)
    arabic_subtitles_path = project_dir / "arabic_subtitles.json"
    
    if not arabic_subtitles_path.exists():
        # Return empty list if no Arabic subtitles yet
        return []
    
    with open(arabic_subtitles_path, 'r', encoding='utf-8') as f:
        arabic_subtitles = json.load(f)
    
    return [CaptionData(**cap) for cap in arabic_subtitles]


@router.put("/{project_id}/arabic-subtitles")
async def update_arabic_subtitles(project_id: str, subtitles_data: List[Dict]):
    """Update Arabic subtitles (independent track)"""
    project_manager = get_project_manager()
    project = project_manager.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project_dir = settings.get_project_dir(project_id)
    arabic_subtitles_path = project_dir / "arabic_subtitles.json"
    
    # Save Arabic subtitles
    with open(arabic_subtitles_path, 'w', encoding='utf-8') as f:
        json.dump(subtitles_data, f, ensure_ascii=False, indent=2)
    
    # Regenerate Arabic ASS file
    from ..utils.ass_utils import save_ass_file
    from ..api.config import SubtitleConfig
    default_config = SubtitleConfig()
    arabic_caption_objects = [CaptionData(**cap) for cap in subtitles_data]
    save_ass_file(project_id, arabic_caption_objects, default_config, filename="arabic_subtitles.ass")
    
    return {"message": "Arabic subtitles updated successfully", "count": len(subtitles_data)}


@router.put("/{project_id}/subtitles/{subtitle_index}")
async def update_subtitle(project_id: str, subtitle_index: int, subtitle_data: Dict):
    """Update a specific subtitle by index"""
    project_manager = get_project_manager()
    # Check if project exists
    project = project_manager.get_project(project_id)
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
    project_manager = get_project_manager()
    # Check if project exists
    project = project_manager.get_project(project_id)
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
    
    # Check if all subtitles have translations
    all_translated = all(
        sub.get('translation') and sub.get('translation').strip() 
        for sub in subtitles_list
    )
    
    # Update status: "completed" if all translated, otherwise "transcribed"
    new_status = "completed" if all_translated else "transcribed"
    project_manager.update_project_status(project_id, new_status, len(subtitles_list))
    
    return {
        "message": "Subtitles updated successfully", 
        "count": len(subtitles_list)
    }


@router.post("/{project_id}/generate-captions")
async def generate_captions(project_id: str):
    """
    Generate source language captions from word-level data using LLM.
    
    This endpoint is triggered manually by the user after word extraction.
    It uses Gemini 3 to create natural, readable captions from word timestamps.
    
    Requires: words.json from transcription (status: words_ready)
    Result: Creates subtitles.json with source captions (status: captions_generated)
    """
    project_manager = get_project_manager()
    project = project_manager.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project_dir = settings.get_project_dir(project_id)
    words_path = project_dir / "words.json"
    
    if not words_path.exists():
        raise HTTPException(
            status_code=404,
            detail="لم يتم العثور على بيانات الكلمات. يرجى معالجة الفيديو أولاً."
        )
    
    async def _background_generate_captions():
        # Load word-level data
        with open(words_path, 'r', encoding='utf-8') as f:
            words = json.load(f)
        
        # Get detected language from project metadata
        metadata_path = project_dir / "metadata.json"
        detected_language = "en"
        if metadata_path.exists():
            with open(metadata_path, 'r', encoding='utf-8') as f:
                metadata = json.load(f)
                detected_language = metadata.get("source_language", "en")
        
        logger.info(f"Generating source captions for project {project_id}: {len(words)} words in {detected_language}")
        
        await websocket_manager.send_to_project(project_id, {
            "project_id": project_id,
            "type": "status",
            "status": "generating_captions",
            "message": f"جاري توليد الكابتشن من {len(words)} كلمة...",
            "progress": 10
        })
        
        # Generate source language captions using LLM
        llm_service = get_llm_caption_service()
        loop = asyncio.get_event_loop()
        source_captions = await loop.run_in_executor(
            None,
            llm_service.generate_source_captions,
            words,
            detected_language
        )
        
        logger.info(f"Generated {len(source_captions)} source captions")
        
        await websocket_manager.send_to_project(project_id, {
            "project_id": project_id,
            "type": "status",
            "status": "saving",
            "message": "جاري حفظ الكابتشن...",
            "progress": 80
        })
        
        # Convert to CaptionData format and save
        captions_list = []
        for cap in source_captions:
            caption_obj = CaptionData(
                start_time=cap['start_time'],
                end_time=cap['end_time'],
                text=cap['text'],
                confidence=cap.get('confidence', 1.0),
                translation=None  # No translation yet
            )
            captions_list.append(caption_obj.dict())
        
        subtitles_path = project_dir / "subtitles.json"
        with open(subtitles_path, 'w', encoding='utf-8') as f:
            json.dump(captions_list, f, ensure_ascii=False, indent=2)
        
        # Generate ASS file
        from ..utils.ass_utils import save_ass_file
        from ..api.config import SubtitleConfig
        default_config = SubtitleConfig()
        caption_objects = [CaptionData(**cap) for cap in captions_list]
        save_ass_file(project_id, caption_objects, default_config)
        
        # Update project status and metadata
        project_manager.update_project_status(project_id, "captions_generated", len(captions_list))
        project_manager.update_project_metadata(project_id, has_captions=True)
        
        await websocket_manager.send_to_project(project_id, {
            "project_id": project_id,
            "type": "subtitles",
            "data": captions_list
        })
        
        await websocket_manager.send_to_project(project_id, {
            "project_id": project_id,
            "type": "status",
            "status": "captions_generated",
            "message": f"تم توليد {len(captions_list)} كابتشن بنجاح!",
            "progress": 100
        })
    
    asyncio.create_task(_background_generate_captions())
    return {
        "message": "Caption generation started",
        "project_id": project_id,
        "status": "generating_captions"
    }


@router.post("/{project_id}/translate")
async def translate_project(project_id: str):
    """
    Generate Arabic translations for project captions using LLM.
    
    This endpoint uses Gemini 3 to create natural Arabic translations
    directly from word-level data, producing optimally-segmented Arabic captions.
    
    Requires: words.json from transcription
    Updates: subtitles.json with Arabic translations (status: translated)
    """
    project_manager = get_project_manager()
    project = project_manager.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project_dir = settings.get_project_dir(project_id)
    words_path = project_dir / "words.json"
    subtitles_path = project_dir / "subtitles.json"
    
    if not words_path.exists():
        raise HTTPException(
            status_code=404,
            detail="لم يتم العثور على بيانات الكلمات. يرجى معالجة الفيديو أولاً."
        )
    
    async def _background_translate():
        # Load word-level data
        with open(words_path, 'r', encoding='utf-8') as f:
            words = json.load(f)
        
        # Get detected language from project metadata
        metadata_path = project_dir / "metadata.json"
        detected_language = "en"
        if metadata_path.exists():
            with open(metadata_path, 'r', encoding='utf-8') as f:
                metadata = json.load(f)
                detected_language = metadata.get("source_language", "en")
        
        logger.info(f"Generating Arabic translations for project {project_id}: {len(words)} words from {detected_language}")
        
        await websocket_manager.send_to_project(project_id, {
            "project_id": project_id,
            "type": "status",
            "status": "translating",
            "message": f"جاري ترجمة المشروع إلى العربية...",
            "progress": 10
        })
        
        # Generate Arabic captions using LLM
        llm_service = get_llm_caption_service()
        loop = asyncio.get_event_loop()
        arabic_captions = await loop.run_in_executor(
            None,
            llm_service.generate_arabic_captions,
            words,
            detected_language
        )
        
        logger.info(f"Generated {len(arabic_captions)} Arabic captions")
        
        await websocket_manager.send_to_project(project_id, {
            "project_id": project_id,
            "type": "status",
            "status": "saving",
            "message": "جاري حفظ الترجمة...",
            "progress": 80
        })
        
        # Save Arabic captions as a SEPARATE track (decoupled from source captions)
        # This allows Arabic to have its own optimal segmentation
        arabic_subtitles_path = project_dir / "arabic_subtitles.json"
        arabic_caption_list = []
        for cap in arabic_captions:
            arabic_caption_list.append({
                "start_time": cap['start_time'],
                "end_time": cap['end_time'],
                "text": cap['text'],
                "confidence": cap.get('confidence', 1.0)
            })
        
        with open(arabic_subtitles_path, 'w', encoding='utf-8') as f:
            json.dump(arabic_caption_list, f, ensure_ascii=False, indent=2)
        
        logger.info(f"Saved {len(arabic_caption_list)} Arabic captions to {arabic_subtitles_path}")
        
        # Generate Arabic ASS file (separate from source ASS)
        from ..utils.ass_utils import save_ass_file
        from ..api.config import SubtitleConfig
        default_config = SubtitleConfig()
        arabic_caption_objects = [CaptionData(**cap) for cap in arabic_caption_list]
        save_ass_file(project_id, arabic_caption_objects, default_config, filename="arabic_subtitles.ass")
        
        # Update project status and metadata
        project_manager.update_project_status(project_id, "translated", len(arabic_caption_list))
        project_manager.update_project_metadata(project_id, has_translation=True)
        
        # Send Arabic captions via WebSocket with track identifier
        await websocket_manager.send_to_project(project_id, {
            "project_id": project_id,
            "type": "arabic_subtitles",
            "data": arabic_caption_list
        })
        
        await websocket_manager.send_to_project(project_id, {
            "project_id": project_id,
            "type": "status",
            "status": "translated",
            "message": f"تم ترجمة {len(arabic_caption_list)} كابتشن بنجاح!",
            "progress": 100
        })
    
    asyncio.create_task(_background_translate())
    return {
        "message": "Translation started",
        "project_id": project_id,
        "status": "translating"
    }


@router.post("/translate-text")
async def translate_text_endpoint(request: TranslationRequest):
    """Translate a single piece of text using LLM"""
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text is required")
    
    # For single text translation, we'll use a simple approach
    llm_service = get_llm_caption_service()
    
    # Create a simple word list for the text
    words = [{"word": request.text, "start": 0, "end": 1}]
    
    loop = asyncio.get_event_loop()
    translated_captions = await loop.run_in_executor(
        None,
        llm_service.generate_arabic_captions,
        words,
        request.source_language
    )
    
    translation = translated_captions[0]["text"] if translated_captions else ""
    return {"translation": translation}
