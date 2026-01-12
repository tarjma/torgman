"""
Background task definitions for video processing, translation, and export operations.

This module contains all long-running background tasks that are executed asynchronously
to keep the API responsive. These tasks handle:
- Video file processing
- YouTube video processing  
- AI translation of subtitles
- Video export with burned-in subtitles

Tasks communicate progress and status via WebSocket connections.
"""

import asyncio
import json
import logging
from typing import List

from ..core.config import settings
from ..services import UnifiedVideoProcessor
from ..services.transcription_service import get_transcription_service
from ..services.llm_caption_service import get_llm_caption_service
from ..services.translation_service import TranslationGenerator
from ..services.export_service import ExportService
from ..api.websocket import manager as websocket_manager
from ..api.config import SubtitleConfig

logger = logging.getLogger(__name__)

# Lazy initialization - only create processors when needed to avoid loading Whisper on import
_video_processor = None
_translation_generator = None
_export_service = None

def get_video_processor():
    """Get or create the video processor (lazy initialization)"""
    global _video_processor
    if _video_processor is None:
        _video_processor = UnifiedVideoProcessor()
    return _video_processor

def get_translation_generator():
    """Get or create the translation generator (lazy initialization)"""
    global _translation_generator
    if _translation_generator is None:
        _translation_generator = TranslationGenerator()
    return _translation_generator

def get_export_service():
    """Get or create the export service (lazy initialization)"""
    global _export_service
    if _export_service is None:
        _export_service = ExportService()
    return _export_service

async def process_youtube_video_task(url: str, project_id: str, resolution: str = "720p", 
                                    language: str = None, audio_language: str = None,
                                    enable_diarization: bool = False, num_speakers: int = None):
    """Background task to process YouTube video with enhanced features
    
    Args:
        url: YouTube video URL
        project_id: Project identifier
        resolution: Video resolution to download
        language: Optional language code for transcription (e.g., 'en', 'ar', 'es'). 
                 If None or 'auto', Whisper will auto-detect the language.
        audio_language: Optional audio language code for multi-track videos (e.g., 'en', 'ar', 'es').
                       If None, yt-dlp will select the best available audio track.
        enable_diarization: Whether to run speaker diarization
        num_speakers: Optional hint for number of speakers
    """
    await get_video_processor().process_youtube_video(
        url, project_id, resolution, language, audio_language,
        enable_diarization, num_speakers
    )

async def process_video_file_task(file_path: str, project_id: str, language: str = None,
                                  enable_diarization: bool = False, num_speakers: int = None):
    """Background task to process uploaded video file
    
    Args:
        file_path: Path to the uploaded video file
        project_id: Project identifier
        language: Optional language code for transcription (e.g., 'en', 'ar', 'es'). 
                 If None or 'auto', Whisper will auto-detect the language.
        enable_diarization: Whether to run speaker diarization
        num_speakers: Optional hint for number of speakers
    """
    await get_video_processor().process_video_file(
        file_path, project_id, language,
        enable_diarization, num_speakers
    )

async def translate_project_task(
    project_id: str, 
    subtitles: List, 
    source_language: str, 
    target_language: str
):
    """Background task to translate all subtitles in a project using AI"""
    logger.info(f"Starting translation task for project {project_id}")
    
    total_subtitles = len(subtitles)
    translated_count = 0
    
    # Update subtitles with translations
    for i, subtitle in enumerate(subtitles):
        progress = int((i / total_subtitles) * 100)
        
        # Send progress update
        await websocket_manager.send_to_project(project_id, {
            "project_id": project_id,
            "type": "status", 
            "status": "translating",
            "message": f"ترجمة الجملة {i + 1} من {total_subtitles}...",
            "progress": progress
        })
        
        # Translate the text (synchronous call wrapped in thread if needed)
        # translation_generator currently provides translate_caption (sync).
        # Run in default loop executor to avoid blocking.
        translated = await asyncio.get_event_loop().run_in_executor(
            None, get_translation_generator().translate_caption, subtitle.text
        )
        subtitle.translation = translated
        translated_count += 1
        
        # Small delay to prevent overwhelming the API
        await asyncio.sleep(0.1)
    
    # Save updated subtitles to file
    project_dir = settings.get_project_dir(project_id)
    subtitles_path = project_dir / "subtitles.json"
    
    subtitles_data = []
    for subtitle in subtitles:
        subtitles_data.append({
            "start_time": subtitle.start_time,
            "end_time": subtitle.end_time,
            "text": subtitle.text,
            "confidence": subtitle.confidence,
            "translation": subtitle.translation
        })
    
    with open(subtitles_path, 'w', encoding='utf-8') as f:
        json.dump(subtitles_data, f, ensure_ascii=False, indent=2)
    
    # Send completion message
    await websocket_manager.send_to_project(project_id, {
        "project_id": project_id,
        "type": "status",
        "status": "completed", 
        "message": f"تم الانتهاء من ترجمة {translated_count} جملة بنجاح!"
    })
    
    # Send updated subtitles
    await websocket_manager.send_to_project(project_id, {
        "project_id": project_id,
        "type": "subtitles",
        "data": subtitles_data
    })
    
    logger.info(f"Translation task completed for project {project_id}")

