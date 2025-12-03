import { useState, useEffect, useCallback } from 'react';
import { fontService, Font, FontFamily } from '../services/fontService';
import { loadFont, preloadFonts, isFontLoaded } from '../services/fontLoader';

export const useFonts = () => {
  const [fonts, setFonts] = useState<Font[]>([]);
  const [fontFamilies, setFontFamilies] = useState<FontFamily[]>([]);
  const [loading, setLoading] = useState(true);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadFonts = async () => {
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
      
      // Preload all fonts into the browser
      await preloadFonts(availableFonts);
      setFontsLoaded(true);
      setLoading(false);
    };

    loadFonts();
  }, []);

  // Function to ensure a specific font is loaded
  const ensureFontLoaded = useCallback(async (fontFamily: string, fontWeight: string = 'Regular') => {
    if (!isFontLoaded(fontFamily, fontWeight)) {
      await loadFont(fontFamily, fontWeight);
    }
  }, []);

  // Validation function to check if a font family exists
  const validateFontFamily = (fontFamily: string): string => {
    const availableFamily = fontFamilies.find(family => family.name === fontFamily);
    if (availableFamily) {
      return fontFamily;
    }
    
    // Fallback to Noto Sans Arabic if available, otherwise first available font
    const fallbackFamily = fontFamilies.find(family => family.name === 'Noto Sans Arabic') || fontFamilies[0];
    return fallbackFamily?.name || 'Noto Sans Arabic';
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
    fontsLoaded,
    error, 
    validateFontFamily, 
    getAvailableWeights, 
    validateFontWeight,
    ensureFontLoaded
  };
};
