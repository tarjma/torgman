"""
LLM Caption Service

This service uses Gemini 3 to generate natural, high-quality subtitle captions
from word-level transcription data. It provides two main functions:

1. generate_source_captions() - Creates captions in the original audio language
2. generate_translated_captions() - Creates Arabic translated captions

Both methods use structured outputs for reliable JSON responses.
"""
import logging
from typing import Any, Dict, List

from google import genai
from pydantic import BaseModel

from ..api.config import (
    get_config_service,
    DEFAULT_MODEL,
    SUBTITLE_MAX_CHARS_PER_LINE,
    SUBTITLE_MAX_LINES_PER_CAPTION,
    SUBTITLE_MAX_DURATION,
    SUBTITLE_MIN_DURATION,
    SUBTITLE_MAX_CPS,
)

logger = logging.getLogger(__name__)

# Model constants (imported from config but kept here for backwards compatibility)
GEMINI_3_FLASH = "gemini-3-flash-preview"
GEMINI_3_PRO = "gemini-3-pro-preview"


class Caption(BaseModel):
    """Schema for a single caption in the structured output."""
    start_word_index: int  # Index of first word in this caption
    end_word_index: int    # Index of last word in this caption (inclusive)
    text: str              # The formatted caption text (can include \n for line breaks)


class CaptionList(BaseModel):
    """Schema for the list of captions returned by the LLM."""
    captions: List[Caption]


