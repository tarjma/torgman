from .projects import router as projects_router
from .youtube import router as youtube_router
from .websocket import router as websocket_router
from .config import router as config_router
from .fonts import router as fonts_router
from .subtitles import router as subtitles_router
from .export import router as export_router

__all__ = [
    "projects_router",
    "youtube_router", 
    "websocket_router",
    "config_router",
    "fonts_router",
    "subtitles_router",
    "export_router"
]
