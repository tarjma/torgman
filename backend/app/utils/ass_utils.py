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

def _hex_to_ass_color(color: str, alpha: str = "00") -> str:
    """Convert hex (and common variants) to ASS &HAA BB GG RR.
    Supports:
    - #RRGGBB -> uses provided alpha (default opaque 00)
    - #AARRGGBB (detected when starts with '#80')
    - #RRGGBBAA (CSS 8-digit hex: alpha at end)
    Alpha conversion: CSS 0..255 -> ASS uses inverted (00 = opaque, FF = transparent)
    """
    if not color:
        return "&H00FFFFFF"

    if color.startswith('rgba'):
        # TODO: parse properly if needed; fallback to semi-transparent black
        return "&H80000000"

    raw = color.lstrip('#')
    if len(raw) == 6:
        r, g, b = raw[0:2], raw[2:4], raw[4:6]
        return f"&H{alpha}{b.upper()}{g.upper()}{r.upper()}"
    if len(raw) == 8:
        # Prefer CSS #RRGGBBAA unless explicitly starting with '#80' (legacy AARRGGBB default)
        if color.startswith('#80'):
            aa_css = int(raw[0:2], 16)
            r, g, b = raw[2:4], raw[4:6], raw[6:8]
        else:
            r, g, b = raw[0:2], raw[2:4], raw[4:6]
            aa_css = int(raw[6:8], 16)
        aa_ass = f"{(255 - aa_css):02X}"
        return f"&H{aa_ass}{b.upper()}{g.upper()}{r.upper()}"
    return "&H00FFFFFF"

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

def _installed_font_families() -> set:
    """Scan known font directories and return a set of installed font family names.
    Family names are inferred from folder names under the font directories.
    """
    families = set()
    try:
        # App assets directory
        assets_dir = settings.fonts_dir
        if assets_dir.exists():
            for p in assets_dir.iterdir():
                if p.is_dir():
                    families.add(p.name.replace("_", " "))
        # System custom fonts directory used in container/Dockerfile
        system_dir = Path("/usr/share/fonts/truetype/custom")
        if system_dir.exists():
            for p in system_dir.iterdir():
                if p.is_dir():
                    families.add(p.name.replace("_", " "))
    except Exception as e:
        logger.warning(f"Error scanning installed fonts: {e}")
    return families

def _get_font_name(font_family: str, font_weight: str) -> str:
    """Return the font family name for ASS if installed; otherwise fallback safely.
    - Accept any family present in assets or system custom fonts.
    - Map 'Amiri Quran' to 'Amiri' for libass family matching.
    - Fallback to 'Noto Sans Arabic' to avoid tofu if not installed.
    """
    requested = (font_family or "").strip()
    if requested == "Amiri Quran":
        return "Amiri"

    installed = _installed_font_families()
    if requested in installed:
        return requested

    # As an extra tolerance, some families may be packaged without spaces in folder names
    if requested.replace(" ", "_") in {name.replace(" ", "_") for name in installed}:
        return requested

    logger.info(f"Requested font family '{requested}' not found. Falling back to Noto Sans Arabic")
    return "Noto Sans Arabic"

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

