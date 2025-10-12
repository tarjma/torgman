import logging
from typing import Any, Dict
from pathlib import Path

from ..api.websocket import manager
from ..core.config import settings
from ..services.project_manager import get_project_manager
from .youtube_service import YouTubeVideoProcessor
from .file_service import VideoFileProcessor
from .transcription_service import TranscriptionGenerator
from ..utils.ass_utils import save_ass_file
from ..api.config import SubtitleConfig
from ..models.project import CaptionData

logger = logging.getLogger(__name__)


class UnifiedVideoProcessor:
    """Unified processor for handling both YouTube and file-based video processing"""
    
    def __init__(self):
        self.youtube_processor = YouTubeVideoProcessor()
        self.file_processor = VideoFileProcessor()
        self.subtitle_generator = TranscriptionGenerator()
    
    async def process_youtube_video(self, url: str, project_id: str, resolution: str = "720p"):
        """Process a YouTube video with unified workflow"""
        try:
            # Send initial status
            await self._send_status(project_id, "downloading_video", 5, f"Downloading YouTube video in {resolution}...")
            
            # Get video info first for metadata
            video_info = self.youtube_processor.get_video_info(url)
            
            # Step 1: Download full video
            video_path = self.youtube_processor.download_video(url, project_id, resolution, video_info)
            
            await self._send_status(project_id, "downloading_thumbnail", 20, "Downloading video thumbnail...")
            
            # Step 2: Download thumbnail
            thumbnail_path = self.youtube_processor.download_thumbnail(url, project_id)
            
            # Step 3: Process audio and generate subtitles
            subtitles = await self._process_audio_and_subtitles(video_path, project_id, 35)
            
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
            
            # Step 5: Finalize
            await self._finalize_processing(project_id, subtitles, {
                "video_file": Path(video_path).name if video_path else "",
                "audio_file": f"{project_id}_audio.wav",
                "thumbnail_file": Path(thumbnail_path).name if thumbnail_path else "",
                "subtitle_count": len(subtitles)
            })
        except Exception as e:
            await self._handle_error(project_id, e, "YouTube video processing")
            
    async def process_video_file(self, file_path: str, project_id: str):
        """Process an uploaded video file with unified workflow"""
        try:
            # Send initial status
            await self._send_status(project_id, "processing", 10, "Processing uploaded video file...")
            
            # Step 1: Extract video information
            await self._send_status(project_id, "extracting_info", 20, "Extracting video information...")
            
            # Update project status to processing
            project_manager = get_project_manager()
            project_manager.update_project_status(project_id, "processing", None)
            
            # Step 2: Process audio and generate subtitles
            subtitles = await self._process_audio_and_subtitles(file_path, project_id, 40)
            
            # Step 3: Save file-specific metadata
            project_dir = settings.get_project_dir(project_id)
            self.file_processor._save_project_metadata(project_dir, project_id, file_path)
            
            # Step 4: Finalize (include video & thumbnail information if created)
            await self._finalize_processing(project_id, subtitles, {
                "video_file": Path(file_path).name,
                "audio_file": f"{project_id}_audio.wav",
                "thumbnail_file": f"{project_id}_thumbnail.webp",  # May or may not exist; frontend can attempt fetch
                "subtitle_count": len(subtitles)
            })
        except Exception as e:
            await self._handle_error(project_id, e, "video file processing")
    
    async def _process_audio_and_subtitles(self, video_path: str, project_id: str, start_progress: int):
        """Common audio processing and subtitle generation workflow"""
        # Extract audio
        await self._send_status(project_id, "extracting_audio", start_progress, "Extracting audio from video...")
        
        # Use the same extract_audio method for both processors
        audio_path = self.youtube_processor.extract_audio(video_path, project_id)
        
        await self._send_status(project_id, "generating_subtitles", start_progress + 25, 
                               "Generating subtitles with speech recognition...")
        
        # Generate subtitles
        subtitles = self.subtitle_generator.generate_transcription(audio_path)
        
        return subtitles
    
    async def _finalize_processing(self, project_id: str, subtitles: list, completion_data: Dict[str, Any]):
        """Common finalization workflow"""
        project_dir = settings.get_project_dir(project_id)
        # Convert raw dict subtitles to CaptionData objects if necessary for downstream utilities
        processed_subtitles = [
            s if isinstance(s, CaptionData) else CaptionData(**s) for s in subtitles
        ]
        # Save subtitles as JSON (raw dict form is acceptable) and generate ASS file
        self.youtube_processor._save_subtitles(project_dir, subtitles)
        try:
            default_config = SubtitleConfig()
            ass_path = save_ass_file(project_id, processed_subtitles, default_config)
            logger.info(f"ASS subtitles saved successfully: {ass_path}")
        except Exception as e:
            logger.error(f"Failed to generate or save ASS subtitles for project {project_id}: {e}")
        db = get_project_manager()
        # Persist detected source language once (after metadata writes by processors)
        detected_lang = getattr(self.subtitle_generator, 'last_detected_language', None)
        if detected_lang:
            try:
                db.update_project_metadata(project_id, source_language=detected_lang)
            except Exception as e:
                logger.error(f"Failed to persist detected language for project {project_id}: {e}")
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
        
        await manager.send_to_project(project_id, {
            "project_id": project_id,
            "type": "error",
            "message": f"Processing failed: {str(error)}"
        })
        
        # Update project status to failed
        try:
            project_manager = get_project_manager()
            project_manager.update_project_status(project_id, "failed", None)
        except Exception as db_error:
            logger.error(f"Failed to update project status: {str(db_error)}")
