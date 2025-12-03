import json
import logging
import os
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/config", tags=["config"])

class CaptionMargin(BaseModel):
    left: float = 10.0  # The left margin, in pixels. Minimum distance from the left edge of the video.
    right: float = 10.0  # The right margin, in pixels. Minimum distance from the right edge of the video.
    vertical: float = 10.0  # The vertical margin, in pixels. For bottom-aligned text, it's the distance from the bottom edge. For top-aligned text, it's the distance from the top edge.
    # Additional explicit margins for better UI control/persistence
    bottom: float = 10.0
    top: float = 10.0

class SubtitleConfig(BaseModel):
    # Basic text properties
    fontSize: Optional[str] = "28"  # Font size in points
    fontFamily: Optional[str] = "Noto Sans Arabic"  # Only font verified to work with libass
    fontWeight: Optional[str] = "Bold"
    
    # Colors (hex format)
    color: Optional[str] = "#ffffff"  # Primary text color (white)
    secondaryColor: Optional[str] = "#0000ff"  # Secondary color for karaoke effects (red)
    outlineColor: Optional[str] = "#000000"  # Outline/border color (black)
    backgroundColor: Optional[str] = "#80000000"  # Background/shadow color (semi-transparent black)
    
    # Style flags (-1 for true, 0 for false in ASS)
    bold: Optional[bool] = False
    italic: Optional[bool] = False
    underline: Optional[bool] = False
    strikeOut: Optional[bool] = False
    
    # Scaling and spacing
    scaleX: Optional[int] = 100  # Horizontal scaling percentage
    scaleY: Optional[int] = 100  # Vertical scaling percentage
    spacing: Optional[int] = 0   # Extra character spacing in pixels
    angle: Optional[float] = 0   # Z-axis rotation in degrees
    
    # Border and shadow
    borderStyle: Optional[int] = 1  # 1=Outline+Shadow, 3=Opaque box
    outline: Optional[int] = 2      # Outline thickness in pixels
    shadow: Optional[int] = 1       # Shadow distance in pixels
    
    # Alignment (numpad layout: 1-9)
    alignment: Optional[int] = 2    # 2 = Bottom Center (standard for subtitles)
    
    # Margins
    margin: Optional[CaptionMargin] = CaptionMargin()

    # Extra UI/preview fields to persist user preferences
    # These are used by the frontend for live preview and layout and should be persisted.
    lineHeight: Optional[str] = "1.4"
    borderRadius: Optional[str] = "4px"
    padding: Optional[str] = "8px 12px"
    maxWidth: Optional[str] = "80%"
    position: Optional[str] = "bottom-center"

class ApiKeyConfig(BaseModel):
    gemini_api_key: str

class ApiKeyStatus(BaseModel):
    has_api_key: bool
    api_key_source: str  # "environment" or "user_set"

@router.get("/api-key/status")
async def get_api_key_status():
    """Get the current API key configuration status"""
    env_key = os.getenv("GEMINI_API_KEY")
    
    # Check if there's a user-set API key in config
    config_dir = settings.data_dir / "config"
    api_key_config_path = config_dir / "api-key.json"
    
    user_key = None
    if api_key_config_path.exists():
        with open(api_key_config_path, 'r', encoding='utf-8') as f:
            config_data = json.load(f)
            user_key = config_data.get("gemini_api_key")
    
    has_api_key = bool(env_key or user_key)
    api_key_source = "environment" if env_key else ("user_set" if user_key else "none")
    
    return ApiKeyStatus(
        has_api_key=has_api_key,
        api_key_source=api_key_source
    )

@router.post("/api-key")
async def set_api_key(config: ApiKeyConfig):
    """Set the Gemini API key for translation services"""
    if not config.gemini_api_key.strip():
        raise HTTPException(status_code=400, detail="API key cannot be empty")
    
    # Save API key to config file
    config_dir = settings.data_dir / "config"
    config_dir.mkdir(parents=True, exist_ok=True)
    
    api_key_config_path = config_dir / "api-key.json"
    
    config_data = {
        "gemini_api_key": config.gemini_api_key.strip()
    }
    
    with open(api_key_config_path, 'w', encoding='utf-8') as f:
        json.dump(config_data, f, indent=2)
    
    logger.info("API key configuration updated successfully")
    return {"message": "API key set successfully"}

@router.delete("/api-key")
async def clear_api_key():
    """Clear the user-set API key (will fall back to environment variable if available)"""
    config_dir = settings.data_dir / "config"
    api_key_config_path = config_dir / "api-key.json"
    
    if api_key_config_path.exists():
        api_key_config_path.unlink()
    
    logger.info("User API key configuration cleared")
    return {"message": "API key cleared successfully"}

@router.get("/subtitle-style", response_model=SubtitleConfig)
async def get_subtitle_config():
    """Get current subtitle configuration"""
    config_path = settings.data_dir / "config" / "subtitle-config.json"
    
    if config_path.exists():
        with open(config_path, 'r', encoding='utf-8') as f:
            config_data = json.load(f)
        return SubtitleConfig(**config_data)
    else:
        # Return default configuration
        return SubtitleConfig()

@router.get("/subtitle-style/default", response_model=SubtitleConfig)
async def get_default_subtitle_config():
    """Get default subtitle configuration (ignoring any saved customizations)"""
    return SubtitleConfig()

@router.put("/subtitle-style")
async def update_subtitle_config(config: SubtitleConfig):
    """Update global subtitle configuration"""
    config_dir = settings.data_dir / "config"
    config_dir.mkdir(parents=True, exist_ok=True)
    
    config_path = config_dir / "subtitle-config.json"
    
    with open(config_path, 'w', encoding='utf-8') as f:
        json.dump(config.model_dump(), f, indent=2)
    
    logger.info(f"Subtitle configuration updated: {config_path}")
    return {"message": "Subtitle configuration updated successfully"}

@router.post("/subtitle-style/reset")
async def reset_subtitle_config():
    """Reset subtitle configuration to defaults"""
    config_dir = settings.data_dir / "config"
    config_path = config_dir / "subtitle-config.json"
    
    # Remove the config file to reset to defaults
    if config_path.exists():
        config_path.unlink()
    
    logger.info("Subtitle configuration reset to defaults")
    return {"message": "Subtitle configuration reset to defaults"}
