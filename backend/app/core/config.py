from pydantic_settings import BaseSettings
from pathlib import Path

class Settings(BaseSettings):
    # Application settings
    app_name: str = "Torgman - Arabic Video Subtitle Translator"
    app_version: str = "1.0.0"
    debug: bool = False
    
    # Database settings
    database_path: Path = Path("/app/data/torgman.db")
    
    # CORS settings
    cors_origins: list = ["*"]
    cors_credentials: bool = True
    cors_methods: list = ["*"]
    cors_headers: list = ["*"]
    
    # File storage settings
    temp_dir: Path = Path("/tmp/torgman")
    static_dir: Path = Path("static")
    
    # API settings
    api_prefix: str = "/api"
    
    # WebSocket settings
    websocket_timeout: int = 300
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

# Create settings instance
settings = Settings()

# Ensure directories exist
settings.database_path.parent.mkdir(parents=True, exist_ok=True)
settings.temp_dir.mkdir(parents=True, exist_ok=True)
settings.static_dir.mkdir(parents=True, exist_ok=True)
