import logging
from pathlib import Path
from typing import Any, Dict, List

import numpy as np
import spacy
import whisper

from ..utils.text_utils import format_multiline_caption as _format_multiline_caption

# It's good practice to allow the model name to be configured
# You might want to use 'base' for speed or 'large' for accuracy later.
DEFAULT_WHISPER_MODEL = "turbo"
DEFAULT_SPACY_MODEL = "en_core_web_sm"

# Load models once
try:
    nlp = spacy.load(DEFAULT_SPACY_MODEL)
except OSError:
    print(f"Downloading spaCy model: {DEFAULT_SPACY_MODEL}")
    from spacy.cli import download
    download(DEFAULT_SPACY_MODEL)
    nlp = spacy.load(DEFAULT_SPACY_MODEL)

logger = logging.getLogger(__name__)

class TranscriptionGenerator:
    """
    Generates high-quality, semantically coherent subtitle captions from audio.
    
    This class handles:
    1. Audio transcription using Whisper.
    2. Semantic segmentation of the transcript into sentences using spaCy.
    3. Grouping sentences into captions that respect timing and length constraints.
    4. Formatting multiline captions into an aesthetic inverted pyramid shape.
    """

    def __init__(
        self,
        whisper_model_name: str = DEFAULT_WHISPER_MODEL,
        max_chars_per_line: int = 42, # Netflix standard
        max_lines_per_caption: int = 2,
        max_caption_duration: int = 7,
        max_cps: int = 21,
    ):
        import torch
        
        # Check if GPU is available and usable
        device = "cpu"  # Default to CPU
        try:
            if torch.cuda.is_available():
                # Try to allocate a small tensor to verify GPU is usable
                test_tensor = torch.zeros(1).cuda()
                del test_tensor
                torch.cuda.empty_cache()
                device = "cuda"
                logger.info("GPU is available and will be used for Whisper model")
            else:
                logger.info("GPU not available, using CPU for Whisper model")
        except Exception as e:
            logger.warning(f"GPU error during initialization: {e}. Falling back to CPU.")
            device = "cpu"
        
        logger.info(f"Loading Whisper model: {whisper_model_name} on device: {device}")
        try:
            self.whisper_model = whisper.load_model(whisper_model_name, device=device)
        except Exception as e:
            logger.error(f"Failed to load Whisper model on {device}: {e}")
            if device == "cuda":
                logger.info("Retrying with CPU...")
                device = "cpu"
                self.whisper_model = whisper.load_model(whisper_model_name, device=device)
            else:
                raise
        self.max_chars_per_line = max_chars_per_line
        self.max_lines_per_caption = max_lines_per_caption
        self.max_caption_duration = max_caption_duration
        self.max_cps = max_cps
        self.max_caption_length = max_chars_per_line * max_lines_per_caption

    def format_multiline_caption(self, text: str) -> List[str]:
        """
        Formats text into one or two lines, prioritizing an inverted pyramid shape.
        Delegates to shared utility function.
        """
        return _format_multiline_caption(text, self.max_chars_per_line)

    def _create_semantic_segments(self, words: List[Dict]) -> List[Dict]:
        """
        **ROBUST IMPLEMENTATION**: Groups words into sentences using character offsets.
        """
        # 1. Build the full transcript and track character index for each word
        full_transcript = ""
        word_spans = []
        for word_data in words:
            start = len(full_transcript)
            # Whisper can include leading spaces, strip them
            word_text = word_data["word"].strip() 
            full_transcript += word_text + " "
            end = len(full_transcript) - 1
            word_spans.append({"start_char": start, "end_char": end, "word_data": word_data})

        # 2. Process with spaCy to find sentence boundaries
        doc = nlp(full_transcript.strip())
        
        # 3. Group words into sentences based on character spans
        segments = []
        current_word_index = 0
        for sent in doc.sents:
            sent_start_char, sent_end_char = sent.start_char, sent.end_char
            
            sentence_words = []
            while current_word_index < len(word_spans):
                word_span = word_spans[current_word_index]
                # Check if the word is within the current sentence span
                if word_span["start_char"] >= sent_start_char and word_span["end_char"] <= sent_end_char:
                    sentence_words.append(word_span["word_data"])
                    current_word_index += 1
                else:
                    break # Word belongs to the next sentence
            
            if sentence_words:
                segments.append({
                    "text": " ".join(w["word"].strip() for w in sentence_words),
                    "start_time": sentence_words[0]["start"],
                    "end_time": sentence_words[-1]["end"],
                    "words": sentence_words
                })
        return segments

    def generate_captions(self, words: List[Dict]) -> List[Dict[str, Any]]:
        """
        Generates captions by combining semantic segments while respecting all constraints.
        Handles splitting of overly long sentences.
        """
        if not words:
            return []

        segments = self._create_semantic_segments(words)
        captions = []
        
        current_caption_words = []
        
        for i, segment in enumerate(segments):
            # Combine current words with the new segment's words
            potential_words = current_caption_words + segment["words"]
            potential_text = " ".join(w["word"].strip() for w in potential_words)
            
            # Check constraints
            duration = potential_words[-1]["end"] - potential_words[0]["start"]
            cps = len(potential_text) / duration if duration > 0 else 0
            
            # If the new segment makes the caption too long, too fast, or too many characters,
            # finalize the PREVIOUS set of words as a caption.
            if current_caption_words and (
                duration > self.max_caption_duration or 
                cps > self.max_cps or 
                len(potential_text) > self.max_caption_length
            ):
                # Finalize the caption with the words we had BEFORE this segment
                # This loop handles splitting a long caption into multiple smaller ones
                while len(" ".join(w["word"].strip() for w in current_caption_words)) > self.max_caption_length:
                    split_point = -1
                    # Find the best place to split the oversized caption
                    for j in range(len(current_caption_words) - 1, 0, -1):
                        text_slice = " ".join(w["word"].strip() for w in current_caption_words[:j])
                        if len(text_slice) <= self.max_caption_length:
                            split_point = j
                            break
                    
                    if split_point == -1: # Cannot split, something is wrong
                        split_point = 1 # Just take the first word to avoid infinite loop

                    words_to_finalize = current_caption_words[:split_point]
                    current_caption_words = current_caption_words[split_point:] # Put rest back for next caption

                    final_text = " ".join(w["word"].strip() for w in words_to_finalize)
                    lines = self.format_multiline_caption(final_text)
                    captions.append({
                        "start_time": words_to_finalize[0]["start"],
                        "end_time": words_to_finalize[-1]["end"],
                        "text": "\n".join(lines),
                        "confidence": np.mean([w.get('probability', 1.0) for w in words_to_finalize])
                    })
                
                # Finalize the remaining (or only) part of the caption
                final_text = " ".join(w["word"].strip() for w in current_caption_words)
                lines = self.format_multiline_caption(final_text)
                captions.append({
                    "start_time": current_caption_words[0]["start"],
                    "end_time": current_caption_words[-1]["end"],
                    "text": "\n".join(lines),
                    "confidence": np.mean([w.get('probability', 1.0) for w in current_caption_words])
                })
                
                # Start the next caption with the current segment
                current_caption_words = segment["words"]
            else:
                # Segment fits, so add it to the current caption
                current_caption_words.extend(segment["words"])

        # After loop, finalize any remaining words in the buffer
        if current_caption_words:
            final_text = " ".join(w["word"].strip() for w in current_caption_words)
            lines = self.format_multiline_caption(final_text)
            captions.append({
                "start_time": current_caption_words[0]["start"],
                "end_time": current_caption_words[-1]["end"],
                "text": "\n".join(lines),
                "confidence": np.mean([w.get('probability', 1.0) for w in current_caption_words])
            })
            
        return captions

    def regenerate_captions_with_params(
        self,
        words: List[Dict],
        max_chars_per_line: int,
        max_lines_per_caption: int,
        max_caption_duration: int,
        max_cps: int
    ) -> List[Dict[str, Any]]:
        """Regenerate captions from existing word data with custom parameters."""
        logger.info(f"Regenerating captions with params: chars={max_chars_per_line}, lines={max_lines_per_caption}, duration={max_caption_duration}, cps={max_cps}")
        
        # Temporarily override instance parameters
        original_params = {
            'max_chars_per_line': self.max_chars_per_line,
            'max_lines_per_caption': self.max_lines_per_caption,
            'max_caption_duration': self.max_caption_duration,
            'max_cps': self.max_cps,
            'max_caption_length': self.max_caption_length
        }
        
        # Set new parameters
        self.max_chars_per_line = max_chars_per_line
        self.max_lines_per_caption = max_lines_per_caption
        self.max_caption_duration = max_caption_duration
        self.max_cps = max_cps
        self.max_caption_length = max_chars_per_line * max_lines_per_caption
        
        # Generate captions with new parameters
        captions = self.generate_captions(words)
        
        # Restore original parameters
        self.max_chars_per_line = original_params['max_chars_per_line']
        self.max_lines_per_caption = original_params['max_lines_per_caption']
        self.max_caption_duration = original_params['max_caption_duration']
        self.max_cps = original_params['max_cps']
        self.max_caption_length = original_params['max_caption_length']
        
        logger.info(f"Regenerated {len(captions)} caption segments")
        return captions

    def generate_transcription(self, audio_path: str, language: str = None) -> List[Dict[str, Any]]:
        """Public method to transcribe an audio file and generate formatted captions.

        Args:
            audio_path: Path to the audio file to transcribe
            language: Optional language code (e.g., 'en', 'ar', 'es'). 
                     If None, Whisper will auto-detect the language.

        NOTE: Whisper returns a detected language code in result.get('language'). We will attach it
        to each caption only via project metadata update elsewhere (UnifiedVideoProcessor) rather than
        mutating caption objects here to keep payload minimal.
        """
        
        logger.info(f"Transcribing audio file: {audio_path} with language: {language or 'auto-detect'}")
        if not Path(audio_path).exists():
            logger.error(f"Audio file not found: {audio_path}")
            raise FileNotFoundError(f"Audio file not found: {audio_path}")
        
        # Whisper output gives us segments, but we want a flat list of words for processing.
        # If language is specified, pass it to Whisper; otherwise let it auto-detect
        transcribe_options = {"word_timestamps": True}
        if language and language != "auto":
            transcribe_options["language"] = language
            
        result = self.whisper_model.transcribe(audio_path, **transcribe_options)
        # Store detected language for external access if needed
        self.last_detected_language = result.get("language") or "en"

        all_words = [word for segment in result["segments"] for word in segment.get("words", [])]

        if not all_words:
            logger.warning("Whisper did not detect any words in the audio.")
            return []

        logger.info(f"Extracted {len(all_words)} words from transcription (detected language: {self.last_detected_language})")

        captions = self.generate_captions(all_words)
        logger.info(f"Generated {len(captions)} caption segments")

        return captions