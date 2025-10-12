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
        # Extract basic video info
        info = self.get_video_info(str(file_path))
        
        # Check if project already has a title (from upload form)
        from ..services.project_manager import get_project_manager
        project_manager = get_project_manager()
        existing_project = project_manager.get_project(project_id)
        
        # Use existing title if available, otherwise fall back to filename
        # ProjectData is a Pydantic model, so access attributes directly
        if existing_project and existing_project.title:
            project_title = existing_project.title
            project_video_title = existing_project.title
        else:
            project_title = info.get("title")
            project_video_title = info.get("title")
        
        # Attempt to create a thumbnail for the uploaded file
        thumbnail_name = self.generate_thumbnail(project_dir, project_id, str(file_path))
        
        # Persist metadata without overwriting user-provided title
        super()._save_project_metadata(
            project_dir,
            project_id,
            original_file=str(file_path),
            audio_file=f"{project_id}_audio.wav",
            video_file=Path(file_path).name,
            thumbnail_file=thumbnail_name if thumbnail_name else None,
            title=project_title,                # Preserve user-provided title
            video_title=project_video_title,    # Preserve user-provided title
            duration=int(info.get("duration") or 0),
            format=info.get("format"),
            width=info.get("width"),
            height=info.get("height")
        )

    def generate_thumbnail(self, project_dir: Path, project_id: str, video_path: str) -> str | None:
        """Generate a single thumbnail image (webp) from the uploaded video.
        Picks a frame at 1 second (or 0 if shorter). Returns filename or None if it fails."""
        try:
            thumbnail_filename = f"{project_id}_thumbnail.webp"
            output_path = project_dir / thumbnail_filename
            (
                ffmpeg
                .input(video_path, ss=1)
                .output(str(output_path), vframes=1, format='webp')
                .overwrite_output()
                .run(capture_stdout=True, capture_stderr=True)
            )
            if output_path.exists():
                logger.info(f"Generated thumbnail for project {project_id}: {output_path}")
                return thumbnail_filename
        except ffmpeg.Error as e:
            msg = e.stderr.decode() if e.stderr else str(e)
            logger.warning(f"Thumbnail generation failed for {video_path}: {msg}")
        except Exception as e:
            logger.warning(f"Unexpected error during thumbnail generation for {video_path}: {e}")
        return None
