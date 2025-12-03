import apiClient from './apiClient';
import { API_CONFIG } from '../config/api';

export interface Font {
  font_family: string;
  font_weight: string;
  arabic_support: 'full' | 'partial' | 'limited' | 'unknown';
}

export interface FontFamily {
  name: string;
  weights: string[];
  arabicSupport: 'full' | 'partial' | 'limited' | 'unknown';
}

class FontService {
  async getAvailableFonts(): Promise<Font[]> {
    const response = await apiClient.get(API_CONFIG.ENDPOINTS.FONTS);
    return response.data;
  }

  // Transform raw font data into grouped font families
  getFontFamilies(fonts: Font[]): FontFamily[] {
    if (!Array.isArray(fonts)) {
      return [];
    }

    const familyMap = new Map<string, { weights: Set<string>; arabicSupport: string }>();
    
    fonts.forEach(font => {
      if (font && font.font_family && font.font_weight) {
        if (!familyMap.has(font.font_family)) {
          familyMap.set(font.font_family, { 
            weights: new Set(), 
            arabicSupport: font.arabic_support || 'unknown' 
          });
        }
        familyMap.get(font.font_family)!.weights.add(font.font_weight);
      }
    });
    
    return Array.from(familyMap.entries()).map(([name, data]) => ({
      name,
      weights: Array.from(data.weights).sort(),
      arabicSupport: data.arabicSupport as FontFamily['arabicSupport']
    }));
  }
}

export const fontService = new FontService();
