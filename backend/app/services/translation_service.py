import json
import logging
import os
from typing import List

from google import genai
from pydantic import BaseModel

from ..core.config import settings
from ..models import CaptionData

logger = logging.getLogger(__name__)

class TranslationGenerator:
    def __init__(self):
        # Get API key from environment variable or user config
        api_key = self._get_api_key()
        if not api_key:
            raise ValueError("Gemini API key not found. Please set it in environment variable GEMINI_API_KEY or configure it in the UI.")
        
        # The client gets the API key from environment or config
        self.client = genai.Client(api_key=api_key)

        # Maximum characters per line for captions
        self.max_chars_per_line = 40
    
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
        """
        if len(text) <= self.max_chars_per_line:
            return [text]

        words = text.split()
        possible_splits = []
        for i in range(1, len(words)):
            line1 = " ".join(words[:i])
            line2 = " ".join(words[i:])
            if len(line1) <= self.max_chars_per_line and len(line2) <= self.max_chars_per_line:
                possible_splits.append((line1, line2))

        if not possible_splits:
            # Fallback if no valid split found, do a hard wrap
            mid_point = text.rfind(' ', 0, self.max_chars_per_line)
            if mid_point == -1:
                return [text[:self.max_chars_per_line], text[self.max_chars_per_line:].strip()]
            return [text[:mid_point], text[mid_point:].strip()]

        # **CRITICAL BUG FIX**: Score splits to prefer inverted pyramids
        best_split = None
        # Score is a tuple: (is_top_heavy, length_difference). Lower is better.
        best_score = (True, float('inf')) 

        for line1, line2 in possible_splits:
            is_top_heavy = len(line1) > len(line2)
            length_difference = abs(len(line1) - len(line2))
            score = (is_top_heavy, length_difference)
            
            if score < best_score:
                best_score = score
                best_split = (line1, line2)
                
        return list(best_split)
    
    def translate_caption(self, caption: str) -> str:
        """Translate the transcription to the Arabic language using Google Gemini"""
        logger.info(f"Translating caption: {caption}")
        response = self.client.models.generate_content(
            model="gemini-2.5-flash", contents="Translate this caption to Arabic (Write nothing except the translation): " + caption,
        )
        translated_text = response.text.replace("\n", " ").strip()
        translated_text = "\n".join(self.format_multiline_caption(translated_text))
        logger.info(f"Translated caption: {translated_text}")
        return translated_text
        
    def translate_transcription(self, transcription: List[CaptionData]) -> List[CaptionData]:
        """Translate the entire transcription to Arabic"""
        logger.info("Translating transcription to Arabic")
        class TranslatedCaption(BaseModel):
            translation: str

        transcription_str = json.dumps([{"start_time": caption.start_time, "end_time": caption.end_time, "text": caption.text} for caption in transcription])
        prompt = "This is the transcription of a video. Please translate it into Arabic.\n\n" + transcription_str
        response = self.client.models.generate_content(
            model="gemini-2.5-pro",
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
