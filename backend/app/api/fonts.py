from fastapi import APIRouter
from typing import List, Dict
import logging
from pathlib import Path

from ..core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/fonts", response_model=List[Dict[str, str]])
async def get_available_fonts():
    """Get list of available fonts from the backend."""
    fonts: List[Dict[str, str]] = []

    # Collect from app assets fonts directory
    assets_dir = settings.fonts_dir
    if assets_dir.exists():
        for font_file in assets_dir.rglob("*.ttf"):
            parts = font_file.stem.split("-")
            font_weight = parts[-1] if len(parts) > 1 else "Regular"
            font_family = font_file.parent.name.replace("_", " ")
            fonts.append({
                "font_family": font_family,
                "font_weight": font_weight,
            })

    # Collect from system custom fonts directory used by ffmpeg/libass
    system_dir = Path("/usr/share/fonts/truetype/custom")
    if system_dir.exists():
        for font_file in system_dir.rglob("*.ttf"):
            parts = font_file.stem.split("-")
            font_weight = parts[-1] if len(parts) > 1 else "Regular"
            font_family = font_file.parent.name.replace("_", " ")
            fonts.append({
                "font_family": font_family,
                "font_weight": font_weight,
            })

    # Deduplicate entries
    seen = set()
    unique_fonts: List[Dict[str, str]] = []
    for f in fonts:
        key = (f["font_family"], f["font_weight"])
        if key not in seen:
            seen.add(key)
            unique_fonts.append(f)

    unique_fonts.sort(key=lambda x: (x["font_family"].lower(), x["font_weight"].lower()))
    logger.info(f"Found {len(unique_fonts)} fonts (aggregated)")
    return unique_fonts
