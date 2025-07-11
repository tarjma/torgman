import json
import logging
from abc import ABC, abstractmethod
from datetime import datetime
from pathlib import Path
from typing import Any, Dict

from moviepy import VideoFileClip

from ..core.config import settings

logger = logging.getLogger(__name__)


class BaseVideoProcessor(ABC):
    """Base class for video processing services with common functionality"""
    
    def __init__(self):
        logger.info(f"{self.__class__.__name__} initialized")
    
    def extract_audio(self, video_path: str, project_id: str) -> str:
        """Extract audio from video using MoviePy for better processing"""
        project_dir = settings.get_project_dir(project_id)
        output_path = project_dir / f"{project_id}_audio.wav"
        
        # Load video with MoviePy
        video_clip = VideoFileClip(video_path)
        
        # Extract audio
        audio_clip = video_clip.audio
        
        # Write audio to file with specific parameters for speech recognition
        audio_clip.write_audiofile(
            str(output_path),
            fps=16000,  # 16kHz sample rate for speech recognition
            nbytes=2,   # 16-bit audio
            codec='pcm_s16le',  # WAV format
            logger=None  # Suppress MoviePy logs
        )
        
        # Clean up
        audio_clip.close()
        video_clip.close()
        
        if output_path.exists():
            logger.info(f"Audio extracted successfully using MoviePy: {output_path}")
            return str(output_path)
        else:
            raise Exception("Audio file not found after extraction")
    
    def _save_project_metadata(self, project_dir: Path, project_id: str, **kwargs) -> None:
        """Save project metadata to a JSON file"""
        metadata = {
            "project_id": project_id,
            "created_at": datetime.now().isoformat(),
            **kwargs  # Allow subclasses to add specific metadata
        }
        
        metadata_path = project_dir / "metadata.json"
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
