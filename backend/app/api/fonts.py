from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from typing import List, Dict
import logging
from pathlib import Path

from ..core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()

# Arabic support levels for fonts
# Only Noto Sans Arabic is verified to work correctly with libass/ffmpeg
FONT_ARABIC_SUPPORT = {
    "Noto Sans Arabic": "full",
}


def _find_font_file(font_family: str, font_weight: str) -> Path | None:
    """Find the font file for a given family and weight."""
    # Normalize family name for directory lookup (spaces to underscores)
    dir_name = font_family.replace(" ", "_")
    
    # Check assets fonts directory first
    assets_dir = settings.fonts_dir / dir_name
    if assets_dir.exists():
        font_filename = f"{dir_name}-{font_weight}.ttf"
        font_path = assets_dir / font_filename
        if font_path.exists():
            return font_path
    
    # Check system custom fonts directory
    system_dir = Path("/usr/share/fonts/truetype/custom") / dir_name
    if system_dir.exists():
        font_filename = f"{dir_name}-{font_weight}.ttf"
        font_path = system_dir / font_filename
        if font_path.exists():
            return font_path
    
    return None


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
            arabic_support = FONT_ARABIC_SUPPORT.get(font_family, "unknown")
            fonts.append({
                "font_family": font_family,
                "font_weight": font_weight,
                "arabic_support": arabic_support,
            })

    # Collect from system custom fonts directory used by ffmpeg/libass
    system_dir = Path("/usr/share/fonts/truetype/custom")
    if system_dir.exists():
        for font_file in system_dir.rglob("*.ttf"):
            parts = font_file.stem.split("-")
            font_weight = parts[-1] if len(parts) > 1 else "Regular"
            font_family = font_file.parent.name.replace("_", " ")
            arabic_support = FONT_ARABIC_SUPPORT.get(font_family, "unknown")
            fonts.append({
                "font_family": font_family,
                "font_weight": font_weight,
                "arabic_support": arabic_support,
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


@router.get("/fonts/{font_family}/{font_weight}")
async def get_font_file(font_family: str, font_weight: str):
    """Serve a font file for browser use."""
    font_path = _find_font_file(font_family, font_weight)
    
    if not font_path:
        raise HTTPException(status_code=404, detail=f"Font not found: {font_family} {font_weight}")
    
    return FileResponse(
        font_path,
        media_type="font/ttf",
        headers={
            "Cache-Control": "public, max-age=31536000",  # Cache for 1 year
            "Access-Control-Allow-Origin": "*"
        }
    )
