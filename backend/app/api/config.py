import json
import logging
import os
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

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
