from fastapi import APIRouter, HTTPException
import logging
import asyncio

from ..models.project import YouTubeProcessRequest
from ..services.youtube_service import YouTubeVideoProcessor
from ..services.project_manager import get_project_manager
from ..utils.youtube_utils import extract_youtube_id

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/youtube", tags=["youtube"])

# Initialize YouTube processor
youtube_processor = YouTubeVideoProcessor()

@router.get("/info")
async def get_youtube_info(url: str):
    """Extract YouTube video information"""
    logger.info(f"Fetching YouTube video info for URL: {url}")
    video_info = youtube_processor.get_video_info(url)
    if not video_info or not video_info.get("title"):
        raise HTTPException(status_code=502, detail="Failed to retrieve video metadata from YouTube")
    # Filter formats that are video (have height) and not audio-only
    raw_formats = video_info.get('formats', []) or []
    # Ignore m3u8/HLS formats to avoid suggesting resolutions that would likely cause 403 fragment errors
    video_formats = [
        f for f in raw_formats
        if f.get('vcodec') != 'none' and f.get('height') and f.get('protocol') != 'm3u8'
    ]
    resolutions_set = {f"{f['height']}p" for f in video_formats}
    sorted_resolutions = sorted(
        list(resolutions_set),
        key=lambda r: int(r[:-1]),
        reverse=True
    )
    recommended_resolution = sorted_resolutions[0] if sorted_resolutions else "N/A"

    # Human readable size helper
    def _human_bytes(num: int) -> str:
        units = ["B", "KB", "MB", "GB", "TB"]
        size = float(num)
        for u in units:
            if size < 1024 or u == units[-1]:
                return f"{size:.2f} {u}"
            size /= 1024

    # Build size estimates per resolution. Strategy:
    # - For each resolution, look for progressive format (has both video+audio) with that height (acodec != none)
    # - If not found, find best video-only + best audio-only and sum their sizes (filesize or filesize_approx)
    # - If sizes not available, estimate via (tbr kbps * duration seconds)/8.
    def _bytes_for_format(fmt: dict) -> int:
        return (
            fmt.get('filesize') or
            fmt.get('filesize_approx') or
            0
        )
    def _estimate_from_tbr(fmt: dict, duration: float) -> int:
        # tbr is in kbps (approx). Convert to bytes: kbps * 1000 / 8 * duration
        tbr = fmt.get('tbr')
        if not tbr or not duration:
            return 0
        return int((tbr * 1000 / 8) * duration)
    duration = video_info.get('duration') or 0
    # Separate audio-only formats for combining if needed
    audio_formats = [
        f for f in raw_formats
        if f.get('acodec') != 'none' and f.get('vcodec') == 'none' and f.get('protocol') != 'm3u8'
    ]
    # Pick best audio by abr or filesize
    def _best_audio():
        if not audio_formats:
            return None
        # Prefer largest filesize; fallback to highest abr
        af_sorted = sorted(audio_formats, key=lambda a: (_bytes_for_format(a), a.get('abr') or 0), reverse=True)
        return af_sorted[0]
    best_audio = _best_audio()
    resolution_sizes = []
    seen = set()
    for res in sorted_resolutions:
        h = int(res[:-1])
        # Progressive candidate: has both audio & video
        progressive_candidates = [f for f in video_formats if f.get('height') == h and f.get('acodec') != 'none']
        progressive = None
        if progressive_candidates:
            # Pick largest filesize else highest tbr
            progressive = sorted(progressive_candidates, key=lambda f: (_bytes_for_format(f), f.get('tbr') or 0), reverse=True)[0]
        total_bytes = 0
        detail = {}
        if progressive:
            size = _bytes_for_format(progressive)
            if not size:
                size = _estimate_from_tbr(progressive, duration)
            total_bytes = size
            detail = {"type": "progressive", "format_id": progressive.get('format_id')}
        else:
            # Separate video-only + best audio
            video_only_candidates = [f for f in video_formats if f.get('height') == h and f.get('acodec') == 'none']
            if video_only_candidates and best_audio:
                video_only = sorted(video_only_candidates, key=lambda f: (_bytes_for_format(f), f.get('tbr') or 0), reverse=True)[0]
                v_size = _bytes_for_format(video_only) or _estimate_from_tbr(video_only, duration)
                a_size = _bytes_for_format(best_audio) or _estimate_from_tbr(best_audio, duration)
                total_bytes = v_size + a_size
                detail = {"type": "separate", "video_format_id": video_only.get('format_id'), "audio_format_id": best_audio.get('format_id')}
        if total_bytes:
            if h not in seen:
                seen.add(h)
                resolution_sizes.append({
                    "resolution": res,
                    "bytes": total_bytes,
                    "human_size": _human_bytes(total_bytes),
                    "detail": detail
                })

    # (No post processing needed since helper is defined before use)
    
    return {
        "video_id": extract_youtube_id(url),
        "title": video_info.get("title"),
        "duration": video_info.get("duration"),
        "thumbnail": video_info.get("thumbnail"),
        "uploader": video_info.get("uploader"),
        "description": video_info.get("description"),
        "available_resolutions": sorted_resolutions,
        "recommended_resolution": recommended_resolution,
        "resolution_sizes": resolution_sizes
    }

@router.post("/process")
async def process_youtube_video(request: YouTubeProcessRequest):
    """Create a new project and start processing YouTube video"""
    # Get video info
    logger.info(f"Processing YouTube video for URL: {request.url} into project {request.project_id}")
    video_info = youtube_processor.get_video_info(request.url)

    # Strict validation: if a numeric resolution is requested, ensure it's actually available
    if request.resolution not in ("best", "worst") and video_info:
        raw_formats = video_info.get('formats', []) or []
        video_formats = [f for f in raw_formats if f.get('vcodec') != 'none' and f.get('height')]
        available_heights = sorted({f.get('height') for f in video_formats})
        res_num = ''.join(ch for ch in request.resolution if ch.isdigit())
        valid = res_num.isdigit() and int(res_num) in available_heights
        logger.info(f"Requested resolution {request.resolution}, available heights: {available_heights}, valid: {valid}")
        if not valid:
            # Build user-friendly list like ["1080p", "720p", ...]
            available = [f"{h}p" for h in available_heights]
            raise HTTPException(status_code=400, detail={
                "message": f"Requested resolution {request.resolution} is not available for this video.",
                "available_resolutions": available
            })
    
    # Create project 
    project_manager = get_project_manager()
    project_data = {
        "id": request.project_id,
        "title": video_info.get("title", "YouTube Video"),
        "description": video_info.get("description", ""),
        "video_title": video_info.get("title", "YouTube Video"),
        "youtube_url": request.url,
        "video_url": request.url,
        "duration": video_info.get("duration", 0),
        "resolution": request.resolution,
        "status": "processing",
        "language": "ar",  # Default language
        "uploader": video_info.get("uploader", "")
    }
    
    # Save project
    success = project_manager.create_project(project_data)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to create project")
    
    # Start background processing
    from ..tasks.video_processing import process_youtube_video_task
    asyncio.create_task(process_youtube_video_task(
        request.url, 
        request.project_id, 
        request.resolution
    ))
    
    return {
        "project_id": request.project_id,
        "status": "processing",
        "message": "Project created, processing started"
    }
    
