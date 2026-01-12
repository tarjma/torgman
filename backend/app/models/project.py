from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class YouTubeProcessRequest(BaseModel):
    url: str
    project_id: str
    resolution: str = "720p"  # Options: "144p", "240p", "360p", "480p", "720p", "1080p", "best", "worst"
    video_info: Optional[dict] = None  # Optional field to pass pre-fetched video info
    language: Optional[str] = None  # Optional language code for transcription (e.g., 'en', 'ar', 'es')
    audio_language: Optional[str] = None  # Optional audio language for multi-track videos (e.g., 'en', 'ar', 'es')
    enable_diarization: bool = False  # Enable speaker diarization
    num_speakers: Optional[int] = None  # Hint for number of speakers (improves diarization accuracy)

class FileUploadRequest(BaseModel):
    project_id: str
    title: str
    language: Optional[str] = None  # Optional language code for transcription
    enable_diarization: bool = False  # Enable speaker diarization
    num_speakers: Optional[int] = None  # Hint for number of speakers

class RetranscribeRequest(BaseModel):
    project_id: str
    language: Optional[str] = None  # Optional language code for transcription (e.g., 'en', 'ar', 'es')
    enable_diarization: bool = False  # Enable speaker diarization
    num_speakers: Optional[int] = None  # Hint for number of speakers

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
    video_title: Optional[str] = None
    youtube_url: Optional[str] = None
    video_file: Optional[str] = None
    thumbnail_file: Optional[str] = None
    duration: float = 0.0
    status: str = "draft"  # Status: draft, processing, words_ready, captions_generated, translated, stale
    error_message: Optional[str] = None  # Error message for failed/stale projects
    # Renamed from 'language' to explicit 'source_language'
    source_language: str = "en"
    subtitle_count: int = 0
    word_count: int = 0  # Number of words extracted from transcription
    has_captions: bool = False  # Whether source captions have been generated
    has_translation: bool = False  # Whether Arabic translation has been generated
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class CaptionData(BaseModel):
    start_time: float
    end_time: float
    text: str
    confidence: Optional[float] = None
    translation: Optional[str] = None
    speaker: Optional[str] = None  # Speaker identifier (e.g., "SPEAKER_00")
    styling: Optional[dict] = None  # Frontend styling information


class WordData(BaseModel):
    """Word-level transcription data with timing and speaker info"""
    word: str
    start: float
    end: float
    probability: Optional[float] = None
    speaker: Optional[str] = None  # Speaker identifier from diarization


class DualCaptionData(BaseModel):
    """Dual caption track for source and translated languages"""
    source_captions: List[CaptionData]  # Original language captions
    translated_captions: List[CaptionData]  # Translated language captions
    source_language: str = "en"
    target_language: str = "ar"