class LLMCaptionService:
    """
    Generates natural captions from word-level transcription using Gemini 3.
    
    This service provides two separate methods:
    1. generate_source_captions() - For captions in the original language
    2. generate_translated_captions() - For Arabic translated captions
    
    Each method makes a single API call and returns structured output.
    """
    
    def __init__(self, model: str = None):
        """
        Initialize the LLM Caption Service.
        
        Args:
            model: Gemini model to use. Options: 'gemini-3-flash-preview', 'gemini-3-pro-preview'
                   If None, uses the model from ConfigService or defaults to gemini-3-flash-preview
        """
        config_service = get_config_service()
        api_key = config_service.get_api_key()
        
        if not api_key:
            raise ValueError("Gemini API key not found. Set GEMINI_API_KEY env var or configure in UI.")
        
        self.client = genai.Client(api_key=api_key)
        self.model = model or config_service.get_llm_model() or DEFAULT_MODEL
        logger.info(f"LLMCaptionService initialized with model: {self.model}")
    
    def _prepare_words_data(self, words: List[Dict]) -> str:
        """
        Prepare word data in a compact format for the LLM.
        Format: index|word|start|end
        """
        lines = []
        for i, word in enumerate(words):
            text = word.get("word", "").strip()
            start = word.get("start", 0)
            end = word.get("end", start)
            lines.append(f"{i}|{text}|{start:.2f}|{end:.2f}")
        return "\n".join(lines)
    
    def _convert_to_caption_dicts(
        self, 
        generated_captions: List[Caption], 
        words: List[Dict]
    ) -> List[Dict[str, Any]]:
        """Convert generated Caption objects to final caption dictionaries with timestamps."""
        captions = []
        for cap in generated_captions:
            # Validate and clamp indices
            start_idx = max(0, min(cap.start_word_index, len(words) - 1))
            end_idx = max(0, min(cap.end_word_index, len(words) - 1))
            
            if start_idx > end_idx:
                start_idx, end_idx = end_idx, start_idx
            
            # Get timestamps from word data
            start_time = words[start_idx].get("start", 0)
            end_time = words[end_idx].get("end", start_time)
            
            # Calculate average confidence
            caption_words = words[start_idx:end_idx + 1]
            avg_confidence = sum(w.get("probability", 1.0) for w in caption_words) / max(1, len(caption_words))
            
            captions.append({
                "start_time": start_time,
                "end_time": end_time,
                "text": cap.text,
                "confidence": avg_confidence
            })
        
        return captions
    
    def generate_source_captions(
        self, 
        words: List[Dict], 
        language: str = "en"
    ) -> List[Dict[str, Any]]:
        """
        Generate captions in the original source language.
        
        This method takes word-level timestamps and groups them into natural,
        readable captions following subtitle best practices.
        
        Args:
            words: List of word dicts with keys: word, start, end, probability
            language: The source language code (e.g., 'en', 'es', 'fr')
        
        Returns:
            List of caption dicts: [{"start_time", "end_time", "text", "confidence"}, ...]
        """
        if not words:
            return []
        
        logger.info(f"Generating source captions for {len(words)} words in {language}")
        
        words_data = self._prepare_words_data(words)
        num_words = len(words)
        
        prompt = f"""You are an expert subtitle editor. Transform the following word-level transcription data into natural, readable subtitle captions.

SUBTITLE BEST PRACTICES:
- Maximum {SUBTITLE_MAX_CHARS_PER_LINE} characters per line
- Maximum {SUBTITLE_MAX_LINES_PER_CAPTION} lines per caption
- Caption duration: {SUBTITLE_MIN_DURATION}-{SUBTITLE_MAX_DURATION} seconds
- Reading speed: max {SUBTITLE_MAX_CPS} characters per second
- Use \\n for line breaks (prefer inverted pyramid: longer line on top)
- Keep complete thoughts together
- End captions at natural pause points (punctuation, clauses)
- Don't split articles from nouns, adjectives from nouns, or verbs from objects

INPUT FORMAT: index|word|start_time|end_time
Language: {language}

WORD DATA:
{words_data}

Generate captions where each caption groups consecutive words into a natural reading unit.
Every word index from 0 to {num_words - 1} must be covered exactly once, in order."""

        response = self.client.models.generate_content(
            model=self.model,
            contents=prompt,
            config={
                "response_mime_type": "application/json",
                "response_schema": CaptionList,
            },
        )
        
        result: CaptionList = response.parsed
        captions = self._convert_to_caption_dicts(result.captions, words)
        
        logger.info(f"Generated {len(captions)} source captions")
        return captions
    
    def generate_arabic_captions(
        self, 
        words: List[Dict], 
        source_language: str = "en"
    ) -> List[Dict[str, Any]]:
        """
        Generate Arabic translated captions from word-level source data.
        
        This method takes word-level timestamps in the source language and generates
        Arabic translated captions following Arabic subtitle conventions.
        
        Args:
            words: List of word dicts with keys: word, start, end, probability
            source_language: The source language code (e.g., 'en')
        
        Returns:
            List of caption dicts: [{"start_time", "end_time", "text", "confidence"}, ...]
        """
        if not words:
            return []
        
        logger.info(f"Generating Arabic captions from {source_language} for {len(words)} words")
        
        words_data = self._prepare_words_data(words)
        num_words = len(words)
        
        prompt = f"""You are an expert multilingual subtitle translator and editor. Transform the following word-level transcription data into Arabic subtitle captions.

TASK: Translate from {source_language} to Arabic while creating natural subtitle segments.

SUBTITLE BEST PRACTICES:
- Maximum {SUBTITLE_MAX_CHARS_PER_LINE} characters per line
- Maximum {SUBTITLE_MAX_LINES_PER_CAPTION} lines per caption  
- Caption duration: {SUBTITLE_MIN_DURATION}-{SUBTITLE_MAX_DURATION} seconds
- Reading speed: max {SUBTITLE_MAX_CPS} characters per second
- Use \\n for line breaks
- Keep complete thoughts together
- Create natural reading units for Arabic speakers

ARABIC-SPECIFIC RULES:
- Arabic text reads right-to-left
- Use Arabic punctuation: ، (comma), ؛ (semicolon), ؟ (question mark), ! (exclamation)
- Arabic text is often more compact than English - adjust segmentation accordingly
- Translate idioms naturally, don't translate literally
- Maintain consistent formal/informal register
- Numbers can be written in Arabic numerals (١٢٣) or Western numerals (123)

INPUT FORMAT: index|word|start_time|end_time
Source Language: {source_language}

WORD DATA:
{words_data}

Generate translated captions where each caption:
1. Groups consecutive source words
2. Provides a natural Arabic translation
3. Forms a complete, readable unit in Arabic

The text field should contain the Arabic translation, NOT the source text.
Every word index from 0 to {num_words - 1} must be covered exactly once, in order."""

        response = self.client.models.generate_content(
            model=self.model,
            contents=prompt,
            config={
                "response_mime_type": "application/json",
                "response_schema": CaptionList,
            },
        )
        
        result: CaptionList = response.parsed
        captions = self._convert_to_caption_dicts(result.captions, words)
        
        logger.info(f"Generated {len(captions)} Arabic captions")
        return captions
    
    def set_model(self, model: str) -> None:
        """Change the Gemini model being used."""
        if model not in [GEMINI_3_FLASH, GEMINI_3_PRO]:
            raise ValueError(f"Invalid model: {model}. Use '{GEMINI_3_FLASH}' or '{GEMINI_3_PRO}'")
        self.model = model
        logger.info(f"Switched to model: {model}")


# Singleton instance
_llm_caption_service: LLMCaptionService = None


def get_llm_caption_service(model: str = None) -> LLMCaptionService:
    """Get or create the singleton LLM caption service."""
    global _llm_caption_service
    if _llm_caption_service is None:
        _llm_caption_service = LLMCaptionService(model=model)
    elif model and _llm_caption_service.model != model:
        _llm_caption_service.set_model(model)
    return _llm_caption_service
