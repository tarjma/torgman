import { API_CONFIG } from '../config/api';

// Track which fonts have been loaded to avoid duplicate loading
const loadedFonts = new Set<string>();

// Map CSS font-weight keywords to numeric values for FontFace API
const weightMap: Record<string, string> = {
  'ExtraLight': '200',
  'Light': '300',
  'Regular': '400',
  'Medium': '500',
  'SemiBold': '600',
  'Bold': '700',
  'ExtraBold': '800',
  'Black': '900',
};

/**
 * Load a specific font into the browser using FontFace API
 * @param fontFamily - The font family name (e.g., "Cairo")
 * @param fontWeight - The font weight variant (e.g., "Regular", "Bold")
 */
export async function loadFont(fontFamily: string, fontWeight: string = 'Regular'): Promise<boolean> {
  const fontKey = `${fontFamily}-${fontWeight}`;
  
  // Skip if already loaded
  if (loadedFonts.has(fontKey)) {
    return true;
  }
  
  const fontUrl = `${API_CONFIG.BASE_URL}/api/fonts/${encodeURIComponent(fontFamily)}/${encodeURIComponent(fontWeight)}`;
  const numericWeight = weightMap[fontWeight] || '400';
  
  // Create FontFace and load it
  const fontFace = new FontFace(fontFamily, `url(${fontUrl})`, {
    weight: numericWeight,
    style: 'normal',
  });
  
  await fontFace.load();
  document.fonts.add(fontFace);
  loadedFonts.add(fontKey);
  console.log(`Loaded font: ${fontFamily} ${fontWeight}`);
  return true;
}

/**
 * Load all weights for a font family
 * @param fontFamily - The font family name
 * @param weights - Array of weight variants to load
 */
export async function loadFontFamily(fontFamily: string, weights: string[]): Promise<void> {
  const loadPromises = weights.map(weight => loadFont(fontFamily, weight));
  await Promise.all(loadPromises);
}

/**
 * Preload common fonts that are likely to be used
 * @param fonts - Array of font objects with font_family and font_weight
 */
export async function preloadFonts(fonts: Array<{ font_family: string; font_weight: string }>): Promise<void> {
  // Load all available fonts (they're small TTF files and will be cached)
  const loadPromises = fonts.map(font => loadFont(font.font_family, font.font_weight));
  await Promise.allSettled(loadPromises);
}

/**
 * Check if a font is currently loaded
 */
export function isFontLoaded(fontFamily: string, fontWeight: string = 'Regular'): boolean {
  return loadedFonts.has(`${fontFamily}-${fontWeight}`);
}

/**
 * Get list of all loaded fonts
 */
export function getLoadedFonts(): string[] {
  return Array.from(loadedFonts);
}
