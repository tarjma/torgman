import { useState, useCallback } from 'react';
import { AITranslation } from '../types';
import apiClient from '../services/apiClient';

export const useAITranslation = () => {
  const [isTranslating, setIsTranslating] = useState(false);
  const [translations, setTranslations] = useState<Map<string, AITranslation>>(new Map());

  const translateText = useCallback(async (text: string, context?: string): Promise<AITranslation> => {
    setIsTranslating(true);
    
    try {
      // Call the real backend API for translation with extended timeout for translations
      const response = await apiClient.post('/api/projects/translate-text', null, {
        params: { text },
        timeout: 120000 // 2 minutes timeout for individual translations
      });
      
      const translation: AITranslation = {
        original: text,
        translated: response.data.translated,
        confidence: 0.9, // Default confidence for API translations
        suggestions: [response.data.translated], // For now, just one suggestion
        context
      };

      setTranslations(prev => new Map(prev).set(text, translation));
      return translation;
    } catch (error: any) {
      console.error('Translation API failed:', error);
      
      // More specific error messages
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        throw new Error('Translation timeout - please try again');
      } else if (error.response?.status === 500) {
        throw new Error('Translation service error - please try again later');
      } else if (error.response?.status === 400) {
        throw new Error('Invalid text for translation');
      } else {
        throw new Error('Translation failed - please check your connection');
      }
    } finally {
      setIsTranslating(false);
    }
  }, []);

  const getTranslation = useCallback((text: string): AITranslation | undefined => {
    return translations.get(text);
  }, [translations]);

  const suggestImprovement = useCallback(async (_originalText: string, translatedText: string): Promise<string[]> => {
    // Simulate AI grammar and improvement suggestions
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return [
      translatedText,
      translatedText + ' (محسّن)',
      translatedText + ' (مبسط)'
    ];
  }, []);

  return {
    isTranslating,
    translateText,
    getTranslation,
    suggestImprovement
  };
};