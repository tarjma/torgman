import asyncio
import logging
from pathlib import Path

import ffmpeg

from ..api.config import SubtitleConfig
from ..api.websocket import manager as websocket_manager
from ..core.config import settings
from ..services.project_manager import get_project_manager
from ..utils.ass_utils import save_ass_file

logger = logging.getLogger(__name__)

class ExportService:
    """Service for exporting videos with ASS subtitles using ffmpeg"""
    
    async def burn_subtitles(self, project_id: str, export_format: str = "hard", config: SubtitleConfig = None) -> str:
        """
        Burn ASS subtitles into video or create soft subtitle version
        
        Args:
            project_id: The project identifier
            export_format: "hard" for burned-in subtitles, "soft" for separate track
            config: Subtitle configuration for styling (optional, loads from saved config if None)
            
        Returns:
            str: Filename of the exported video
        """
        project_dir = settings.get_project_dir(project_id)
        
        # Find video file
        video_files = list(project_dir.glob(f"{project_id}_video.*"))
        if not video_files:
            raise FileNotFoundError("Original video file not found for export.")
        video_path = video_files[0]
        
        # Get subtitles from project manager
        project_manager = get_project_manager()
        subtitles = project_manager.get_project_subtitles(project_id)
        if not subtitles:
            raise ValueError("No subtitles found for this project.")
        
        # Use provided config override if passed; otherwise load per-project then global config
        if config is None:
            config = await self._load_project_or_global_subtitle_config(project_id)
        logger.info(f"Loaded subtitle configuration {config}")
        
        await websocket_manager.send_to_project(project_id, {
            "project_id": project_id,
            "type": "export_status", 
            "status": "generating_subtitles", 
            "progress": 15, 
            "message": "جاري إنشاء ملف الترجمة بالإعدادات المحددة..."
        })
        
        # Generate ASS file with user's configuration
        ass_path = save_ass_file(project_id, subtitles, config)
        logger.info(f"Generated ASS file with user config: {ass_path}")
    
        # Determine output filename and format
        if export_format == "soft":
            output_filename = f"{project_id}_export.mkv"  # MKV supports soft subtitles
        else:
            output_filename = f"{project_id}_export.mp4"  # MP4 for hard subtitles
            
        output_path = project_dir / output_filename

        await websocket_manager.send_to_project(project_id, {
            "project_id": project_id,
            "type": "export_status", 
            "status": "export_started", 
            "progress": 10, 
            "message": "جاري بدء تصدير الفيديو..."
        })

        if export_format == "soft":
            await self._export_soft_subtitles(video_path, ass_path, output_path, project_id)
        else:
            await self._export_hard_subtitles(video_path, ass_path, output_path, project_id)

        # Send final progress update
        await websocket_manager.send_to_project(project_id, {
            "project_id": project_id,
            "type": "export_status",
            "status": "finalizing", 
            "progress": 90, 
            "message": "جاري إنهاء عملية التصدير..."
        })

        logger.info(f"Video exported successfully for project {project_id}: {output_path}")
        return output_filename
    
    async def _export_hard_subtitles(self, video_path: Path, ass_path: Path, output_path: Path, project_id: str):
        """Export video with burned-in subtitles"""
        await websocket_manager.send_to_project(project_id, {
            "project_id": project_id,
            "type": "export_status",
            "status": "burning_subtitles", 
            "progress": 30, 
            "message": "جاري دمج الترجمة في الفيديو..."
        })
        
        # Run ffmpeg in a thread to avoid blocking
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self._run_hard_subtitle_export, 
                                   str(video_path), str(ass_path), str(output_path), project_id)
    
    def _run_hard_subtitle_export(self, video_path: str, ass_path: str, output_path: str, project_id: str):
        """Run the actual ffmpeg command for hard subtitles"""
        # Prefer system-installed custom fonts directory in Docker
        import os
        system_fontsdir = "/usr/share/fonts/truetype/custom"
        fontsdir = system_fontsdir if os.path.isdir(system_fontsdir) else str(settings.fonts_dir)

        # Use ffmpeg-python filter API to avoid quoting/escaping issues
        in_stream = ffmpeg.input(video_path)
        # Render ASS subtitles using libass with custom fonts directory
        subbed_video = in_stream.filter(
            'subtitles',
            filename=ass_path,
            fontsdir=fontsdir
        )

        (
            ffmpeg
            .output(
                subbed_video,            # filtered video stream with subtitles
                in_stream.audio,         # original audio stream preserved
                output_path,
                vcodec='libx264',        # H.264 video codec
                acodec='copy',           # Copy audio without re-encoding
                preset='medium',         # Balance between speed and quality
                crf=23                   # Constant rate factor for quality
            )
            .overwrite_output()
            .run(capture_stdout=True, capture_stderr=True)
        )

    async def _export_soft_subtitles(self, video_path: Path, ass_path: Path, output_path: Path, project_id: str):
        """Export video with soft subtitles (separate track)"""
        await websocket_manager.send_to_project(project_id, {
            "project_id": project_id,
            "type": "export_status",
            "status": "creating_soft_subtitles", 
            "progress": 30, 
            "message": "جاري إنشاء الفيديو مع الترجمة كأختيار غير أساسى..."
        })
        
        # Run ffmpeg in a thread to avoid blocking
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self._run_soft_subtitle_export, 
                                   str(video_path), str(ass_path), str(output_path), project_id)
    
    def _run_soft_subtitle_export(self, video_path: str, ass_path: str, output_path: str, project_id: str):
        """Run the actual ffmpeg command for soft subtitles"""
        (
            ffmpeg
            .input(video_path)
            .input(ass_path)
            .output(
                output_path,
                vcodec='copy',           # Copy video without re-encoding
                acodec='copy',           # Copy audio without re-encoding
                scodec='ass',            # ASS subtitle codec
                **{'metadata:s:s:0': 'title=Arabic'},  # Subtitle metadata
                **{'disposition:s:s:0': 'default'}     # Make subtitle default
            )
            .overwrite_output()
            .run(capture_stdout=True, capture_stderr=True)
        )
    
    async def _load_project_or_global_subtitle_config(self, project_id: str) -> SubtitleConfig:
        """Load subtitle configuration from the project folder if available, otherwise from global config, else defaults."""
        import json

        # Prefer project-level configuration for per-project customization
        project_config_path = settings.get_project_dir(project_id) / "subtitle-config.json"
        if project_config_path.exists():
            with open(project_config_path, 'r', encoding='utf-8') as f:
                config_data = json.load(f)
            return SubtitleConfig(**config_data)

        # Fallback to global configuration
        global_config_path = settings.data_dir / "config" / "subtitle-config.json"
        if global_config_path.exists():
            with open(global_config_path, 'r', encoding='utf-8') as f:
                config_data = json.load(f)
            return SubtitleConfig(**config_data)

        # Default configuration
        return SubtitleConfig()
