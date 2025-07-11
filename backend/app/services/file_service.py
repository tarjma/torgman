import logging
from pathlib import Path
from typing import Any, Dict
from moviepy import VideoFileClip

from .base_video_processor import BaseVideoProcessor

logger = logging.getLogger(__name__)

class VideoFileProcessor(BaseVideoProcessor):
    """Process video files to extract audio and metadata for subtitle generation"""
    
    def __init__(self):
        logger.info("Video file processor initialized")
    
    def get_video_info(self, file_path: str) -> Dict[str, Any]:
        """Extract video information using MoviePy"""
        
        with VideoFileClip(file_path) as clip:
            duration = clip.duration
            title = Path(file_path).stem  # Use filename without extension as title
            
            # Get file size
            file_size = Path(file_path).stat().st_size
            
            return {
                "title": title,
                "duration": duration,
                "format": Path(file_path).suffix.lower().lstrip('.'),
                "size": file_size,
            }
        
    def _save_project_metadata(self, project_dir: Path, project_id: str, file_path: str) -> None:
        """Save file-specific project metadata"""
        super()._save_project_metadata(
            project_dir, 
            project_id, 
            original_file=str(file_path),
            audio_file=f"{project_id}_audio.wav"
        )