def create_ass_content(subtitles: List[CaptionData], style_config: SubtitleConfig, video_width: int = 1280, video_height: int = 720) -> str:
    """
    Generates the content for an .ass subtitle file using the complete ASS specification.
    Now properly handles resolution matching and background boxes.
    """
    
    # Get font name (not path) for better FFmpeg compatibility
    font_name = _get_font_name(style_config.fontFamily, style_config.fontWeight)
    
    # Convert colors to ASS format
    primary_color = _hex_to_ass_color(style_config.color or "#ffffff", "00")
    # Avoid blue fringing/edges by defaulting secondary to primary when not explicitly set
    if not style_config.secondaryColor or style_config.secondaryColor.lower() == "#0000ff":
        secondary_color = primary_color
    else:
        secondary_color = _hex_to_ass_color(style_config.secondaryColor, "00")
    outline_color = _hex_to_ass_color(style_config.outlineColor or "#000000", "00")
    
    # Handle background color and determine BorderStyle
    border_style = 1  # Default: Outline + Shadow
    back_color = "&H00000000"  # Transparent by default

    if style_config.backgroundColor and style_config.backgroundColor.lower() not in ["transparent", "#00000000"]:
        # Enable boxed background
        border_style = 3
        back_color = _hex_to_ass_color(style_config.backgroundColor)
    
    # Calculate font size directly from config (fixed PlayRes baseline handled by libass)
    font_size_num = int(str(style_config.fontSize).replace('px', '').replace('pt', '')) if style_config.fontSize else 28
    # Apply a metric compensation factor to better match browser vs libass rendering
    # This helps align perceived size between CSS and libass when using the same nominal size
    metric_scale = 1.35
    ass_font_size = max(8, int(round(font_size_num * metric_scale)))
    
    # Convert style flags; infer from fontWeight if explicit flags are not set
    weight = (style_config.fontWeight or "").lower()
    # Treat any weight containing these tokens as bold-ish for ASS
    bold_tokens = {"medium", "semi", "semibold", "bold", "extra", "extrabold", "black"}
    bold_flag = bool(style_config.bold) or any(tok in weight for tok in bold_tokens)
    italic_flag = bool(style_config.italic) or ("italic" in weight)
    # ASS expects -1 for true, 0 for false
    bold = -1 if bold_flag else 0
    italic = -1 if italic_flag else 0
    underline = -1 if style_config.underline else 0
    strikeout = -1 if style_config.strikeOut else 0
    
    # Scaling and effects
    scale_x = style_config.scaleX or 100
    scale_y = style_config.scaleY or 100
    spacing = style_config.spacing or 0
    angle = style_config.angle or 0
    
    # Border and shadow
    # In ASS, when using BorderStyle=3 (opaque box), the Outline field works as padding around the text.
    # Increase the minimum considerably for better aesthetics on left/right.
    outline = max(0, int(style_config.outline or 2))
    if border_style == 3 and outline < 8:
        outline = 8
    # When using a background box, treat outline as box padding and disable shadow to avoid colored edges
    if border_style == 3:
        shadow = 0
    else:
        shadow = max(0, int(style_config.shadow or 1))
    
    # Get alignment (use numpad layout)
    alignment = _get_ass_alignment_from_numpad(style_config.alignment or 2)
    
    # Calculate margins in pixels (no scaling; fixed PlayRes will scale appropriately)
    margin_left = int(round(style_config.margin.left))
    margin_right = int(round(style_config.margin.right))
    
    # For vertical margin, use bottom for bottom-aligned subtitles (1,2,3), top for top-aligned (7,8,9)
    # Fall back to vertical for backward compatibility or center-aligned (4,5,6)
    if alignment in [1, 2, 3]:  # Bottom-aligned
        margin_vertical = int(round(style_config.margin.bottom if hasattr(style_config.margin, 'bottom') else style_config.margin.vertical))
    elif alignment in [7, 8, 9]:  # Top-aligned
        margin_vertical = int(round(style_config.margin.top if hasattr(style_config.margin, 'top') else style_config.margin.vertical))
    else:  # Center or fallback
        margin_vertical = int(round(style_config.margin.vertical))
    
    # V4+ Style line format (complete ASS specification)
    style_header = "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding"
    
    # Create the main style with all ASS fields - use font_name instead of font_path
    main_style = f"Style: Default,{font_name},{ass_font_size},{primary_color},{secondary_color},{outline_color},{back_color},{bold},{italic},{underline},{strikeout},{scale_x},{scale_y},{spacing},{angle},{border_style},{outline},{shadow},{alignment},{margin_left},{margin_right},{margin_vertical},1"
    
    # Log the generated style for debugging
    logger.info(f"Generated ASS style: {main_style}")
    logger.info(f"Video resolution (target): {video_width}x{video_height}, PlayRes baseline: 1280x720")
    logger.info(f"Font size: Config {style_config.fontSize} -> ASS {ass_font_size}")
    logger.info(f"Resolved font family for ASS: {font_name}")
    logger.info(f"Colors - Primary: {primary_color}, Outline: {outline_color}, Background: {back_color}")
    logger.info(f"Border style: {border_style} ({'Background box' if border_style == 3 else 'Outline + Shadow'})")
    logger.info(f"Outline thickness: {outline}, Shadow: {shadow}")
    
    # Events line format
    events_header = "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"
    
    # Create dialogue lines
    dialogue_lines = []
    RLE = "\u202B"  # Right-to-Left Embedding
    PDF = "\u202C"  # Pop Directional Formatting
    for sub in subtitles:
        start_time = _to_ass_time(sub.start_time)
        end_time = _to_ass_time(sub.end_time)
        
        # Use translation if available, otherwise use original text
        text = sub.translation if sub.translation else sub.text
        if text:
            # Escape text for ASS format and handle line breaks
            # Wrap with bidi embedding marks first (they are control chars, not rendered)
            text_wrapped = f"{RLE}{text}{PDF}"
            text = text_wrapped.replace('\n', '\\N').replace('{', '\\{').replace('}', '\\}')
            dialogue_lines.append(f"Dialogue: 0,{start_time},{end_time},Default,,0,0,0,,{text}")
    
    # Assemble the full ASS file content with fixed PlayRes baseline (1280x720)
    ass_content = f"""[Script Info]
Title: Torgman Generated Subtitles
ScriptType: v4.00+
WrapStyle: 0
PlayResX: 1280
PlayResY: 720
ScaledBorderAndShadow: yes

[V4+ Styles]
{style_header}
{main_style}

[Events]
{events_header}
{chr(10).join(dialogue_lines)}
"""

    logger.info(f"Generated ASS file with {len(dialogue_lines)} dialogue lines for {video_width}x{video_height} resolution")
    return ass_content.strip()

