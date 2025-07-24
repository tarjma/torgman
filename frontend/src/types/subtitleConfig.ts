export interface CaptionMargin {
  left: number;
  right: number;
  vertical: number;
}

export interface SubtitleConfig {
  // Basic text properties
  fontSize: string;        // Font size in points (e.g., "28")
  fontFamily: string;      // Font family name
  fontWeight: string;      // Font weight
  
  // Colors (hex format)
  color: string;           // Primary text color (e.g., "#ffffff")
  secondaryColor?: string; // Secondary color for karaoke effects (e.g., "#0000ff")
  outlineColor?: string;   // Outline/border color (e.g., "#000000")
  backgroundColor: string; // Background/shadow color (e.g., "#80000000")
  
  // Style flags (boolean in frontend, converted to -1/0 in backend)
  bold?: boolean;          // Bold text
  italic?: boolean;        // Italic text
  underline?: boolean;     // Underlined text
  strikeOut?: boolean;     // Strike-through text
  
  // Scaling and spacing
  scaleX?: number;         // Horizontal scaling percentage (default: 100)
  scaleY?: number;         // Vertical scaling percentage (default: 100)
  spacing?: number;        // Extra character spacing in pixels (default: 0)
  angle?: number;          // Z-axis rotation in degrees (default: 0)
  
  // Border and shadow
  borderStyle?: number;    // 1=Outline+Shadow, 3=Opaque box (default: 1)
  outline?: number;        // Outline thickness in pixels (default: 2)
  shadow?: number;         // Shadow distance in pixels (default: 1)
  
  // Alignment (numpad layout: 1-9, default: 2 for bottom center)
  alignment?: number;      // ASS alignment using numpad layout
  
  // Margins
  margin: CaptionMargin;
  
}
