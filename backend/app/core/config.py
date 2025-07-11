from pydantic_settings import BaseSettings
from pathlib import Path

class Settings(BaseSettings):
    # Application settings
    app_name: str = "Torgman"
    
    # Data directory - centralized location for all persistent data
    base_dir: Path = Path(__file__).parent.parent.parent
    
    # Data directories
    data_dir: Path = base_dir / "data"  # Main data directory
    projects_dir: Path = data_dir / "projects"  # Each project gets its own folder
    config_dir: Path = data_dir / "config"  # Application configuration files
    database_path: Path = data_dir / "torgman.db"
    
    # CORS settings
    cors_origins: list = ["*"]
    cors_credentials: bool = True
    cors_methods: list = ["*"]
    cors_headers: list = ["*"]
    
    # Static files
    static_dir: Path = base_dir / "static"  # Static files (e.g., favicon, images)
    
    def get_project_dir(self, project_id: str) -> Path:
        """Get the directory path for a specific project"""
        project_dir = self.projects_dir / project_id
        project_dir.mkdir(parents=True, exist_ok=True)
        return project_dir
    
    # API settings
    api_prefix: str = "/api"
    
    # WebSocket settings
    websocket_timeout: int = 300

# Create settings instance
settings = Settings()

# Ensure all data directories exist
settings.data_dir.mkdir(parents=True, exist_ok=True)
settings.database_path.parent.mkdir(parents=True, exist_ok=True)
settings.projects_dir.mkdir(parents=True, exist_ok=True)
settings.config_dir.mkdir(parents=True, exist_ok=True)
settings.static_dir.mkdir(parents=True, exist_ok=True)