def get_video_resolution(video_path: str) -> tuple[int, int]:
    """
    Get video resolution using ffprobe.
    Returns (width, height) tuple, defaults to (1280, 720) if detection fails.
    """
    import subprocess
    import json
    
    try:
        # Use ffprobe to get video information
        cmd = [
            'ffprobe', '-v', 'quiet', '-print_format', 'json', '-show_streams',
            '-select_streams', 'v:0', video_path
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        
        if result.returncode == 0:
            data = json.loads(result.stdout)
            if 'streams' in data and len(data['streams']) > 0:
                stream = data['streams'][0]
                width = int(stream.get('width', 1280))
                height = int(stream.get('height', 720))
                logger.info(f"Detected video resolution: {width}x{height}")
                return width, height
                
    except Exception as e:
        logger.warning(f"Could not detect video resolution from {video_path}: {e}")
    
    # Default to 720p if detection fails
    logger.info("Using default resolution: 1280x720")
    return 1280, 720

def save_ass_file(project_id: str, subtitles: List[CaptionData], style_config: SubtitleConfig, video_width: int = None, video_height: int = None) -> Path:
    """Save ASS subtitle file for a project with proper resolution matching"""
    project_dir = settings.get_project_dir(project_id)
    ass_path = project_dir / "subtitles.ass"
    
    # If resolution not provided, try to detect from video file
    if video_width is None or video_height is None:
        video_file = None
        # Look for video file in project directory
        for ext in ['.mp4', '.mkv', '.avi', '.mov', '.webm']:
            potential_video = project_dir / f"{project_id}_video{ext}"
            if potential_video.exists():
                video_file = str(potential_video)
                break
        
        if video_file:
            video_width, video_height = get_video_resolution(video_file)
        else:
            # Default to 720p
            video_width, video_height = 1280, 720
            logger.info("Video file not found, using default 720p resolution")
    
    ass_content = create_ass_content(subtitles, style_config, video_width, video_height)
    
    with open(ass_path, 'w', encoding='utf-8') as f:
        f.write(ass_content)
    
    logger.info(f"ASS subtitles saved successfully: {ass_path} (Resolution: {video_width}x{video_height})")
    return ass_path
        
