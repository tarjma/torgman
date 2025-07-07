import re
from typing import Optional

def extract_youtube_id(url: str) -> Optional[str]:
    """Extract YouTube video ID from URL"""
    youtube_regex = r'(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})'
    match = re.search(youtube_regex, url)
    return match.group(1) if match else None

def validate_youtube_url(url: str) -> bool:
    """Validate if URL is a valid YouTube URL"""
    youtube_patterns = [
        r'https?://(www\.)?youtube\.com/watch\?v=[\w-]+',
        r'https?://(www\.)?youtu\.be/[\w-]+',
        r'https?://(www\.)?youtube\.com/embed/[\w-]+',
        r'https?://(www\.)?youtube\.com/v/[\w-]+'
    ]
    
    return any(re.match(pattern, url) for pattern in youtube_patterns)
