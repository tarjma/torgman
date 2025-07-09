import logging
import os
from typing import Any, Dict, List

import librosa
import whisper
from pyannote.audio import Model
from pyannote.audio.pipelines import VoiceActivityDetection

logger = logging.getLogger(__name__)

class SubtitleGenerator:
    """Generate subtitles using Whisper ASR with audio segmentation"""
    
    def __init__(self):
        # Load the segmentation model from Hugging Face
        logger.info("Loading segmentation model")
        segmentation_model = Model.from_pretrained(
            "pyannote/segmentation",
            use_auth_token=os.getenv("HF_TOKEN")
        )
        self.segmentation_pipeline = VoiceActivityDetection(segmentation=segmentation_model)
        HYPER_PARAMETERS = {
            "onset": 0.5, "offset": 0.5, # onset/offset activation thresholds
            "min_duration_on": 0.7, # remove speech regions shorter than that many seconds.
            "min_duration_off": 0.4 # fill non-speech regions shorter than that many seconds.
        }
        self.segmentation_pipeline.instantiate(HYPER_PARAMETERS)

        # Load the Whisper model
        logger.info("Loading Whisper model")
        self.whisper_model = whisper.load_model("turbo")
    
    def generate_transcription(self, audio_path: str) -> List[Dict[str, Any]]:
        """Segment audio into manageable chunks for Whisper processing"""
        # Load the entire audio file
        logger.info(f"Loading audio file: {audio_path}")
        audio, sr = librosa.load(audio_path, sr=16000, mono=True)
        logger.info(f"Audio loaded with sample rate: {sr} Hz, duration: {len(audio)/sr:.2f} seconds")
        
        # Use pyannote segmentation to find natural breaks in audio
        speech_segments = self.segmentation_pipeline(audio_path)
        logger.info(f"Detected {len(speech_segments)} speech segments")
        
        # Convert segmentation to manageable chunks
        segments = []
        for segment in speech_segments.itersegments():
            start_time = segment.start
            end_time = segment.end
            
            # Convert start/end times to sample indices
            # This is the core of the "cutting" process
            start_sample = int(start_time * sr)
            end_sample = int(end_time * sr)
            
            # Slice the audio waveform to get the segment
            segment_audio = audio[start_sample:end_sample]
            
            # Ensure the segment is not empty
            if len(segment_audio) == 0:
                continue
                
            # Transcribe the audio chunk with Whisper
            # Use fp16=False if you are running on CPU
            result = self.whisper_model.transcribe(segment_audio)
            logger.info(result)
            transcribed_text = result['text'].strip()
            logger.info(f"Transcribed segment from {start_time:.2f}s to {end_time:.2f}s: {transcribed_text}")
        
            segments.append({
                "start": start_time,
                "end": end_time,
                "text": transcribed_text,
                "confidence": result.get('confidence', 0.5),
                "language": result.get('language', 'unknown')
            })
        
        logger.info(f"Created {len(segments)} audio segments")
        return segments
