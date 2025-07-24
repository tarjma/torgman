import logging
from typing import List
from pathlib import Path
from ..models.project import CaptionData
from ..api.config import SubtitleConfig
from ..core.config import settings

logger = logging.getLogger(__name__)

# Font mapping for your available fonts
FONT_MAPPING = {
    "Cairo": {
        "ExtraLight": "Cairo/Cairo-ExtraLight.ttf",
        "Light": "Cairo/Cairo-Light.ttf",
        "Regular": "Cairo/Cairo-Regular.ttf", 
        "Medium": "Cairo/Cairo-Medium.ttf",
        "SemiBold": "Cairo/Cairo-SemiBold.ttf",
        "Bold": "Cairo/Cairo-Bold.ttf",
        "ExtraBold": "Cairo/Cairo-ExtraBold.ttf",
        "Black": "Cairo/Cairo-Black.ttf"
    },
    "Noto Sans Arabic": {
        "Thin": "Noto_Sans_Arabic/NotoSansArabic-Thin.ttf",
        "ExtraLight": "Noto_Sans_Arabic/NotoSansArabic-ExtraLight.ttf",
        "Light": "Noto_Sans_Arabic/NotoSansArabic-Light.ttf",
        "Regular": "Noto_Sans_Arabic/NotoSansArabic-Regular.ttf",
        "Medium": "Noto_Sans_Arabic/NotoSansArabic-Medium.ttf",
        "SemiBold": "Noto_Sans_Arabic/NotoSansArabic-SemiBold.ttf",
        "Bold": "Noto_Sans_Arabic/NotoSansArabic-Bold.ttf",
        "ExtraBold": "Noto_Sans_Arabic/NotoSansArabic-ExtraBold.ttf",
        "Black": "Noto_Sans_Arabic/NotoSansArabic-Black.ttf"
    },
    "Tajawal": {
        "ExtraLight": "Tajawal/Tajawal-ExtraLight.ttf",
        "Light": "Tajawal/Tajawal-Light.ttf",
        "Regular": "Tajawal/Tajawal-Regular.ttf",
        "Medium": "Tajawal/Tajawal-Medium.ttf",
        "Bold": "Tajawal/Tajawal-Bold.ttf",
        "ExtraBold": "Tajawal/Tajawal-ExtraBold.ttf",
        "Black": "Tajawal/Tajawal-Black.ttf"
    },
    "Rubik": {
        "Light": "Rubik/Rubik-Light.ttf",
        "Regular": "Rubik/Rubik-Regular.ttf",
        "Medium": "Rubik/Rubik-Medium.ttf",
        "SemiBold": "Rubik/Rubik-SemiBold.ttf",
        "Bold": "Rubik/Rubik-Bold.ttf",
        "ExtraBold": "Rubik/Rubik-ExtraBold.ttf",
        "Black": "Rubik/Rubik-Black.ttf",
        # Italic variants
        "LightItalic": "Rubik/Rubik-LightItalic.ttf",
        "Italic": "Rubik/Rubik-Italic.ttf",
        "MediumItalic": "Rubik/Rubik-MediumItalic.ttf",
        "SemiBoldItalic": "Rubik/Rubik-SemiBoldItalic.ttf",
        "BoldItalic": "Rubik/Rubik-BoldItalic.ttf",
        "ExtraBoldItalic": "Rubik/Rubik-ExtraBoldItalic.ttf",
        "BlackItalic": "Rubik/Rubik-BlackItalic.ttf"
    },
    "Amiri": {
        "Regular": "Amiri_Quran/AmiriQuran-Regular.ttf"
    },
    "Amiri Quran": {
        "Regular": "Amiri_Quran/AmiriQuran-Regular.ttf"
    }
}

