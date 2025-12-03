import logging
from pathlib import Path
from typing import Any, Dict, List

import requests
import yt_dlp
import ffmpeg

from ..core.config import settings
from .base_video_processor import BaseVideoProcessor

logger = logging.getLogger(__name__)

class YouTubeVideoProcessor(BaseVideoProcessor):
    """Process YouTube videos to download video and extract audio for subtitle generation"""
    
    def __init__(self):
        # No global temp directory needed - each project gets its own folder
        logger.info("YouTube audio processor initialized")
    
    def _cookiefile_opt(self) -> Dict[str, Any]:
        opts: Dict[str, Any] = {}
        try:
            if settings.youtube_cookies_file:
                p = Path(settings.youtube_cookies_file)
                if p.exists():
                    opts["cookiefile"] = str(p)
        except Exception:
            pass
        return opts
    def get_video_info(self, url: str) -> Dict[str, Any]:
        ydl_opts: Dict[str, Any] = {
            "quiet": True,
            "no_warnings": True,
            "skip_download": True,
            "noplaylist": True,
            "retries": 3,
            "ignore_no_formats_error": True,
        }
        ydl_opts.update(self._cookiefile_opt())
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
        
        # Extract available audio languages and detect the original language
        if info and info.get('formats'):
            audio_languages = set()
            for fmt in info['formats']:
                # Check if this is an audio format
                if fmt.get('acodec') != 'none':
                    lang = fmt.get('language') or fmt.get('lang')
                    if lang:
                        audio_languages.add(lang)
            
            info['available_audio_languages'] = sorted(list(audio_languages))
            # Try to detect the original/default language from video metadata
            # YouTube typically provides 'language' field for the video's original language
            info['original_audio_language'] = info.get('language') or (info['available_audio_languages'][0] if info['available_audio_languages'] else None)
            logger.info(f"Available audio languages: {info['available_audio_languages']}, Original: {info.get('original_audio_language')}")
        
        return info or {}
    
    def download_video(self, url: str, project_id: str, resolution: str = "720p", video_info: Dict[str, Any] | None = None, audio_language: str | None = None) -> str:
        """Download full YouTube video with specified resolution and audio language.
        If video_info provided, derive best safe format chain from actual heights to avoid unavailable format errors.
        
        Args:
            url: YouTube video URL
            project_id: Project identifier
            resolution: Video resolution (e.g., '720p', '1080p', 'best')
            video_info: Optional pre-fetched video info dict
            audio_language: Optional audio language code (e.g., 'en', 'ar', 'es'). If None, uses default audio.
        """
        
        # Get project-specific directory
        project_dir = settings.get_project_dir(project_id)
        output_path = project_dir / f"{project_id}_video.%(ext)s"
        
        # STRICT MODE: Only attempt exactly the requested resolution (or best/worst special cases)
        format_selector = self._build_video_format_selector(resolution, audio_language)
        # If formats are missing, attempt to re-extract a fresh info dict with formats
        if not video_info or not video_info.get('formats'):
            probe_opts = {
                'quiet': True,
                'no_warnings': True,
                'ignoreerrors': True,
                'skip_download': True,
                'extract_flat': False,
                'retries': 2,
                'fragment_retries': 2,
                'noplaylist': True,
                'http_headers': {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
                    'Accept-Language': 'en-US,en;q=0.9'
                }
            }
            if settings.youtube_cookies_file:
                from pathlib import Path as _P
                _cookie = _P(settings.youtube_cookies_file)
                if _cookie.exists():
                    probe_opts['cookiefile'] = str(_cookie)
            with yt_dlp.YoutubeDL(probe_opts) as ydl_probe:
                video_info = ydl_probe.extract_info(url, download=False) or {}
        if video_info and video_info.get('formats'):
            raw_formats: List[Dict[str, Any]] = video_info['formats']
            available_heights: List[int] = sorted({
                f.get('height') for f in raw_formats
                if f.get('vcodec') != 'none' and f.get('height')
            })
            logger.info(f"Available heights for project {project_id}: {available_heights}")

            # Helper to get byte size or approx
            def _bytes(fmt: Dict[str, Any]) -> int:
                return int(fmt.get('filesize') or fmt.get('filesize_approx') or 0)

            # Determine target height 'h'
            if resolution not in ("best", "worst"):
                num = ''.join(ch for ch in resolution if ch.isdigit())
                if not (num.isdigit() and int(num) in available_heights):
                    raise Exception(f"Requested resolution {resolution} not available. Available: {available_heights}")
                h = int(num)
            elif resolution == 'worst':
                if not available_heights:
                    raise Exception("No video heights available")
                h = available_heights[0]
            else:  # best
                if not available_heights:
                    raise Exception("No video heights available")
                h = available_heights[-1]

            # Choose exact formats at height h
            video_height_formats = [f for f in raw_formats if f.get('vcodec') != 'none' and f.get('height') == h]
            # Avoid HLS/m3u8 where possible to reduce fragment-related 403s
            progressive_candidates = [
                f for f in video_height_formats
                if f.get('acodec') != 'none' and f.get('protocol') != 'm3u8'
            ]
            
            # Filter progressive candidates by audio language if specified
            if audio_language and progressive_candidates:
                lang_filtered = [
                    f for f in progressive_candidates
                    if f.get('language') == audio_language or f.get('lang') == audio_language
                ]
                if lang_filtered:
                    progressive_candidates = lang_filtered
                    logger.info(f"Filtered progressive formats to audio language: {audio_language}")
                else:
                    logger.warning(f"No progressive formats found with audio language {audio_language}, using all available")
            
            if progressive_candidates:
                # Pick largest progressive by bytes then tbr
                prog = sorted(progressive_candidates, key=lambda f: (_bytes(f), f.get('tbr') or 0), reverse=True)[0]
                format_selector = str(prog.get('format_id'))
            else:
                video_only_candidates = [
                    f for f in video_height_formats
                    if f.get('acodec') == 'none' and f.get('protocol') != 'm3u8'
                ]
                if not video_only_candidates:
                    raise Exception(f"No video-only format found at {h}p")
                best_video = sorted(video_only_candidates, key=lambda f: (_bytes(f), f.get('tbr') or 0), reverse=True)[0]
                audio_formats = [
                    f for f in raw_formats
                    if f.get('acodec') != 'none' and f.get('vcodec') == 'none' and f.get('protocol') != 'm3u8'
                ]
                
                # Filter audio formats by language if specified
                if audio_language and audio_formats:
                    lang_filtered_audio = [
                        f for f in audio_formats
                        if f.get('language') == audio_language or f.get('lang') == audio_language
                    ]
                    if lang_filtered_audio:
                        audio_formats = lang_filtered_audio
                        logger.info(f"Filtered audio-only formats to language: {audio_language}")
                    else:
                        logger.warning(f"No audio formats found with language {audio_language}, using all available")
                
                if not audio_formats:
                    raise Exception("No audio-only formats available to merge")
                # Prefer largest audio by bytes then abr
                best_audio = sorted(audio_formats, key=lambda a: (_bytes(a), a.get('abr') or 0), reverse=True)[0]
                v_id = str(best_video.get('format_id'))
                a_id = str(best_audio.get('format_id'))
                format_selector = f"{v_id}+{a_id}/{v_id}"
        logger.info(f"STRICT YouTube format selector for project {project_id}: {format_selector}")
        
        ydl_opts = {
            'format': format_selector,
            'outtmpl': str(output_path),
            'quiet': True,
            'no_warnings': True,
            'retries': 10,
            'fragment_retries': 10,
            'ignoreerrors': False,
            'noplaylist': True,
            'concurrent_fragment_downloads': 1,
            'extractor_retries': 5,
            'file_access_retries': 5,
            'sleep_interval': 1,
            'max_sleep_interval': 5,
            'sleep_interval_requests': 1,
            'http_headers': {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Sec-Fetch-Mode': 'navigate',
            }
        }
        
        # Attach cookies file if configured
        if settings.youtube_cookies_file:
            from pathlib import Path as _P
            cookie_path = _P(settings.youtube_cookies_file)
            if cookie_path.exists():
                ydl_opts['cookiefile'] = str(cookie_path)
        
        # Add PO token if configured (helps bypass YouTube bot detection)
        if settings.youtube_po_token:
            ydl_opts['extractor_args'] = {
                'youtube': {
                    'player_client': ['web'],
                    'po_token': [f'web+{settings.youtube_po_token}']
                }
            }
            logger.info("Using PO token for YouTube download")
        
        # Try download with multiple fallback strategies
        download_attempts = [
            (format_selector, "primary format"),
            ('best[height<=720]/best', "best quality fallback"),
            ('18/best', "format 18 fallback"),  # 360p progressive
        ]
        
        last_error = None
        for fmt, description in download_attempts:
            try:
                logger.info(f"Attempting download with {description}: {fmt}")
                ydl_opts['format'] = fmt
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    ydl.download([url])
                break  # Success, exit loop
            except Exception as e:
                last_error = e
                error_str = str(e)
                if '403' in error_str or 'Forbidden' in error_str:
                    logger.warning(f"Got 403 error with {description}, trying next fallback...")
                    continue
                else:
                    raise  # Non-403 error, don't retry
        else:
            # All attempts failed
            if last_error:
                raise last_error
        
        # Find the downloaded video file (extension is determined by yt-dlp)
        video_files = list(project_dir.glob(f"{project_id}_video.*"))
        if video_files:
            video_path = video_files[0]
            # Probe actual resolution
            probe = ffmpeg.probe(str(video_path))
            v_stream = next((s for s in probe.get('streams', []) if s.get('codec_type') == 'video'), None)
            if v_stream:
                w = v_stream.get('width')
                h = v_stream.get('height')
                logger.info(f"Downloaded video actual resolution: {w}x{h} (project {project_id})")
            size_bytes = video_path.stat().st_size
            logger.info(f"Downloaded file size: {size_bytes} bytes (~{size_bytes/1024/1024:.2f} MB) for project {project_id}")
            logger.info(f"Video downloaded successfully: {video_path}")
            return str(video_path)
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

    def _build_video_format_selector(self, resolution: str, audio_language: str | None = None) -> str:
        """Strict selector before video_info (limited context).
        
        Args:
            resolution: Video resolution (e.g., '720p', '1080p', 'best')
            audio_language: Optional audio language code (e.g., 'en', 'ar', 'es')
        
        Returns:
            Format selector string for yt-dlp
        """
        # Build audio selector with optional language filter
        if audio_language:
            audio_selector = f"bestaudio[language={audio_language}]/bestaudio"
            logger.info(f"Audio language specified: {audio_language}, using audio selector: {audio_selector}")
        else:
            audio_selector = "bestaudio"
        
        if resolution == "worst":
            return f"worst+{audio_selector}/worst"
        if resolution == "best":
            return f"bestvideo+{audio_selector}/bestvideo"
        num = ''.join(ch for ch in resolution if ch.isdigit())
        if not num.isdigit():
            # Default strict height
            return f"bestvideo[height=720]+{audio_selector}/bestvideo[height=720]"
        h = int(num)
        return f"bestvideo[height={h}]+{audio_selector}/bestvideo[height={h}]"
    
    def _save_project_metadata(self, project_dir: Path, project_id: str, url: str, resolution: str, video_file: str = "", thumbnail_file: str = "", video_info: Dict[str, Any] = None) -> None:
        """Save YouTube-specific project metadata"""
        
        # Get video info if not provided
        if not video_info:
            try:
                video_info = self.get_video_info(url)
            except Exception as e:
                logger.warning(f"Could not get video info for metadata: {e}")
                video_info = {}
        
        # Extract relevant information from video_info
        title = video_info.get("title", "YouTube Video")
        description = video_info.get("description", "")
        duration = video_info.get("duration", 0)
        uploader = video_info.get("uploader", "")
        
        # Augment with actual file properties if present
        actual_resolution = ""
        video_size_bytes = 0
        if video_file:
            vf = project_dir / video_file
            if vf.exists():
                video_size_bytes = vf.stat().st_size
                probe = ffmpeg.probe(str(vf))
                v_stream = next((s for s in probe.get('streams', []) if s.get('codec_type') == 'video'), None)
                if v_stream:
                    actual_resolution = f"{v_stream.get('width')}x{v_stream.get('height')}"
        super()._save_project_metadata(
            project_dir,
            project_id,
            title=title,
            description=description,
            video_title=title,
            youtube_url=url,
            video_url=url,
            requested_resolution=resolution,
            actual_video_resolution=actual_resolution,
            video_size_bytes=video_size_bytes,
            duration=duration,
            video_file=video_file,
            thumbnail_file=thumbnail_file,
            uploader=uploader
        )
