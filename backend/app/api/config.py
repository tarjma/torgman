import json
import logging
import os
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/config", tags=["config"])


# Available Gemini 3 models
AVAILABLE_MODELS = [
    {"id": "gemini-3-flash-preview", "name": "Gemini 3 Flash", "description": "Fast and cost-effective (recommended)"},
    {"id": "gemini-3-pro-preview", "name": "Gemini 3 Pro", "description": "Highest quality translations"},
]
DEFAULT_MODEL = "gemini-3-flash-preview"

# Subtitle best practices constraints (Netflix/broadcast standards)
# These can be made configurable in the future via UI
SUBTITLE_MAX_CHARS_PER_LINE = 42  # Netflix standard
SUBTITLE_MAX_LINES_PER_CAPTION = 2
SUBTITLE_MAX_DURATION = 7.0  # seconds
SUBTITLE_MIN_DURATION = 0.7  # seconds
SUBTITLE_MAX_CPS = 21  # Characters per second (comfortable reading speed)


class ConfigService:
    """
    Unified configuration service that provides a single source of truth
    for all application configuration: API keys, LLM models, and subtitle styles.
    """
    
    def __init__(self):
        self.config_dir: Path = settings.data_dir / "config"
        self.config_dir.mkdir(parents=True, exist_ok=True)
    
    # === API Key Management ===
    
    def get_api_key(self) -> Optional[str]:
        """Get Gemini API key. Checks environment first, then config file."""
        env_key = os.getenv("GEMINI_API_KEY")
        if env_key:
            return env_key
        
        config_path = self.config_dir / "api-key.json"
        if config_path.exists():
            with open(config_path, 'r', encoding='utf-8') as f:
                config_data = json.load(f)
                return config_data.get("gemini_api_key")
        
        return None
    
    def get_api_key_source(self) -> str:
        """Get the source of the API key: 'environment', 'user_set', or 'none'."""
        if os.getenv("GEMINI_API_KEY"):
            return "environment"
        
        config_path = self.config_dir / "api-key.json"
        if config_path.exists():
            with open(config_path, 'r', encoding='utf-8') as f:
                config_data = json.load(f)
                if config_data.get("gemini_api_key"):
                    return "user_set"
        
        return "none"
    
    def set_api_key(self, api_key: str) -> None:
        """Save user-provided API key to config file."""
        config_path = self.config_dir / "api-key.json"
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump({"gemini_api_key": api_key.strip()}, f, indent=2)
        logger.info("API key configuration updated")
    
    def clear_api_key(self) -> None:
        """Remove user-set API key (falls back to environment variable)."""
        config_path = self.config_dir / "api-key.json"
        if config_path.exists():
            config_path.unlink()
        logger.info("User API key cleared")
    
    # === LLM Model Management ===
    
    def get_llm_model(self) -> str:
        """Get the configured LLM model for caption generation."""
        config_path = self.config_dir / "llm-config.json"
        if config_path.exists():
            with open(config_path, 'r', encoding='utf-8') as f:
                config_data = json.load(f)
                return config_data.get("caption_model", DEFAULT_MODEL)
        return DEFAULT_MODEL
    
    def set_llm_model(self, model: str) -> None:
        """Set the LLM model for caption generation."""
        valid_models = [m["id"] for m in AVAILABLE_MODELS]
        if model not in valid_models:
            raise ValueError(f"Invalid model: {model}. Available: {valid_models}")
        
        config_path = self.config_dir / "llm-config.json"
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump({"caption_model": model}, f, indent=2)
        logger.info(f"LLM model set to: {model}")
    
    def get_available_models(self) -> list:
        """Get list of available LLM models."""
        return AVAILABLE_MODELS
    
    # === Subtitle Style Management ===
    
    def get_subtitle_style(self) -> dict:
        """Get current subtitle style configuration."""
        config_path = self.config_dir / "subtitle-config.json"
        if config_path.exists():
            with open(config_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {}  # Return empty dict to use defaults
    
    def set_subtitle_style(self, style: dict) -> None:
        """Save subtitle style configuration."""
        config_path = self.config_dir / "subtitle-config.json"
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(style, f, indent=2)
        logger.info("Subtitle style configuration updated")
    
    def reset_subtitle_style(self) -> None:
        """Reset subtitle style to defaults by removing config file."""
        config_path = self.config_dir / "subtitle-config.json"
        if config_path.exists():
            config_path.unlink()
        logger.info("Subtitle style reset to defaults")


# Singleton instance
_config_service: ConfigService = None


def get_config_service() -> ConfigService:
    """Get the singleton ConfigService instance."""
    global _config_service
    if _config_service is None:
        _config_service = ConfigService()
    return _config_service

class CaptionMargin(BaseModel):
    left: float = 10.0  # The left margin, in pixels. Minimum distance from the left edge of the video.
    right: float = 10.0  # The right margin, in pixels. Minimum distance from the right edge of the video.
    vertical: float = 10.0  # The vertical margin, in pixels. For bottom-aligned text, it's the distance from the bottom edge. For top-aligned text, it's the distance from the top edge.
    # Additional explicit margins for better UI control/persistence
    bottom: float = 10.0
    top: float = 10.0

class SubtitleConfig(BaseModel):
    # Track selection: 'source' for original subtitles, 'arabic' for Arabic translations
    track: Optional[str] = "source"
    
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
    api_key_source: str  # "environment", "user_set", or "none"

class LLMModelConfig(BaseModel):
    caption_model: str = "gemini-3-flash-preview"

class LLMModelStatus(BaseModel):
    current_model: str
    available_models: list


# === API Endpoints using ConfigService ===

@router.get("/api-key/status")
async def get_api_key_status():
    """Get the current API key configuration status"""
    config_service = get_config_service()
    api_key = config_service.get_api_key()
    source = config_service.get_api_key_source()
    
    return ApiKeyStatus(
        has_api_key=bool(api_key),
        api_key_source=source
    )

@router.post("/api-key")
async def set_api_key(config: ApiKeyConfig):
    """Set the Gemini API key for translation services"""
    if not config.gemini_api_key.strip():
        raise HTTPException(status_code=400, detail="API key cannot be empty")
    
    config_service = get_config_service()
    config_service.set_api_key(config.gemini_api_key)
    return {"message": "API key set successfully"}

@router.delete("/api-key")
async def clear_api_key():
    """Clear the user-set API key (will fall back to environment variable if available)"""
    config_service = get_config_service()
    config_service.clear_api_key()
    return {"message": "API key cleared successfully"}


@router.get("/llm-model", response_model=LLMModelStatus)
async def get_llm_model_config():
    """Get current LLM model configuration"""
    config_service = get_config_service()
    return LLMModelStatus(
        current_model=config_service.get_llm_model(),
        available_models=config_service.get_available_models()
    )

@router.put("/llm-model")
async def set_llm_model_config(config: LLMModelConfig):
    """Set the LLM model for caption generation"""
    config_service = get_config_service()
    valid_models = [m["id"] for m in config_service.get_available_models()]
    
    if config.caption_model not in valid_models:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid model. Available models: {', '.join(valid_models)}"
        )
    
    config_service.set_llm_model(config.caption_model)
    return {"message": f"Model set to {config.caption_model}"}


@router.get("/subtitle-style", response_model=SubtitleConfig)
async def get_subtitle_config():
    """Get current subtitle configuration"""
    config_service = get_config_service()
    style_data = config_service.get_subtitle_style()
    if style_data:
        return SubtitleConfig(**style_data)
    return SubtitleConfig()

@router.get("/subtitle-style/default", response_model=SubtitleConfig)
async def get_default_subtitle_config():
    """Get default subtitle configuration (ignoring any saved customizations)"""
    return SubtitleConfig()

@router.put("/subtitle-style")
async def update_subtitle_config(config: SubtitleConfig):
    """Update global subtitle configuration"""
    config_service = get_config_service()
    config_service.set_subtitle_style(config.model_dump())
    return {"message": "Subtitle configuration updated successfully"}

@router.post("/subtitle-style/reset")
async def reset_subtitle_config():
    """Reset subtitle configuration to defaults"""
    config_service = get_config_service()
    config_service.reset_subtitle_style()
    return {"message": "Subtitle configuration reset to defaults"}
