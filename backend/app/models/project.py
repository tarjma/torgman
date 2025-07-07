from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class YouTubeProcessRequest(BaseModel):
    url: str
    project_id: str
    language: str = "ar"
    resolution: str = "720p"  # Options: "144p", "240p", "360p", "480p", "720p", "1080p", "best", "worst"

class SubtitleSegment(BaseModel):
    id: str
    start_time: float
    end_time: float
    text: str
    confidence: Optional[float] = None

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

class SubtitleData(BaseModel):
    id: str
    project_id: str
    start_time: float
    end_time: float
    text: str
    speaker_id: Optional[str] = None
    confidence: Optional[float] = None
    created_at: Optional[datetime] = None
