import json
import logging
from abc import ABC, abstractmethod
from datetime import datetime
from pathlib import Path
from typing import Any, Dict

import ffmpeg
from ..core.config import settings

logger = logging.getLogger(__name__)


class BaseVideoProcessor(ABC):
    """Base class for video processing services with common functionality"""
    
    def __init__(self):
        logger.info(f"{self.__class__.__name__} initialized")
    
    def extract_audio(self, video_path: str, project_id: str) -> str:
        """Extract audio from video using ffmpeg-python"""
        project_dir = settings.get_project_dir(project_id)
        output_path = project_dir / f"{project_id}_audio.wav"
        
        logger.info(f"Extracting audio from {video_path} to {output_path}")
        
        try:
            (
                ffmpeg
                .input(video_path)
                .output(
                    str(output_path),
                    acodec='pcm_s16le',  # Codec for WAV format, good for Whisper
                    ar='16000',          # 16kHz sample rate
                    ac=1                 # Mono audio
                )
                .overwrite_output()
                .run(capture_stdout=True, capture_stderr=True)
            )
            
            if output_path.exists():
                logger.info(f"Audio extracted successfully using ffmpeg-python: {output_path}")
                return str(output_path)
            else:
                raise Exception("Audio file not found after ffmpeg extraction")
                
        except ffmpeg.Error as e:
            error_message = e.stderr.decode() if e.stderr else str(e)
            logger.error(f"ffmpeg-python audio extraction failed: {error_message}")
            raise Exception(f"Audio extraction failed: {error_message}")
        except Exception as e:
            logger.error(f"Unexpected error during audio extraction: {e}")
            raise Exception(f"Audio extraction failed: {e}")
    
    def _save_project_metadata(self, project_dir: Path, project_id: str, **kwargs) -> None:
        """Save project metadata to a JSON file preserving existing detected source_language if present."""
        metadata_path = project_dir / "metadata.json"
        existing_source_lang = None
        if metadata_path.exists():
            try:
                with open(metadata_path, 'r', encoding='utf-8') as f:
                    prior = json.load(f)
                    existing_source_lang = prior.get("source_language") or prior.get("language")
            except Exception:
                existing_source_lang = None
        metadata = {
            "project_id": project_id,
            "created_at": datetime.now().isoformat(),
            **kwargs
        }
        if existing_source_lang and "source_language" not in metadata:
            metadata["source_language"] = existing_source_lang
        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2)
        logger.info(f"Project metadata saved: {metadata_path}")
    
    def _save_subtitles(self, project_dir: Path, subtitles: Dict[str, Any]) -> None:
        """Save subtitles to a JSON file"""
        subtitles_path = project_dir / "subtitles.json"
        with open(subtitles_path, 'w', encoding='utf-8') as f:
            json.dump(subtitles, f, indent=2, ensure_ascii=False)
        logger.info(f"Subtitles saved successfully: {subtitles_path}")
    
    @abstractmethod
    def get_video_info(self, source: str) -> Dict[str, Any]:
        """Get video information - must be implemented by subclasses"""
        pass
