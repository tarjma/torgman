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
    
    # Static files - handle both development and production
    @property
    def static_dir(self) -> Path:
        """Get static directory based on environment"""
        # In production (Docker), static files are copied to /app/static
        prod_static = self.base_dir / "static"
        if prod_static.exists() and (prod_static / "index.html").exists():
            return prod_static
        
        # In development, look for frontend build directory
        dev_static = self.base_dir / "frontend" / "dist"
        if dev_static.exists() and (dev_static / "index.html").exists():
            return dev_static
            
        # Fallback to production path (will be created if needed)
        return prod_static
    
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
# Note: static_dir is now a property, so we ensure it exists when accessed