def _to_ass_time(seconds: float) -> str:
    """Converts seconds to ASS time format H:MM:SS.ss"""
    h = int(seconds / 3600)
    m = int((seconds % 3600) / 60)
    s = int(seconds % 60)
    cs = int((seconds - h * 3600 - m * 60 - s) * 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"

def _hex_to_ass_color(hex_color: str, alpha: str = "00") -> str:
    """Converts #RRGGBB hex to &H[AA]BBGGRR ASS format."""
    if not hex_color:
        return "&H00FFFFFF"  # Default to white
        
    # Handle special color format for semi-transparent backgrounds
    if hex_color.startswith('#80') and len(hex_color) == 9:
        # Format: #80RRGGBB -> &H80BBGGRR
        alpha = hex_color[1:3]
        hex_color = hex_color[3:]
    elif hex_color.startswith('rgba'):
        # Extract alpha from rgba and convert
        return "&H80000000"  # Fallback for semi-transparent black
    else:
        hex_color = hex_color.lstrip('#')
    
    if len(hex_color) == 6:
        try:
            r, g, b = hex_color[0:2], hex_color[2:4], hex_color[4:6]
            return f"&H{alpha}{b.upper()}{g.upper()}{r.upper()}"
        except ValueError:
            return "&H00FFFFFF"
    
    return "&H00FFFFFF"  # Default to white

def _get_ass_alignment_from_numpad(alignment: int) -> int:
    """Convert numpad alignment (1-9) to ASS alignment, validating the input."""
    # ASS uses numpad layout:
    # 7 8 9  (Top-Left, Top-Center, Top-Right)
    # 4 5 6  (Mid-Left, Mid-Center, Mid-Right) 
    # 1 2 3  (Bot-Left, Bot-Center, Bot-Right)
    
    if alignment in [1, 2, 3, 4, 5, 6, 7, 8, 9]:
        return alignment
    else:
        logger.warning(f"Invalid alignment value {alignment}, defaulting to 2 (Bottom Center)")
        return 2  # Default to bottom center

def _get_font_path(font_family: str, font_weight: str) -> str:
    """Get the absolute path to the font file"""
    try:
        if font_family in FONT_MAPPING and font_weight in FONT_MAPPING[font_family]:
            relative_path = FONT_MAPPING[font_family][font_weight]
            font_path = settings.fonts_dir / relative_path
            
            if font_path.exists():
                return str(font_path)
            else:
                logger.warning(f"Font file not found: {font_path}")
        
        # Fallback to Noto Sans Arabic Regular
        fallback_path = settings.fonts_dir / "Noto_Sans_Arabic/NotoSansArabic-Regular.ttf"
        if fallback_path.exists():
            logger.info(f"Using fallback font: {fallback_path}")
            return str(fallback_path)
        
        # Last resort fallback to Cairo Regular
        cairo_fallback = settings.fonts_dir / "Cairo/Cairo-Regular.ttf"
        if cairo_fallback.exists():
            logger.info(f"Using Cairo fallback font: {cairo_fallback}")
            return str(cairo_fallback)
            
    except Exception as e:
        logger.error(f"Error getting font path for {font_family} {font_weight}: {e}")
    
    # If all else fails, return the font name for system fonts
    return font_family

def _get_ass_alignment_from_numpad(alignment: int) -> int:
    """Convert numpad alignment (1-9) to ASS alignment, validating the input."""
    # ASS uses numpad layout:
    # 7 8 9  (Top-Left, Top-Center, Top-Right)
    # 4 5 6  (Mid-Left, Mid-Center, Mid-Right) 
    # 1 2 3  (Bot-Left, Bot-Center, Bot-Right)
    
    if alignment in [1, 2, 3, 4, 5, 6, 7, 8, 9]:
        return alignment
    else:
        logger.warning(f"Invalid alignment value {alignment}, defaulting to 2 (Bottom Center)")
        return 2  # Default to bottom center

def _get_ass_alignment(position: str, text_align: str) -> int:
    """Convert legacy position and alignment to ASS alignment code (for backward compatibility)"""
    # ASS alignment codes using numpad layout:
    # 7=Top-Left, 8=Top-Center, 9=Top-Right
    # 4=Mid-Left, 5=Mid-Center, 6=Mid-Right  
    # 1=Bot-Left, 2=Bot-Center, 3=Bot-Right
    
    if position == "top-center":
        if text_align == "left":
            return 7
        elif text_align == "right":
            return 9
        else:
            return 8  # center
    elif position == "center":
        if text_align == "left":
            return 4
        elif text_align == "right":
            return 6
        else:
            return 5  # center
    else:  # bottom-center (default)
        if text_align == "left":
            return 1
        elif text_align == "right":
            return 3
        else:
            return 2  # center

def create_ass_content(subtitles: List[CaptionData], style_config: SubtitleConfig) -> str:
    """
    Generates the content for an .ass subtitle file using the complete ASS specification.
    """
    
    # Get font path
    font_path = _get_font_path(style_config.fontFamily, style_config.fontWeight)
    
    # Convert colors to ASS format
    primary_color = _hex_to_ass_color(style_config.color or "#ffffff", "00")
    secondary_color = _hex_to_ass_color(style_config.secondaryColor or "#0000ff", "00")
    outline_color = _hex_to_ass_color(style_config.outlineColor or "#000000", "00")
    
    # Handle background color with proper transparency
    if style_config.backgroundColor:
        if style_config.backgroundColor == "transparent" or style_config.backgroundColor == "#00000000":
            back_color = "&H00000000"  # Fully transparent
        elif len(style_config.backgroundColor) == 9:  # #rrggbbaa format
            # Convert #rrggbbaa to ASS &Haarrggbb format
            hex_color = style_config.backgroundColor[1:]  # Remove #
            alpha = hex_color[6:8]
            rgb = hex_color[0:6]
            back_color = f"&H{alpha}{rgb[4:6]}{rgb[2:4]}{rgb[0:2]}"
        else:
            # Regular hex color, add semi-transparency for better readability
            back_color = _hex_to_ass_color(style_config.backgroundColor, "80")
    else:
        back_color = "&H80000000"  # Default semi-transparent black
    
    # Get font size (ensure it's just the number, but scale appropriately for ASS)
    # ASS font sizes tend to be smaller than CSS pixel sizes for the same visual result
    font_size_num = int(style_config.fontSize.replace('px', '').replace('pt', '')) if style_config.fontSize else 28
    # Scale down CSS pixel sizes to better match ASS rendering
    # For better visual matching, we need to adjust based on typical video resolution
    ass_font_size = max(16, int(font_size_num * 0.9))  # Less aggressive scaling for better matching
    
    # Convert boolean style flags to ASS format (-1 for true, 0 for false)
    bold = -1 if style_config.bold else 0
    italic = -1 if style_config.italic else 0
    underline = -1 if style_config.underline else 0
    strikeout = -1 if style_config.strikeOut else 0
    
    # Scaling and effects
    scale_x = style_config.scaleX or 100
    scale_y = style_config.scaleY or 100
    spacing = style_config.spacing or 0
    angle = style_config.angle or 0
    
    # Border and shadow - adjust for better visual matching
    border_style = style_config.borderStyle or 1
    # Increase outline thickness for better visibility to match CSS text-shadow
    # CSS text-shadow creates a strong outline effect, so we need thicker ASS outline
    outline = max(3, (style_config.outline or 2) * 2)    # Double the outline for better matching
    shadow = max(2, (style_config.shadow or 1) * 1.5)    # Increase shadow for better visibility
    
    # Get alignment (use numpad layout)
    alignment = _get_ass_alignment_from_numpad(style_config.alignment or 2)
    
    # Calculate margins in pixels
    margin_left = int(style_config.margin.left)
    margin_right = int(style_config.margin.right)
    margin_vertical = int(style_config.margin.vertical)
    
    # V4+ Style line format (complete ASS specification)
    style_header = "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding"
    
    # Create the main style with all ASS fields
    main_style = f"Style: Default,{font_path},{ass_font_size},{primary_color},{secondary_color},{outline_color},{back_color},{bold},{italic},{underline},{strikeout},{scale_x},{scale_y},{spacing},{angle},{border_style},{outline},{shadow},{alignment},{margin_left},{margin_right},{margin_vertical},1"
    
    # Log the generated style for debugging
    logger.info(f"Generated ASS style: {main_style}")
    logger.info(f"Font size conversion: CSS {style_config.fontSize} -> ASS {ass_font_size}")
    logger.info(f"Colors - Primary: {primary_color}, Outline: {outline_color}, Background: {back_color}")
    logger.info(f"Outline thickness: {outline}, Shadow: {shadow}")
    
    # Events line format
    events_header = "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"
    
    # Create dialogue lines
    dialogue_lines = []
    for sub in subtitles:
        start_time = _to_ass_time(sub.start)
        end_time = _to_ass_time(sub.end)
        
        # Use translation if available, otherwise use original text
        text = sub.translation if sub.translation else sub.text
        if text:
            # Escape text for ASS format and handle line breaks
            text = text.replace('\n', '\\N').replace('{', '\\{').replace('}', '\\}')
            dialogue_lines.append(f"Dialogue: 0,{start_time},{end_time},Default,,0,0,0,,{text}")
    
    # Assemble the full ASS file content with dynamic resolution
    ass_content = f"""[Script Info]
Title: Torgman Generated Subtitles
ScriptType: v4.00+
WrapStyle: 0
PlayResX: 1920
PlayResY: 1080
ScaledBorderAndShadow: yes

[V4+ Styles]
{style_header}
{main_style}

[Events]
{events_header}
{chr(10).join(dialogue_lines)}
"""

    logger.info(f"Generated ASS file with {len(dialogue_lines)} dialogue lines")
    return ass_content.strip()

def save_ass_file(project_id: str, subtitles: List[CaptionData], style_config: SubtitleConfig) -> Path:
    """Save ASS subtitle file for a project"""
    project_dir = settings.get_project_dir(project_id)
    ass_path = project_dir / "subtitles.ass"
    
    ass_content = create_ass_content(subtitles, style_config)
    
    with open(ass_path, 'w', encoding='utf-8') as f:
        f.write(ass_content)
    
    logger.info(f"ASS subtitles saved successfully: {ass_path}")
    return ass_path
        
