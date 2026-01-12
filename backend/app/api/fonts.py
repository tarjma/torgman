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
    # Normalize family name for filename (no spaces or underscores)
    file_name_base = font_family.replace(" ", "").replace("_", "")
    
    # Check assets fonts directory first
    assets_dir = settings.fonts_dir / dir_name
    if assets_dir.exists():
        # Try both naming conventions: NotoSansArabic-Bold.ttf and Noto_Sans_Arabic-Bold.ttf
        for filename in [f"{file_name_base}-{font_weight}.ttf", f"{dir_name}-{font_weight}.ttf"]:
            font_path = assets_dir / filename
            if font_path.exists():
                return font_path
    
    # Check system custom fonts directory - fonts may be directly in the custom folder
    system_dir = Path("/usr/share/fonts/truetype/custom")
    if system_dir.exists():
        # Try fonts directly in custom folder
        for filename in [f"{file_name_base}-{font_weight}.ttf", f"{dir_name}-{font_weight}.ttf"]:
            font_path = system_dir / filename
            if font_path.exists():
                return font_path
        
        # Also check subdirectory matching the font family
        family_subdir = system_dir / dir_name
        if family_subdir.exists():
            for filename in [f"{file_name_base}-{font_weight}.ttf", f"{dir_name}-{font_weight}.ttf"]:
                font_path = family_subdir / filename
                if font_path.exists():
                    return font_path
    
    return None


def _extract_font_info(font_file: Path) -> tuple[str, str]:
    """Extract font family and weight from a font filename.
    
    Handles formats like:
    - NotoSansArabic-Bold.ttf -> ("Noto Sans Arabic", "Bold")
    - Noto_Sans_Arabic-Bold.ttf -> ("Noto Sans Arabic", "Bold")
    """
    stem = font_file.stem  # e.g., "NotoSansArabic-Bold"
    
    if "-" in stem:
        parts = stem.rsplit("-", 1)
        font_name_part = parts[0]
        font_weight = parts[1] if len(parts) > 1 else "Regular"
    else:
        font_name_part = stem
        font_weight = "Regular"
    
    # Convert CamelCase or underscored name to spaced name
    # NotoSansArabic -> Noto Sans Arabic
    # Noto_Sans_Arabic -> Noto Sans Arabic
    import re
    font_name_part = font_name_part.replace("_", " ")
    # Insert space before capital letters (for CamelCase)
    font_family = re.sub(r'(?<!^)(?=[A-Z])', ' ', font_name_part).strip()
    
    return font_family, font_weight


@router.get("/fonts", response_model=List[Dict[str, str]])
async def get_available_fonts():
    """Get list of available fonts from the backend."""
    fonts: List[Dict[str, str]] = []

    # Collect from app assets fonts directory
    assets_dir = settings.fonts_dir
    if assets_dir.exists():
        for font_file in assets_dir.rglob("*.ttf"):
            font_family, font_weight = _extract_font_info(font_file)
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
            font_family, font_weight = _extract_font_info(font_file)
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