async def export_video_task(project_id: str, video_path: str, config):
    """Background task to burn subtitles into video"""
    logger.info(f"Starting export task for project {project_id}")
    
    # Convert the config to SubtitleConfig if it's a dict
    if isinstance(config, dict):
        config = SubtitleConfig(**config)
    
    try:
        # Perform the export
        output_filename = await get_export_service().burn_subtitles(project_id, export_format="hard", config=config)
        
        # Send completion notification to frontend
        await websocket_manager.send_to_project(project_id, {
            "project_id": project_id,
            "type": "export_status",
            "status": "export_completed",
            "message": "تم تصدير الفيديو بنجاح! جاري تحضير التحميل...",
            "progress": 100,
            "data": {
                "filename": output_filename,
                "download_url": f"/api/projects/{project_id}/download-export/{output_filename}"
            }
        })
        
        logger.info(f"Export task completed for project {project_id}")
        
    except Exception as e:
        logger.error(f"Export task failed for project {project_id}: {e}")
        
        # Send failure notification to frontend
        await websocket_manager.send_to_project(project_id, {
            "project_id": project_id,
            "type": "export_status",
            "status": "export_failed",
            "message": f"فشل في تصدير الفيديو: {str(e)}",
            "progress": 0
        })

async def retranscribe_project_task(project_id: str, language: str = None):
    """Background task to retranscribe an existing project with a specified language
    
    Args:
        project_id: Project identifier
        language: Language code for transcription (e.g., 'en', 'ar', 'es'). 
                 If None or 'auto', Whisper will auto-detect the language.
    """
    logger.info(f"Starting retranscription task for project {project_id} with language: {language or 'auto-detect'}")
    
    transcription_service = get_transcription_service()
    llm_caption_service = get_llm_caption_service()
    
    # Send initial status
    await websocket_manager.send_to_project(project_id, {
        "project_id": project_id,
        "type": "status",
        "status": "retranscribing",
        "message": "جاري إعادة توليد الترجمات...",
        "progress": 10
    })
    
    # Get project directory and check if audio file exists
    project_dir = settings.get_project_dir(project_id)
    audio_path = project_dir / f"{project_id}_audio.wav"
    
    if not audio_path.exists():
        raise FileNotFoundError(f"Audio file not found for project {project_id}")
    
    # Update progress
    await websocket_manager.send_to_project(project_id, {
        "project_id": project_id,
        "type": "status",
        "status": "retranscribing",
        "message": "جاري تحليل الصوت...",
        "progress": 30
    })
    
    # Transcribe audio to get word-level timestamps
    all_words, detected_lang = transcription_service.transcribe(str(audio_path), language)
    
    # Save word-level data for later regeneration
    words_path = project_dir / "words.json"
    with open(words_path, 'w', encoding='utf-8') as f:
        json.dump(all_words, f, ensure_ascii=False, indent=2)
    
    # Generate source language captions using LLM
    await websocket_manager.send_to_project(project_id, {
        "project_id": project_id,
        "type": "status",
        "status": "retranscribing",
        "message": "جاري إنشاء الترجمات...",
        "progress": 50
    })
    
    subtitles = llm_caption_service.generate_source_captions(all_words, detected_lang)
    
    # Generate Arabic translated captions using LLM
    await websocket_manager.send_to_project(project_id, {
        "project_id": project_id,
        "type": "status",
        "status": "retranscribing",
        "message": "جاري الترجمة إلى العربية...",
        "progress": 70
    })
    
    arabic_captions = llm_caption_service.generate_translated_captions(
        all_words, 
        source_language=detected_lang, 
        target_language="ar"
    )
    
    # Add translations to subtitles
    for i, subtitle in enumerate(subtitles):
        if i < len(arabic_captions):
            subtitle["translation"] = arabic_captions[i]["text"]
    
    # Save subtitles as JSON
    subtitles_path = project_dir / "subtitles.json"
    with open(subtitles_path, 'w', encoding='utf-8') as f:
        json.dump(subtitles, f, ensure_ascii=False, indent=2)
    
    # Generate ASS file
    from ..models.project import CaptionData
    from ..utils.ass_utils import save_ass_file
    
    processed_subtitles = [CaptionData(**s) for s in subtitles]
    default_config = SubtitleConfig()
    ass_path = save_ass_file(project_id, processed_subtitles, default_config)
    logger.info(f"ASS subtitles saved successfully: {ass_path}")
    
    # Update project metadata with detected language
    from ..services.project_manager import get_project_manager
    db = get_project_manager()
    db.update_project_metadata(project_id, 
                              source_language=detected_lang,
                              subtitle_count=len(subtitles))
    
    # Send completion message
    await websocket_manager.send_to_project(project_id, {
        "project_id": project_id,
        "type": "status",
        "status": "retranscribe_completed",
        "message": f"تم إعادة توليد {len(subtitles)} ترجمة بنجاح! (اللغة المكتشفة: {detected_lang})",
        "progress": 100
    })
    
    # Send updated subtitles
    await websocket_manager.send_to_project(project_id, {
        "project_id": project_id,
        "type": "subtitles",
        "data": subtitles
    })
    
    logger.info(f"Retranscription task completed for project {project_id}")
