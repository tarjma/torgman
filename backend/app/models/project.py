from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class YouTubeProcessRequest(BaseModel):
    url: str
    project_id: str
    resolution: str = "720p"  # Options: "144p", "240p", "360p", "480p", "720p", "1080p", "best", "worst"
    video_info: Optional[dict] = None  # Optional field to pass pre-fetched video info

class FileUploadRequest(BaseModel):
    project_id: str
    title: str

class ProjectResponse(BaseModel):
    id: str
    title: str
    youtube_url: str
    duration: float
    status: str
    subtitle_count: int

class ProjectData(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    youtube_url: Optional[str] = None
    duration: float = 0.0
    status: str = "draft"
    language: str = "ar"
    subtitle_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class CaptionData(BaseModel):
    start: float
    end: float
    text: str
    confidence: Optional[float] = None
    translation: Optional[str] = None
    styling: Optional[dict] = None  # Frontend styling information
