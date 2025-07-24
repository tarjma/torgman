import logging
from pathlib import Path
from typing import Any, Dict
import ffmpeg

from .base_video_processor import BaseVideoProcessor

logger = logging.getLogger(__name__)

class VideoFileProcessor(BaseVideoProcessor):
    """Process video files to extract audio and metadata for subtitle generation"""
    
    def __init__(self):
        logger.info("Video file processor initialized")
    
    def get_video_info(self, file_path: str) -> Dict[str, Any]:
        """Extract video information using ffmpeg probe"""
        
        try:
            # Use ffmpeg probe to get video metadata
            probe = ffmpeg.probe(file_path)
            
            # Extract basic information
            format_info = probe['format']
            duration = float(format_info.get('duration', 0))
            title = Path(file_path).stem  # Use filename without extension as title
            file_size = Path(file_path).stat().st_size
            
            # Get video stream information if available
            video_streams = [stream for stream in probe['streams'] if stream['codec_type'] == 'video']
            width = height = None
            if video_streams:
                video_stream = video_streams[0]
                width = video_stream.get('width')
                height = video_stream.get('height')
            
            return {
                "title": title,
                "duration": duration,
                "format": Path(file_path).suffix.lower().lstrip('.'),
                "size": file_size,
                "width": width,
                "height": height
            }
            
        except ffmpeg.Error as e:
            error_message = e.stderr.decode() if e.stderr else str(e)
            logger.error(f"ffmpeg probe failed for {file_path}: {error_message}")
            
            # Return basic info if probe fails
            return {
                "title": Path(file_path).stem,
                "duration": 0,
                "format": Path(file_path).suffix.lower().lstrip('.'),
                "size": Path(file_path).stat().st_size,
                "width": None,
                "height": None
            }
        
    def _save_project_metadata(self, project_dir: Path, project_id: str, file_path: str) -> None:
        """Save file-specific project metadata"""
        super()._save_project_metadata(
            project_dir, 
            project_id, 
            original_file=str(file_path),
            audio_file=f"{project_id}_audio.wav"
        )
