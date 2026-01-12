import logging
from typing import Any, Dict, Optional
from pathlib import Path

from ..api.websocket import manager
from ..core.config import settings
from ..services.project_manager import get_project_manager
from .youtube_service import YouTubeVideoProcessor
from .file_service import VideoFileProcessor
from .transcription_service import get_transcription_service
from .speaker_diarization_service import get_diarization_service
from ..utils.ass_utils import save_ass_file
from ..api.config import SubtitleConfig
from ..models.project import CaptionData

logger = logging.getLogger(__name__)


class UnifiedVideoProcessor:
    """Unified processor for handling both YouTube and file-based video processing.
    
    The processing workflow stops after word extraction:
    1. Download/process video
    2. Extract audio
    3. Transcribe audio with Whisper to get word-level timestamps
    4. Optionally run speaker diarization
    5. Save words.json and set status to 'words_ready'
    
    Caption generation and translation are triggered manually by the user.
    """
    
    def __init__(self):
        self.youtube_processor = YouTubeVideoProcessor()
        self.file_processor = VideoFileProcessor()
        self.transcription_service = get_transcription_service()
    
    async def process_youtube_video(self, url: str, project_id: str, resolution: str = "720p", 
                                   language: str = None, audio_language: str = None,
                                   enable_diarization: bool = False, num_speakers: Optional[int] = None):
        """Process a YouTube video with unified workflow.
        
        Processing stops after word extraction. User must manually trigger
        caption generation and translation.
        
        Args:
            url: YouTube video URL
            project_id: Project identifier
            resolution: Video resolution to download
            language: Optional language code for transcription (e.g., 'en', 'ar', 'es'). 
                     If None or 'auto', Whisper will auto-detect the language.
            audio_language: Optional audio language code for multi-track videos (e.g., 'en', 'ar', 'es').
                           If None, yt-dlp will select the best available audio track.
            enable_diarization: Whether to run speaker diarization
            num_speakers: Optional hint for number of speakers (improves diarization)
        """
        try:
            # Send initial status
            await self._send_status(project_id, "downloading_video", 5, f"Downloading YouTube video in {resolution}...")
            
            # Get video info first for metadata
            video_info = self.youtube_processor.get_video_info(url)
            
            # Step 1: Download full video
            video_path = self.youtube_processor.download_video(url, project_id, resolution, video_info, audio_language)
            
            await self._send_status(project_id, "downloading_thumbnail", 20, "Downloading video thumbnail...")
            
            # Step 2: Download thumbnail
            thumbnail_path = self.youtube_processor.download_thumbnail(url, project_id)
            
            # Step 3: Process audio and extract words (stops after word extraction)
            word_count, detected_language = await self._process_audio_and_subtitles(
                video_path, project_id, 35, 
                language=language,
                enable_diarization=enable_diarization,
                num_speakers=num_speakers
            )
            
            # Step 4: Save YouTube-specific metadata
            await self._send_status(project_id, "saving_data", 90, "Saving project data...")
            
            project_dir = settings.get_project_dir(project_id)
            self.youtube_processor._save_project_metadata(
                project_dir, 
                project_id, 
                url, 
                resolution, 
                Path(video_path).name if video_path else "",
                Path(thumbnail_path).name if thumbnail_path else "",
                video_info
            )
            
            # Step 5: Finalize with words_ready status
            await self._finalize_words_ready(project_id, word_count, detected_language, {
                "video_file": Path(video_path).name if video_path else "",
                "audio_file": f"{project_id}_audio.wav",
                "thumbnail_file": Path(thumbnail_path).name if thumbnail_path else "",
                "word_count": word_count
            })
        except Exception as e:
            await self._handle_error(project_id, e, "YouTube video processing")
            
    async def process_video_file(self, file_path: str, project_id: str, language: str = None,
                                 enable_diarization: bool = False, num_speakers: Optional[int] = None):
        """Process an uploaded video file with unified workflow.
        
        Processing stops after word extraction. User must manually trigger
        caption generation and translation.
        
        Args:
            file_path: Path to the uploaded video file
            project_id: Project identifier
            language: Optional language code for transcription (e.g., 'en', 'ar', 'es'). 
                     If None or 'auto', Whisper will auto-detect the language.
            enable_diarization: Whether to run speaker diarization
            num_speakers: Optional hint for number of speakers
        """
        try:
            # Send initial status
            await self._send_status(project_id, "processing", 10, "Processing uploaded video file...")
            
            # Step 1: Extract video information
            await self._send_status(project_id, "extracting_info", 20, "Extracting video information...")
            
            # Update project status to processing
            project_manager = get_project_manager()
            project_manager.update_project_status(project_id, "processing", None)
            
            # Step 2: Process audio and extract words (stops after word extraction)
            word_count, detected_language = await self._process_audio_and_subtitles(
                file_path, project_id, 40, 
                language=language,
                enable_diarization=enable_diarization,
                num_speakers=num_speakers
            )
            
            # Step 3: Save file-specific metadata
            project_dir = settings.get_project_dir(project_id)
            self.file_processor._save_project_metadata(project_dir, project_id, file_path)
            
            # Step 4: Finalize with words_ready status
            await self._finalize_words_ready(project_id, word_count, detected_language, {
                "video_file": Path(file_path).name,
                "audio_file": f"{project_id}_audio.wav",
                "thumbnail_file": f"{project_id}_thumbnail.webp",
                "word_count": word_count
            })
        except Exception as e:
            await self._handle_error(project_id, e, "video file processing")
    
    async def _process_audio_and_subtitles(
        self, 
        video_path: str, 
        project_id: str, 
        start_progress: int, 
        language: str = None,
        enable_diarization: bool = False,
        num_speakers: Optional[int] = None
    ):
        """Extract audio and generate word-level timestamps.
        
        This workflow:
        1. Extracts audio from video
        2. Transcribes audio using Whisper to get word-level timestamps
        3. Optionally runs speaker diarization
        4. Saves words.json and STOPS
        
        Caption generation and translation are triggered manually by the user.
        
        Args:
            video_path: Path to the video file
            project_id: Project identifier
            start_progress: Starting progress percentage
            language: Optional language code for transcription (e.g., 'en', 'ar', 'es'). 
                     If None or 'auto', Whisper will auto-detect the language.
            enable_diarization: Whether to run speaker diarization
            num_speakers: Optional hint for number of speakers
            
        Returns:
            Tuple of (word_count, detected_language)
        """
        import json
        
        # Step 1: Extract audio from video
        await self._send_status(project_id, "extracting_audio", start_progress, "جاري استخراج الصوت من الفيديو...")
        audio_path = self.youtube_processor.extract_audio(video_path, project_id)
        
        # Step 2: Transcribe audio to get word-level timestamps
        await self._send_status(project_id, "transcribing", start_progress + 20, "جاري التعرف على الكلام...")
        all_words, detected_language = self.transcription_service.transcribe(audio_path, language)
        
        if not all_words:
            logger.warning(f"No words detected in audio for project {project_id}")
            return 0, detected_language
        
        logger.info(f"Transcribed {len(all_words)} words (detected language: {detected_language})")
        
        # Step 3: Run speaker diarization if enabled
        if enable_diarization:
            await self._send_status(project_id, "diarizing", start_progress + 40, "جاري تحديد المتحدثين...")
            diarization_service = get_diarization_service()
            all_words = diarization_service.diarize_and_assign(audio_path, all_words, num_speakers)
            logger.info(f"Speaker diarization complete for project {project_id}")
        
        # Step 4: Save word-level data
        await self._send_status(project_id, "saving_words", start_progress + 50, "جاري حفظ البيانات...")
        project_dir = settings.get_project_dir(project_id)
        words_path = project_dir / "words.json"
        with open(words_path, 'w', encoding='utf-8') as f:
            json.dump(all_words, f, ensure_ascii=False, indent=2)
        
        # Store detected language for metadata
        self._last_detected_language = detected_language
        
        # Processing stops here - no automatic caption generation
        return len(all_words), detected_language
    
    async def _finalize_words_ready(self, project_id: str, word_count: int, detected_language: str, completion_data: Dict[str, Any]):
        """Finalize processing with words_ready status (no captions yet)."""
        db = get_project_manager()
        
        # Update project metadata with detected language and word count
        db.update_project_metadata(project_id, source_language=detected_language, word_count=word_count)
        db.update_project_status(project_id, "words_ready", None)
        
        await self._send_status(project_id, "words_ready", 100, "تم استخراج الكلمات بنجاح! يمكنك الآن توليد الكابتشن.")
        
        await manager.send_to_project(project_id, {
            "project_id": project_id,
            "type": "words_ready",
            "data": {
                "word_count": word_count,
                "detected_language": detected_language
            }
        })
        
        await manager.send_to_project(project_id, {
            "project_id": project_id,
            "type": "completion",
            "data": completion_data
        })
        
        logger.info(f"Word extraction completed for project {project_id}: {word_count} words")
    
    async def _finalize_processing(self, project_id: str, subtitles: list, completion_data: Dict[str, Any]):
        """Common finalization workflow"""
        project_dir = settings.get_project_dir(project_id)
        # Convert raw dict subtitles to CaptionData objects if necessary for downstream utilities
        processed_subtitles = [
            s if isinstance(s, CaptionData) else CaptionData(**s) for s in subtitles
        ]
        # Save subtitles as JSON (raw dict form is acceptable) and generate ASS file
        self.youtube_processor._save_subtitles(project_dir, subtitles)
        default_config = SubtitleConfig()
        ass_path = save_ass_file(project_id, processed_subtitles, default_config)
        logger.info(f"ASS subtitles saved successfully: {ass_path}")
        
        db = get_project_manager()
        # Persist detected source language once (after metadata writes by processors)
        detected_lang = getattr(self, '_last_detected_language', None)
        if detected_lang:
            db.update_project_metadata(project_id, source_language=detected_lang)
        db.update_project_status(project_id, "transcribed", len(subtitles))
        await self._send_status(project_id, "transcribed", 100, "Transcription completed successfully!")
        await manager.send_to_project(project_id, {
            "project_id": project_id,
            "type": "subtitles",
            "data": subtitles
        })
        await manager.send_to_project(project_id, {
            "project_id": project_id,
            "type": "completion",
            "data": completion_data
        })
        logger.info(f"Transcription completed for project {project_id}")
    
    async def _send_status(self, project_id: str, status: str, progress: int, message: str):
        """Send status update via WebSocket"""
        await manager.send_to_project(project_id, {
            "project_id": project_id,
            "type": "status",
            "status": status,
            "progress": progress,
            "message": message
        })
    
    async def _handle_error(self, project_id: str, error: Exception, operation: str):
        """Handle errors during processing"""
        logger.error(f"Error during {operation} for project {project_id}: {str(error)}")
        
        # Provide user-friendly Arabic error messages
        error_str = str(error)
        if "403" in error_str or "Forbidden" in error_str:
            user_message = "فشل تحميل الفيديو من YouTube. يرجى المحاولة مرة أخرى أو استخدام فيديو آخر. قد تحتاج إلى تحديث الأداة."
        elif "404" in error_str or "not found" in error_str.lower():
            user_message = "الفيديو غير موجود أو غير متاح. يرجى التحقق من الرابط."
        elif "private" in error_str.lower() or "unavailable" in error_str.lower():
            user_message = "الفيديو خاص أو غير متاح للمشاهدة. يرجى استخدام فيديو عام."
        elif "age" in error_str.lower() and "restricted" in error_str.lower():
            user_message = "الفيديو مقيد بالعمر ولا يمكن تحميله."
        else:
            user_message = f"فشلت المعالجة: {error_str}"
        
        await manager.send_to_project(project_id, {
            "project_id": project_id,
            "type": "error",
            "message": user_message
        })
        
        # Update project status to failed
        try:
            project_manager = get_project_manager()
            project_manager.update_project_status(project_id, "failed", None)
        except Exception as db_error:
            logger.error(f"Failed to update project status: {str(db_error)}")
