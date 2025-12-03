import json
import logging
import os
from typing import List

from google import genai
from pydantic import BaseModel

from ..core.config import settings
from ..models import CaptionData
from ..utils.text_utils import format_multiline_caption as _format_multiline_caption

logger = logging.getLogger(__name__)

# Constants for translation settings
GEMINI_MODEL_TRANSLATE_CAPTION = "gemini-2.5-flash"
GEMINI_MODEL_TRANSLATE_TRANSCRIPTION = "gemini-2.5-pro"
DEFAULT_MAX_CHARS_PER_LINE = 40

class TranslationGenerator:
    def __init__(self):
        # Get API key from environment variable or user config
        api_key = self._get_api_key()
        if not api_key:
            raise ValueError("Gemini API key not found. Please set it in environment variable GEMINI_API_KEY or configure it in the UI.")
        
        # The client gets the API key from environment or config
        self.client = genai.Client(api_key=api_key)

        # Maximum characters per line for captions
        self.max_chars_per_line = DEFAULT_MAX_CHARS_PER_LINE
    
    def _get_api_key(self) -> str:
        """Get API key from environment variable or user config file"""
        # First try environment variable
        env_key = os.getenv("GEMINI_API_KEY")
        if env_key:
            return env_key
        
        # Then try user config file
        config_dir = settings.data_dir / "config"
        api_key_config_path = config_dir / "api-key.json"
        
        if api_key_config_path.exists():
            with open(api_key_config_path, 'r', encoding='utf-8') as f:
                config_data = json.load(f)
                user_key = config_data.get("gemini_api_key")
                if user_key:
                    return user_key
    
        return None

    def format_multiline_caption(self, text: str) -> List[str]:
        """
        Formats text into one or two lines, prioritizing an inverted pyramid shape.
        Delegates to shared utility function.
        """
        return _format_multiline_caption(text, self.max_chars_per_line)
    
    def translate_caption(self, caption: str, source_language: str = "en", target_language: str = "ar") -> str:
        """Translate a single caption using Google Gemini (synchronous)."""
        logger.info(f"Translating caption ({source_language}->{target_language}): {caption}")
        prompt = f"Translate this {source_language} caption to {target_language} (Write nothing except the translation): {caption}"
        response = self.client.models.generate_content(
            model=GEMINI_MODEL_TRANSLATE_CAPTION, contents=prompt,
        )
        translated_text = response.text.replace("\n", " ").strip()
        translated_text = "\n".join(self.format_multiline_caption(translated_text))
        logger.info(f"Translated caption: {translated_text}")
        return translated_text
    
    def translate_transcription(self, transcription: List[CaptionData], source_language: str = "en", target_language: str = "ar") -> List[CaptionData]:
        """Translate the entire transcription in one shot."""
        logger.info(f"Translating transcription {source_language}->{target_language} (segments={len(transcription)})")
        class TranslatedCaption(BaseModel):
            translation: str

        transcription_str = json.dumps([{"start_time": caption.start_time, "end_time": caption.end_time, "text": caption.text} for caption in transcription])
        prompt = (
            f"This is the transcription of a {source_language} video. "
            f"Please translate it into {target_language}. Return ONLY a JSON array matching the schema with the same number of list elements in the input transcription (One to One translation mapping).\n\n" + transcription_str
        )
        response = self.client.models.generate_content(
            model=GEMINI_MODEL_TRANSLATE_TRANSCRIPTION,
            contents=prompt,
            config={
                "response_mime_type": "application/json",
                "response_schema": list[TranslatedCaption],
            },
        )
        translations: List[TranslatedCaption] = response.parsed
        for idx in range(len(transcription)):
            translation_text = translations[idx].translation.replace("\n", " ").strip()
            transcription[idx].translation = "\n".join(self.format_multiline_caption(translation_text))
            logger.info(f"Translation for segment {idx}: {transcription[idx].translation}")

        return transcription

    def _save_subtitles(self, project_dir, subtitles):
        """Save subtitles to a JSON file in the project directory"""
        subtitles_path = project_dir / "subtitles.json"
        with open(subtitles_path, 'w', encoding='utf-8') as f:
            # Convert CaptionData objects to dictionaries for JSON serialization
            subtitles_dict = [subtitle.dict() for subtitle in subtitles]
            json.dump(subtitles_dict, f, indent=2, ensure_ascii=False)
        logger.info(f"Subtitles saved successfully: {subtitles_path}")
