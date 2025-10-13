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
from ..services.translation_service import TranslationGenerator
from ..services.export_service import ExportService
from ..api.websocket import manager as websocket_manager
from ..api.config import SubtitleConfig

logger = logging.getLogger(__name__)

# Initialize processors
video_processor = UnifiedVideoProcessor()
translation_generator = TranslationGenerator()
export_service = ExportService()

async def process_youtube_video_task(url: str, project_id: str, resolution: str = "720p", 
                                    language: str = None, audio_language: str = None):
    """Background task to process YouTube video with enhanced features
    
    Args:
        url: YouTube video URL
        project_id: Project identifier
        resolution: Video resolution to download
        language: Optional language code for transcription (e.g., 'en', 'ar', 'es'). 
                 If None or 'auto', Whisper will auto-detect the language.
        audio_language: Optional audio language code for multi-track videos (e.g., 'en', 'ar', 'es').
                       If None, yt-dlp will select the best available audio track.
    """
    await video_processor.process_youtube_video(url, project_id, resolution, language, audio_language)

async def process_video_file_task(file_path: str, project_id: str, language: str = None):
    """Background task to process uploaded video file
    
    Args:
        file_path: Path to the uploaded video file
        project_id: Project identifier
        language: Optional language code for transcription (e.g., 'en', 'ar', 'es'). 
                 If None or 'auto', Whisper will auto-detect the language.
    """
    await video_processor.process_video_file(file_path, project_id, language)

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
            None, translation_generator.translate_caption, subtitle.text
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
        output_filename = await export_service.burn_subtitles(project_id, export_format="hard", config=config)
        
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
    
    try:
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
            "message": "جاري تحليل الصوت وتوليد الترجمات...",
            "progress": 30
        })
        
        # Retranscribe the audio with the specified language
        transcription_generator = video_processor.subtitle_generator
        
        # Use the transcription service with language parameter
        transcribe_options = {"word_timestamps": True}
        if language and language != "auto":
            transcribe_options["language"] = language
            
        result = transcription_generator.whisper_model.transcribe(str(audio_path), **transcribe_options)
        all_words = [word for segment in result["segments"] for word in segment.get("words", [])]
        
        # Update detected language
        detected_lang = result.get("language") or "en"
        transcription_generator.last_detected_language = detected_lang
        
        # Update progress
        await websocket_manager.send_to_project(project_id, {
            "project_id": project_id,
            "type": "status",
            "status": "retranscribing",
            "message": "جاري تنسيق الترجمات...",
            "progress": 70
        })
        
        # Generate captions with current settings
        subtitles = transcription_generator.generate_captions(all_words)
        
        # Save word-level data for later regeneration
        words_path = project_dir / "words.json"
        with open(words_path, 'w', encoding='utf-8') as f:
            json.dump(all_words, f, ensure_ascii=False, indent=2)
        
        # Save subtitles as JSON
        subtitles_path = project_dir / "subtitles.json"
        subtitles_data = []
        for subtitle in subtitles:
            subtitles_data.append({
                "start_time": subtitle.get("start_time", subtitle.get("start", 0)),
                "end_time": subtitle.get("end_time", subtitle.get("end", 0)),
                "text": subtitle.get("text", ""),
                "confidence": subtitle.get("confidence")
            })
        
        with open(subtitles_path, 'w', encoding='utf-8') as f:
            json.dump(subtitles_data, f, ensure_ascii=False, indent=2)
        
        # Generate ASS file
        try:
            from ..models.project import CaptionData
            from ..utils.ass_utils import save_ass_file
            from ..api.config import SubtitleConfig
            
            processed_subtitles = [CaptionData(**s) for s in subtitles_data]
            default_config = SubtitleConfig()
            ass_path = save_ass_file(project_id, processed_subtitles, default_config)
            logger.info(f"ASS subtitles saved successfully: {ass_path}")
        except Exception as e:
            logger.error(f"Failed to generate ASS subtitles: {e}")
        
        # Update project metadata with detected language
        from ..services.project_manager import get_project_manager
        db = get_project_manager()
        try:
            db.update_project_metadata(project_id, 
                                      source_language=detected_lang,
                                      subtitle_count=len(subtitles_data))
        except Exception as e:
            logger.error(f"Failed to update project metadata: {e}")
        
        # Send completion message
        await websocket_manager.send_to_project(project_id, {
            "project_id": project_id,
            "type": "status",
            "status": "retranscribe_completed",
            "message": f"تم إعادة توليد {len(subtitles_data)} ترجمة بنجاح! (اللغة المكتشفة: {detected_lang})",
            "progress": 100
        })
        
        # Send updated subtitles
        await websocket_manager.send_to_project(project_id, {
            "project_id": project_id,
            "type": "subtitles",
            "data": subtitles_data
        })
        
        logger.info(f"Retranscription task completed for project {project_id}")
        
    except Exception as e:
        logger.error(f"Retranscription task failed for project {project_id}: {e}")
        
        # Send failure notification
        await websocket_manager.send_to_project(project_id, {
            "project_id": project_id,
            "type": "status",
            "status": "retranscribe_failed",
            "message": f"فشل في إعادة توليد الترجمات: {str(e)}",
            "progress": 0
        })
