import json
import logging
from typing import List

import ollama
from pydantic import BaseModel
from ..models import CaptionData
from google import genai

logger = logging.getLogger(__name__)

class TranslationGenerator:
    def __init__(self, model_name: str = "alibayram/smollm3"):
        # The client gets the API key from the environment variable `GEMINI_API_KEY`.
        self.client = genai.Client()

        self.model_name = model_name

    def translate_caption(self, caption: str) -> str:
        """Translate the transcription to the Arabic language using Ollama"""
        logger.info(f"Translating caption: {caption}")
        response = self.client.models.generate_content(
            model="gemini-2.5-flash", contents="Translate this caption to Arabic (Write nothing except the translation): " + caption,
        )
        translated_text = response.text.strip()
        logger.info(f"Translated caption: {translated_text}")
        return translated_text
        
        # response = ollama.chat(
        #     model=self.model_name,
        #     messages=[
        #         {"role": "system", "content": "You are a smart Arabic translator."},
        #         {
        #             "role": "user",
        #             "content": f"Translate this caption to Arabic (Write nothing except the translation): {caption}",
        #         },
        #     ],
        # )
        # translated_text = response["message"]["content"].strip()
        # logger.info(f"Translated caption: {translated_text}")
        # return translated_text

    def translate_transcription(self, transcription: List[CaptionData]) -> List[CaptionData]:
        """Translate the entire transcription to Arabic"""
        logger.info("Translating transcription to Arabic")
        class TranslatedCaption(BaseModel):
            translation: str

        transcription_str = json.dumps([caption.dict() for caption in transcription])
        prompt = "This is the transcription of a video. Please translate it to Arabic.\n\n" + transcription_str
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
            transcription[idx].translation = translations[idx].translation
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
