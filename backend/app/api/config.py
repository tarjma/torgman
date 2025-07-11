from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import logging
import json

from ..core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/config", tags=["config"])

class SubtitleConfig(BaseModel):
    fontSize: Optional[str] = "16px"
    fontFamily: Optional[str] = "Arial, sans-serif"
    fontWeight: Optional[str] = "bold"
    color: Optional[str] = "#ffffff"
    backgroundColor: Optional[str] = "rgba(0, 0, 0, 0.7)"
    textAlign: Optional[str] = "center"
    padding: Optional[str] = "8px 12px"
    borderRadius: Optional[str] = "4px"
    textShadow: Optional[str] = "2px 2px 4px rgba(0, 0, 0, 0.8)"
    lineHeight: Optional[str] = "1.4"
    maxWidth: Optional[str] = "80%"
    position: Optional[str] = "bottom-center"  # bottom-center, top-center, center
    marginBottom: Optional[str] = "60px"
    marginTop: Optional[str] = "20px"
    showTranslation: Optional[bool] = False
    translationColor: Optional[str] = "#ffeb3b"
    translationFontSize: Optional[str] = "14px"

@router.get("/subtitle-style", response_model=SubtitleConfig)
async def get_subtitle_config():
    """Get global subtitle configuration"""
    try:
        config_path = settings.data_dir / "config" / "subtitle-config.json"
        
        if config_path.exists():
            with open(config_path, 'r', encoding='utf-8') as f:
                config_data = json.load(f)
            return SubtitleConfig(**config_data)
        else:
            # Return default configuration
            return SubtitleConfig()
    except Exception as e:
        logger.error(f"Error getting subtitle config: {e}")
        # Return default configuration on error
        return SubtitleConfig()

@router.put("/subtitle-style")
async def update_subtitle_config(config: SubtitleConfig):
    """Update global subtitle configuration"""
    try:
        config_dir = settings.data_dir / "config"
        config_dir.mkdir(parents=True, exist_ok=True)
        
        config_path = config_dir / "subtitle-config.json"
        
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(config.model_dump(), f, indent=2)
        
        logger.info(f"Subtitle configuration updated: {config_path}")
        return {"message": "Subtitle configuration updated successfully"}
    except Exception as e:
        logger.error(f"Error updating subtitle config: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update subtitle configuration: {str(e)}")

@router.post("/subtitle-style/reset")
async def reset_subtitle_config():
    """Reset subtitle configuration to defaults"""
    try:
        config_dir = settings.data_dir / "config"
        config_path = config_dir / "subtitle-config.json"
        
        # Remove the config file to reset to defaults
        if config_path.exists():
            config_path.unlink()
        
        logger.info("Subtitle configuration reset to defaults")
        return {"message": "Subtitle configuration reset to defaults"}
    except Exception as e:
        logger.error(f"Error resetting subtitle config: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to reset subtitle configuration: {str(e)}")
