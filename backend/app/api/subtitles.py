import asyncio
import json
import logging
from typing import Dict, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..core.config import settings
from ..models.project import CaptionData
from ..services.project_manager import get_project_manager
from ..services.translation_service import TranslationGenerator
from .websocket import manager as websocket_manager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/projects", tags=["subtitles"])

class TranslationRequest(BaseModel):
    text: str
    source_language: str = "en"
    target_language: str = "ar"

class ProjectTranslationRequest(BaseModel):
    source_language: str = "en"
    target_language: str = "ar"

@router.get("/{project_id}/subtitles", response_model=List[CaptionData])
async def get_project_subtitles(project_id: str):
    """Get subtitles for a project"""
    project_manager = get_project_manager()
    # Check if project exists
    project = project_manager.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    subtitles = project_manager.get_project_subtitles(project_id)
    return subtitles

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
    
    # Update subtitle count in project metadata
    project_manager.update_project_status(project_id, "completed", len(subtitles_list))
    
    return {
        "message": "Subtitles updated successfully", 
        "count": len(subtitles_list)
    }

@router.post("/{project_id}/translate")
async def translate_project_subtitles(project_id: str, request: ProjectTranslationRequest):
    """Kick off one-shot translation in the background to avoid HTTP timeouts.
    Progress and results are delivered over the project's WebSocket channel."""
    project_manager = get_project_manager()

    async def _background_translate():
        # Load subtitles
        subs = project_manager.get_project_subtitles(project_id)
        logger.info(f"One-shot translation for project {project_id} to {request.target_language}, segments={len(subs)}")
        await websocket_manager.send_to_project(project_id, {
            "project_id": project_id,
            "type": "status",
            "status": "translating",
            "message": f"جاري ترجمة {len(subs)} جملة دفعة واحدة...",
            "progress": 5
        })
        translation_generator = TranslationGenerator()
        loop = asyncio.get_event_loop()
        translated = await loop.run_in_executor(
            None,
            translation_generator.translate_transcription,
            subs,
            request.source_language,
            request.target_language,
        )
        project_dir = settings.get_project_dir(project_id)
        subtitles_path = project_dir / "subtitles.json"
        with open(subtitles_path, 'w', encoding='utf-8') as f:
            json.dump([s.model_dump() for s in translated], f, ensure_ascii=False, indent=2)
        await websocket_manager.send_to_project(project_id, {
            "project_id": project_id,
            "type": "subtitles",
            "data": [s.model_dump() for s in translated]
        })
        await websocket_manager.send_to_project(project_id, {
            "project_id": project_id,
            "type": "status",
            "status": "translation_completed",
            "message": f"اكتملت ترجمة {len(translated)} جملة.",
            "progress": 100
        })

    asyncio.create_task(_background_translate())
    return {
        "message": "Translation started",
        "project_id": project_id,
        "status": "translating",
        "source_language": request.source_language,
        "target_language": request.target_language
    }

@router.post("/translate-text")
async def translate_text_endpoint(request: TranslationRequest):
    """Translate a single piece of text"""
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text is required")
    
    translation_generator = TranslationGenerator()
    # Single caption translation (sync) executed in thread to avoid blocking if needed
    import asyncio
    loop = asyncio.get_event_loop()
    translated = await loop.run_in_executor(
        None, translation_generator.translate_caption, request.text, request.source_language, request.target_language
    )
    return {"translation": translated}

class RegenerateCaptionsRequest(BaseModel):
    max_chars_per_line: int = 42
    max_lines_per_caption: int = 2
    max_caption_duration: int = 7
    max_cps: int = 17

@router.post("/{project_id}/regenerate-captions")
async def regenerate_captions(project_id: str, request: RegenerateCaptionsRequest):
    """Regenerate captions with custom parameters using stored word-level data"""
    project_manager = get_project_manager()
    project = project_manager.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project_dir = settings.get_project_dir(project_id)
    words_path = project_dir / "words.json"
    
    if not words_path.exists():
        raise HTTPException(
            status_code=404, 
            detail="لم يتم العثور على بيانات الكلمات. هذا المشروع قديم ولا يدعم هذه الميزة. يرجى إنشاء مشروع جديد للاستفادة من تخصيص الترجمات."
        )
    
    # Load word-level data
    with open(words_path, 'r', encoding='utf-8') as f:
        words = json.load(f)
    
    # Import and regenerate captions with new parameters
    from ..services.transcription_service import TranscriptionGenerator
    generator = TranscriptionGenerator()
    
    new_captions = generator.regenerate_captions_with_params(
        words,
        request.max_chars_per_line,
        request.max_lines_per_caption,
        request.max_caption_duration,
        request.max_cps
    )
    
    # Preserve existing translations if they exist
    subtitles_path = project_dir / "subtitles.json"
    existing_translations = {}
    if subtitles_path.exists():
        with open(subtitles_path, 'r', encoding='utf-8') as f:
            existing_subtitles = json.load(f)
            # Create a map of text to translation
            for sub in existing_subtitles:
                if sub.get('translation'):
                    # Store by the original text (without line breaks for matching)
                    original_text = sub.get('text', '').replace('\n', ' ')
                    existing_translations[original_text] = sub.get('translation')
    
    # Try to match translations to new captions (best effort)
    for caption in new_captions:
        caption_text = caption['text'].replace('\n', ' ')
        if caption_text in existing_translations:
            caption['translation'] = existing_translations[caption_text]
    
    # Save updated captions
    captions_list = []
    for cap in new_captions:
        caption_obj = CaptionData(
            start_time=cap['start_time'],
            end_time=cap['end_time'],
            text=cap['text'],
            confidence=cap.get('confidence', 1.0),
            translation=cap.get('translation')
        )
        captions_list.append(caption_obj.dict())
    
    with open(subtitles_path, 'w', encoding='utf-8') as f:
        json.dump(captions_list, f, ensure_ascii=False, indent=2)
    
    # Update project metadata
    project_manager.update_project_status(project_id, project.status, len(captions_list))
    
    # Regenerate ASS file with new captions
    from ..utils.ass_utils import save_ass_file
    from ..api.config import SubtitleConfig
    default_config = SubtitleConfig()
    caption_objects = [CaptionData(**cap) for cap in captions_list]
    save_ass_file(project_id, caption_objects, default_config)
    
    return {
        "message": "Captions regenerated successfully",
        "count": len(captions_list),
        "data": captions_list
    }
