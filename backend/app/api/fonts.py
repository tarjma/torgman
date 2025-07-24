from fastapi import APIRouter
from typing import List, Dict
import logging
import re

from ..core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/fonts", response_model=List[Dict[str, str]])
async def get_available_fonts():
    """Get list of available fonts from the backend."""

    # Convert to a more frontend-friendly format
    available_fonts = []
    for font_file in settings.fonts_dir.glob("**/*.ttf"):
        font_weight = font_file.stem.split("-")[-1]
        font_family = font_file.parent.name.replace("_", " ")
        available_fonts.append({
            "font_family": font_family, # Cairo
            "font_weight": font_weight, # Regular
        })
    
    # Sort alphabetically by name
    available_fonts.sort(key=lambda x: x["font_family"])
    
    logger.info(f"Found {len(available_fonts)} custom fonts")
    
    return available_fonts
