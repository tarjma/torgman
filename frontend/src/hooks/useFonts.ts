import { useState, useEffect } from 'react';
import { fontService, Font, FontFamily } from '../services/fontService';

export const useFonts = () => {
  const [fonts, setFonts] = useState<Font[]>([]);
  const [fontFamilies, setFontFamilies] = useState<FontFamily[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadFonts = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const availableFonts = await fontService.getAvailableFonts();
        
        // Ensure we have an array
        if (!Array.isArray(availableFonts)) {
          throw new Error('API returned non-array response');
        }
        
        setFonts(availableFonts);
        
        // Transform into font families
        const families = fontService.getFontFamilies(availableFonts);
        setFontFamilies(families);
      } catch (err) {
        setError('Failed to load fonts');
        // Set empty arrays as fallback
        setFonts([]);
        setFontFamilies([]);
      } finally {
        setLoading(false);
      }
    };

    loadFonts();
  }, []);

  // Validation function to check if a font family exists
  const validateFontFamily = (fontFamily: string): string => {
    const availableFamily = fontFamilies.find(family => family.name === fontFamily);
    if (availableFamily) {
      return fontFamily;
    }
    
    // Fallback to Cairo if available, otherwise first available font
    const fallbackFamily = fontFamilies.find(family => family.name === 'Cairo') || fontFamilies[0];
    return fallbackFamily?.name || 'Cairo';
  };

  // Function to get available weights for a font family
  const getAvailableWeights = (fontFamily: string): string[] => {
    const family = fontFamilies.find(family => family.name === fontFamily);
    return family?.weights || ['Regular'];
  };

  // Function to validate font weight for a specific family
  const validateFontWeight = (fontFamily: string, fontWeight: string): string => {
    const availableWeights = getAvailableWeights(fontFamily);
    if (availableWeights.includes(fontWeight)) {
      return fontWeight;
    }
    
    // Fallback to Regular if available, otherwise first available weight
    return availableWeights.includes('Regular') ? 'Regular' : availableWeights[0] || 'Regular';
  };

  return { 
    fonts, 
    fontFamilies, 
    loading, 
    error, 
    validateFontFamily, 
    getAvailableWeights, 
    validateFontWeight 
  };
};
