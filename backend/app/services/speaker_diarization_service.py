"""
Speaker Diarization Service using PyAnnote.audio

This service identifies different speakers in audio and assigns speaker labels
to word-level timestamps from Whisper transcription.
"""
import logging
import os
from pathlib import Path
from typing import Dict, List, Optional

import torch

logger = logging.getLogger(__name__)

# Lazy loading of pyannote to avoid import errors if not installed
_diarization_pipeline = None


def _get_diarization_pipeline():
    """Lazy load the diarization pipeline with HuggingFace token."""
    global _diarization_pipeline
    
    if _diarization_pipeline is not None:
        return _diarization_pipeline
    
    from pyannote.audio import Pipeline
    
    # Get HuggingFace token from environment
    hf_token = os.getenv("HF_TOKEN") or os.getenv("HUGGINGFACE_TOKEN")
    
    if not hf_token:
        logger.warning("No HuggingFace token found. Speaker diarization requires accepting pyannote terms at huggingface.co")
        return None
    
    # Determine device
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    logger.info(f"Loading pyannote diarization pipeline on {device}")
    
    _diarization_pipeline = Pipeline.from_pretrained(
        "pyannote/speaker-diarization-3.1",
        use_auth_token=hf_token
    )
    _diarization_pipeline.to(device)
    
    logger.info("Diarization pipeline loaded successfully")
    return _diarization_pipeline


class SpeakerDiarizationService:
    """
    Service for speaker diarization that assigns speaker labels to words.
    
    Uses pyannote.audio to identify speaker segments, then aligns them with
    word-level timestamps from Whisper.
    """
    
    def __init__(self):
        self.pipeline = None
        self._initialized = False
    
    def _ensure_initialized(self) -> bool:
        """Ensure the diarization pipeline is loaded."""
        if self._initialized:
            return self.pipeline is not None
        
        self.pipeline = _get_diarization_pipeline()
        self._initialized = True
        return self.pipeline is not None
    
    def diarize_audio(self, audio_path: str, num_speakers: Optional[int] = None) -> List[Dict]:
        """
        Perform speaker diarization on an audio file.
        
        Args:
            audio_path: Path to the audio file (WAV format recommended)
            num_speakers: Optional hint for number of speakers (improves accuracy)
            
        Returns:
            List of speaker segments: [{"start": float, "end": float, "speaker": str}, ...]
        """
        if not self._ensure_initialized():
            logger.warning("Diarization pipeline not available, returning empty segments")
            return []
        
        if not Path(audio_path).exists():
            logger.error(f"Audio file not found: {audio_path}")
            return []
        
        logger.info(f"Starting speaker diarization for: {audio_path}")
        
        # Run diarization
        diarization_params = {}
        if num_speakers is not None:
            diarization_params["num_speakers"] = num_speakers
        
        diarization = self.pipeline(audio_path, **diarization_params)
        
        # Convert to list of segments
        segments = []
        for turn, _, speaker in diarization.itertracks(yield_label=True):
            segments.append({
                "start": turn.start,
                "end": turn.end,
                "speaker": speaker
            })
        
        logger.info(f"Diarization complete: found {len(set(s['speaker'] for s in segments))} speakers, {len(segments)} segments")
        return segments
    
    def assign_speakers_to_words(
        self, 
        words: List[Dict], 
        speaker_segments: List[Dict]
    ) -> List[Dict]:
        """
        Assign speaker labels to word-level timestamps.
        
        Uses overlap-based assignment: a word is assigned to the speaker
        whose segment has the most overlap with the word's time span.
        
        Args:
            words: List of word dicts from Whisper: [{"word": str, "start": float, "end": float, ...}, ...]
            speaker_segments: List of speaker segments from diarization
            
        Returns:
            Words with added "speaker" field
        """
        if not speaker_segments:
            # No diarization data, assign all to SPEAKER_00
            for word in words:
                word["speaker"] = "SPEAKER_00"
            return words
        
        # Sort segments by start time for efficient lookup
        sorted_segments = sorted(speaker_segments, key=lambda s: s["start"])
        
        for word in words:
            word_start = word.get("start", 0)
            word_end = word.get("end", word_start)
            word_mid = (word_start + word_end) / 2
            
            # Find the speaker segment that contains the word midpoint
            # or has the most overlap with the word
            best_speaker = "SPEAKER_00"
            best_overlap = 0
            
            for segment in sorted_segments:
                seg_start = segment["start"]
                seg_end = segment["end"]
                
                # Skip segments that end before the word starts
                if seg_end < word_start:
                    continue
                
                # Stop if segment starts after word ends
                if seg_start > word_end:
                    break
                
                # Calculate overlap
                overlap_start = max(word_start, seg_start)
                overlap_end = min(word_end, seg_end)
                overlap = max(0, overlap_end - overlap_start)
                
                if overlap > best_overlap:
                    best_overlap = overlap
                    best_speaker = segment["speaker"]
                
                # Quick assignment if midpoint is in segment
                if seg_start <= word_mid <= seg_end:
                    best_speaker = segment["speaker"]
                    break
            
            word["speaker"] = best_speaker
        
        # Log speaker distribution
        speaker_counts = {}
        for word in words:
            speaker = word.get("speaker", "UNKNOWN")
            speaker_counts[speaker] = speaker_counts.get(speaker, 0) + 1
        logger.info(f"Speaker word distribution: {speaker_counts}")
        
        return words
    
    def diarize_and_assign(
        self, 
        audio_path: str, 
        words: List[Dict],
        num_speakers: Optional[int] = None
    ) -> List[Dict]:
        """
        Convenience method: diarize audio and assign speakers to words in one call.
        
        Args:
            audio_path: Path to the audio file
            words: List of word dicts from Whisper
            num_speakers: Optional hint for number of speakers
            
        Returns:
            Words with added "speaker" field
        """
        speaker_segments = self.diarize_audio(audio_path, num_speakers)
        return self.assign_speakers_to_words(words, speaker_segments)


# Singleton instance
_diarization_service = None


def get_diarization_service() -> SpeakerDiarizationService:
    """Get or create the singleton diarization service."""
    global _diarization_service
    if _diarization_service is None:
        _diarization_service = SpeakerDiarizationService()
    return _diarization_service
