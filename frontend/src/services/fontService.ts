import apiClient from './apiClient';
import { API_CONFIG } from '../config/api';

export interface Font {
  font_family: string;
  font_weight: string;
}

export interface FontFamily {
  name: string;
  weights: string[];
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

    const familyMap = new Map<string, Set<string>>();
    
    fonts.forEach(font => {
      if (font && font.font_family && font.font_weight) {
        if (!familyMap.has(font.font_family)) {
          familyMap.set(font.font_family, new Set());
        }
        familyMap.get(font.font_family)!.add(font.font_weight);
      }
    });
    
    return Array.from(familyMap.entries()).map(([name, weights]) => ({
      name,
      weights: Array.from(weights).sort()
    }));
  }
}

export const fontService = new FontService();
