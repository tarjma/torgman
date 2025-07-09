import logging
import subprocess
from pathlib import Path
from typing import Any, Dict

from moviepy import VideoFileClip

from ..core.config import settings

logger = logging.getLogger(__name__)

class VideoFileProcessor:
    """Process video files to extract audio and metadata for subtitle generation"""
    
    def __init__(self):
        logger.info("Video file processor initialized")
    
    def get_video_info(self, file_path: str) -> Dict[str, Any]:
        """Extract video information using FFprobe"""
        # Use FFprobe to get video information
        cmd = [
            'ffprobe',
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_format',
            '-show_streams',
            file_path
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        import json
        info = json.loads(result.stdout)
        
        # Extract relevant information
        format_info = info.get('format', {})
        video_streams = [s for s in info.get('streams', []) if s.get('codec_type') == 'video']
        
        duration = float(format_info.get('duration', 0))
        title = Path(file_path).stem  # Use filename without extension as title
        
        return {
            "title": title,
            "duration": duration,
            "format": format_info.get('format_name', 'unknown'),
            "size": int(format_info.get('size', 0)),
            "bit_rate": format_info.get('bit_rate'),
            "video_streams": len(video_streams)
        }
        
    def extract_audio(self, video_path: str, project_id: str) -> str:
        """Extract audio from YouTube video using MoviePy for better processing"""
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

    def _save_project_metadata(self, project_dir: Path, project_id: str, file_path: str) -> None:
        """Save project metadata to a JSON file"""
        import json
        from datetime import datetime
        
        metadata = {
            "project_id": project_id,
            "original_file": str(file_path),
            "created_at": datetime.now().isoformat(),
            "audio_file": f"{project_id}_audio.wav",
        }
        
        metadata_path = project_dir / "metadata.json"
        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2)
        logger.info(f"Project metadata saved: {metadata_path}")
