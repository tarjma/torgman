from .projects import router as projects_router
from .youtube import router as youtube_router
from .websocket import router as websocket_router
from .config import router as config_router

__all__ = ["projects_router", "youtube_router", "websocket_router", "config_router"]
