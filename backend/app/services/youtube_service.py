import logging
from pathlib import Path
from typing import Any, Dict

import requests
import yt_dlp

from ..core.config import settings
from .base_video_processor import BaseVideoProcessor

logger = logging.getLogger(__name__)

class YouTubeVideoProcessor(BaseVideoProcessor):
    """Process YouTube videos to download video and extract audio for subtitle generation"""
    
    def __init__(self):
        # No global temp directory needed - each project gets its own folder
        logger.info("YouTube audio processor initialized")
    
    def get_video_info(self, url: str) -> Dict[str, Any]:
        """Get YouTube video information without downloading"""
        # Import here to handle missing dependencies gracefully
        
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            
        return info
    
    def download_video(self, url: str, project_id: str, resolution: str = "720p") -> str:
        """Download full YouTube video with specified resolution"""
        
        # Get project-specific directory
        project_dir = settings.get_project_dir(project_id)
        output_path = project_dir / f"{project_id}_video.%(ext)s"
        
        # Build format selector for video (includes both video and audio)
        format_selector = self._build_video_format_selector(resolution)
        
        ydl_opts = {
            'format': format_selector,
            'outtmpl': str(output_path),
            'quiet': True,
            'no_warnings': True,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
        
        # Find the downloaded video file (extension is determined by yt-dlp)
        video_files = list(project_dir.glob(f"{project_id}_video.*"))
        if video_files:
            logger.info(f"Video downloaded successfully: {video_files[0]}")
            return str(video_files[0])
        else:
            raise Exception("Video file not found after download")

    def download_thumbnail(self, url: str, project_id: str) -> str:
        """Download YouTube video thumbnail"""
        
        # Get project-specific directory
        project_dir = settings.get_project_dir(project_id)
        
        # Get video info to find best thumbnail
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            
            # Get the best thumbnail URL
            thumbnail_url = info.get('thumbnail')
            if not thumbnail_url:
                # Try to get from thumbnails array
                thumbnails = info.get('thumbnails', [])
                if thumbnails:
                    # Get the highest resolution thumbnail
                    thumbnail_url = max(thumbnails, key=lambda t: t.get('width', 0) * t.get('height', 0)).get('url')
        
        if not thumbnail_url:
            logger.warning(f"No thumbnail found for video: {url}")
            return ""
        
        # Download thumbnail
        response = requests.get(thumbnail_url, timeout=30)
        response.raise_for_status()
        
        # Determine file extension from content type or URL
        content_type = response.headers.get('content-type', '')
        if 'jpeg' in content_type or 'jpg' in content_type:
            ext = 'jpg'
        elif 'png' in content_type:
            ext = 'png'
        elif 'webp' in content_type:
            ext = 'webp'
        else:
            # Fallback to jpg
            ext = 'jpg'
        
        thumbnail_path = project_dir / f"{project_id}_thumbnail.{ext}"
        
        with open(thumbnail_path, 'wb') as f:
            f.write(response.content)
        
        logger.info(f"Thumbnail downloaded successfully: {thumbnail_path}")
        return str(thumbnail_path)
        

    def _build_format_selector(self, resolution: str) -> str:
        """Build yt-dlp format selector based on resolution preference (audio only)"""
        # Map resolution preferences to yt-dlp format selectors for audio extraction
        format_map = {
            "144p": "worst[height<=144]/bestaudio/worst",
            "240p": "best[height<=240]/bestaudio/best",
            "360p": "best[height<=360]/bestaudio/best", 
            "480p": "best[height<=480]/bestaudio/best",
            "720p": "best[height<=720]/bestaudio/best",
            "1080p": "best[height<=1080]/bestaudio/best",
            "best": "best/bestaudio/best",
            "worst": "worst/bestaudio/worst"
        }
        
        # Default to 720p if resolution not recognized
        return format_map.get(resolution, format_map["720p"])

    def _build_video_format_selector(self, resolution: str) -> str:
        """Build yt-dlp format selector for full video download"""
        # Map resolution preferences to yt-dlp format selectors for video download
        format_map = {
            "144p": "best[height<=144]",
            "240p": "best[height<=240]",
            "360p": "best[height<=360]", 
            "480p": "best[height<=480]",
            "720p": "best[height<=720]",
            "1080p": "best[height<=1080]",
            "1440p": "best[height<=1440]",
            "2160p": "best[height<=2160]",
            "best": "best",
            "worst": "worst"
        }
        
        # Default to 720p if resolution not recognized
        return format_map.get(resolution, format_map["720p"])
    
    def _save_project_metadata(self, project_dir: Path, project_id: str, url: str, resolution: str, video_file: str = "", thumbnail_file: str = "") -> None:
        """Save YouTube-specific project metadata"""
        super()._save_project_metadata(
            project_dir, 
            project_id, 
            youtube_url=url,
            resolution=resolution,
            video_file=video_file,
            thumbnail_file=thumbnail_file
        )
