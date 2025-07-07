import { useState, useCallback } from 'react';
import { AITranslation } from '../types';

export const useAITranslation = () => {
  const [isTranslating, setIsTranslating] = useState(false);
  const [translations, setTranslations] = useState<Map<string, AITranslation>>(new Map());

  const translateText = useCallback(async (text: string, context?: string): Promise<AITranslation> => {
    setIsTranslating(true);
    
    try {
      // Simulate AI translation API call
      // In a real app, this would call your AI translation service
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const mockTranslation: AITranslation = {
        original: text,
        translated: getMockArabicTranslation(text),
        confidence: 0.85 + Math.random() * 0.15,
        suggestions: [
          getMockArabicTranslation(text),
          getMockArabicTranslation(text, true),
          getMockArabicTranslation(text, false, true)
        ],
        context
      };

      setTranslations(prev => new Map(prev).set(text, mockTranslation));
      return mockTranslation;
    } catch (error) {
      throw new Error('Translation failed');
    } finally {
      setIsTranslating(false);
    }
  }, []);

  const getMockArabicTranslation = (text: string, formal: boolean = false, short: boolean = false): string => {
    // Mock Arabic translations for demo
    const translations: Record<string, string> = {
      'Hello': 'مرحبا',
      'Hello World': 'مرحبا بالعالم',
      'Welcome': 'أهلا وسهلا',
      'Thank you': 'شكرا لك',
      'Goodbye': 'وداعا',
      'Yes': 'نعم',
      'No': 'لا',
      'Please': 'من فضلك',
      'How are you?': 'كيف حالك؟',
      'Good morning': 'صباح الخير',
      'Good evening': 'مساء الخير'
    };

    return translations[text] || `ترجمة: ${text}`;
  };

  const getTranslation = useCallback((text: string): AITranslation | undefined => {
    return translations.get(text);
  }, [translations]);

  const suggestImprovement = useCallback(async (originalText: string, translatedText: string): Promise<string[]> => {
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