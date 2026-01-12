"""
Transcription Service

This service handles audio transcription using OpenAI's Whisper model.
It extracts word-level timestamps from audio files which are then used
by the LLM Caption Service to generate formatted captions.
"""
import logging
from pathlib import Path
from typing import Any, Dict, List, Tuple

import whisper

logger = logging.getLogger(__name__)

# Whisper model configuration
DEFAULT_WHISPER_MODEL = "turbo"


class TranscriptionService:
    """
    Handles audio transcription using Whisper.
    
    This service is responsible for:
    1. Loading and managing the Whisper model
    2. Transcribing audio files to get word-level timestamps
    3. Detecting the source language of the audio
    
    Caption generation is handled separately by LLMCaptionService.
    """

    def __init__(self, whisper_model_name: str = DEFAULT_WHISPER_MODEL):
        import torch
        
        # Check if GPU is available and usable
        device = "cpu"
        if torch.cuda.is_available():
            # Verify GPU is usable by allocating a small tensor
            test_tensor = torch.zeros(1).cuda()
            del test_tensor
            torch.cuda.empty_cache()
            device = "cuda"
            logger.info("GPU is available and will be used for Whisper model")
        else:
            logger.info("GPU not available, using CPU for Whisper model")
        
        logger.info(f"Loading Whisper model: {whisper_model_name} on device: {device}")
        self.whisper_model = whisper.load_model(whisper_model_name, device=device)
        self.last_detected_language: str = "en"

    def transcribe(self, audio_path: str, language: str = None) -> Tuple[List[Dict[str, Any]], str]:
        """
        Transcribe an audio file and return word-level timestamps.

        Args:
            audio_path: Path to the audio file to transcribe
            language: Optional language code (e.g., 'en', 'ar', 'es'). 
                     If None, Whisper will auto-detect the language.

        Returns:
            Tuple of (words, detected_language) where words is a list of dicts:
            [{"word": str, "start": float, "end": float, "probability": float}, ...]
        """
        logger.info(f"Transcribing audio file: {audio_path} with language: {language or 'auto-detect'}")
        
        if not Path(audio_path).exists():
            raise FileNotFoundError(f"Audio file not found: {audio_path}")
        
        # Configure transcription options
        transcribe_options = {"word_timestamps": True}
        if language and language != "auto":
            transcribe_options["language"] = language
        
        # Run Whisper transcription
        result = self.whisper_model.transcribe(audio_path, **transcribe_options)
        
        # Extract detected language
        detected_language = result.get("language") or "en"
        self.last_detected_language = detected_language
        
        # Flatten word-level data from all segments
        all_words = []
        for segment in result["segments"]:
            for word in segment.get("words", []):
                all_words.append({
                    "word": word.get("word", "").strip(),
                    "start": word.get("start", 0.0),
                    "end": word.get("end", 0.0),
                    "probability": word.get("probability", 1.0)
                })
        
        if not all_words:
            logger.warning("Whisper did not detect any words in the audio.")
            return [], detected_language
        
        logger.info(f"Extracted {len(all_words)} words (detected language: {detected_language})")
        return all_words, detected_language


# Singleton instance for reuse
_transcription_service: TranscriptionService = None


def get_transcription_service() -> TranscriptionService:
    """Get or create the singleton transcription service."""
    global _transcription_service
    if _transcription_service is None:
        _transcription_service = TranscriptionService()
    return _transcription_service