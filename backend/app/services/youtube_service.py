import logging
from typing import Any, Dict
import yt_dlp

from ..core.config import settings

logger = logging.getLogger(__name__)

class YouTubeAudioProcessor:
    """Process YouTube videos to extract audio for subtitle generation"""
    
    def __init__(self):
        self.temp_dir = settings.temp_dir / "audio"
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"YouTube audio processor initialized, temp dir: {self.temp_dir}")
    
    def get_video_info(self, url: str) -> Dict[str, Any]:
        """Get YouTube video information without downloading"""
        # Import here to handle missing dependencies gracefully
        
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            
            return {
                "title": info.get("title", "Unknown Title"),
                "duration": info.get("duration", 0),
                "thumbnail": info.get("thumbnail"),
                "uploader": info.get("uploader"),
                "description": info.get("description", "")[:500]  # Truncate description
            }
    
    def extract_audio(self, url: str, project_id: str, resolution: str = "720p") -> str:
        """Extract audio from YouTube video with specified resolution"""
            
        output_path = self.temp_dir / f"{project_id}.wav"
        
        # Build format selector based on resolution
        format_selector = self._build_format_selector(resolution)
        
        ydl_opts = {
            'format': format_selector,
            'outtmpl': str(output_path).replace('.wav', '.%(ext)s'),
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'wav',
                'preferredquality': '192',
            }],
            'quiet': True,
            'no_warnings': True,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
        
        if output_path.exists():
            logger.info(f"Audio extracted successfully: {output_path}")
            return str(output_path)
        else:
            raise Exception("Audio file not found after extraction")
    
    def _build_format_selector(self, resolution: str) -> str:
        """Build yt-dlp format selector based on resolution preference"""
        # Map resolution preferences to yt-dlp format selectors
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
    
    def get_available_formats(self, url: str) -> Dict[str, Any]:
        """Get available video formats and resolutions"""
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            
            formats = info.get('formats', [])
            resolutions = set()
            
            for fmt in formats:
                if fmt.get('height'):
                    resolutions.add(f"{fmt['height']}p")
            
            # Sort resolutions
            available_resolutions = sorted(list(resolutions), 
                                         key=lambda x: int(x.replace('p', '')))
            
            return {
                "available_resolutions": available_resolutions,
                "recommended": "720p" if "720p" in available_resolutions else available_resolutions[-1] if available_resolutions else "best"
            }